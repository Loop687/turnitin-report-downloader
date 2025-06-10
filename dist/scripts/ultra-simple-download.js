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
// Información EXACTA del archivo JSON que compartiste
const EXACT_JSON_DATA = {
    workTitle: "LA LECTURA.docx",
    aiButtonXPath: "//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button",
    aiButtonCSS: "tii-aiw-button.hydrated",
    expectedAttributes: {
        type: "ev",
        status: "success",
        percent: "100",
        submissionTrn: "trn:oid:::1:3272334500"
    },
    expectedFinalUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
};
async function ultraSimpleDownload() {
    const scraper = new improved_turnitin_scraper_service_1.ImprovedTurnitinScraperService(true);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const askQuestion = (question) => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };
    try {
        console.log('🎯 DESCARGADOR ULTRA-SIMPLE');
        console.log('===========================');
        console.log('Usa la información EXACTA del archivo JSON para navegación automática');
        console.log('Luego te da el control total para realizar la descarga manualmente.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        // PARTE 1: NAVEGACIÓN AUTOMÁTICA CON DATOS DEL JSON
        console.log('🚀 PARTE 1: Navegación automática hasta la página del reporte...');
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        console.log(`🎯 Buscando trabajo: "${EXACT_JSON_DATA.workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, EXACT_JSON_DATA.workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return;
        }
        // Encontrar página de Carta
        const browser = page.browser();
        const pages = await browser.pages();
        let cartaPage = page;
        for (const p of pages) {
            const url = p.url();
            if (url.includes('ev.turnitin.com/app/carta')) {
                cartaPage = p;
                console.log(`✅ Página de Carta: ${url}`);
                break;
            }
        }
        await cartaPage.waitForTimeout(5000);
        // Hacer clic en IA usando datos del JSON
        console.log('🤖 Haciendo clic en botón de IA con datos del JSON...');
        console.log(`   CSS: ${EXACT_JSON_DATA.aiButtonCSS}`);
        console.log(`   XPath: ${EXACT_JSON_DATA.aiButtonXPath}`);
        let aiReportPage = null;
        const pagePromise = new Promise((resolve) => {
            const onTargetCreated = async (target) => {
                if (target.type() === 'page') {
                    const newPage = await target.page();
                    resolve(newPage);
                }
            };
            browser.on('targetcreated', onTargetCreated);
            setTimeout(() => {
                browser.off('targetcreated', onTargetCreated);
                resolve(null);
            }, 15000);
        });
        // Usar CSS selector del JSON
        const aiElements = await cartaPage.$$(EXACT_JSON_DATA.aiButtonCSS);
        console.log(`🔍 Elementos encontrados: ${aiElements.length}`);
        if (aiElements.length > 0) {
            await aiElements[0].click();
            console.log('✅ Clic en IA realizado');
            aiReportPage = await pagePromise;
            if (aiReportPage) {
                await aiReportPage.waitForTimeout(10000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte: ${aiUrl}`);
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ ¡PERFECTO! Llegamos a la página del reporte de IA');
                    console.log(`   URL esperada: ${EXACT_JSON_DATA.expectedFinalUrl}`);
                    console.log(`   URL obtenida: ${aiUrl}`);
                    console.log('');
                    // PARTE 2: CONTROL MANUAL TOTAL
                    await giveFullManualControl(aiReportPage, scraper.getDownloadPath());
                }
                else {
                    console.log(`❌ URL inesperada: ${aiUrl}`);
                }
            }
            else {
                console.log('❌ No se abrió nueva pestaña');
            }
        }
        else {
            console.log('❌ No se encontró el botón de IA');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        console.log('\nPresiona ENTER para cerrar...');
        await askQuestion('');
        rl.close();
        await scraper.closeBrowser();
    }
}
async function giveFullManualControl(page, downloadPath) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const askQuestion = (question) => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };
    try {
        console.log('🎮 PARTE 2: CONTROL MANUAL TOTAL');
        console.log('=================================');
        console.log('');
        console.log('✅ La página del reporte de IA está lista en el navegador');
        console.log('✅ Ahora tienes CONTROL TOTAL para realizar la descarga');
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('1. Ve al navegador que se abrió automáticamente');
        console.log('2. Deberías ver la página del reporte de IA de Turnitin');
        console.log('3. Busca el botón de DESCARGA (puede ser un ícono o texto)');
        console.log('4. Haz clic en él manualmente');
        console.log('5. Si aparece un menú/popover, haz clic en la opción de descarga');
        console.log('6. Cuando se descargue el PDF, vuelve aquí y presiona ENTER');
        console.log('');
        // Tomar screenshot
        const screenshot = path_1.default.join(downloadPath, `ultra_simple_control_${Date.now()}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        console.log(`📸 Screenshot de la página: ${screenshot}`);
        console.log('💡 Puedes usar este screenshot como referencia');
        console.log('');
        // Información de la página
        const pageInfo = await page.evaluate(() => ({
            title: document.title,
            url: window.location.href,
            elementsCount: document.querySelectorAll('*').length
        }));
        console.log('📋 INFORMACIÓN DE LA PÁGINA:');
        console.log(`   📄 Título: ${pageInfo.title}`);
        console.log(`   🌐 URL: ${pageInfo.url}`);
        console.log(`   🔧 Total elementos: ${pageInfo.elementsCount}`);
        console.log('');
        // Monitoreo de archivos inicial
        const initialFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
        console.log(`📁 Archivos iniciales en directorio: ${initialFiles.length}`);
        console.log('🔴 MODO MANUAL ACTIVADO');
        console.log('=======================');
        console.log('Realiza la descarga manualmente en el navegador...');
        console.log('');
        // Dar opciones al usuario
        let continueMonitoring = true;
        while (continueMonitoring) {
            console.log('🎯 OPCIONES DISPONIBLES:');
            console.log('1. screenshot - Tomar nuevo screenshot');
            console.log('2. files - Verificar archivos descargados');
            console.log('3. info - Mostrar información de la página');
            console.log('4. help - Mostrar ayuda');
            console.log('5. done - Terminar (cuando hayas descargado)');
            console.log('');
            const choice = await askQuestion('¿Qué quieres hacer?: ');
            switch (choice.toLowerCase()) {
                case '1':
                case 'screenshot':
                    const newScreenshot = path_1.default.join(downloadPath, `manual_screenshot_${Date.now()}.png`);
                    await page.screenshot({ path: newScreenshot, fullPage: true });
                    console.log(`📸 Nuevo screenshot: ${newScreenshot}`);
                    break;
                case '2':
                case 'files':
                    const currentFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
                    const newFiles = currentFiles.filter(f => !initialFiles.includes(f));
                    console.log(`📁 Archivos totales: ${currentFiles.length}`);
                    console.log(`📄 Archivos nuevos: ${newFiles.length}`);
                    if (newFiles.length > 0) {
                        console.log('   Archivos nuevos encontrados:');
                        newFiles.forEach((file, index) => {
                            const filePath = path_1.default.join(downloadPath, file);
                            const stats = fs_1.default.statSync(filePath);
                            console.log(`     ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                        });
                    }
                    break;
                case '3':
                case 'info':
                    const currentPageInfo = await page.evaluate(() => {
                        var _a;
                        return ({
                            title: document.title,
                            url: window.location.href,
                            bodyText: ((_a = document.body.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 200)) + '...'
                        });
                    });
                    console.log('📋 Información actual:');
                    console.log(`   📄 Título: ${currentPageInfo.title}`);
                    console.log(`   🌐 URL: ${currentPageInfo.url}`);
                    console.log(`   📝 Contenido: ${currentPageInfo.bodyText}`);
                    break;
                case '4':
                case 'help':
                    console.log('💡 AYUDA:');
                    console.log('- Busca botones que digan "Download", "Descargar" o tengan íconos de descarga');
                    console.log('- Pueden estar en la parte superior de la página');
                    console.log('- Si ves un menú desplegable, haz clic en él');
                    console.log('- El archivo PDF se debería descargar a tu carpeta de Descargas');
                    console.log('- Si no encuentras el botón, toma un screenshot y revísalo');
                    break;
                case '5':
                case 'done':
                    continueMonitoring = false;
                    break;
                default:
                    console.log('❌ Opción no válida. Usa: screenshot, files, info, help, o done');
            }
            console.log('');
        }
        // Verificación final
        const finalFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
        const downloadedFiles = finalFiles.filter(f => !initialFiles.includes(f) && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
        console.log('📋 RESUMEN FINAL:');
        console.log('=================');
        console.log(`📁 Archivos de reporte descargados: ${downloadedFiles.length}`);
        if (downloadedFiles.length > 0) {
            console.log('✅ ¡DESCARGA EXITOSA!');
            downloadedFiles.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file}`);
            });
            // Renombrar archivos
            const pdfFile = downloadedFiles.find(f => f.endsWith('.pdf'));
            if (pdfFile) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const newName = `AI_Report_LA_LECTURA_${timestamp}.pdf`;
                const oldPath = path_1.default.join(downloadPath, pdfFile);
                const newPath = path_1.default.join(downloadPath, newName);
                try {
                    fs_1.default.renameSync(oldPath, newPath);
                    console.log(`📝 Archivo renombrado: ${newName}`);
                }
                catch (error) {
                    console.log(`⚠️ No se pudo renombrar: ${error}`);
                }
            }
        }
        else {
            console.log('⚠️ No se detectaron descargas de reportes');
            console.log('💡 Verifica tu carpeta de Descargas del navegador');
        }
    }
    catch (error) {
        console.error('❌ Error en control manual:', error);
    }
    finally {
        rl.close();
    }
}
if (require.main === module) {
    ultraSimpleDownload()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
