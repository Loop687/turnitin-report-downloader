import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { ElementHandle, Page } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

// Definir interfaces para tipado
interface ClickableElement {
    globalIndex: number;
    tag: string;
    text: string;
    innerText: string;
    ariaLabel: string;
    title: string;
    className: string;
    id: string;
    href: string;
    type: string;
    visible: boolean;
    xpath: string;
    cssSelector: string;
    outerHTML: string;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    isLikelyDownloadButton: boolean;
}

interface TurnitinElement {
    selector: string;
    tag: string;
    text: string | undefined;
    id: string;
    className: string;
    xpath: string;
    outerHTML: string;
}

interface PageAnalysis {
    url: string;
    title: string;
    totalClickableElements: number;
    visibleClickableElements: number;
    potentialDownloadButtons: ClickableElement[];
    allClickableElements: ClickableElement[];
    turnitinSpecificElements: TurnitinElement[];
    pageText: string;
    htmlStructure: string;
}

async function analyzeAIPage() {
    const scraper = new ImprovedTurnitinScraperService(true);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question: string): Promise<string> => {
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
        
        let aiReportPage: Page | null = null;
        const pagePromise = new Promise<Page | null>((resolve) => {
            const onTargetCreated = async (target: any) => {
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
            await (aiElements[0] as ElementHandle<Element>).click();
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
                
            } else {
                console.log('❌ No se pudo acceder a la página del reporte de IA');
            }
        } else {
            console.log('❌ No se encontró el botón de IA');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        console.log('\nPresiona ENTER para cerrar...');
        await askQuestion('');
        rl.close();
        await scraper.closeBrowser();
    }
}

async function performCompletePageAnalysis(page: Page, downloadPath: string) {
    console.log('\n🔍 INICIANDO ANÁLISIS COMPLETO DE LA PÁGINA...');
    console.log('===============================================');
    
    try {
        // Tomar screenshot
        const screenshotPath = path.join(downloadPath, `ai_page_analysis_${Date.now()}.png`);
        await page.screenshot({ 
            path: screenshotPath, 
            fullPage: true 
        });
        console.log(`📸 Screenshot guardado en: ${screenshotPath}`);
        
        // Análisis completo
        const pageAnalysis = await page.evaluate((): PageAnalysis => {
            // Función para generar XPath
            function generateXPath(element: Element): string {
                if (element.id) {
                    return `//*[@id="${element.id}"]`;
                }
                
                const parts: string[] = [];
                let currentEl: Element | null = element;
                
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
                    
                    const siblings = Array.from(currentEl.parentElement.children).filter(
                        child => child.tagName === currentEl!.tagName
                    );
                    
                    if (siblings.length > 1) {
                        tagName += `[${index}]`;
                    }
                    
                    parts.unshift(tagName);
                    currentEl = currentEl.parentElement;
                }
                
                return '//' + parts.join('/');
            }
            
            // Buscar TODOS los elementos clickeables
            const allClickable: ClickableElement[] = [];
            const selectors = ['button', 'a', '[role="button"]', '[onclick]', 'input[type="button"]', 'input[type="submit"]'];
            
            selectors.forEach(selector => {
                const elements = Array.from(document.querySelectorAll(selector));
                elements.forEach((el, globalIndex) => {
                    const computedStyle = window.getComputedStyle(el);
                    const isVisible = computedStyle.display !== 'none' && 
                                     computedStyle.visibility !== 'hidden' &&
                                     (el as HTMLElement).offsetWidth > 0 && 
                                     (el as HTMLElement).offsetHeight > 0;
                    
                    allClickable.push({
                        globalIndex: allClickable.length + 1,
                        tag: el.tagName,
                        text: el.textContent?.trim() || '[Sin texto]',
                        innerText: (el as HTMLElement).innerText?.trim() || '[Sin innerText]',
                        ariaLabel: el.getAttribute('aria-label') || '[Sin aria-label]',
                        title: el.getAttribute('title') || '[Sin title]',
                        className: el.className || '[Sin clases]',
                        id: el.id || '[Sin ID]',
                        href: (el as HTMLAnchorElement).href || '[No es enlace]',
                        type: (el as HTMLInputElement).type || '[No es input]',
                        visible: isVisible,
                        xpath: generateXPath(el),
                        cssSelector: el.id ? `#${el.id}` : 
                                    el.className ? `${el.tagName.toLowerCase()}.${el.className.split(' ').filter(c => c.length > 0).join('.')}` :
                                    el.tagName.toLowerCase(),
                        outerHTML: el.outerHTML.substring(0, 200) + (el.outerHTML.length > 200 ? '...' : ''),
                        rect: {
                            x: (el as HTMLElement).getBoundingClientRect().x,
                            y: (el as HTMLElement).getBoundingClientRect().y,
                            width: (el as HTMLElement).getBoundingClientRect().width,
                            height: (el as HTMLElement).getBoundingClientRect().height
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
            const turnitinElements: TurnitinElement[] = [];
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
                        turnitinElements.push({
                            selector: selector,
                            tag: el.tagName,
                            text: el.textContent?.trim(),
                            id: el.id,
                            className: el.className,
                            xpath: generateXPath(el),
                            outerHTML: el.outerHTML.substring(0, 300) + '...'
                        });
                    });
                } catch (error) {
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
                pageText: document.body.textContent?.substring(0, 1000) || '',
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
        const analysisFile = path.join(downloadPath, `ai_page_complete_analysis_${Date.now()}.json`);
        fs.writeFileSync(analysisFile, JSON.stringify(pageAnalysis, null, 2));
        console.log(`\n💾 Análisis completo guardado en: ${analysisFile}`);
        
        // Mostrar contenido de texto de la página
        console.log('\n📝 CONTENIDO DE TEXTO DE LA PÁGINA (primeros 500 caracteres):');
        console.log('===============================================================');
        console.log(pageAnalysis.pageText.substring(0, 500) + '...');
        
    } catch (error) {
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
