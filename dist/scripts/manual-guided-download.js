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
async function manualGuidedDownload() {
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
        console.log('🎯 DESCARGA GUIADA MANUAL - MODO PASO A PASO');
        console.log('============================================');
        console.log('Este script te llevará hasta la página del reporte de IA');
        console.log('y te guiará paso a paso para grabar MANUALMENTE cada acción.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        const session = {
            sessionId: `guided_${Date.now()}`,
            workTitle: "LA LECTURA.docx",
            startTime: Date.now(),
            finalUrl: '',
            manualSteps: [],
            downloadedFiles: [],
            success: false
        };
        console.log('🚀 Navegando automáticamente hasta la página del reporte de IA...');
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        const jsonData = {
            workTitle: "LA LECTURA.docx",
            aiButtonCSS: "tii-aiw-button.hydrated",
            aiButtonXPath: "//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button",
            expectedUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
        };
        console.log(`🎯 Procesando: "${jsonData.workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, jsonData.workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return;
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
                    await startManualGuidedMode(aiReportPage, scraper.getDownloadPath(), session);
                }
                else {
                    console.log(`❌ URL inesperada: ${aiUrl}`);
                }
            }
            else {
                console.log('❌ No se abrió nueva pestaña del reporte');
            }
        }
        else {
            console.log('❌ No se encontró el botón de IA');
        }
        const sessionFile = path_1.default.join(scraper.getDownloadPath(), `guided_session_${session.sessionId}.json`);
        fs_1.default.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        console.log(`💾 Sesión guardada: ${sessionFile}`);
        if (session.success) {
            await generateManualScript(session, scraper.getDownloadPath());
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
async function startManualGuidedMode(page, downloadPath, session) {
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
        console.log('\n🎯 MODO GUIADO MANUAL ACTIVADO');
        console.log('===============================');
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('1. Vamos a grabar PASO A PASO cada acción que realices');
        console.log('2. Después de cada acción, me dirás qué elemento clickeaste');
        console.log('3. Tomaré screenshots y generaré XPaths de cada paso');
        console.log('4. Al final tendremos un script completamente automatizado');
        console.log('');
        const initialScreenshot = path_1.default.join(downloadPath, `guided_initial_${session.sessionId}.png`);
        await page.screenshot({ path: initialScreenshot, fullPage: true });
        console.log(`📸 Screenshot inicial guardado: ${initialScreenshot}`);
        const initialFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
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
                const step = {
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
                console.log('🔍 Analizando elementos clickeables en la página...');
                const clickableElements = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="button"], input[type="submit"]'));
                    return elements.map((el, index) => {
                        function generateXPath(element) {
                            if (element.id) {
                                return `//*[@id="${element.id}"]`;
                            }
                            const parts = [];
                            let current = element;
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
                                const siblings = Array.from(current.parentElement.children).filter(child => child.tagName === current.tagName);
                                if (siblings.length > 1) {
                                    tagName += `[${index}]`;
                                }
                                parts.unshift(tagName);
                                current = current.parentElement;
                                if (parts.length > 6)
                                    break;
                            }
                            return '//' + parts.join('/');
                        }
                        const isVisible = window.getComputedStyle(el).display !== 'none' &&
                            window.getComputedStyle(el).visibility !== 'hidden' &&
                            el.offsetWidth > 0;
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
                        if (el) {
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
                        if (selectedElement) {
                            console.log(`\n🎯 Elemento seleccionado: <${selectedElement.tagName}> "${selectedElement.text}"`);
                            console.log(`XPath: ${selectedElement.xpath}`);
                            const confirm = await askQuestion('¿Confirmas que quieres hacer clic en este elemento? (s/n): ');
                            if (confirm.toLowerCase() === 's') {
                                const beforeScreenshot = path_1.default.join(downloadPath, `guided_step_${stepNumber}_before.png`);
                                await page.screenshot({ path: beforeScreenshot, fullPage: true });
                                console.log('🖱️ Realizando clic...');
                                try {
                                    const elements = await page.$x(selectedElement.xpath);
                                    if (elements.length > 0) {
                                        await elements[0].click();
                                        console.log('✅ Clic realizado exitosamente');
                                        await page.waitForTimeout(3000);
                                        const afterScreenshot = path_1.default.join(downloadPath, `guided_step_${stepNumber}_after.png`);
                                        await page.screenshot({ path: afterScreenshot, fullPage: true });
                                        const step = {
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
                                    }
                                    else {
                                        console.log('❌ No se pudo encontrar el elemento para hacer clic');
                                    }
                                }
                                catch (error) {
                                    console.log(`❌ Error al hacer clic: ${error}`);
                                }
                            }
                            else {
                                console.log('❌ Clic cancelado');
                                continue;
                            }
                        }
                        else {
                            console.log('❌ Elemento seleccionado es inválido');
                            continue;
                        }
                    }
                    else {
                        console.log('❌ Número de elemento inválido');
                        continue;
                    }
                }
                else {
                    console.log('❌ No se encontraron elementos clickeables en la página');
                }
            }
            stepNumber++;
            const currentFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
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
    }
    catch (error) {
        console.error('❌ Error en modo guiado:', error);
    }
    finally {
        rl.close();
    }
}
async function generateManualScript(session, downloadPath) {
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
        }
        else if (step.elementInfo) {
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
    const scriptPath = path_1.default.join(downloadPath, `manual_learned_sequence_${session.sessionId}.ts`);
    fs_1.default.writeFileSync(scriptPath, scriptContent);
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
