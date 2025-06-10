import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
const EXACT_JSON_DATA = {
    aiButtonCSS: "tii-aiw-button.hydrated",
};
let globalScraperInstance = null;
let globalLoggedInPage = null;
let isSessionActive = false;
async function getOrCreateScraperSession() {
    if (globalScraperInstance && globalLoggedInPage && isSessionActive) {
        console.log('🔄 Reutilizando sesión existente del navegador...');
        try {
            await globalLoggedInPage.evaluate(() => document.title);
            if (!globalLoggedInPage.url().includes('inbox')) {
                console.log('🔄 Navegando de vuelta a la bandeja de entrada...');
                await globalLoggedInPage.goto('https://www.turnitin.com/inbox', { waitUntil: 'networkidle2', timeout: 30000 });
                console.log('🔐 Por favor, asegúrate de estar en la bandeja de entrada correcta y presiona ENTER en la consola si se te solicita.');
            }
            return { scraper: globalScraperInstance, inboxPage: globalLoggedInPage };
        }
        catch (error) {
            console.log('⚠️ La sesión existente no es válida, creando nueva...');
            isSessionActive = false;
            globalScraperInstance = null;
            globalLoggedInPage = null;
        }
    }
    console.log('🆕 Creando nueva sesión de navegador...');
    const scraper = new ImprovedTurnitinScraperService(true);
    await scraper.initializeBrowser();
    const page = await scraper.createNewPage();
    try {
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: scraper.getDownloadPath()
        });
        console.log('✅ Carpeta de descarga configurada');
    }
    catch (cdpError) {
        console.warn(`⚠️ Error CDP: ${cdpError.message}`);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const loggedInPage = await navigateToInboxAndLogin(scraper, page, rl);
    rl.close();
    if (!loggedInPage) {
        throw new Error('No se pudo completar el login');
    }
    globalScraperInstance = scraper;
    globalLoggedInPage = loggedInPage;
    isSessionActive = true;
    console.log('✅ Nueva sesión establecida y guardada globalmente');
    return { scraper, inboxPage: loggedInPage };
}
export async function coordinateBasedDownloader(invokedTargetWorkTitle, invokedSubmissionId) {
    let targetWorkTitle = invokedTargetWorkTitle || "";
    let submissionId = invokedSubmissionId || "";
    try {
        console.log('🎯 DESCARGADOR BASADO EN COORDENADAS');
        console.log('===================================');
        console.log('');
        const { scraper, inboxPage } = await getOrCreateScraperSession();
        let currentPage = inboxPage;
        const projectDownloadPath = scraper.getDownloadPath();
        console.log(`✅ Sesión lista en la bandeja de entrada: ${currentPage.url()}`);
        if (!submissionId && !targetWorkTitle) {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const askQuestion = (question) => new Promise((resolve) => rl.question(question, resolve));
            console.log('Puedes usar cualquiera de las dos opciones para encontrar el trabajo:');
            submissionId = await askQuestion('📋 Introduce el Submission ID (visible en la bandeja de entrada, ej: 2696113910) [RECOMENDADO]: ');
            if (!submissionId.trim()) {
                targetWorkTitle = await askQuestion('📄 O introduce el título exacto del trabajo (ej: Mi Ensayo Final.docx): ');
            }
            rl.close();
        }
        if (!submissionId.trim() && !targetWorkTitle.trim()) {
            const msg = '❌ Debes proporcionar el Submission ID o el título del trabajo. Abortando.';
            console.log(msg);
            return { success: false, message: msg };
        }
        const searchCriteria = submissionId.trim() ? submissionId.trim() : targetWorkTitle.trim();
        const searchType = submissionId.trim() ? 'Submission ID' : 'título';
        console.log(`👍 Estrategia de búsqueda: Por ${searchType}: "${searchCriteria}"`);
        await closeExistingDocumentWindows(inboxPage);
        const aiReportPageInstance = await findWorkAndOpenAIReport(scraper, currentPage, searchCriteria, searchType, projectDownloadPath);
        if (!aiReportPageInstance) {
            const msg = `❌ No se llegó a la página del reporte de IA para el ${searchType} "${searchCriteria}".`;
            console.log(msg);
            return { success: false, message: msg };
        }
        currentPage = aiReportPageInstance;
        console.log(`✅ En la página del reporte de IA: ${currentPage.url()}`);
        await waitForCompletePageLoad(currentPage);
        await visualDownloadStrategy(currentPage, projectDownloadPath);
        let downloadedFilePath;
        if (searchType === 'Submission ID') {
            downloadedFilePath = await detectAndConfirmDownloadById(projectDownloadPath, searchCriteria);
        }
        else {
            downloadedFilePath = await detectAndConfirmDownload(projectDownloadPath, searchCriteria);
        }
        if (downloadedFilePath) {
            const msg = `✅ Descarga confirmada: ${downloadedFilePath}`;
            console.log(msg);
            console.log('🔄 Navegando de vuelta a la bandeja de entrada para futuras descargas...');
            await scraper.navigateToTurnitinInbox(globalLoggedInPage);
            console.log('🔓 Sesión mantenida para futuras descargas...');
            return { success: true, message: msg, filePath: downloadedFilePath };
        }
        else {
            const msg = '❌ No se pudo confirmar la descarga del archivo.';
            console.log(msg);
            try {
                await scraper.navigateToTurnitinInbox(globalLoggedInPage);
            }
            catch (navError) {
                console.warn('⚠️ Error navegando de vuelta a la bandeja de entrada:', navError);
            }
            console.log('🔓 Sesión mantenida a pesar del error...');
            return { success: false, message: msg };
        }
    }
    catch (error) {
        const errorMsg = `❌ ERROR GENERAL: ${error.message}`;
        console.error(errorMsg);
        if (error.stack)
            console.error(error.stack);
        if (globalLoggedInPage && isSessionActive) {
            try {
                await globalScraperInstance?.navigateToTurnitinInbox(globalLoggedInPage);
                console.log('🔄 Navegado de vuelta a la bandeja de entrada después del error');
            }
            catch (navError) {
                console.warn('⚠️ Error navegando de vuelta después del error principal:', navError);
                isSessionActive = false;
            }
        }
        console.log('🔓 Sesión mantenida a pesar del error...');
        return { success: false, message: errorMsg };
    }
    finally {
        console.log('ℹ️ Navegador y sesión mantenidos para reutilización.');
    }
}
export async function closeBrowserSession() {
    if (globalScraperInstance) {
        console.log('🔒 Cerrando sesión global del navegador...');
        await globalScraperInstance.closeBrowser();
        globalScraperInstance = null;
        globalLoggedInPage = null;
        isSessionActive = false;
        console.log('✅ Sesión cerrada');
    }
}
async function closeExistingDocumentWindows(mainPage) {
    console.log('🧹 Cerrando pestañas de documentos anteriores...');
    const browser = mainPage.browser();
    const allPages = await browser.pages();
    let closedCount = 0;
    for (const page of allPages) {
        if (page === mainPage || page === globalLoggedInPage) {
            continue;
        }
        const url = page.url();
        if (url.includes('ev.turnitin.com/app/carta') || url.includes('integrity.turnitin.com')) {
            try {
                console.log(`   📄 Cerrando pestaña: ${url}`);
                await page.close();
                closedCount++;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                console.warn(`   ⚠️ No se pudo cerrar la pestaña ${url}: ${error instanceof Error ? error.message : error}`);
            }
        }
    }
    if (closedCount > 0) {
        console.log(`✅ ${closedCount} pestaña(s) de documentos anteriores cerrada(s).`);
    }
    else {
        console.log('ℹ️ No se encontraron pestañas de documentos anteriores para cerrar.');
    }
}
async function navigateToInboxAndLogin(scraper, page, rlInstance) {
    const askLoginQuestion = (question) => new Promise((resolve) => rlInstance.question(question, resolve));
    try {
        console.log('🌐 Iniciando proceso de login y navegación...');
        await scraper.navigateToTurnitinInbox(page);
        console.log('');
        console.log('⚠️  PASOS MANUALES REQUERIDOS:');
        console.log('   1️⃣ En el navegador que se abrió (si está oculto, el script espera), haz login en Turnitin.');
        console.log('   2️⃣ Navega a tu BANDEJA DE ENTRADA de la clase específica.');
        console.log('      La URL debería ser similar a:');
        console.log('      https://www.turnitin.com/assignment/type/paper/inbox/NUMERO_CLASE');
        console.log('      (Ejemplo: https://www.turnitin.com/assignment/type/paper/inbox/170792714)');
        console.log('   3️⃣ Una vez en la bandeja de entrada correcta, presiona ENTER aquí en la consola.');
        console.log('');
        await askLoginQuestion('Presiona ENTER después de completar el login y navegar a la bandeja de entrada específica: ');
        console.log('🔄 Verificando estado post-login...');
        await scraper.navigateToTurnitinInbox(page);
        if (page.url().includes('login')) {
            console.log('❌ Sigue en la página de login después de presionar ENTER. Verifica el inicio de sesión.');
            return null;
        }
        console.log('✅ En la bandeja de entrada de Turnitin.');
        return page;
    }
    catch (error) {
        console.error(`❌ Error en navigateToInboxAndLogin: ${error.message}`);
        return null;
    }
    finally {
    }
}
async function findWorkAndOpenAIReport(scraper, page, searchCriteria, searchType, projectDownloadPath) {
    try {
        console.log(`🎯 Buscando trabajo por ${searchType}: "${searchCriteria}" en la bandeja de entrada.`);
        let foundAndClicked = false;
        if (searchType === 'Submission ID') {
            console.log(`   ℹ️ ESTRATEGIA: Buscando el Submission ID "${searchCriteria}" como texto visible en la lista de la bandeja de entrada.`);
            console.log(`   ℹ️ (Asegúrate que tu ImprovedTurnitinScraperService tenga el método 'findAndClickOnSubmissionById')`);
            foundAndClicked = await scraper.findAndClickOnSubmissionById(page, searchCriteria);
        }
        else {
            console.log(`   ℹ️ ESTRATEGIA: Buscando por título del documento "${searchCriteria}" en la bandeja de entrada.`);
            foundAndClicked = await scraper.findAndClickOnSubmission(page, searchCriteria);
        }
        if (!foundAndClicked) {
            console.log(`🔍 DEBUG: No se pudo encontrar o hacer clic en el trabajo con ${searchType}: "${searchCriteria}"`);
            if (searchType === 'Submission ID') {
                console.log(`   💡 TIP (Submission ID): Verifica que el ID "${searchCriteria}" sea exactamente el que aparece en la columna "Submission ID" de la bandeja de entrada.`);
            }
            else {
                console.log(`   💡 TIP (Título): Verifica que el título "${searchCriteria}" sea exacto, incluyendo la extensión del archivo (ej: .docx, .pdf).`);
            }
            const debugScreenshotPath = path.join(projectDownloadPath, `debug_inbox_search_failed_${searchType.replace(' ', '_')}_${Date.now()}.png`);
            try {
                await page.screenshot({ path: debugScreenshotPath });
                console.log(`📸 Screenshot del inbox (fallo de búsqueda) guardado en: ${debugScreenshotPath}`);
            }
            catch (ssError) {
                console.warn(`⚠️ No se pudo tomar screenshot de debug: ${ssError}`);
            }
            throw new Error(`No se pudo encontrar o hacer clic en el trabajo con ${searchType}: "${searchCriteria}"`);
        }
        console.log(`✅ Clic exitoso en trabajo con ${searchType}: "${searchCriteria}"`);
        const browser = page.browser();
        let cartaPage;
        console.log('⏳ Esperando que se abra la página del visor de documentos (Carta)...');
        await page.waitForTimeout(8000);
        let pages = await browser.pages();
        cartaPage = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
        if (!cartaPage) {
            console.log('⚠️ Página de Carta no encontrada inmediatamente, intentando de nuevo...');
            await page.waitForTimeout(10000);
            pages = await browser.pages();
            cartaPage = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
        }
        if (!cartaPage) {
            if (page.url().includes('ev.turnitin.com/app/carta')) {
                cartaPage = page;
                console.log('📄 Ventana actual es la página de Carta.');
            }
            else {
                console.log('❌ Página de Carta no encontrada. Páginas actuales:');
                pages.forEach((p, idx) => console.log(`   ${idx + 1}: ${p.url()}`));
                throw new Error('Página de Carta (visor de documentos) no encontrada después de hacer clic en el trabajo.');
            }
        }
        const cartaUrl = cartaPage.url();
        const urlSubmissionId = cartaUrl.match(/[?&]o=(\d+)/)?.[1];
        if (urlSubmissionId) {
            console.log(`ℹ️ ID del documento en URL (parámetro 'o'): ${urlSubmissionId}`);
            if (searchType === 'Submission ID' && urlSubmissionId !== searchCriteria) {
                console.log(`⚠️ ADVERTENCIA: El ID del documento en la URL (${urlSubmissionId}) no coincide con el Submission ID buscado (${searchCriteria}).`);
                console.log(`   Esto podría indicar que se hizo clic en el trabajo incorrecto, o que hay una discrepancia en los IDs.`);
                console.log(`   URL actual de Carta: ${cartaUrl}`);
            }
            else if (searchType === 'Submission ID' && urlSubmissionId === searchCriteria) {
                console.log(`✅ ID del documento en URL verificado y coincide con el Submission ID buscado.`);
            }
        }
        else {
            console.log(`⚠️ No se pudo extraer el ID del documento (parámetro 'o') de la URL de Carta: ${cartaUrl}`);
        }
        console.log(`🪟 Ventana correcta del reporte detectada: ${cartaPage.url()}`);
        await cartaPage.bringToFront();
        await cartaPage.waitForTimeout(5000);
        console.log('🤖 Haciendo clic en botón de IA...');
        const aiButton = await cartaPage.$(EXACT_JSON_DATA.aiButtonCSS);
        if (!aiButton) {
            const debugPath = path.join(projectDownloadPath, `debug_carta_page_no_ai_button_${Date.now()}.png`);
            try {
                await cartaPage.screenshot({ path: debugPath });
                console.log(`📸 Screenshot de debug (sin botón IA) guardado en ${debugPath}`);
            }
            catch (e) { }
            throw new Error('No se encontró el botón de IA en la página de Carta.');
        }
        const newPagePromiseAfterAIClick = new Promise(resolve => {
            browser.once('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const newP = await target.page();
                    if (newP) {
                        console.log(`🌟 Nueva pestaña abierta por clic en IA: ${newP.url()}`);
                        resolve(newP);
                    }
                    else {
                        resolve(null);
                    }
                }
                else {
                    resolve(null);
                }
            });
            setTimeout(() => {
                console.log('⏱️ Timeout esperando nueva pestaña después de clic en IA.');
                resolve(null);
            }, 20000);
        });
        await aiButton.click();
        console.log('✅ Clic en IA realizado');
        let aiReportTargetPage = await newPagePromiseAfterAIClick;
        if (!aiReportTargetPage) {
            console.log('⚠️ No se detectó una nueva pestaña. Verificando páginas existentes para el reporte de IA...');
            await cartaPage.waitForTimeout(12000);
            if (cartaPage.url().includes('integrity.turnitin.com')) {
                console.log('📄 Página de Carta navegó a la página del reporte de IA.');
                aiReportTargetPage = cartaPage;
            }
            else {
                pages = await browser.pages();
                const integrityPage = pages.find(p => p.url().includes('integrity.turnitin.com'));
                if (integrityPage) {
                    console.log('📄 Página del reporte de IA encontrada entre las páginas existentes.');
                    aiReportTargetPage = integrityPage;
                }
                else {
                    console.log('❌ No se pudo determinar la página del reporte de IA. Páginas actuales:');
                    pages.forEach((p, idx) => console.log(`   ${idx + 1}: ${p.url()}`));
                    const debugPath = path.join(projectDownloadPath, `debug_no_ai_report_page_${Date.now()}.png`);
                    try {
                        await cartaPage.screenshot({ path: debugPath });
                        console.log(`📸 Screenshot de debug (sin pág. reporte IA) guardado en ${debugPath}`);
                    }
                    catch (e) { }
                    throw new Error('No se pudo encontrar la página del reporte de IA después del clic en el botón de IA.');
                }
            }
        }
        if (!aiReportTargetPage) {
            throw new Error('No se pudo obtener la página del reporte de IA.');
        }
        await aiReportTargetPage.bringToFront();
        console.log('⏳ Esperando que la página del reporte de IA cargue completamente...');
        await aiReportTargetPage.waitForTimeout(10000);
        if (aiReportTargetPage.url().includes('integrity.turnitin.com')) {
            console.log('✅ Llegamos a la página del reporte de IA.');
            return aiReportTargetPage;
        }
        else {
            throw new Error(`URL inesperada después de intentar abrir el reporte de IA: ${aiReportTargetPage.url()}`);
        }
    }
    catch (error) {
        console.error(`❌ Error en findWorkAndOpenAIReport: ${error.message}`);
        if (error.stack)
            console.error(error.stack);
        try {
            const debugPath = path.join(projectDownloadPath, `error_findWorkAndOpenAIReport_${Date.now()}.png`);
            if (page && typeof page.screenshot === 'function') {
                await page.screenshot({ path: debugPath });
                console.log(`📸 Screenshot de error guardado en ${debugPath}`);
            }
        }
        catch (ssError) {
            console.error(`Error al tomar screenshot de error: ${ssError.message}`);
        }
        return null;
    }
}
async function waitForCompletePageLoad(page) {
    console.log('\n⏳ ESPERANDO CARGA COMPLETA DE LA PÁGINA - VERSIÓN OPTIMIZADA');
    console.log('=============================================================');
    console.log('📡 Esperando estabilización de red (optimizado)...');
    for (let i = 0; i < 2; i++) {
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
            console.log(`✅ Red estable en intento ${i + 1}`);
            break;
        }
        catch (error) {
            console.log(`⚠️ Intento ${i + 1} de red falló, continuando...`);
            await page.waitForTimeout(3000);
        }
    }
    console.log('⏱️ Espera base (10 segundos)...');
    await page.waitForTimeout(10000);
    console.log('📐 Configurando viewport...');
    try {
        await page.setViewport({ width: 1366, height: 768 });
        const viewport = await page.viewport();
        console.log(`✅ Viewport configurado: ${viewport?.width}x${viewport?.height}`);
    }
    catch (error) {
        console.log(`⚠️ Error configurando viewport, continuando...`);
    }
    console.log('🎯 Verificando elementos clave...');
    const elementsToWaitFor = [
        'body',
        'tii-ai-writing-app'
    ];
    for (const selector of elementsToWaitFor) {
        try {
            await page.waitForSelector(selector, { visible: true, timeout: 5000 });
            console.log(`✅ ${selector} cargado`);
        }
        catch (error) {
            console.log(`⚠️ ${selector} no encontrado, continuando...`);
        }
    }
    console.log('⏱️ Espera final para renderizado (15 segundos)...');
    await page.waitForTimeout(15000);
    console.log('🔍 Verificando elementos en la página...');
    try {
        const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
        console.log(`📊 Total de elementos en DOM: ${elementCount}`);
        if (elementCount < 50) {
            console.log('⚠️ Pocos elementos detectados, esperando 10 segundos adicionales...');
            await page.waitForTimeout(10000);
        }
    }
    catch (error) {
        console.log('⚠️ Error verificando elementos, continuando...');
    }
    console.log('✅ Carga de página optimizada completada');
}
async function visualDownloadStrategy(page, projectDownloadPath) {
    console.log('\n🎨 ESTRATEGIA VISUAL DE DESCARGA OPTIMIZADA');
    console.log('===========================================');
    let viewport = await page.viewport();
    if (!viewport) {
        console.log('🔧 Configurando viewport...');
        await page.setViewport({ width: 1366, height: 768 });
        viewport = await page.viewport();
    }
    console.log(`📐 Viewport confirmado: ${viewport?.width}x${viewport?.height}`);
    const gridScreenshotsPath = path.join(projectDownloadPath, 'grid_screenshots');
    if (!fs.existsSync(gridScreenshotsPath)) {
        fs.mkdirSync(gridScreenshotsPath, { recursive: true });
    }
    console.log(`📸 Screenshots se guardarán en: ${gridScreenshotsPath}`);
    const click57_X = 1326;
    const click57_Y = 20;
    console.log(`🎯 EJECUTANDO CLIC PARA ABRIR MENÚ: (${click57_X}, ${click57_Y})`);
    try {
        await page.mouse.click(click57_X, click57_Y);
        console.log(`🖱️ Clic realizado. Esperando menú...`);
        await page.waitForTimeout(2000);
        const menuOpenScreenshot = path.join(gridScreenshotsPath, `menu_open_${Date.now()}.png`);
        await page.screenshot({ path: menuOpenScreenshot });
        console.log(`📸 Screenshot del menú: ${menuOpenScreenshot}`);
        let aiReportButtonX = 1155;
        let aiReportButtonY = 145;
        console.log(`🎯 Clic en "AI Writing Report": (${aiReportButtonX}, ${aiReportButtonY})`);
        await page.mouse.click(aiReportButtonX, aiReportButtonY);
        console.log(`✅ Clic en AI Writing Report realizado`);
        await page.waitForTimeout(3000);
        const finalClickScreenshot = path.join(projectDownloadPath, `ai_report_click_${Date.now()}.png`);
        await page.screenshot({ path: finalClickScreenshot });
        console.log(`📸 Screenshot post-clic: ${finalClickScreenshot}`);
        console.log('✅ Descarga iniciada. Esperando archivo...');
        await page.waitForTimeout(8000);
        return;
    }
    catch (error) {
        console.log(`⚠️ Error en descarga: ${error.message}`);
        const errorScreenshot = path.join(projectDownloadPath, `error_${Date.now()}.png`);
        try {
            await page.screenshot({ path: errorScreenshot });
            console.log(`📸 Screenshot de error: ${errorScreenshot}`);
        }
        catch (ssError) {
            console.log(`⚠️ Error tomando screenshot: ${ssError.message}`);
        }
    }
    console.log('❌ Descarga no completada.');
}
async function detectAndConfirmDownload(projectDownloadPath, targetWorkTitle) {
    console.log('\n🕵️ DETECTANDO DESCARGA OPTIMIZADA...');
    const downloadLocations = [
        projectDownloadPath,
        path.join(os.homedir(), 'Downloads'),
    ].filter(loc => fs.existsSync(loc));
    const baseTitle = targetWorkTitle.split('.')[0];
    const searchPatterns = [
        baseTitle.toLowerCase(),
        baseTitle.toLowerCase().replace(/ /g, '_'),
        baseTitle.toLowerCase().replace(/ /g, '-'),
        baseTitle.toLowerCase().replace(/[^\w]/g, ''),
    ];
    console.log(`   📋 Buscando: ${searchPatterns.slice(0, 2).join(', ')}...`);
    const totalAttempts = 6;
    const waitTimeBetweenAttempts = 3000;
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
        console.log(`--- Intento ${attempt}/${totalAttempts} ---`);
        for (const location of downloadLocations) {
            try {
                const files = fs.readdirSync(location);
                for (const file of files) {
                    const fileNameLower = file.toLowerCase();
                    if (!fileNameLower.endsWith('.pdf'))
                        continue;
                    try {
                        const filePath = path.join(location, file);
                        const stats = fs.statSync(filePath);
                        const isRecent = (Date.now() - stats.mtimeMs) < (5 * 60 * 1000);
                        if (isRecent) {
                            const matchFound = searchPatterns.some(pattern => fileNameLower.includes(pattern));
                            if (matchFound) {
                                console.log(`🎉 ¡DESCARGA ENCONTRADA!`);
                                console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
                                console.log(`   📂 ${location}`);
                                return filePath;
                            }
                            const titleWords = baseTitle.toLowerCase().split(/\s+/).filter(word => word.length > 2);
                            const wordMatches = titleWords.filter(word => fileNameLower.includes(word)).length;
                            if (titleWords.length > 0 && (wordMatches / titleWords.length) >= 0.6) {
                                console.log(`🎉 ¡DESCARGA ENCONTRADA POR PALABRAS!`);
                                console.log(`   📄 ${file} (${wordMatches}/${titleWords.length} coincidencias)`);
                                console.log(`   📂 ${location}`);
                                return filePath;
                            }
                        }
                    }
                    catch (statError) {
                    }
                }
            }
            catch (readDirError) {
            }
        }
        if (attempt < totalAttempts) {
            console.log(`   ⏱️ Esperando ${waitTimeBetweenAttempts / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTimeBetweenAttempts));
        }
    }
    console.log('\n📋 DEBUG - PDFs recientes:');
    for (const location of downloadLocations) {
        try {
            const files = fs.readdirSync(location);
            const recentPdfs = files.filter(file => {
                if (!file.toLowerCase().endsWith('.pdf'))
                    return false;
                try {
                    const filePath = path.join(location, file);
                    const stats = fs.statSync(filePath);
                    return (Date.now() - stats.mtimeMs) < (5 * 60 * 1000);
                }
                catch {
                    return false;
                }
            }).slice(0, 3);
            if (recentPdfs.length > 0) {
                console.log(`   📂 ${path.basename(location)}: ${recentPdfs.join(', ')}`);
            }
        }
        catch (error) {
        }
    }
    console.log('❌ Descarga no confirmada automáticamente.');
    return null;
}
async function detectAndConfirmDownloadById(projectDownloadPath, submissionId) {
    console.log('\n🕵️ DETECTANDO DESCARGA POR SUBMISSION ID...');
    const downloadLocations = [
        projectDownloadPath,
        path.join(os.homedir(), 'Downloads'),
    ].filter(loc => fs.existsSync(loc));
    console.log(`   📋 Buscando archivo PDF reciente (cualquier nombre) para Submission ID: ${submissionId}`);
    const totalAttempts = 6;
    const waitTimeBetweenAttempts = 3000;
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
        console.log(`--- Intento ${attempt}/${totalAttempts} ---`);
        for (const location of downloadLocations) {
            try {
                const files = fs.readdirSync(location);
                let mostRecentPdf = null;
                for (const file of files) {
                    const fileNameLower = file.toLowerCase();
                    if (!fileNameLower.endsWith('.pdf'))
                        continue;
                    try {
                        const filePath = path.join(location, file);
                        const stats = fs.statSync(filePath);
                        const isRecent = (Date.now() - stats.mtimeMs) < (5 * 60 * 1000);
                        if (isRecent) {
                            if (!mostRecentPdf || stats.mtimeMs > mostRecentPdf.mtime) {
                                mostRecentPdf = {
                                    file,
                                    filePath,
                                    mtime: stats.mtimeMs
                                };
                            }
                        }
                    }
                    catch (statError) {
                    }
                }
                if (mostRecentPdf) {
                    console.log(`🎉 ¡DESCARGA ENCONTRADA (PDF MÁS RECIENTE)!`);
                    console.log(`   📄 ${mostRecentPdf.file} (${((await fs.promises.stat(mostRecentPdf.filePath)).size / 1024).toFixed(1)} KB)`);
                    console.log(`   📂 ${location}`);
                    console.log(`   🕒 Modificado: ${new Date(mostRecentPdf.mtime).toLocaleString()}`);
                    return mostRecentPdf.filePath;
                }
            }
            catch (readDirError) {
            }
        }
        if (attempt < totalAttempts) {
            console.log(`   ⏱️ Esperando ${waitTimeBetweenAttempts / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTimeBetweenAttempts));
        }
    }
    console.log('❌ No se encontró ningún PDF reciente para el Submission ID.');
    return null;
}
if (require.main === module) {
    coordinateBasedDownloader().then(result => {
        console.log('\n--- Resultado Final del Script ---');
        console.log(`Éxito: ${result.success}`);
        console.log(`Mensaje: ${result.message}`);
        if (result.filePath) {
            console.log(`Archivo: ${result.filePath}`);
        }
        console.log('---------------------------------');
    }).catch(error => {
        console.error('\n--- ERROR INESPERADO EJECUTANDO SCRIPT ---');
        console.error(error);
        console.error('------------------------------------------');
    });
}
