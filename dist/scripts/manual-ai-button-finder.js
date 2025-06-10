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
async function manualAIButtonFinder() {
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
        console.log('🔍 FINDER MANUAL DEL BOTÓN DE IA - MODO INTERACTIVO');
        console.log('==================================================');
        console.log('Este modo te mostrará todos los botones disponibles');
        console.log('y tú podrás seleccionar cuál es el botón de IA.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        const workTitle = await askQuestion('¿Cuál es el título del trabajo que quieres analizar? (ej: "LA LECTURA.docx"): ');
        console.log(`\n🎯 Buscando trabajo: "${workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo encontrar o hacer clic en el trabajo');
            return;
        }
        const browser = page.browser();
        const pages = await browser.pages();
        console.log(`📑 Páginas abiertas: ${pages.length}`);
        let workingPage = page;
        if (pages.length > 1) {
            for (const p of pages) {
                const url = p.url();
                if (url.includes('ev.turnitin.com/app/carta')) {
                    console.log(`🎯 Encontrada ventana del reporte: ${url}`);
                    workingPage = p;
                    break;
                }
            }
        }
        console.log('✅ Trabajo abierto exitosamente');
        console.log(`📍 Analizando página: ${workingPage.url()}`);
        await workingPage.waitForTimeout(5000);
        console.log('\n🔍 Escaneando todos los elementos clickeables en la página...');
        const allElements = await workingPage.evaluate(() => {
            const foundElements = [];
            const turnitinSelectors = [
                'tii-aiw-button',
                'tii-aiw-ev-button',
                'tdl-tooltip',
                '*[percent]',
                '*[type="ev"]',
                '*[submission-trn]'
            ];
            turnitinSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    elements.forEach(el => {
                        foundElements.push({
                            element: el,
                            priority: 1,
                            category: 'Turnitin AI'
                        });
                    });
                }
                catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            const aiContainers = Array.from(document.querySelectorAll('tii-aiw-button, tii-aiw-ev-button, tdl-tooltip'));
            aiContainers.forEach(container => {
                const nestedElements = Array.from(container.querySelectorAll('button, [role="button"], *[onclick]'));
                nestedElements.forEach(el => {
                    foundElements.push({
                        element: el,
                        priority: 1,
                        category: 'Turnitin AI (Anidado)'
                    });
                });
            });
            const otherSelectors = ['button', 'a', '[role="button"]', '[onclick]'];
            otherSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    elements.forEach(el => {
                        const isDuplicate = foundElements.some(item => item.element === el);
                        if (!isDuplicate) {
                            foundElements.push({
                                element: el,
                                priority: 2,
                                category: 'Otros'
                            });
                        }
                    });
                }
                catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            return foundElements.map((item, index) => {
                const element = item.element;
                const generateXPath = (el) => {
                    if (el.id) {
                        return `//*[@id="${el.id}"]`;
                    }
                    const parts = [];
                    let currentEl = el;
                    while (currentEl && currentEl.parentElement) {
                        let tagName = currentEl.tagName.toLowerCase();
                        let index = 1;
                        let sibling = currentEl.previousElementSibling;
                        while (sibling) {
                            if (sibling.tagName === currentEl.tagName) {
                                index++;
                            }
                            sibling = sibling.previousElementSibling;
                        }
                        const siblings = Array.from(currentEl.parentElement.children).filter(child => child.tagName === currentEl.tagName);
                        if (siblings.length > 1) {
                            tagName += `[${index}]`;
                        }
                        parts.unshift(tagName);
                        currentEl = currentEl.parentElement;
                    }
                    return '//' + parts.join('/');
                };
                const elementData = {
                    index: index + 1,
                    category: item.category,
                    priority: item.priority,
                    tagName: element.tagName,
                    text: element.textContent?.trim() || '[Sin texto]',
                    ariaLabel: element.getAttribute('aria-label') || '[Sin aria-label]',
                    title: element.getAttribute('title') || '[Sin title]',
                    className: element.className || '[Sin clases]',
                    id: element.id || '[Sin ID]',
                    xpath: generateXPath(element),
                    cssSelector: element.id ? `#${element.id}` :
                        element.className ? `${element.tagName.toLowerCase()}.${element.className.split(' ').join('.')}` :
                            element.tagName.toLowerCase(),
                    visible: window.getComputedStyle(element).display !== 'none' &&
                        window.getComputedStyle(element).visibility !== 'hidden' &&
                        element.offsetWidth > 0 &&
                        element.offsetHeight > 0,
                    turnitinAttributes: {
                        type: element.getAttribute('type'),
                        status: element.getAttribute('status'),
                        percent: element.getAttribute('percent'),
                        submissionTrn: element.getAttribute('submission-trn')
                    },
                    outerHTML: element.outerHTML?.substring(0, 200) + '...'
                };
                return elementData;
            }).filter(el => el.visible);
        });
        const aiElements = allElements.filter(el => el.category.includes('Turnitin'));
        const otherElements = allElements.filter(el => !el.category.includes('Turnitin'));
        console.log(`\n📊 Encontrados ${allElements.length} elementos clickeables visibles`);
        console.log(`   🤖 Elementos de IA: ${aiElements.length}`);
        console.log(`   🔘 Otros elementos: ${otherElements.length}`);
        if (aiElements.length > 0) {
            console.log('\n🤖 ELEMENTOS DE IA DE TURNITIN:');
            console.log('===============================');
            aiElements.forEach((el) => {
                console.log(`\n⭐ ${el.index}. ${el.category} - <${el.tagName}>:`);
                console.log(`   📝 Texto: "${el.text}"`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎯 XPath: ${el.xpath}`);
                console.log(`   🤖 Atributos Turnitin:`);
                console.log(`      Type: ${el.turnitinAttributes.type || 'N/A'}`);
                console.log(`      Status: ${el.turnitinAttributes.status || 'N/A'}`);
                console.log(`      Percent: ${el.turnitinAttributes.percent || 'N/A'}`);
                console.log(`   📜 HTML: ${el.outerHTML}`);
            });
        }
        if (otherElements.length > 0) {
            console.log('\n🔘 OTROS ELEMENTOS IMPORTANTES:');
            console.log('===============================');
            otherElements.slice(0, 10).forEach((el) => {
                console.log(`\n${el.index}. <${el.tagName}> - "${el.text.substring(0, 40)}..."`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎯 XPath: ${el.xpath}`);
            });
            if (otherElements.length > 10) {
                console.log(`\n... y ${otherElements.length - 10} elementos más`);
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('🎯 OPCIONES:');
        console.log('1. Ingresa el NÚMERO de cualquier elemento de la lista');
        console.log('2. Escribe "xpath" para usar un XPath personalizado');
        console.log('3. Los elementos ⭐ son los más relevantes para IA');
        console.log('');
        const userInput = await askQuestion(`¿Qué elemento quieres probar? (1-${allElements.length}) o "xpath": `);
        let selectedElement;
        let useCustomXPath = false;
        let customXPath = '';
        if (userInput.toLowerCase() === 'xpath') {
            useCustomXPath = true;
            customXPath = await askQuestion('Ingresa el XPath personalizado: ');
            selectedElement = {
                index: 'XPath',
                tagName: 'CUSTOM',
                text: 'Elemento personalizado via XPath',
                xpath: customXPath
            };
            console.log(`\n✅ Usando XPath personalizado: ${customXPath}`);
        }
        else {
            const elementIndex = parseInt(userInput) - 1;
            if (isNaN(elementIndex) || elementIndex < 0 || elementIndex >= allElements.length) {
                console.log(`❌ Número inválido. Debe ser entre 1 y ${allElements.length}`);
                return;
            }
            selectedElement = allElements[elementIndex];
            console.log(`\n✅ Seleccionaste el elemento #${selectedElement.index}:`);
            console.log(`   🏷️ Categoría: ${selectedElement.category}`);
            console.log(`   📝 Texto: "${selectedElement.text}"`);
            console.log(`   🎯 XPath: ${selectedElement.xpath}`);
        }
        const testClick = await askQuestion('\n¿Quieres probar hacer clic en este elemento? (s/n): ');
        if (testClick.toLowerCase() === 's') {
            try {
                console.log(`🖱️ Haciendo clic en el elemento...`);
                const targetXPath = useCustomXPath ? customXPath : selectedElement.xpath;
                let success = false;
                const browser = workingPage.browser();
                let newPage = null;
                const pagePromise = new Promise((resolve) => {
                    const onTargetCreated = async (target) => {
                        if (target.type() === 'page') {
                            const page = await target.page();
                            resolve(page);
                        }
                    };
                    browser.on('targetcreated', onTargetCreated);
                    setTimeout(() => {
                        browser.off('targetcreated', onTargetCreated);
                        resolve(null);
                    }, 10000);
                });
                try {
                    const elements = await workingPage.$x(targetXPath);
                    console.log(`🔍 Elementos encontrados con XPath: ${elements.length}`);
                    if (elements.length > 0) {
                        await elements[0].click();
                        console.log('✅ Clic realizado con XPath');
                        success = true;
                    }
                    else {
                        console.log('⚠️ No se encontraron elementos con XPath');
                    }
                }
                catch (error) {
                    console.log(`❌ Error con XPath: ${error}`);
                }
                if (!success && !useCustomXPath && selectedElement.cssSelector) {
                    try {
                        await workingPage.click(selectedElement.cssSelector);
                        console.log('✅ Clic realizado con CSS selector');
                        success = true;
                    }
                    catch (error) {
                        console.log(`❌ Error con CSS: ${error}`);
                    }
                }
                if (success) {
                    console.log('⏳ Esperando nueva pestaña...');
                    newPage = await pagePromise;
                    let targetPage = workingPage;
                    if (newPage) {
                        console.log('🆕 Nueva pestaña detectada');
                        await newPage.waitForTimeout(5000);
                        const newUrl = newPage.url();
                        console.log(`📍 URL de nueva pestaña: ${newUrl}`);
                        if (newUrl.includes('integrity.turnitin.com') || newUrl.includes('awo-usw2.integrity.turnitin.com')) {
                            console.log('✅ Nueva pestaña es del reporte de IA, cambiando contexto...');
                            targetPage = newPage;
                        }
                        else {
                            console.log('⚠️ Nueva pestaña no parece ser del reporte de IA');
                        }
                    }
                    else {
                        console.log('ℹ️ No se detectó nueva pestaña, analizando página actual...');
                        await workingPage.waitForTimeout(5000);
                    }
                    const finalUrl = targetPage.url();
                    console.log(`📍 URL final analizada: ${finalUrl}`);
                    const pageInfo = await targetPage.evaluate(() => ({
                        title: document.title,
                        url: window.location.href,
                        hasAIContent: document.body.textContent?.toLowerCase().includes('artificial intelligence') ||
                            document.body.textContent?.toLowerCase().includes('ai detection') ||
                            document.body.textContent?.toLowerCase().includes('ai writing') ||
                            document.body.textContent?.toLowerCase().includes('detected as ai'),
                        hasDownloadLinks: document.querySelectorAll('*[href*="download"], *[title*="download"], button[title*="Download"], a[title*="Download"]').length,
                        contentPreview: document.body.textContent?.substring(0, 500) || '',
                        downloadElements: Array.from(document.querySelectorAll('button, a')).filter(el => {
                            const text = el.textContent?.toLowerCase() || '';
                            const title = el.getAttribute('title')?.toLowerCase() || '';
                            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                            return text.includes('download') || title.includes('download') || ariaLabel.includes('download');
                        }).map(el => ({
                            tag: el.tagName,
                            text: el.textContent?.trim(),
                            title: el.getAttribute('title'),
                            href: el.href || 'N/A'
                        }))
                    }));
                    console.log('\n📋 Información de la página del reporte de IA:');
                    console.log(`   📄 Título: ${pageInfo.title}`);
                    console.log(`   🌐 URL: ${pageInfo.url}`);
                    console.log(`   🤖 Contiene contenido de IA: ${pageInfo.hasAIContent}`);
                    console.log(`   📥 Enlaces de descarga encontrados: ${pageInfo.hasDownloadLinks}`);
                    console.log(`   📝 Vista previa: ${pageInfo.contentPreview.substring(0, 200)}...`);
                    if (pageInfo.downloadElements.length > 0) {
                        console.log('\n📥 ELEMENTOS DE DESCARGA ENCONTRADOS:');
                        pageInfo.downloadElements.forEach((el, index) => {
                            console.log(`   ${index + 1}. <${el.tag}> "${el.text}" - ${el.href}`);
                            console.log(`      Title: ${el.title || 'N/A'}`);
                        });
                        const specificDownloadXPath = '//*[@id="download-popover"]/ul/li/button';
                        console.log('\n🎯 Usando XPath específico del botón de descarga...');
                        const tryDownload = await askQuestion('\n¿Quieres intentar descargar usando el XPath específico? (s/n): ');
                        if (tryDownload.toLowerCase() === 's') {
                            try {
                                console.log(`🖱️ Haciendo clic en: ${specificDownloadXPath}`);
                                const downloadElements = await targetPage.$x(specificDownloadXPath);
                                console.log(`🔍 Elementos encontrados con XPath de descarga: ${downloadElements.length}`);
                                if (downloadElements.length > 0) {
                                    console.log('📁 Configurando directorio de descarga...');
                                    const client = await targetPage.target().createCDPSession();
                                    await client.send('Page.setDownloadBehavior', {
                                        behavior: 'allow',
                                        downloadPath: scraper.getDownloadPath()
                                    });
                                    await downloadElements[0].click();
                                    console.log('✅ Clic en descarga realizado exitosamente');
                                    console.log('⏳ Esperando descarga (15 segundos)...');
                                    await targetPage.waitForTimeout(15000);
                                    const downloadPath = scraper.getDownloadPath();
                                    console.log(`📂 Verificando archivos en: ${downloadPath}`);
                                    try {
                                        const fs = require('fs');
                                        const files = fs.readdirSync(downloadPath);
                                        const pdfFiles = files.filter((f) => f.endsWith('.pdf'));
                                        const recentFiles = files.filter((f) => {
                                            const filePath = path_1.default.join(downloadPath, f);
                                            const stats = fs.statSync(filePath);
                                            const now = new Date();
                                            const fileTime = new Date(stats.mtime);
                                            return (now.getTime() - fileTime.getTime()) < 60000;
                                        });
                                        console.log(`📋 Archivos en directorio: ${files.length}`);
                                        console.log(`📄 Archivos PDF: ${pdfFiles.length}`);
                                        console.log(`🕐 Archivos recientes: ${recentFiles.length}`);
                                        if (recentFiles.length > 0) {
                                            console.log('\n✅ ¡DESCARGA EXITOSA!');
                                            console.log('📁 Archivos descargados recientemente:');
                                            recentFiles.forEach((file, index) => {
                                                const filePath = path_1.default.join(downloadPath, file);
                                                const stats = fs.statSync(filePath);
                                                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                                            });
                                            const recentPdf = recentFiles.find((f) => f.endsWith('.pdf'));
                                            if (recentPdf) {
                                                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                                const newName = `AI_Report_${workTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
                                                const oldPath = path_1.default.join(downloadPath, recentPdf);
                                                const newPath = path_1.default.join(downloadPath, newName);
                                                try {
                                                    fs.renameSync(oldPath, newPath);
                                                    console.log(`📝 Archivo renombrado a: ${newName}`);
                                                }
                                                catch (error) {
                                                    console.log(`⚠️ No se pudo renombrar: ${error}`);
                                                }
                                            }
                                        }
                                        else {
                                            console.log('⚠️ No se detectaron archivos descargados recientemente');
                                            console.log('💡 Verifica tu carpeta de descargas del navegador');
                                        }
                                    }
                                    catch (error) {
                                        console.log(`❌ Error verificando archivos: ${error}`);
                                    }
                                }
                                else {
                                    console.log('❌ No se encontró el botón de descarga con el XPath específico');
                                    console.log('🔄 Intentando con búsqueda general de botones de descarga...');
                                    const fallbackResult = await targetPage.evaluate(() => {
                                        const downloadButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
                                            const text = el.textContent?.toLowerCase() || '';
                                            const title = el.getAttribute('title')?.toLowerCase() || '';
                                            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                                            return text.includes('download') ||
                                                title.includes('download') ||
                                                ariaLabel.includes('download') ||
                                                text.includes('descargar');
                                        });
                                        if (downloadButtons.length > 0) {
                                            downloadButtons[0].click();
                                            return {
                                                success: true,
                                                elementText: downloadButtons[0].textContent?.trim(),
                                                totalFound: downloadButtons.length
                                            };
                                        }
                                        return { success: false, totalFound: 0 };
                                    });
                                    if (fallbackResult.success) {
                                        console.log(`✅ Clic realizado en: "${fallbackResult.elementText}"`);
                                        console.log('⏳ Esperando descarga...');
                                        await targetPage.waitForTimeout(10000);
                                    }
                                    else {
                                        console.log('❌ No se encontraron botones de descarga alternativos');
                                    }
                                }
                            }
                            catch (error) {
                                console.log(`❌ Error durante la descarga: ${error}`);
                            }
                        }
                    }
                    else {
                        console.log('\n🎯 No se detectaron elementos automáticamente, usando XPath específico...');
                        const trySpecificXPath = await askQuestion('¿Quieres probar el XPath específico del botón de descarga? (s/n): ');
                        if (trySpecificXPath.toLowerCase() === 's') {
                            try {
                                const specificDownloadXPath = '//*[@id="download-popover"]/ul/li/button';
                                console.log(`🖱️ Probando XPath: ${specificDownloadXPath}`);
                                const elements = await targetPage.$x(specificDownloadXPath);
                                console.log(`🔍 Elementos encontrados: ${elements.length}`);
                                if (elements.length > 0) {
                                    await elements[0].click();
                                    console.log('✅ Clic realizado en botón de descarga');
                                    console.log('⏳ Esperando descarga (10 segundos)...');
                                    await targetPage.waitForTimeout(10000);
                                    console.log('📋 Verifica tu carpeta de descargas');
                                }
                                else {
                                    console.log('❌ No se encontró el elemento con el XPath específico');
                                }
                            }
                            catch (error) {
                                console.log(`❌ Error con XPath específico: ${error}`);
                            }
                        }
                    }
                }
                else {
                    console.log('❌ No se pudo hacer clic en el elemento');
                }
            }
            catch (error) {
                console.log(`❌ Error durante el test: ${error}`);
            }
        }
        const debugInfo = {
            workTitle: workTitle,
            pageUrl: workingPage.url(),
            totalElements: allElements.length,
            aiElements: aiElements,
            selectedElement: selectedElement,
            timestamp: new Date().toISOString()
        };
        const debugFile = path_1.default.join(scraper.getDownloadPath(), `ai-finder-debug-${Date.now()}.json`);
        fs_1.default.writeFileSync(debugFile, JSON.stringify(debugInfo, null, 2));
        console.log(`\n💾 Información de debug guardada en: ${debugFile}`);
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
if (require.main === module) {
    manualAIButtonFinder()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
