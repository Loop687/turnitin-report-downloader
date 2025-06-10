import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { Page, ElementHandle } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';

const EXACT_JSON_DATA = {
    workTitle: "LA LECTURA.docx",
    aiButtonCSS: "tii-aiw-button.hydrated", // Este es para ir a la página del reporte de IA
    expectedFinalUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
};

// XPath para el botón de descarga DENTRO del popover en la página del reporte de IA
const AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR = '//*[@id="download-popover"]/ul/li/button';
const IS_XPATH_SELECTOR = true; // Este es un XPath

// Selector para el botón que ABRIRÍA el popover de descarga (el ícono de descarga principal).
const POPOVER_OPENER_SELECTOR = "//tii-sws-header-btn[.//tdl-icon[@icon-name='download']]//button | //tii-sws-header-btn[.//tdl-icon[@icon-name='download']] | //tii-sws-download-btn-mfe//button | //tii-sws-download-btn-mfe";
const IS_POPOVER_OPENER_XPATH = true; // Este es un XPath

async function fullyAutomatedAIDownload() {
    const scraper = new ImprovedTurnitinScraperService(true);
    const mainRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const mainAskQuestion = (question: string): Promise<string> => new Promise((resolve) => mainRl.question(question, resolve));

    let currentPage: Page | null = null;
    const projectDownloadPath = scraper.getDownloadPath(); // Definir aquí para usar en screenshots de error

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
        } catch (cdpError: any) {
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
        await currentPage.waitForTimeout(30000); // Aumentar espera inicial considerablemente

        let downloadActionSuccessful = false;
        let attempt = 1;
        const maxAttempts = 2; // Intentar una vez, luego refrescar e intentar de nuevo

        while (attempt <= maxAttempts && !downloadActionSuccessful) {
            console.log(`\n🔎 Intento ${attempt} de ${maxAttempts} para encontrar y hacer clic en el botón de descarga.`);
            
            let popoverOpener: ElementHandle<Element> | null = null;
            if (POPOVER_OPENER_SELECTOR) { 
                try {
                    console.log(`🤖 Buscando botón para abrir popover con selector: ${POPOVER_OPENER_SELECTOR}`);
                    if (IS_POPOVER_OPENER_XPATH) {
                        // Esperar a que alguno de los elementos del XPath sea visible
                        await currentPage.waitForXPath(POPOVER_OPENER_SELECTOR, { timeout: 20000, visible: true }); // Aumentado timeout
                        const openers = await currentPage.$x(POPOVER_OPENER_SELECTOR);
                        if (openers.length > 0) {
                            popoverOpener = openers[0] as ElementHandle<Element>; // Tomar el primero que coincida
                            console.log(`✅ Botón para abrir popover encontrado con XPath (se encontró ${openers.length} coincidencia(s)).`);
                        } else {
                             console.log('⚠️ No se encontró el botón para abrir el popover con el XPath proporcionado (openers.length es 0).');
                        }
                    } else {
                        await currentPage.waitForSelector(POPOVER_OPENER_SELECTOR, { timeout: 20000, visible: true }); // Aumentado timeout
                        popoverOpener = await currentPage.$(POPOVER_OPENER_SELECTOR);
                         if (popoverOpener) {
                            console.log('✅ Botón para abrir popover encontrado con CSS selector.');
                        } else {
                            console.log('⚠️ No se encontró el botón para abrir el popover con el CSS selector proporcionado.');
                        }
                    }

                    if (popoverOpener) {
                        console.log('✅ Botón para abrir popover listo. Haciendo clic...');
                        await currentPage.evaluate(el => (el as HTMLElement).click(), popoverOpener);
                        console.log('🖱️ Clic en abridor de popover realizado. Esperando que aparezca el popover y el botón final (10 segundos)...');
                        try {
                            // Esperar a que el botón de descarga DENTRO del popover sea visible
                            await currentPage.waitForXPath(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
                            console.log('✅ Popover parece estar abierto y el botón de descarga final está visible.');
                        } catch (popoverWaitError: any) {
                            console.warn(`🔶 Popover o botón de descarga final no se hizo visible después del clic en el abridor: ${popoverWaitError.message}`);
                            const popoverErrorPath = path.join(projectDownloadPath, `error_popover_not_visible_attempt_${attempt}_${Date.now()}.png`);
                            if (currentPage) await currentPage.screenshot({ path: popoverErrorPath });
                            console.log(`📸 Screenshot de error de popover guardado en: ${popoverErrorPath}`);
                        }
                    } else {
                        // Mensaje ya se muestra arriba si no se encuentra
                    }
                } catch (e: any) {
                    console.log(`🔶 Error al intentar encontrar/abrir popover: ${e.message}`);
                    const openerErrorPath = path.join(projectDownloadPath, `error_popover_opener_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage) await currentPage.screenshot({ path: openerErrorPath });
                    console.log(`📸 Screenshot de error de abridor de popover guardado en: ${openerErrorPath}`);
                }
            } else {
                 // Esta rama ahora se ejecutaría si POPOVER_OPENER_SELECTOR fuera una cadena vacía.
                 console.log("ℹ️ No se ha configurado un selector para abrir popover (POPOVER_OPENER_SELECTOR está vacío), se buscará el botón de descarga directamente.");
            }

            // Intentar hacer clic en el botón de descarga final
            let downloadButton: ElementHandle<Element> | null = null;
            console.log(`🤖 Buscando botón de descarga final con XPath: ${AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR}`);
            try {
                await currentPage.waitForXPath(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR, { visible: true, timeout: 20000 }); // Aumentado timeout
                const elements = await currentPage.$x(AI_REPORT_PAGE_DOWNLOAD_BUTTON_SELECTOR);
                if (elements.length > 0) {
                    downloadButton = elements[0] as ElementHandle<Element>;
                }
            } catch (e: any) {
                console.log(`❌ Error esperando el XPath del botón de descarga final: ${e.message}`);
            }

            if (downloadButton) {
                console.log('✅ Botón de descarga final encontrado y visible. Haciendo clic...');
                try {
                    await currentPage.evaluate(el => (el as HTMLElement).click(), downloadButton);
                    console.log('🖱️ Clic realizado en el botón de descarga final. Esperando inicio de descarga (20 segundos)...');
                    await currentPage.waitForTimeout(20000);
                    downloadActionSuccessful = true; 
                } catch (clickError: any) {
                    console.error(`❌ Error al hacer clic en el botón de descarga final: ${clickError.message}`);
                    const clickErrorScreenshotPath = path.join(projectDownloadPath, `error_click_download_btn_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage) await currentPage.screenshot({ path: clickErrorScreenshotPath });
                    console.log(`📸 Screenshot de error de clic guardado en: ${clickErrorScreenshotPath}`);
                }
            } else {
                console.log(`❌ No se encontró el botón de descarga final en el intento ${attempt}.`);
                const notFoundScreenshotPath = path.join(projectDownloadPath, `error_btn_not_found_attempt_${attempt}_${Date.now()}.png`);
                if (currentPage) await currentPage.screenshot({ path: notFoundScreenshotPath });
                console.log(`📸 Screenshot de "no encontrado" guardado en: ${notFoundScreenshotPath}`);
            }
            
            if (!downloadActionSuccessful && attempt < maxAttempts) {
                console.log('🔄 Refrescando página y esperando antes del siguiente intento...');
                try {
                    if (currentPage) {
                        await currentPage.reload({ waitUntil: ["networkidle0", "domcontentloaded"], timeout: 60000 }); // Aumentado timeout
                        console.log('⏳ Esperando después del refresco (30 segundos)...');
                        await currentPage.waitForTimeout(30000);
                    } else {
                        console.error("❌ No se puede refrescar, la página actual es nula.");
                        break; // Salir del bucle si no hay página
                    }
                } catch (reloadError: any) {
                    console.error(`❌ Error durante el refresco de página: ${reloadError.message}`);
                    const reloadErrorPath = path.join(projectDownloadPath, `error_reload_attempt_${attempt}_${Date.now()}.png`);
                    if (currentPage) await currentPage.screenshot({ path: reloadErrorPath });
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

    } catch (error: any) {
        console.error(`❌ ERROR FATAL: ${error.message}`);
        if (currentPage) {
            const fatalErrorScreenshotPath = path.join(projectDownloadPath, `fatal_error_screenshot_${Date.now()}.png`);
            try {
                await currentPage.screenshot({ path: fatalErrorScreenshotPath });
                console.log(`📸 Screenshot de error fatal guardado en: ${fatalErrorScreenshotPath}`);
            } catch (screenshotError: any) { 
                console.error(`No se pudo tomar screenshot del error fatal: ${(screenshotError as Error).message}`);
            }
        }
        if (error.stack) console.error(error.stack);
    } finally {
        console.log('\nPresiona ENTER para cerrar...');
        await mainAskQuestion(''); 
        if (scraper) await scraper.closeBrowser();
        mainRl.close(); 
    }
}

// Added askLoginPrompt as a parameter to avoid redeclaring readline interface
async function navigateToAIReportPage(
    scraper: ImprovedTurnitinScraperService, 
    page: Page,
    // mainAskQuestion is not used in this version as rl is local
    _mainAskQuestion?: (question: string) => Promise<string> // Parameter can be optional or removed if not used
): Promise<Page | null> {
    // rl and askQuestion are defined locally within this function
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (question: string): Promise<string> => new Promise((resolve) => {
        // Removed: if (rl.closed) { ... }
        // We assume rl is active when askQuestion is called within this function's scope.
        // rl.question will handle its own state or error if called inappropriately,
        // but the design here is that it's called before rl.close().
        try {
            rl.question(question, resolve);
        } catch (e: any) {
            console.warn(`Readline question error: ${e.message}. Resolving with empty string.`);
            resolve(''); // Gracefully handle if rl.question throws (e.g., if rl was closed unexpectedly)
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
        let targetPage: Page | null = null;

        const newPagePromise = new Promise<Page | null>(resolve => browser.once('targetcreated', async target => { 
            if (target.type() === 'page') {
                const newPageCandidate = await target.page();
                resolve(newPageCandidate); 
            } else {
                resolve(null);
            }
        }));

        let pages = await browser.pages();
        let cartaPage: Page | undefined = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
        
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
                new Promise<Page | null>(resolve => setTimeout(() => {
                    resolve(cartaPage as Page); 
                }, 10000)) 
            ]);
        } catch (e) {
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
        } else {
            pages = await browser.pages(); // Re-fetch pages
            const integrityPage = pages.find(p => p.url().includes('integrity.turnitin.com'));
            if (integrityPage) {
                console.log(`✅ Encontrada página de integridad en segundo plano: ${integrityPage.url()}`);
                await integrityPage.bringToFront();
                await integrityPage.waitForTimeout(5000);
                return integrityPage;
            }
            throw new Error(`URL inesperada después del clic en IA: ${finalUrl}. Se esperaba "integrity.turnitin.com"`);
        }
    } finally {
        // Ensure rl is closed if it was created in this function scope
        if (rl) { // Check if rl was initialized
            // Removed: && !rl.closed
            rl.close();
        }
    }
}


async function detectAndConfirmDownload(projectDownloadPath: string): Promise<boolean> {
    console.log('\n🕵️ DETECTANDO Y CONFIRMANDO DESCARGA...');
    console.log('========================================');
    
    const downloadLocations = [
        projectDownloadPath,
        path.join(os.homedir(), 'Downloads'),
    ].filter(loc => fs.existsSync(loc));

    console.log('📁 Verificando en las siguientes ubicaciones:');
    downloadLocations.forEach(loc => console.log(`   - ${loc}`));

    const expectedFileBaseName = EXACT_JSON_DATA.workTitle.split('.')[0].toLowerCase();
    let downloadConfirmed = false;
    const maxAttempts = 4; 
    const attemptDelay = 7000; 

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\n--- Intento de detección ${attempt} de ${maxAttempts} ---`);
        for (const location of downloadLocations) {
            if (!fs.existsSync(location)) continue; 
            const filesInLocation = fs.readdirSync(location);
            for (const file of filesInLocation) {
                const filePath = path.join(location, file);
                const fileNameLower = file.toLowerCase();

                if (!fileNameLower.endsWith('.pdf')) continue;

                try {
                    const stats = fs.statSync(filePath);
                    const isRecent = (Date.now() - stats.mtimeMs) < (15 * 60 * 1000); 

                    if (fileNameLower.includes(expectedFileBaseName) && isRecent) {
                        console.log(`🎉 ¡DESCARGA CONFIRMADA!`);
                        console.log(`   Archivo: ${file}`);
                        console.log(`   Ubicación: ${location}`);
                        console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
                        console.log(`   Modificado: ${stats.mtime.toLocaleString()}`);

                        const safeOriginalFileName = file.replace(/[^a-zA-Z0-9_.-]/g, '_');
                        const finalFileName = `AI_Report_${EXACT_JSON_DATA.workTitle.split('.')[0]}_${new Date().toISOString().replace(/[:.]/g, '-')}_${safeOriginalFileName}`;
                        const destPath = path.join(projectDownloadPath, finalFileName);

                        if (path.resolve(filePath) !== path.resolve(destPath)) { 
                           if (fs.existsSync(destPath) && fs.statSync(destPath).size === stats.size) { 
                                console.log(`   ℹ️  Un archivo idéntico ya existe en temp-downloads: ${finalFileName}`);
                           } else {
                                fs.copyFileSync(filePath, destPath);
                                console.log(`   ✅ COPIADO a temp-downloads como: ${finalFileName}`);
                           }
                        } else {
                            console.log(`   ℹ️  El archivo ya está en la carpeta de destino del proyecto (temp-downloads).`);
                        }
                        downloadConfirmed = true;
                        break; 
                    }
                } catch (statError: any) {
                    if (statError.code !== 'ENOENT') {
                        console.warn(`   ⚠️ No se pudo obtener info de ${file}: ${statError.message}`);
                    }
                }
            }
            if (downloadConfirmed) break; 
        }
        if (downloadConfirmed) break; 

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
