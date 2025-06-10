"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const improved_turnitin_scraper_service_1 = require("../services/improved-turnitin-scraper.service");
const readline = __importStar(require("readline"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const EXACT_JSON_DATA = {
    workTitle: "LA LECTURA.docx",
    aiButtonCSS: "tii-aiw-button.hydrated",
    expectedFinalUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
};
const AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR = '//*[@id="download-popover"]/ul/li/button';
const IS_XPATH_SELECTOR = true;
const POPOVER_OPENER_SELECTOR = "//tii-sws-header-btn[.//tdl-icon[@icon-name='download']]//button | //tii-sws-header-btn[.//tdl-icon[@icon-name='download']] | //tii-sws-download-btn-mfe//button | //tii-sws-download-btn-mfe";
const IS_POPOVER_OPENER_XPATH = true;
async function fullyAutomatedAIDownload() {
    const scraper = new improved_turnitin_scraper_service_1.ImprovedTurnitinScraperService(true);
    const mainRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const mainAskQuestion = (question) => new Promise((resolve) => mainRl.question(question, resolve));
    let currentPage = null;
    const projectDownloadPath = scraper.getDownloadPath();
    try {
        console.log('🚀 INICIANDO DESCARGA TOTALMENTE AUTOMATIZADA DE REPORTE DE IA');
        await scraper.initializeBrowser();
        currentPage = await scraper.createNewPage();
        console.log(`📁 Configurando descarga en: ${projectDownloadPath}`);
        try {
            const client = await currentPage.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: projectDownloadPath
            });
            console.log('✅ Carpeta de descarga configurada en el navegador');
        }
        catch (cdpError) {
            console.warn(`⚠️ No se pudo configurar la carpeta de descarga vía CDP: ${cdpError.message}.`);
        }
        const aiReportPageInstance = await navigateToAIReportPage(scraper, currentPage, mainAskQuestion);
        if (!aiReportPageInstance) {
            console.log('❌ No se pudo obtener la instancia de la página del reporte de IA.');
            return;
        }
        currentPage = aiReportPageInstance;
        console.log(`✅ Navegación exitosa a la página del reporte de IA: ${currentPage.url()}`);
        console.log('⏳ Esperando carga completa de la página del reporte de IA (30 segundos)...');
        await currentPage.waitForTimeout(30000);
        let downloadActionSuccessful = false;
        let attempt = 1;
        const maxAttempts = 2;
        while (attempt <= maxAttempts && !downloadActionSuccessful) {
            console.log(`\n🔎 Intento ${attempt} de ${maxAttempts} para encontrar y hacer clic en el botón de descarga.`);
            let popoverOpener = null;
            if (POPOVER_OPENER_SELECTOR) {
                try {
                    console.log(`🤖 Buscando botón para abrir popover con selector: ${POPOVER_OPENER_SELECTOR}`);
                    if (IS_POPOVER_OPENER_XPATH) {
                        await currentPage.waitForXPath(POPOVER_OPENER_SELECTOR, { timeout: 20000, visible: true });
                        const openers = await currentPage.$x(POPOVER_OPENER_SELECTOR);
                        if (openers.length > 0) {
                            popoverOpener = openers[0];
                            console.log(`✅ Botón para abrir popover encontrado con XPath (se encontró ${openers.length} coincidencia(s)).`);
                        }
                        else {
                            console.log('⚠️ No se encontró el botón para abrir el popover con el XPath proporcionado (openers.length es 0).');
                        }
                    }
                    else {
                        await currentPage.waitForSelector(POPOVER_OPENER_SELECTOR, { timeout: 20000, visible: true });
                        popoverOpener = await currentPage.$(POPOVER_OPENER_SELECTOR);
                        if (popoverOpener) {
                            console.log('✅ Botón para abrir popover encontrado con CSS selector.');
                        }
                        else {
                            console.log('⚠️ No se encontró el botón para abrir el popover con el CSS selector proporcionado.');
                        }
                    }
                    if (popoverOpener) {
                        console.log('✅ Botón para abrir popover listo. Haciendo clic...');
                        await currentPage.evaluate(el => el.click(), popoverOpener);
                        console.log('🖱️ Clic en abridor de popover realizado. Esperando que aparezca el popover y el botón final (10 segundos)...');
                        try {
                            await currentPage.waitForXPath(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
                            console.log('✅ Popover parece estar abierto y el botón de descarga final está visible.');
                        }
                        catch (popoverWaitError) {
                            console.warn(`🔶 Popover o botón de descarga final no se hizo visible después del clic en el abridor: ${popoverWaitError.message}`);
                            const popoverErrorPath = path_1.default.join(projectDownloadPath, `error_popover_not_visible_attempt_${attempt}_${Date.now()}.png`);
                            if (currentPage)
                                await currentPage.screenshot({ path: popoverErrorPath });
                            console.log(`📸 Screenshot de error de popover guardado en: ${popoverErrorPath}`);
                        }
                    }
                    else {
                    }
                }
                catch (e) {
                    console.log(`🔶 Error al intentar encontrar/abrir popover: ${e.message}`);
                    const openerErrorPath = path_1.default.join(projectDownloadPath, `error_popover_opener_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage)
                        await currentPage.screenshot({ path: openerErrorPath });
                    console.log(`📸 Screenshot de error de abridor de popover guardado en: ${openerErrorPath}`);
                }
            }
            else {
                console.log("ℹ️ No se ha configurado un selector para abrir popover (POPOVER_OPENER_SELECTOR está vacío), se buscará el botón de descarga directamente.");
            }
            let downloadButton = null;
            console.log(`🤖 Buscando botón de descarga final con XPath: ${AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR}`);
            try {
                await currentPage.waitForXPath(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR, { visible: true, timeout: 20000 });
                const elements = await currentPage.$x(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR);
                if (elements.length > 0) {
                    downloadButton = elements[0];
                }
            }
            catch (e) {
                console.log(`❌ Error esperando el XPath del botón de descarga final: ${e.message}`);
            }
            if (downloadButton) {
                console.log('✅ Botón de descarga final encontrado y visible. Haciendo clic...');
                try {
                    await currentPage.evaluate(el => el.click(), downloadButton);
                    console.log('🖱️ Clic realizado en el botón de descarga final. Esperando inicio de descarga (20 segundos)...');
                    await currentPage.waitForTimeout(20000);
                    downloadActionSuccessful = true;
                }
                catch (clickError) {
                    console.error(`❌ Error al hacer clic en el botón de descarga final: ${clickError.message}`);
                    const clickErrorScreenshotPath = path_1.default.join(projectDownloadPath, `error_click_download_btn_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage)
                        await currentPage.screenshot({ path: clickErrorScreenshotPath });
                    console.log(`📸 Screenshot de error de clic guardado en: ${clickErrorScreenshotPath}`);
                }
            }
            else {
                console.log(`❌ No se encontró el botón de descarga final en el intento ${attempt}.`);
                const notFoundScreenshotPath = path_1.default.join(projectDownloadPath, `error_btn_not_found_attempt_${attempt}_${Date.now()}.png`);
                if (currentPage)
                    await currentPage.screenshot({ path: notFoundScreenshotPath });
                console.log(`📸 Screenshot de "no encontrado" guardado en: ${notFoundScreenshotPath}`);
            }
            if (!downloadActionSuccessful && attempt < maxAttempts) {
                console.log('🔄 Refrescando página y esperando antes del siguiente intento...');
                try {
                    if (currentPage) {
                        await currentPage.reload({ waitUntil: ["networkidle0", "domcontentloaded"], timeout: 60000 });
                        console.log('⏳ Esperando después del refresco (30 segundos)...');
                        await currentPage.waitForTimeout(30000);
                    }
                    else {
                        console.error("❌ No se puede refrescar, la página actual es nula.");
                        break;
                    }
                }
                catch (reloadError) {
                    console.error(`❌ Error durante el refresco de página: ${reloadError.message}`);
                    const reloadErrorPath = path_1.default.join(projectDownloadPath, `error_reload_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage)
                        await currentPage.screenshot({ path: reloadErrorPath });
                    console.log(`📸 Screenshot de error de refresco guardado en: ${reloadErrorPath}`);
                    break;
                }
            }
            attempt++;
        }
        if (!downloadActionSuccessful) {
            console.log('❌❌ No se pudo hacer clic en el botón de descarga después de todos los intentos.');
        }
        await detectAndConfirmDownload(projectDownloadPath);
    }
    catch (error) {
        console.error(`❌ ERROR FATAL: ${error.message}`);
        if (currentPage) {
            const fatalErrorScreenshotPath = path_1.default.join(projectDownloadPath, `fatal_error_screenshot_${Date.now()}.png`);
            try {
                await currentPage.screenshot({ path: fatalErrorScreenshotPath });
                console.log(`📸 Screenshot de error fatal guardado en: ${fatalErrorScreenshotPath}`);
            }
            catch (screenshotError) {
                console.error(`No se pudo tomar screenshot del error fatal: ${screenshotError.message}`);
            }
        }
        if (error.stack)
            console.error(error.stack);
    }
    finally {
        console.log('\nPresiona ENTER para cerrar...');
        await mainAskQuestion('');
        if (scraper)
            await scraper.closeBrowser();
        mainRl.close();
    }
}
async function navigateToAIReportPage(scraper, page, _mainAskQuestion) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (question) => new Promise((resolve) => {
        try {
            rl.question(question, resolve);
        }
        catch (e) {
            console.warn(`Readline question error: ${e.message}. Resolving with empty string.`);
            resolve('');
        }
    });
    try {
        await scraper.navigateToTurnitinInbox(page);
        if (page.url().includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        console.log(`🎯 Buscando trabajo: "${EXACT_JSON_DATA.workTitle}"`);
        if (!await scraper.findAndClickOnSubmission(page, EXACT_JSON_DATA.workTitle)) {
            throw new Error('No se pudo abrir el trabajo');
        }
        const browser = page.browser();
        let targetPage = null;
        const newPagePromise = new Promise(resolve => browser.once('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPageCandidate = await target.page();
                resolve(newPageCandidate);
            }
            else {
                resolve(null);
            }
        }));
        let pages = await browser.pages();
        let cartaPage = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
        if (!cartaPage) {
            await page.waitForTimeout(3000);
            pages = await browser.pages();
            cartaPage = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
        }
        if (!cartaPage) {
            throw new Error('Página de Carta no encontrada después de múltiples intentos.');
        }
        console.log(`✅ Página de Carta encontrada/confirmada: ${cartaPage.url()}`);
        await cartaPage.bringToFront();
        await cartaPage.waitForTimeout(5000);
        console.log('🤖 Haciendo clic en botón de IA...');
        const aiButton = await cartaPage.$(EXACT_JSON_DATA.aiButtonCSS);
        if (!aiButton) {
            throw new Error('No se encontró el botón de IA en la página de Carta');
        }
        await aiButton.click();
        console.log('✅ Clic en IA realizado');
        try {
            targetPage = await Promise.race([
                newPagePromise,
                new Promise(resolve => setTimeout(() => {
                    resolve(cartaPage);
                }, 10000))
            ]);
        }
        catch (e) {
            console.warn("Error esperando nueva página, se usará la página de carta actual", e);
            targetPage = cartaPage;
        }
        if (!targetPage) {
            console.log("No se pudo determinar la página objetivo, usando cartaPage como fallback.");
            targetPage = cartaPage;
        }
        await targetPage.bringToFront();
        await targetPage.waitForTimeout(12000);
        const finalUrl = targetPage.url();
        console.log(`📍 URL después del clic en IA: ${finalUrl}`);
        if (finalUrl.includes('integrity.turnitin.com')) {
            console.log('✅ Llegamos a la página del reporte de IA.');
            return targetPage;
        }
        else {
            pages = await browser.pages();
            const integrityPage = pages.find(p => p.url().includes('integrity.turnitin.com'));
            if (integrityPage) {
                console.log(`✅ Encontrada página de integridad en segundo plano: ${integrityPage.url()}`);
                await integrityPage.bringToFront();
                await integrityPage.waitForTimeout(5000);
                return integrityPage;
            }
            throw new Error(`URL inesperada después del clic en IA: ${finalUrl}. Se esperaba "integrity.turnitin.com"`);
        }
    }
    finally {
        if (rl) {
            rl.close();
        }
    }
}
async function detectAndConfirmDownload(projectDownloadPath) {
    console.log('\n🕵️ DETECTANDO Y CONFIRMANDO DESCARGA...');
    console.log('========================================');
    const downloadLocations = [
        projectDownloadPath,
        path_1.default.join(os_1.default.homedir(), 'Downloads'),
    ].filter(loc => fs_1.default.existsSync(loc));
    console.log('📁 Verificando en las siguientes ubicaciones:');
    downloadLocations.forEach(loc => console.log(`   - ${loc}`));
    const expectedFileBaseName = EXACT_JSON_DATA.workTitle.split('.')[0].toLowerCase();
    let downloadConfirmed = false;
    const maxAttempts = 4;
    const attemptDelay = 7000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\n--- Intento de detección ${attempt} de ${maxAttempts} ---`);
        for (const location of downloadLocations) {
            if (!fs_1.default.existsSync(location))
                continue;
            const filesInLocation = fs_1.default.readdirSync(location);
            for (const file of filesInLocation) {
                const filePath = path_1.default.join(location, file);
                const fileNameLower = file.toLowerCase();
                if (!fileNameLower.endsWith('.pdf'))
                    continue;
                try {
                    const stats = fs_1.default.statSync(filePath);
                    const isRecent = (Date.now() - stats.mtimeMs) < (15 * 60 * 1000);
                    if (fileNameLower.includes(expectedFileBaseName) && isRecent) {
                        console.log(`🎉 ¡DESCARGA CONFIRMADA!`);
                        console.log(`   Archivo: ${file}`);
                        console.log(`   Ubicación: ${location}`);
                        console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
                        console.log(`   Modificado: ${stats.mtime.toLocaleString()}`);
                        const safeOriginalFileName = file.replace(/[^a-zA-Z0-9_.-]/g, '_');
                        const finalFileName = `AI_Report_${EXACT_JSON_DATA.workTitle.split('.')[0]}_${new Date().toISOString().replace(/[:.]/g, '-')}_${safeOriginalFileName}`;
                        const destPath = path_1.default.join(projectDownloadPath, finalFileName);
                        if (path_1.default.resolve(filePath) !== path_1.default.resolve(destPath)) {
                            if (fs_1.default.existsSync(destPath) && fs_1.default.statSync(destPath).size === stats.size) {
                                console.log(`   ℹ️  Un archivo idéntico ya existe en temp-downloads: ${finalFileName}`);
                            }
                            else {
                                fs_1.default.copyFileSync(filePath, destPath);
                                console.log(`   ✅ COPIADO a temp-downloads como: ${finalFileName}`);
                            }
                        }
                        else {
                            console.log(`   ℹ️  El archivo ya está en la carpeta de destino del proyecto (temp-downloads).`);
                        }
                        downloadConfirmed = true;
                        break;
                    }
                }
                catch (statError) {
                    if (statError.code !== 'ENOENT') {
                        console.warn(`   ⚠️ No se pudo obtener info de ${file}: ${statError.message}`);
                    }
                }
            }
            if (downloadConfirmed)
                break;
        }
        if (downloadConfirmed)
            break;
        if (attempt < maxAttempts) {
            console.log(`   ...no se encontró el archivo aún, esperando ${attemptDelay / 1000}s para el siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, attemptDelay));
        }
    }
    if (!downloadConfirmed) {
        console.log('\n❌ No se pudo confirmar la descarga del archivo PDF esperado después de varios intentos.');
        console.log('   Por favor, verifica manualmente las carpetas de descarga.');
    }
    return downloadConfirmed;
}
if (require.main === module) {
    fullyAutomatedAIDownload();
}
