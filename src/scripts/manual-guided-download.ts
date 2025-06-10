import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { ElementHandle, Page } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

interface ManualStep {
    stepNumber: number;
    description: string;
    timestamp: number;
    elementInfo?: {
        tagName: string;
        className: string;
        id: string;
        text: string;
        xpath: string;
        cssSelector: string;
    };
    screenshotPath?: string;
}

interface GuidedSession {
    sessionId: string;
    workTitle: string;
    startTime: number;
    endTime?: number;
    finalUrl: string;
    manualSteps: ManualStep[];
    downloadedFiles: string[];
    success: boolean;
}

async function manualGuidedDownload() {
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
        console.log('🎯 DESCARGA GUIADA MANUAL - MODO PASO A PASO');
        console.log('============================================');
        console.log('Este script te llevará hasta la página del reporte de IA');
        console.log('y te guiará paso a paso para grabar MANUALMENTE cada acción.');
        console.log('');

        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        
        // Crear sesión guiada
        const session: GuidedSession = {
            sessionId: `guided_${Date.now()}`,
            workTitle: "LA LECTURA.docx",
            startTime: Date.now(),
            finalUrl: '',
            manualSteps: [],
            downloadedFiles: [],
            success: false
        };
        
        // Navegación automática usando el archivo JSON
        console.log('🚀 Navegando automáticamente hasta la página del reporte de IA...');
        
        await scraper.navigateToTurnitinInbox(page);
        
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        
        // Información del archivo JSON
        const jsonData = {
            workTitle: "LA LECTURA.docx",
            aiButtonCSS: "tii-aiw-button.hydrated",
            aiButtonXPath: "//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button",
            expectedUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
        };
        
        console.log(`🎯 Procesando: "${jsonData.workTitle}"`);
        
        // Abrir trabajo
        const clickSuccess = await scraper.findAndClickOnSubmission(page, jsonData.workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return;
        }
        
        // Encontrar página de Carta
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
        
        // Hacer clic en botón de IA
        console.log('🤖 Haciendo clic en botón de IA...');
        
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
        
        const aiElements = await workingPage.$$(jsonData.aiButtonCSS);
        if (aiElements.length > 0) {
            await aiElements[0].click();
            console.log('✅ Clic en IA realizado');
            
            aiReportPage = await pagePromise;
            
            if (aiReportPage) {
                await aiReportPage.waitForTimeout(8000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte: ${aiUrl}`);
                
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ ¡ÉXITO! Llegamos a la página del reporte de IA');
                    session.finalUrl = aiUrl;
                    
                    // INICIAR GUÍA MANUAL PASO A PASO
                    await startManualGuidedMode(aiReportPage, scraper.getDownloadPath(), session);
                    
                } else {
                    console.log(`❌ URL inesperada: ${aiUrl}`);
                }
            } else {
                console.log('❌ No se abrió nueva pestaña del reporte');
            }
        } else {
            console.log('❌ No se encontró el botón de IA');
        }
        
        // Guardar sesión
        const sessionFile = path.join(scraper.getDownloadPath(), `guided_session_${session.sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        console.log(`💾 Sesión guardada: ${sessionFile}`);
        
        if (session.success) {
            await generateManualScript(session, scraper.getDownloadPath());
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

async function startManualGuidedMode(page: Page, downloadPath: string, session: GuidedSession): Promise<void> {
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
        console.log('\n🎯 MODO GUIADO MANUAL ACTIVADO');
        console.log('===============================');
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('1. Vamos a grabar PASO A PASO cada acción que realices');
        console.log('2. Después de cada acción, me dirás qué elemento clickeaste');
        console.log('3. Tomaré screenshots y generaré XPaths de cada paso');
        console.log('4. Al final tendremos un script completamente automatizado');
        console.log('');
        
        // Screenshot inicial
        const initialScreenshot = path.join(downloadPath, `guided_initial_${session.sessionId}.png`);
        await page.screenshot({ path: initialScreenshot, fullPage: true });
        console.log(`📸 Screenshot inicial guardado: ${initialScreenshot}`);
        
        // Monitoreo de archivos inicial
        const initialFiles = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        
        let stepNumber = 1;
        let continueGuiding = true;
        
        console.log('\n🚀 COMENZANDO GUÍA PASO A PASO...');
        console.log('==================================');
        
        while (continueGuiding) {
            console.log(`\n📍 PASO ${stepNumber}:`);
            console.log(`Mira la página del navegador (${page.url()})`);
            
            const action = await askQuestion(`¿Qué acción quieres realizar? (clic/hover/esperar/terminar): `);
            
            if (action.toLowerCase() === 'terminar') {
                console.log('🏁 Terminando guía manual...');
                continueGuiding = false;
                break;
            }
            
            if (action.toLowerCase() === 'esperar') {
                const waitTime = await askQuestion('¿Cuántos segundos esperar? (ej: 3): ');
                const seconds = parseInt(waitTime) || 3;
                
                console.log(`⏳ Esperando ${seconds} segundos...`);
                await page.waitForTimeout(seconds * 1000);
                
                const step: ManualStep = {
                    stepNumber: stepNumber,
                    description: `Esperar ${seconds} segundos`,
                    timestamp: Date.now()
                };
                
                session.manualSteps.push(step);
                stepNumber++;
                continue;
            }
            
            if (action.toLowerCase() === 'clic') {
                console.log('\n🖱️ PREPARÁNDOSE PARA CLIC...');
                console.log('En el navegador, INSPECCIONA EL ELEMENTO que vas a clickear (F12 > clic derecho > Inspeccionar)');
                
                const elementDescription = await askQuestion('Describe el elemento (ej: "botón de descarga azul", "enlace PDF"): ');
                
                // Analizar elementos en la página antes del clic
                console.log('🔍 Analizando elementos clickeables en la página...');
                
                const clickableElements = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="button"], input[type="submit"]'));
                    
                    return elements.map((el, index) => {
                        // Generar XPath
                        function generateXPath(element: Element): string {
                            if (element.id) {
                                return `//*[@id="${element.id}"]`;
                            }
                            
                            const parts: string[] = [];
                            let current: Element | null = element;
                            
                            while (current && current.parentElement) {
                                let tagName = current.tagName.toLowerCase();
                                let index = 1;
                                
                                let sibling = current.previousElementSibling;
                                while (sibling) {
                                    if (sibling.tagName === current.tagName) {
                                        index++;
                                    }
                                    sibling = sibling.previousElementSibling;
                                }
                                
                                const siblings = Array.from(current.parentElement.children).filter(
                                    child => child.tagName === current!.tagName
                                );
                                
                                if (siblings.length > 1) {
                                    tagName += `[${index}]`;
                                }
                                
                                parts.unshift(tagName);
                                current = current.parentElement;
                                
                                if (parts.length > 6) break;
                            }
                            
                            return '//' + parts.join('/');
                        }
                        
                        const isVisible = window.getComputedStyle(el).display !== 'none' && 
                                         window.getComputedStyle(el).visibility !== 'hidden' &&
                                         (el as HTMLElement).offsetWidth > 0;
                        
                        if (isVisible) {
                            return {
                                index: index + 1,
                                tagName: el.tagName,
                                text: el.textContent?.trim().substring(0, 60) || '[Sin texto]',
                                className: el.className || '[Sin clases]',
                                id: el.id || '[Sin ID]',
                                xpath: generateXPath(el),
                                cssSelector: el.id ? `#${el.id}` : el.tagName.toLowerCase()
                            };
                        }
                        return null;
                    }).filter(Boolean);
                });
                
                if (clickableElements.length > 0) {
                    console.log('\n📋 ELEMENTOS CLICKEABLES DISPONIBLES:');
                    clickableElements.forEach((el, index) => {
                        if (el) { // Verificar que el elemento no sea null
                            console.log(`   ${index + 1}. <${el.tagName}> "${el.text}" (ID: ${el.id})`);
                            console.log(`      XPath: ${el.xpath}`);
                            console.log(`      CSS: ${el.cssSelector}`);
                            console.log('');
                        }
                    });
                    
                    const elementChoice = await askQuestion(`¿Cuál elemento vas a clickear? (1-${clickableElements.length}): `);
                    const choiceIndex = parseInt(elementChoice) - 1;
                    
                    if (choiceIndex >= 0 && choiceIndex < clickableElements.length) {
                        const selectedElement = clickableElements[choiceIndex];
                        
                        if (selectedElement) { // Verificar que el elemento seleccionado no sea null
                            console.log(`\n🎯 Elemento seleccionado: <${selectedElement.tagName}> "${selectedElement.text}"`);
                            console.log(`XPath: ${selectedElement.xpath}`);
                            
                            const confirm = await askQuestion('¿Confirmas que quieres hacer clic en este elemento? (s/n): ');
                            
                            if (confirm.toLowerCase() === 's') {
                                // Tomar screenshot antes del clic
                                const beforeScreenshot = path.join(downloadPath, `guided_step_${stepNumber}_before.png`);
                                await page.screenshot({ path: beforeScreenshot, fullPage: true });
                                
                                console.log('🖱️ Realizando clic...');
                                
                                try {
                                    const elements = await page.$x(selectedElement.xpath);
                                    if (elements.length > 0) {
                                        await (elements[0] as ElementHandle<Element>).click();
                                        console.log('✅ Clic realizado exitosamente');
                                        
                                        // Esperar un poco después del clic
                                        await page.waitForTimeout(3000);
                                        
                                        // Tomar screenshot después del clic
                                        const afterScreenshot = path.join(downloadPath, `guided_step_${stepNumber}_after.png`);
                                        await page.screenshot({ path: afterScreenshot, fullPage: true });
                                        
                                        const step: ManualStep = {
                                            stepNumber: stepNumber,
                                            description: `${elementDescription} - Clic en <${selectedElement.tagName}> "${selectedElement.text}"`,
                                            timestamp: Date.now(),
                                            elementInfo: {
                                                tagName: selectedElement.tagName,
                                                className: selectedElement.className,
                                                id: selectedElement.id,
                                                text: selectedElement.text,
                                                xpath: selectedElement.xpath,
                                                cssSelector: selectedElement.cssSelector
                                            },
                                            screenshotPath: afterScreenshot
                                        };
                                        
                                        session.manualSteps.push(step);
                                        
                                        console.log(`📸 Screenshots guardados:`);
                                        console.log(`   Antes: ${beforeScreenshot}`);
                                        console.log(`   Después: ${afterScreenshot}`);
                                        
                                    } else {
                                        console.log('❌ No se pudo encontrar el elemento para hacer clic');
                                    }
                                    
                                } catch (error) {
                                    console.log(`❌ Error al hacer clic: ${error}`);
                                }
                            } else {
                                console.log('❌ Clic cancelado');
                                continue;
                            }
                        } else {
                            console.log('❌ Elemento seleccionado es inválido');
                            continue;
                        }
                    } else {
                        console.log('❌ Número de elemento inválido');
                        continue;
                    }
                } else {
                    console.log('❌ No se encontraron elementos clickeables en la página');
                }
            }
            
            stepNumber++;
            
            // Verificar si se descargaron archivos
            const currentFiles = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
            const newFiles = currentFiles.filter(f => !initialFiles.includes(f) && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
            
            if (newFiles.length > 0) {
                console.log('\n🎉 ¡DESCARGA DETECTADA!');
                newFiles.forEach((file, index) => {
                    console.log(`   📄 ${index + 1}. ${file}`);
                });
                
                session.downloadedFiles = newFiles;
                session.success = true;
                
                const shouldContinue = await askQuestion('¿Quieres agregar más pasos o terminar aquí? (continuar/terminar): ');
                if (shouldContinue.toLowerCase() === 'terminar') {
                    continueGuiding = false;
                }
            }
        }
        
        session.endTime = Date.now();
        
        // Resumen final
        console.log('\n📋 RESUMEN DE LA SESIÓN GUIADA:');
        console.log('================================');
        console.log(`⏱️ Duración: ${((session.endTime - session.startTime) / 1000).toFixed(2)} segundos`);
        console.log(`📝 Pasos grabados: ${session.manualSteps.length}`);
        console.log(`📁 Archivos descargados: ${session.downloadedFiles.length}`);
        console.log(`✅ Éxito: ${session.success ? 'SÍ' : 'NO'}`);
        
        if (session.manualSteps.length > 0) {
            console.log('\n🎬 SECUENCIA DE PASOS:');
            session.manualSteps.forEach((step, index) => {
                console.log(`   ${step.stepNumber}. ${step.description}`);
                if (step.elementInfo) {
                    console.log(`      XPath: ${step.elementInfo.xpath}`);
                }
            });
        }
        
        if (session.success) {
            console.log('\n🎉 ¡GUÍA COMPLETADA EXITOSAMENTE!');
            console.log('📝 Generando script automático...');
        }
        
    } catch (error) {
        console.error('❌ Error en modo guiado:', error);
    } finally {
        rl.close();
    }
}

async function generateManualScript(session: GuidedSession, downloadPath: string): Promise<void> {
    const scriptContent = `// Script generado desde guía manual paso a paso
// Sesión: ${session.sessionId}
// Trabajo: ${session.workTitle}
// Fecha: ${new Date().toISOString()}
// Pasos: ${session.manualSteps.length}

import { Page } from 'puppeteer';
import { ElementHandle } from 'puppeteer';

export async function executeManualLearnedSequence(page: Page): Promise<boolean> {
    console.log('🤖 Ejecutando secuencia aprendida manualmente...');
    
    try {
${session.manualSteps.map((step) => {
    if (step.description.includes('Esperar')) {
        const waitTime = step.description.match(/(\d+) segundos/);
        const seconds = waitTime ? waitTime[1] : '3';
        return `        // Paso ${step.stepNumber}: ${step.description}
        await page.waitForTimeout(${seconds}000);`;
    } else if (step.elementInfo) {
        return `        // Paso ${step.stepNumber}: ${step.description}
        try {
            const elements_${step.stepNumber} = await page.$x('${step.elementInfo.xpath}');
            if (elements_${step.stepNumber}.length > 0) {
                await (elements_${step.stepNumber}[0] as ElementHandle<Element>).click();
                console.log('✅ Paso ${step.stepNumber}: ${step.elementInfo.tagName}');
                await page.waitForTimeout(2000); // Espera después del clic
            } else {
                console.log('⚠️ Elemento no encontrado en paso ${step.stepNumber}');
            }
        } catch (error) {
            console.log('❌ Error en paso ${step.stepNumber}:', error);
        }`;
    }
    return '';
}).filter(Boolean).join('\n')}
        
        // Espera final para asegurar descarga
        console.log('⏳ Esperando finalización de descarga...');
        await page.waitForTimeout(10000);
        
        console.log('✅ Secuencia manual completada');
        return true;
        
    } catch (error) {
        console.error('❌ Error ejecutando secuencia manual:', error);
        return false;
    }
}

// Información de los pasos grabados:
/*
${session.manualSteps.map(step => `Paso ${step.stepNumber}: ${step.description}${step.elementInfo ? `\n   XPath: ${step.elementInfo.xpath}` : ''}`).join('\n')}
*/
`;
    
    const scriptPath = path.join(downloadPath, `manual_learned_sequence_${session.sessionId}.ts`);
    fs.writeFileSync(scriptPath, scriptContent);
    
    console.log(`📝 Script automático generado: ${scriptPath}`);
    console.log('💡 Este script se puede usar para automatizar futuras descargas');
}

if (require.main === module) {
    manualGuidedDownload()
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}
