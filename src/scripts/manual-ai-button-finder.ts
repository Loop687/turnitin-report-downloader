import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { ElementHandle, Page } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

async function manualAIButtonFinder() {
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
        console.log('🔍 FINDER MANUAL DEL BOTÓN DE IA - MODO INTERACTIVO');
        console.log('==================================================');
        console.log('Este modo te mostrará todos los botones disponibles');
        console.log('y tú podrás seleccionar cuál es el botón de IA.');
        console.log('');

        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        
        // Navegar a la bandeja de entrada
        await scraper.navigateToTurnitinInbox(page);
        
        // Verificar login
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        
        // Seleccionar un trabajo para analizar
        const workTitle = await askQuestion('¿Cuál es el título del trabajo que quieres analizar? (ej: "LA LECTURA.docx"): ');
        
        console.log(`\n🎯 Buscando trabajo: "${workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        
        if (!clickSuccess) {
            console.log('❌ No se pudo encontrar o hacer clic en el trabajo');
            return;
        }
        
        // Verificar si hay múltiples páginas abiertas (nueva ventana)
        const browser = page.browser();
        const pages = await browser.pages();
        console.log(`📑 Páginas abiertas: ${pages.length}`);
        
        let workingPage = page;
        
        if (pages.length > 1) {
            // Buscar la página que contiene 'carta' en la URL
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
        
        // Esperar un poco más para que cargue completamente
        await workingPage.waitForTimeout(5000);
        
        console.log('\n🔍 Escaneando todos los elementos clickeables en la página...');
        
        // Buscar elementos específicos y crear una lista más ordenada
        const allElements = await workingPage.evaluate(() => {
            const foundElements: any[] = [];
            
            // 1. Buscar específicamente elementos de IA de Turnitin
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
                            priority: 1, // Alta prioridad para elementos de IA
                            category: 'Turnitin AI'
                        });
                    });
                } catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            
            // 2. Buscar elementos anidados dentro de componentes de IA
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
            
            // 3. Buscar otros elementos clickeables
            const otherSelectors = ['button', 'a', '[role="button"]', '[onclick]'];
            otherSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    elements.forEach(el => {
                        // Evitar duplicados
                        const isDuplicate = foundElements.some(item => item.element === el);
                        if (!isDuplicate) {
                            foundElements.push({
                                element: el,
                                priority: 2,
                                category: 'Otros'
                            });
                        }
                    });
                } catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            
            // Procesar elementos y crear datos estructurados
            return foundElements.map((item, index) => {
                const element = item.element;
                
                // Generar XPath mejorado
                const generateXPath = (el: Element): string => {
                    if (el.id) {
                        return `//*[@id="${el.id}"]`;
                    }
                    
                    const parts: string[] = [];
                    let currentEl: Element | null = el;
                    
                    while (currentEl && currentEl.parentElement) {
                        let tagName = currentEl.tagName.toLowerCase();
                        let index = 1;
                        
                        // Contar hermanos del mismo tipo
                        let sibling = currentEl.previousElementSibling;
                        while (sibling) {
                            if (sibling.tagName === currentEl.tagName) {
                                index++;
                            }
                            sibling = sibling.previousElementSibling;
                        }
                        
                        // Solo agregar índice si hay múltiples hermanos
                        const siblings = Array.from(currentEl.parentElement.children).filter(
                            child => child.tagName === currentEl!.tagName // Usar ! para indicar que sabemos que no es null
                        );
                        
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
                            (element as HTMLElement).offsetWidth > 0 && 
                            (element as HTMLElement).offsetHeight > 0,
                    turnitinAttributes: {
                        type: element.getAttribute('type'),
                        status: element.getAttribute('status'),
                        percent: element.getAttribute('percent'),
                        submissionTrn: element.getAttribute('submission-trn')
                    },
                    outerHTML: element.outerHTML?.substring(0, 200) + '...'
                };
                
                return elementData;
            }).filter(el => el.visible); // Solo elementos visibles
        });
        
        // Separar elementos por categoría
        const aiElements = allElements.filter(el => el.category.includes('Turnitin'));
        const otherElements = allElements.filter(el => !el.category.includes('Turnitin'));
        
        console.log(`\n📊 Encontrados ${allElements.length} elementos clickeables visibles`);
        console.log(`   🤖 Elementos de IA: ${aiElements.length}`);
        console.log(`   🔘 Otros elementos: ${otherElements.length}`);
        
        // Mostrar elementos de IA primero
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
        
        // Mostrar algunos otros elementos
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
        
        let selectedElement: any;
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
        } else {
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
        
        // Probar el clic
        const testClick = await askQuestion('\n¿Quieres probar hacer clic en este elemento? (s/n): ');
        
        if (testClick.toLowerCase() === 's') {
            try {
                console.log(`🖱️ Haciendo clic en el elemento...`);
                
                const targetXPath = useCustomXPath ? customXPath : selectedElement.xpath;
                let success = false;
                
                // Configurar listener para nuevas pestañas antes del clic
                const browser = workingPage.browser();
                let newPage: Page | null = null;
                
                const pagePromise = new Promise<Page | null>((resolve) => {
                    const onTargetCreated = async (target: any) => {
                        if (target.type() === 'page') {
                            const page = await target.page();
                            resolve(page);
                        }
                    };
                    browser.on('targetcreated', onTargetCreated);
                    
                    // Timeout de seguridad
                    setTimeout(() => {
                        browser.off('targetcreated', onTargetCreated);
                        resolve(null);
                    }, 10000);
                });
                
                // Intentar clic con XPath
                try {
                    const elements = await workingPage.$x(targetXPath);
                    console.log(`🔍 Elementos encontrados con XPath: ${elements.length}`);
                    
                    if (elements.length > 0) {
                        await (elements[0] as ElementHandle<Element>).click();
                        console.log('✅ Clic realizado con XPath');
                        success = true;
                    } else {
                        console.log('⚠️ No se encontraron elementos con XPath');
                    }
                } catch (error) {
                    console.log(`❌ Error con XPath: ${error}`);
                }
                
                // Si XPath falló y no es personalizado, intentar CSS
                if (!success && !useCustomXPath && selectedElement.cssSelector) {
                    try {
                        await workingPage.click(selectedElement.cssSelector);
                        console.log('✅ Clic realizado con CSS selector');
                        success = true;
                    } catch (error) {
                        console.log(`❌ Error con CSS: ${error}`);
                    }
                }
                
                if (success) {
                    console.log('⏳ Esperando nueva pestaña...');
                    
                    // Esperar a que se abra nueva pestaña
                    newPage = await pagePromise;
                    
                    let targetPage = workingPage; // Por defecto usar la página actual
                    
                    if (newPage) {
                        console.log('🆕 Nueva pestaña detectada');
                        await newPage.waitForTimeout(5000); // Esperar a que cargue
                        
                        const newUrl = newPage.url();
                        console.log(`📍 URL de nueva pestaña: ${newUrl}`);
                        
                        // Verificar si la nueva pestaña es de Turnitin Integrity (reporte de IA)
                        if (newUrl.includes('integrity.turnitin.com') || newUrl.includes('awo-usw2.integrity.turnitin.com')) {
                            console.log('✅ Nueva pestaña es del reporte de IA, cambiando contexto...');
                            targetPage = newPage;
                        } else {
                            console.log('⚠️ Nueva pestaña no parece ser del reporte de IA');
                        }
                    } else {
                        console.log('ℹ️ No se detectó nueva pestaña, analizando página actual...');
                        await workingPage.waitForTimeout(5000);
                    }
                    
                    const finalUrl = targetPage.url();
                    console.log(`📍 URL final analizada: ${finalUrl}`);
                    
                    // Verificar cambios en la página correcta
                    const pageInfo = await targetPage.evaluate(() => ({
                        title: document.title,
                        url: window.location.href,
                        hasAIContent: document.body.textContent?.toLowerCase().includes('artificial intelligence') ||
                                     document.body.textContent?.toLowerCase().includes('ai detection') ||
                                     document.body.textContent?.toLowerCase().includes('ai writing') ||
                                     document.body.textContent?.toLowerCase().includes('detected as ai'),
                        hasDownloadLinks: document.querySelectorAll('*[href*="download"], *[title*="download"], button[title*="Download"], a[title*="Download"]').length,
                        contentPreview: document.body.textContent?.substring(0, 500) || '',
                        // Buscar específicamente elementos de descarga
                        downloadElements: Array.from(document.querySelectorAll('button, a')).filter(el => {
                            const text = el.textContent?.toLowerCase() || '';
                            const title = el.getAttribute('title')?.toLowerCase() || '';
                            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                            return text.includes('download') || title.includes('download') || ariaLabel.includes('download');
                        }).map(el => ({
                            tag: el.tagName,
                            text: el.textContent?.trim(),
                            title: el.getAttribute('title'),
                            href: (el as HTMLAnchorElement).href || 'N/A'
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
                        
                        // Usar el XPath específico que encontraste
                        const specificDownloadXPath = '//*[@id="download-popover"]/ul/li/button';
                        console.log('\n🎯 Usando XPath específico del botón de descarga...');
                        
                        const tryDownload = await askQuestion('\n¿Quieres intentar descargar usando el XPath específico? (s/n): ');
                        
                        if (tryDownload.toLowerCase() === 's') {
                            try {
                                console.log(`🖱️ Haciendo clic en: ${specificDownloadXPath}`);
                                
                                // Intentar con el XPath específico
                                const downloadElements = await targetPage.$x(specificDownloadXPath);
                                console.log(`🔍 Elementos encontrados con XPath de descarga: ${downloadElements.length}`);
                                
                                if (downloadElements.length > 0) {
                                    // Configurar listener para descargas antes del clic
                                    console.log('📁 Configurando directorio de descarga...');
                                    
                                    // Configurar descarga
                                    const client = await targetPage.target().createCDPSession();
                                    await client.send('Page.setDownloadBehavior', {
                                        behavior: 'allow',
                                        downloadPath: scraper.getDownloadPath()
                                    });
                                    
                                    // Hacer clic en el botón de descarga
                                    await (downloadElements[0] as ElementHandle<Element>).click();
                                    console.log('✅ Clic en descarga realizado exitosamente');
                                    
                                    console.log('⏳ Esperando descarga (15 segundos)...');
                                    await targetPage.waitForTimeout(15000);
                                    
                                    // Verificar archivos descargados
                                    const downloadPath = scraper.getDownloadPath();
                                    console.log(`📂 Verificando archivos en: ${downloadPath}`);
                                    
                                    try {
                                        const fs = require('fs');
                                        const files = fs.readdirSync(downloadPath);
                                        const pdfFiles = files.filter((f: string) => f.endsWith('.pdf'));
                                        const recentFiles = files.filter((f: string) => {
                                            const filePath = path.join(downloadPath, f);
                                            const stats = fs.statSync(filePath);
                                            const now = new Date();
                                            const fileTime = new Date(stats.mtime);
                                            return (now.getTime() - fileTime.getTime()) < 60000; // Archivos de los últimos 60 segundos
                                        });
                                        
                                        console.log(`📋 Archivos en directorio: ${files.length}`);
                                        console.log(`📄 Archivos PDF: ${pdfFiles.length}`);
                                        console.log(`🕐 Archivos recientes: ${recentFiles.length}`);
                                        
                                        if (recentFiles.length > 0) {
                                            console.log('\n✅ ¡DESCARGA EXITOSA!');
                                            console.log('📁 Archivos descargados recientemente:');
                                            recentFiles.forEach((file, index) => {
                                                const filePath = path.join(downloadPath, file);
                                                const stats = fs.statSync(filePath);
                                                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                                            });
                                            
                                            // Renombrar el archivo más reciente si es PDF
                                            const recentPdf = recentFiles.find((f: string) => f.endsWith('.pdf'));
                                            if (recentPdf) {
                                                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                                const newName = `AI_Report_${workTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
                                                const oldPath = path.join(downloadPath, recentPdf);
                                                const newPath = path.join(downloadPath, newName);
                                                
                                                try {
                                                    fs.renameSync(oldPath, newPath);
                                                    console.log(`📝 Archivo renombrado a: ${newName}`);
                                                } catch (error) {
                                                    console.log(`⚠️ No se pudo renombrar: ${error}`);
                                                }
                                            }
                                        } else {
                                            console.log('⚠️ No se detectaron archivos descargados recientemente');
                                            console.log('💡 Verifica tu carpeta de descargas del navegador');
                                        }
                                        
                                    } catch (error) {
                                        console.log(`❌ Error verificando archivos: ${error}`);
                                    }
                                    
                                } else {
                                    console.log('❌ No se encontró el botón de descarga con el XPath específico');
                                    
                                    // Fallback: buscar cualquier botón de descarga
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
                                            (downloadButtons[0] as HTMLElement).click();
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
                                    } else {
                                        console.log('❌ No se encontraron botones de descarga alternativos');
                                    }
                                }
                                
                            } catch (error) {
                                console.log(`❌ Error durante la descarga: ${error}`);
                            }
                        }
                    } else {
                        // Si no se detectaron elementos de descarga automáticamente, usar el XPath específico
                        console.log('\n🎯 No se detectaron elementos automáticamente, usando XPath específico...');
                        
                        const trySpecificXPath = await askQuestion('¿Quieres probar el XPath específico del botón de descarga? (s/n): ');
                        
                        if (trySpecificXPath.toLowerCase() === 's') {
                            try {
                                const specificDownloadXPath = '//*[@id="download-popover"]/ul/li/button';
                                console.log(`🖱️ Probando XPath: ${specificDownloadXPath}`);
                                
                                const elements = await targetPage.$x(specificDownloadXPath);
                                console.log(`🔍 Elementos encontrados: ${elements.length}`);
                                
                                if (elements.length > 0) {
                                    await (elements[0] as ElementHandle<Element>).click();
                                    console.log('✅ Clic realizado en botón de descarga');
                                    console.log('⏳ Esperando descarga (10 segundos)...');
                                    await targetPage.waitForTimeout(10000);
                                    console.log('📋 Verifica tu carpeta de descargas');
                                } else {
                                    console.log('❌ No se encontró el elemento con el XPath específico');
                                }
                                
                            } catch (error) {
                                console.log(`❌ Error con XPath específico: ${error}`);
                            }
                        }
                    }
                    
                } else {
                    console.log('❌ No se pudo hacer clic en el elemento');
                }
                
            } catch (error) {
                console.log(`❌ Error durante el test: ${error}`);
            }
        }
        
        // Guardar información para debugging
        const debugInfo = {
            workTitle: workTitle,
            pageUrl: workingPage.url(),
            totalElements: allElements.length,
            aiElements: aiElements,
            selectedElement: selectedElement,
            timestamp: new Date().toISOString()
        };
        
        const debugFile = path.join(scraper.getDownloadPath(), `ai-finder-debug-${Date.now()}.json`);
        fs.writeFileSync(debugFile, JSON.stringify(debugInfo, null, 2));
        console.log(`\n💾 Información de debug guardada en: ${debugFile}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
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
