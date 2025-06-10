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
async function analyzeAIPage() {
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
        console.log('🔍 ANALIZADOR DE PÁGINA DE REPORTE DE IA');
        console.log('========================================');
        console.log('Este script analiza la página del reporte de IA y muestra todos los elementos disponibles.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        // Navegar a Turnitin
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        // Seleccionar trabajo
        const workTitle = await askQuestion('¿Cuál es el título del trabajo? (ej: "LA LECTURA.docx"): ');
        console.log(`\n🎯 Procesando: "${workTitle}"`);
        // Abrir trabajo
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return;
        }
        // Encontrar página correcta
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
        console.log(`📍 Página de trabajo: ${workingPage.url()}`);
        await workingPage.waitForTimeout(3000);
        // Hacer clic en IA
        console.log('🤖 Haciendo clic en botón de IA...');
        const aiXPath = '//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button';
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
            }, 10000);
        });
        const aiElements = await workingPage.$x(aiXPath);
        if (aiElements.length > 0) {
            await aiElements[0].click();
            console.log('✅ Clic en IA realizado');
            aiReportPage = await pagePromise;
            if (aiReportPage && aiReportPage.url().includes('integrity.turnitin.com')) {
                console.log('✅ Página del reporte de IA detectada');
                console.log(`📍 URL: ${aiReportPage.url()}`);
                // Esperar a que cargue
                console.log('⏳ Esperando que la página cargue completamente (15 segundos)...');
                await aiReportPage.waitForTimeout(15000);
                // ANÁLISIS COMPLETO DE LA PÁGINA
                await performCompletePageAnalysis(aiReportPage, scraper.getDownloadPath());
            }
            else {
                console.log('❌ No se pudo acceder a la página del reporte de IA');
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
async function performCompletePageAnalysis(page, downloadPath) {
    console.log('\n🔍 INICIANDO ANÁLISIS COMPLETO DE LA PÁGINA...');
    console.log('===============================================');
    try {
        // Tomar screenshot
        const screenshotPath = path_1.default.join(downloadPath, `ai_page_analysis_${Date.now()}.png`);
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        console.log(`📸 Screenshot guardado en: ${screenshotPath}`);
        // Análisis completo
        const pageAnalysis = await page.evaluate(() => {
            var _a;
            // Función para generar XPath
            function generateXPath(element) {
                if (element.id) {
                    return `//*[@id="${element.id}"]`;
                }
                const parts = [];
                let currentEl = element;
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
            }
            // Buscar TODOS los elementos clickeables
            const allClickable = [];
            const selectors = ['button', 'a', '[role="button"]', '[onclick]', 'input[type="button"]', 'input[type="submit"]'];
            selectors.forEach(selector => {
                const elements = Array.from(document.querySelectorAll(selector));
                elements.forEach((el, globalIndex) => {
                    var _a, _b;
                    const computedStyle = window.getComputedStyle(el);
                    const isVisible = computedStyle.display !== 'none' &&
                        computedStyle.visibility !== 'hidden' &&
                        el.offsetWidth > 0 &&
                        el.offsetHeight > 0;
                    allClickable.push({
                        globalIndex: allClickable.length + 1,
                        tag: el.tagName,
                        text: ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '[Sin texto]',
                        innerText: ((_b = el.innerText) === null || _b === void 0 ? void 0 : _b.trim()) || '[Sin innerText]',
                        ariaLabel: el.getAttribute('aria-label') || '[Sin aria-label]',
                        title: el.getAttribute('title') || '[Sin title]',
                        className: el.className || '[Sin clases]',
                        id: el.id || '[Sin ID]',
                        href: el.href || '[No es enlace]',
                        type: el.type || '[No es input]',
                        visible: isVisible,
                        xpath: generateXPath(el),
                        cssSelector: el.id ? `#${el.id}` :
                            el.className ? `${el.tagName.toLowerCase()}.${el.className.split(' ').filter(c => c.length > 0).join('.')}` :
                                el.tagName.toLowerCase(),
                        outerHTML: el.outerHTML.substring(0, 200) + (el.outerHTML.length > 200 ? '...' : ''),
                        rect: {
                            x: el.getBoundingClientRect().x,
                            y: el.getBoundingClientRect().y,
                            width: el.getBoundingClientRect().width,
                            height: el.getBoundingClientRect().height
                        },
                        // Verificar si puede ser botón de descarga
                        isLikelyDownloadButton: (() => {
                            const searchText = (el.textContent + ' ' + el.getAttribute('aria-label') + ' ' + el.getAttribute('title') + ' ' + el.className + ' ' + el.id).toLowerCase();
                            return searchText.includes('download') ||
                                searchText.includes('descargar') ||
                                searchText.includes('save') ||
                                searchText.includes('export') ||
                                searchText.includes('pdf') ||
                                searchText.includes('report');
                        })()
                    });
                });
            });
            // Buscar elementos específicos de Turnitin
            const turnitinElements = [];
            const turnitinSelectors = [
                'tii-sws-header-btn',
                'tdl-button',
                'tdl-tooltip',
                '*[id*="download"]',
                '*[class*="download"]',
                '*[data-*="download"]'
            ];
            turnitinSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    elements.forEach(el => {
                        var _a;
                        turnitinElements.push({
                            selector: selector,
                            tag: el.tagName,
                            text: (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim(),
                            id: el.id,
                            className: el.className,
                            xpath: generateXPath(el),
                            outerHTML: el.outerHTML.substring(0, 300) + '...'
                        });
                    });
                }
                catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            return {
                url: window.location.href,
                title: document.title,
                totalClickableElements: allClickable.length,
                visibleClickableElements: allClickable.filter(el => el.visible).length,
                potentialDownloadButtons: allClickable.filter(el => el.isLikelyDownloadButton),
                allClickableElements: allClickable,
                turnitinSpecificElements: turnitinElements,
                pageText: ((_a = document.body.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 1000)) || '',
                htmlStructure: document.body.innerHTML.substring(0, 2000) + '...'
            };
        });
        // Mostrar resultados
        console.log('\n📊 RESULTADOS DEL ANÁLISIS:');
        console.log('===========================');
        console.log(`📄 Título: ${pageAnalysis.title}`);
        console.log(`🌐 URL: ${pageAnalysis.url}`);
        console.log(`🔘 Total elementos clickeables: ${pageAnalysis.totalClickableElements}`);
        console.log(`👁️  Elementos clickeables visibles: ${pageAnalysis.visibleClickableElements}`);
        console.log(`📥 Potenciales botones de descarga: ${pageAnalysis.potentialDownloadButtons.length}`);
        console.log(`🔧 Elementos específicos de Turnitin: ${pageAnalysis.turnitinSpecificElements.length}`);
        // Mostrar elementos potenciales de descarga
        if (pageAnalysis.potentialDownloadButtons.length > 0) {
            console.log('\n📥 POTENCIALES BOTONES DE DESCARGA:');
            console.log('====================================');
            pageAnalysis.potentialDownloadButtons.forEach((el, index) => {
                console.log(`\n${index + 1}. <${el.tag}> (${el.visible ? 'VISIBLE' : 'OCULTO'}):`);
                console.log(`   📝 Texto: "${el.text}"`);
                console.log(`   🏷️  Aria-label: "${el.ariaLabel}"`);
                console.log(`   📋 Title: "${el.title}"`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎨 Clases: "${el.className}"`);
                console.log(`   🎯 XPath: ${el.xpath}`);
                console.log(`   🔗 CSS: ${el.cssSelector}`);
                console.log(`   📐 Posición: x:${el.rect.x}, y:${el.rect.y}, w:${el.rect.width}, h:${el.rect.height}`);
                console.log(`   📜 HTML: ${el.outerHTML}`);
            });
        }
        // Mostrar elementos específicos de Turnitin
        if (pageAnalysis.turnitinSpecificElements.length > 0) {
            console.log('\n🔧 ELEMENTOS ESPECÍFICOS DE TURNITIN:');
            console.log('====================================');
            pageAnalysis.turnitinSpecificElements.forEach((el, index) => {
                console.log(`\n${index + 1}. <${el.tag}> (Selector: ${el.selector}):`);
                console.log(`   📝 Texto: "${el.text}"`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎨 Clases: "${el.className}"`);
                console.log(`   🎯 XPath: ${el.xpath}`);
                console.log(`   📜 HTML: ${el.outerHTML}`);
            });
        }
        // Mostrar TODOS los elementos clickeables visibles
        console.log('\n👁️ TODOS LOS ELEMENTOS CLICKEABLES VISIBLES:');
        console.log('=============================================');
        const visibleElements = pageAnalysis.allClickableElements.filter(el => el.visible);
        visibleElements.forEach((el, index) => {
            console.log(`\n${index + 1}. <${el.tag}>:`);
            console.log(`   📝 Texto: "${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}"`);
            console.log(`   🆔 ID: "${el.id}"`);
            console.log(`   🎯 XPath: ${el.xpath}`);
            console.log(`   🔗 CSS: ${el.cssSelector}`);
            if (el.href !== '[No es enlace]') {
                console.log(`   🔗 Enlace: ${el.href}`);
            }
        });
        // Guardar análisis completo
        const analysisFile = path_1.default.join(downloadPath, `ai_page_complete_analysis_${Date.now()}.json`);
        fs_1.default.writeFileSync(analysisFile, JSON.stringify(pageAnalysis, null, 2));
        console.log(`\n💾 Análisis completo guardado en: ${analysisFile}`);
        // Mostrar contenido de texto de la página
        console.log('\n📝 CONTENIDO DE TEXTO DE LA PÁGINA (primeros 500 caracteres):');
        console.log('===============================================================');
        console.log(pageAnalysis.pageText.substring(0, 500) + '...');
    }
    catch (error) {
        console.error('❌ Error durante el análisis:', error);
    }
}
if (require.main === module) {
    analyzeAIPage()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
