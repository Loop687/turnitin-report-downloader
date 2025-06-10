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
async function turnitinWebComponentsFinder() {
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
        console.log('🔧 FINDER DE WEB COMPONENTS DE TURNITIN');
        console.log('======================================');
        console.log('Busca específicamente en Web Components de Turnitin para el botón de descarga.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        // Proceso completo hasta llegar a la página de IA
        await navigateToAIReportPage(scraper, page);
        if (!page.url().includes('integrity.turnitin.com')) {
            console.log('❌ No se pudo llegar a la página del reporte de IA');
            return;
        }
        console.log('✅ En la página del reporte de IA');
        console.log(`📍 URL: ${page.url()}`);
        // Búsqueda específica en Web Components
        await searchTurnitinWebComponents(page, scraper.getDownloadPath());
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
async function navigateToAIReportPage(scraper, page) {
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
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        const workTitle = "LA LECTURA.docx";
        console.log(`🎯 Procesando: "${workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        if (!clickSuccess) {
            throw new Error('No se pudo abrir el trabajo');
        }
        const browser = page.browser();
        const pages = await browser.pages();
        let workingPage = page;
        for (const p of pages) {
            const url = p.url();
            if (url.includes('ev.turnitin.com/app/carta')) {
                workingPage = p;
                break;
            }
        }
        await workingPage.waitForTimeout(5000);
        // Usar información exacta del debug
        const debugInfo = {
            cssSelector: "tii-aiw-button.hydrated",
            expectedAttributes: {
                type: "ev",
                status: "success",
                percent: "100"
            }
        };
        console.log('🤖 Haciendo clic en botón de IA...');
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
        const cssElements = await workingPage.$$(debugInfo.cssSelector);
        if (cssElements.length > 0) {
            await cssElements[0].click();
            console.log('✅ Clic en IA realizado');
            aiReportPage = await pagePromise;
            if (aiReportPage) {
                await aiReportPage.waitForTimeout(10000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte: ${aiUrl}`);
                if (aiUrl.includes('integrity.turnitin.com')) {
                    Object.assign(page, aiReportPage);
                }
                else {
                    throw new Error(`URL inesperada: ${aiUrl}`);
                }
            }
            else {
                throw new Error('No se abrió nueva pestaña');
            }
        }
        else {
            throw new Error('No se encontró el botón de IA');
        }
    }
    finally {
        rl.close();
    }
}
async function searchTurnitinWebComponents(page, downloadPath) {
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
        console.log('\n🔧 BÚSQUEDA EN WEB COMPONENTS DE TURNITIN');
        console.log('==========================================');
        // Tomar screenshot
        const screenshotPath = path_1.default.join(downloadPath, `turnitin_web_components_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot: ${screenshotPath}`);
        // XPath específico que proporcionaste
        const specificXPath = '/body/tii-ai-writing-app//tii-router//aiwa-home//tii-sws-submission-workspace/tii-sws-header/tii-sws-download-btn-mfe';
        console.log(`🎯 XPath específico proporcionado: ${specificXPath}`);
        // Búsqueda completa de Web Components
        const webComponentAnalysis = await page.evaluate(() => {
            const results = {
                turnitinWebComponents: [],
                downloadRelatedElements: [],
                allCustomElements: [],
                shadowDomElements: []
            };
            // 1. Buscar todos los Web Components de Turnitin
            const turnitinSelectors = [
                'tii-ai-writing-app',
                'tii-router',
                'aiwa-home',
                'tii-sws-submission-workspace',
                'tii-sws-header',
                'tii-sws-download-btn-mfe',
                'tii-sws-header-btn',
                'tdl-button',
                'tdl-tooltip'
            ];
            turnitinSelectors.forEach(selector => {
                const elements = Array.from(document.querySelectorAll(selector));
                elements.forEach((el, index) => {
                    var _a;
                    results.turnitinWebComponents.push({
                        selector: selector,
                        index: index,
                        tagName: el.tagName,
                        id: el.id || '[Sin ID]',
                        className: el.className || '[Sin clases]',
                        attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '),
                        hasChildren: el.children.length > 0,
                        childrenCount: el.children.length,
                        textContent: ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim().substring(0, 100)) || '[Sin texto]',
                        hasShadowRoot: !!el.shadowRoot,
                        outerHTML: el.outerHTML.substring(0, 300) + '...'
                    });
                });
            });
            // 2. Buscar elementos relacionados con descarga
            const downloadSelectors = [
                '*[class*="download"]',
                '*[id*="download"]',
                '*[aria-label*="download"]',
                '*[title*="download"]'
            ];
            downloadSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    elements.forEach(el => {
                        var _a;
                        results.downloadRelatedElements.push({
                            selector: selector,
                            tagName: el.tagName,
                            id: el.id,
                            className: el.className,
                            textContent: (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim().substring(0, 50)
                        });
                    });
                }
                catch (error) {
                    // Algunos selectores pueden fallar
                }
            });
            // 3. Buscar todos los custom elements
            const allElements = Array.from(document.querySelectorAll('*'));
            allElements.forEach(el => {
                var _a;
                if (el.tagName.includes('-')) { // Custom elements tienen guión
                    results.allCustomElements.push({
                        tagName: el.tagName,
                        id: el.id || '[Sin ID]',
                        className: el.className || '[Sin clases]',
                        textContent: ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim().substring(0, 50)) || '[Sin texto]'
                    });
                }
            });
            // 4. Intentar acceder a Shadow DOM
            const elementsWithShadow = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
            elementsWithShadow.forEach(el => {
                const shadowRoot = el.shadowRoot;
                if (shadowRoot) {
                    const shadowElements = Array.from(shadowRoot.querySelectorAll('*'));
                    shadowElements.forEach(shadowEl => {
                        var _a;
                        const shadowElement = shadowEl;
                        results.shadowDomElements.push({
                            parentTag: el.tagName,
                            tagName: shadowElement.tagName,
                            id: shadowElement.id || '[Sin ID]',
                            className: shadowElement.className || '[Sin clases]',
                            textContent: ((_a = shadowElement.textContent) === null || _a === void 0 ? void 0 : _a.trim().substring(0, 50)) || '[Sin texto]'
                        });
                    });
                }
            });
            return results;
        });
        // Mostrar resultados
        console.log('\n📊 RESULTADOS DEL ANÁLISIS:');
        console.log('============================');
        console.log(`🔧 Web Components de Turnitin: ${webComponentAnalysis.turnitinWebComponents.length}`);
        console.log(`📥 Elementos relacionados con descarga: ${webComponentAnalysis.downloadRelatedElements.length}`);
        console.log(`🌐 Todos los custom elements: ${webComponentAnalysis.allCustomElements.length}`);
        console.log(`👻 Shadow DOM elements: ${webComponentAnalysis.shadowDomElements.length}`);
        if (webComponentAnalysis.turnitinWebComponents.length > 0) {
            console.log('\n🔧 WEB COMPONENTS DE TURNITIN ENCONTRADOS:');
            console.log('==========================================');
            webComponentAnalysis.turnitinWebComponents.forEach((comp, index) => {
                console.log(`\n${index + 1}. <${comp.tagName}> (${comp.selector}):`);
                console.log(`   🆔 ID: "${comp.id}"`);
                console.log(`   🎨 Clases: "${comp.className}"`);
                console.log(`   📊 Atributos: ${comp.attributes}`);
                console.log(`   👶 Hijos: ${comp.childrenCount}`);
                console.log(`   👻 Shadow Root: ${comp.hasShadowRoot}`);
                console.log(`   📝 Texto: "${comp.textContent}"`);
                console.log(`   📜 HTML: ${comp.outerHTML}`);
            });
        }
        if (webComponentAnalysis.shadowDomElements.length > 0) {
            console.log('\n👻 ELEMENTOS EN SHADOW DOM:');
            console.log('============================');
            webComponentAnalysis.shadowDomElements.forEach((el, index) => {
                console.log(`${index + 1}. <${el.tagName}> dentro de <${el.parentTag}>:`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   📝 Texto: "${el.textContent}"`);
            });
        }
        // Probar el XPath específico
        console.log('\n🎯 PROBANDO XPATH ESPECÍFICO:');
        console.log('==============================');
        try {
            const specificElements = await page.$x(specificXPath);
            console.log(`✅ Elementos encontrados con XPath específico: ${specificElements.length}`);
            if (specificElements.length > 0) {
                console.log('🎉 ¡XPath específico funcionó!');
                const shouldClick = await askQuestion('¿Hacer clic en el elemento encontrado con XPath específico? (s/n): ');
                if (shouldClick.toLowerCase() === 's') {
                    console.log('🖱️ Haciendo clic...');
                    const filesBefore = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
                    await specificElements[0].click();
                    console.log('✅ Clic realizado');
                    console.log('⏳ Esperando descarga (15 segundos)...');
                    await page.waitForTimeout(15000);
                    const filesAfter = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
                    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
                    if (newFiles.length > 0) {
                        console.log('🎉 ¡DESCARGA EXITOSA!');
                        newFiles.forEach((file, index) => {
                            const filePath = path_1.default.join(downloadPath, file);
                            const stats = fs_1.default.statSync(filePath);
                            console.log(`   📄 ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                        });
                        const pdfFile = newFiles.find(f => f.endsWith('.pdf'));
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
                        console.log('🎉 ¡PROCESO COMPLETADO EXITOSAMENTE!');
                    }
                    else {
                        console.log('ℹ️ No se detectaron descargas inmediatas');
                        console.log('💡 El clic podría haber iniciado un proceso que toma más tiempo');
                    }
                }
            }
            else {
                console.log('❌ XPath específico no encontró elementos');
                // Intentar variaciones del XPath
                console.log('\n🔄 Probando variaciones del XPath...');
                const xpathVariations = [
                    '//tii-ai-writing-app//tii-router//aiwa-home//tii-sws-submission-workspace//tii-sws-header//tii-sws-download-btn-mfe',
                    '//tii-sws-download-btn-mfe',
                    '//tii-sws-header//tii-sws-download-btn-mfe',
                    '//aiwa-home//tii-sws-download-btn-mfe',
                    '//*[contains(@class, "download")]',
                    '//button[contains(@class, "download")]'
                ];
                for (const xpath of xpathVariations) {
                    try {
                        const elements = await page.$x(xpath);
                        console.log(`   ${xpath}: ${elements.length} elementos`);
                        if (elements.length > 0) {
                            console.log(`   ✅ Encontrado con: ${xpath}`);
                            const useThis = await askQuestion(`   ¿Usar este XPath? (s/n): `);
                            if (useThis.toLowerCase() === 's') {
                                await elements[0].click();
                                console.log('   ✅ Clic realizado');
                                await page.waitForTimeout(10000);
                                break;
                            }
                        }
                    }
                    catch (error) {
                        console.log(`   ❌ Error con ${xpath}: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            console.log(`❌ Error probando XPath específico: ${error}`);
        }
        // Guardar análisis completo
        const analysisFile = path_1.default.join(downloadPath, `turnitin_web_components_analysis_${Date.now()}.json`);
        fs_1.default.writeFileSync(analysisFile, JSON.stringify(webComponentAnalysis, null, 2));
        console.log(`\n💾 Análisis completo guardado en: ${analysisFile}`);
    }
    catch (error) {
        console.error('❌ Error en búsqueda de Web Components:', error);
    }
    finally {
        rl.close();
    }
}
if (require.main === module) {
    turnitinWebComponentsFinder()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
