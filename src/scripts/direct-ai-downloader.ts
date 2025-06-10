import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { ElementHandle, Page } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

// Definir interfaces para tipado
interface ClickableElement {
    index: number;
    tag: string;
    text: string;
    className: string;
    id: string;
    xpath: string;
}

async function directAIDownloader() {
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
        console.log('🎯 DESCARGADOR DIRECTO DE REPORTES DE IA');
        console.log('=========================================');
        console.log('Usa la información exacta del archivo de debug para hacer el proceso completo.');
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
        
        // Seleccionar trabajo - usar exactamente el mismo que en el debug
        console.log('📋 Usando información del archivo de debug...');
        const workTitle = "LA LECTURA.docx"; // Del archivo de debug
        
        console.log(`\n🎯 Procesando: "${workTitle}"`);
        
        // PASO 1: Abrir trabajo
        console.log('📋 PASO 1: Abriendo trabajo...');
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return;
        }
        
        // PASO 2: Encontrar página correcta
        console.log('🔍 PASO 2: Buscando ventana del reporte...');
        const browser = page.browser();
        const pages = await browser.pages();
        
        let workingPage = page;
        for (const p of pages) {
            const url = p.url();
            if (url.includes('ev.turnitin.com/app/carta')) {
                workingPage = p;
                console.log(`✅ Encontrada página: ${url}`);
                break;
            }
        }
        
        await workingPage.waitForTimeout(5000);
        
        // PASO 3: Usar información exacta del archivo de debug
        console.log('🤖 PASO 3: Haciendo clic en botón de IA usando información exacta del debug...');
        
        // Información exacta del archivo de debug
        const debugInfo = {
            xpath: "//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button",
            cssSelector: "tii-aiw-button.hydrated",
            submissionTrn: "trn:oid:::1:3272334500",
            expectedAttributes: {
                type: "ev",
                status: "success", 
                percent: "100"
            }
        };
        
        console.log(`🎯 XPath del debug: ${debugInfo.xpath}`);
        console.log(`🎯 CSS del debug: ${debugInfo.cssSelector}`);
        console.log(`🎯 Submission TRN: ${debugInfo.submissionTrn}`);
        
        // Configurar listener para nueva pestaña
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
            }, 15000);
        });
        
        // Verificar elementos disponibles usando CSS selector del debug
        console.log('🔍 Verificando elementos usando CSS selector del debug...');
        const cssElements = await workingPage.$$(debugInfo.cssSelector);
        console.log(`✅ Elementos encontrados con CSS: ${cssElements.length}`);
        
        if (cssElements.length > 0) {
            // Verificar atributos del primer elemento
            const elementInfo = await workingPage.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                    return {
                        tagName: element.tagName,
                        type: element.getAttribute('type'),
                        status: element.getAttribute('status'),
                        percent: element.getAttribute('percent'),
                        submissionTrn: element.getAttribute('submission-trn'),
                        className: element.className,
                        visible: window.getComputedStyle(element).display !== 'none'
                    };
                }
                return null;
            }, debugInfo.cssSelector);
            
            console.log('📋 Información del elemento encontrado:');
            console.log(`   Tag: ${elementInfo?.tagName}`);
            console.log(`   Type: ${elementInfo?.type}`);
            console.log(`   Status: ${elementInfo?.status}`);
            console.log(`   Percent: ${elementInfo?.percent}`);
            console.log(`   Submission TRN: ${elementInfo?.submissionTrn}`);
            console.log(`   Visible: ${elementInfo?.visible}`);
            
            // Verificar que los atributos coincidan con el debug
            const attributesMatch = 
                elementInfo?.type === debugInfo.expectedAttributes.type &&
                elementInfo?.status === debugInfo.expectedAttributes.status &&
                elementInfo?.percent === debugInfo.expectedAttributes.percent;
            
            if (attributesMatch) {
                console.log('✅ Atributos coinciden con el archivo de debug, haciendo clic...');
                
                await cssElements[0].click();
                console.log('✅ Clic en IA realizado usando CSS selector');
                
                // Esperar nueva pestaña
                console.log('⏳ Esperando nueva pestaña del reporte de IA...');
                aiReportPage = await pagePromise;
                
                if (aiReportPage) {
                    await aiReportPage.waitForTimeout(10000);
                    const aiUrl = aiReportPage.url();
                    console.log(`📍 URL del reporte: ${aiUrl}`);
                    
                    if (aiUrl.includes('integrity.turnitin.com')) {
                        console.log('✅ ¡Llegamos a la página del reporte de IA!');
                        
                        // PASO 4: Proceso de descarga interactivo
                        console.log('🔍 PASO 4: Iniciando proceso de descarga...');
                        await performInteractiveDownload(aiReportPage, scraper.getDownloadPath(), workTitle);
                        
                    } else {
                        console.log(`❌ URL inesperada: ${aiUrl}`);
                    }
                } else {
                    console.log('❌ No se abrió nueva pestaña');
                }
            } else {
                console.log('⚠️ Los atributos no coinciden con el archivo de debug');
                console.log('🔍 Elementos disponibles:');
                console.log(`   Esperado: type=${debugInfo.expectedAttributes.type}, status=${debugInfo.expectedAttributes.status}, percent=${debugInfo.expectedAttributes.percent}`);
                console.log(`   Encontrado: type=${elementInfo?.type}, status=${elementInfo?.status}, percent=${elementInfo?.percent}`);
            }
        } else {
            console.log('❌ No se encontró elemento con CSS selector del debug');
            
            // Intentar con XPath del debug
            console.log('🔄 Intentando con XPath del debug...');
            const xpathElements = await workingPage.$x(debugInfo.xpath);
            console.log(`🔍 Elementos encontrados con XPath: ${xpathElements.length}`);
            
            if (xpathElements.length > 0) {
                await (xpathElements[0] as ElementHandle<Element>).click();
                console.log('✅ Clic realizado usando XPath del debug');
                
                aiReportPage = await pagePromise;
                if (aiReportPage && aiReportPage.url().includes('integrity.turnitin.com')) {
                    console.log('✅ ¡Llegamos a la página del reporte de IA con XPath!');
                    await performInteractiveDownload(aiReportPage, scraper.getDownloadPath(), workTitle);
                }
            } else {
                console.log('❌ Tampoco se encontró con XPath del debug');
            }
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

async function performInteractiveDownload(page: Page, downloadPath: string, workTitle: string): Promise<void> {
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
        // Tomar screenshot
        const screenshotPath = path.join(downloadPath, `ai_report_page_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot: ${screenshotPath}`);
        
        // Analizar elementos clickeables
        const elements = await page.evaluate((): ClickableElement[] => {
            const clickables: ClickableElement[] = [];
            const selectors = ['button', 'a', '[role="button"]', '[onclick]', '*[class*="download"]', '*[id*="download"]'];
            
            selectors.forEach(selector => {
                try {
                    const found = Array.from(document.querySelectorAll(selector));
                    found.forEach(el => {
                        const isVisible = window.getComputedStyle(el).display !== 'none' && 
                                         window.getComputedStyle(el).visibility !== 'hidden' &&
                                         (el as HTMLElement).offsetWidth > 0;
                        
                        if (isVisible) {
                            // Generar XPath simple
                            let xpath = '';
                            if (el.id) {
                                xpath = `//*[@id="${el.id}"]`;
                            } else {
                                let current: Element | null = el;
                                const parts: string[] = [];
                                while (current && current.parentElement && parts.length < 6) {
                                    let part = current.tagName.toLowerCase();
                                    if (current.className) {
                                        const classes = current.className.split(' ').filter(c => c.length > 0);
                                        if (classes.length > 0) {
                                            part += `[@class="${current.className}"]`;
                                        }
                                    }
                                    parts.unshift(part);
                                    current = current.parentElement;
                                }
                                xpath = '//' + parts.join('/');
                            }
                            
                            clickables.push({
                                index: clickables.length + 1,
                                tag: el.tagName,
                                text: el.textContent?.trim().substring(0, 100) || '[Sin texto]',
                                className: el.className || '[Sin clases]',
                                id: el.id || '[Sin ID]',
                                xpath: xpath
                            });
                        }
                    });
                } catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            
            return clickables;
        });
        
        console.log(`\n📊 ELEMENTOS CLICKEABLES EN PÁGINA DE IA: ${elements.length}`);
        console.log('===========================================');
        
        if (elements.length === 0) {
            console.log('❌ No se encontraron elementos clickeables');
            
            // Mostrar contenido de la página
            const content = await page.evaluate(() => ({
                title: document.title,
                bodyText: document.body.textContent?.substring(0, 300),
                allElements: document.querySelectorAll('*').length
            }));
            
            console.log(`📄 Título: ${content.title}`);
            console.log(`📝 Contenido: ${content.bodyText}...`);
            console.log(`🔧 Total elementos DOM: ${content.allElements}`);
            
        } else {
            elements.forEach(el => {
                console.log(`\n${el.index}. <${el.tag}>:`);
                console.log(`   📝 Texto: "${el.text}"`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎨 Clases: "${el.className.substring(0, 50)}${el.className.length > 50 ? '...' : ''}"`);
                console.log(`   🎯 XPath: ${el.xpath}`);
            });
            
            let continueInteracting = true;
            while (continueInteracting) {
                console.log('\n🎯 OPCIONES:');
                console.log(`1-${elements.length}: Hacer clic en elemento`);
                console.log('r: Reanalizar página');
                console.log('q: Salir');
                
                const choice = await askQuestion('\n¿Qué hacer?: ');
                
                if (choice.toLowerCase() === 'q') {
                    continueInteracting = false;
                } else if (choice.toLowerCase() === 'r') {
                    console.log('🔄 Reanalizando...');
                    rl.close();
                    await performInteractiveDownload(page, downloadPath, workTitle);
                    return;
                } else {
                    const elementIndex = parseInt(choice) - 1;
                    
                    if (elementIndex >= 0 && elementIndex < elements.length) {
                        const selectedElement = elements[elementIndex];
                        console.log(`\n🖱️ Haciendo clic en: <${selectedElement.tag}> "${selectedElement.text}"`);
                        
                        // Obtener archivos antes del clic
                        const filesBefore = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                        
                        try {
                            const xpathElements = await page.$x(selectedElement.xpath);
                            if (xpathElements.length > 0) {
                                await (xpathElements[0] as ElementHandle<Element>).click();
                                console.log('✅ Clic realizado');
                                
                                console.log('⏳ Esperando respuesta (10 segundos)...');
                                await page.waitForTimeout(10000);
                                
                                // Verificar descargas
                                const filesAfter = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                                const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
                                
                                if (newFiles.length > 0) {
                                    console.log('🎉 ¡DESCARGA DETECTADA!');
                                    newFiles.forEach((file, index) => {
                                        const filePath = path.join(downloadPath, file);
                                        const stats = fs.statSync(filePath);
                                        console.log(`   📄 ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                                    });
                                    
                                    // Renombrar si es PDF
                                    const pdfFile = newFiles.find(f => f.endsWith('.pdf'));
                                    if (pdfFile) {
                                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                        const newName = `AI_Report_${workTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
                                        const oldPath = path.join(downloadPath, pdfFile);
                                        const newPath = path.join(downloadPath, newName);
                                        
                                        try {
                                            fs.renameSync(oldPath, newPath);
                                            console.log(`📝 Archivo renombrado: ${newName}`);
                                        } catch (error) {
                                            console.log(`⚠️ No se pudo renombrar: ${error}`);
                                        }
                                    }
                                    
                                    console.log('🎉 ¡PROCESO COMPLETADO EXITOSAMENTE!');
                                    continueInteracting = false;
                                    
                                } else {
                                    console.log('ℹ️ No se detectaron descargas. El clic podría haber abierto un popover o menú.');
                                    console.log('💡 Usa "r" para reanalizar la página y buscar nuevos elementos.');
                                }
                                
                                const newUrl = page.url();
                                console.log(`📍 URL: ${newUrl}`);
                                
                            } else {
                                console.log('❌ No se pudo encontrar el elemento para hacer clic');
                            }
                            
                        } catch (error) {
                            console.log(`❌ Error al hacer clic: ${error}`);
                        }
                    } else {
                        console.log('❌ Número inválido');
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error en análisis interactivo:', error);
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    directAIDownloader()
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}
