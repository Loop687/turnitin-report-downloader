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
async function learnDownloadActions() {
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
        console.log('🎓 APRENDIZAJE DE ACCIONES DE DESCARGA');
        console.log('=====================================');
        console.log('Este script llegará hasta la página final del reporte de IA');
        console.log('y grabará TODAS tus acciones para automatizar el proceso.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        // Crear sesión de aprendizaje
        const session = {
            sessionId: `learn_${Date.now()}`,
            workTitle: "LA LECTURA.docx",
            startTime: Date.now(),
            finalUrl: '',
            userActions: [],
            downloadedFiles: [],
            success: false
        };
        // Navegación automática hasta la página final
        console.log('🚀 Navegando automáticamente hasta la página del reporte de IA...');
        await navigateToFinalAIPage(scraper, page, session);
        // Verificar que llegamos a la página correcta
        const currentUrl = page.url();
        console.log(`📍 URL final alcanzada: ${currentUrl}`);
        if (!currentUrl.includes('integrity.turnitin.com')) {
            console.log('❌ No se pudo llegar a la página del reporte de IA');
            console.log(`   URL actual: ${currentUrl}`);
            console.log(`   URL esperada: debe contener "integrity.turnitin.com"`);
            return;
        }
        session.finalUrl = currentUrl;
        console.log(`✅ ¡ÉXITO! Llegamos a la página del reporte de IA: ${session.finalUrl}`);
        // INICIO DEL MODO APRENDIZAJE
        await startLearningMode(page, scraper.getDownloadPath(), session);
        // Guardar sesión de aprendizaje
        const sessionFile = path_1.default.join(scraper.getDownloadPath(), `download_learning_session_${session.sessionId}.json`);
        fs_1.default.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        console.log(`💾 Sesión de aprendizaje guardada: ${sessionFile}`);
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
async function navigateToFinalAIPage(scraper, page, session) {
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
        // Usar información exacta del archivo JSON que proporcionaste
        const debugInfo = {
            workTitle: "LA LECTURA.docx",
            aiButtonXPath: "//body/div[6]/div[1]/aside/div[1]/div[3]/tii-aiw-button",
            aiButtonCSS: "tii-aiw-button.hydrated",
            expectedAttributes: {
                type: "ev",
                status: "success",
                percent: "100",
                submissionTrn: "trn:oid:::1:3272334500"
            }
        };
        await scraper.navigateToTurnitinInbox(page);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(page);
        }
        console.log(`🎯 Procesando: "${debugInfo.workTitle}"`);
        const clickSuccess = await scraper.findAndClickOnSubmission(page, debugInfo.workTitle);
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
        console.log('🤖 Haciendo clic en botón de IA usando información del archivo JSON...');
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
        const cssElements = await workingPage.$$(debugInfo.aiButtonCSS);
        if (cssElements.length > 0) {
            await cssElements[0].click();
            console.log('✅ Clic en IA realizado');
            aiReportPage = await pagePromise;
            if (aiReportPage) {
                await aiReportPage.waitForTimeout(10000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte: ${aiUrl}`);
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ Nueva pestaña del reporte de IA confirmada');
                    // Actualizar la referencia de página para que el script principal use la nueva pestaña
                    Object.setPrototypeOf(page, Object.getPrototypeOf(aiReportPage));
                    Object.assign(page, aiReportPage);
                    // Verificar que la página esté completamente cargada
                    console.log('⏳ Esperando que la página del reporte cargue completamente...');
                    await page.waitForTimeout(8000);
                    console.log('✅ Página del reporte de IA lista para el modo aprendizaje');
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
async function startLearningMode(page, downloadPath, session) {
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
        console.log('\n🎓 MODO APRENDIZAJE ACTIVADO');
        console.log('============================');
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('1. NO cierres ni cambies de esta ventana del navegador');
        console.log('2. Realiza MANUALMENTE todos los pasos para descargar el reporte');
        console.log('3. El script grabará AUTOMÁTICAMENTE todas tus acciones');
        console.log('4. Cuando hayas descargado el archivo, presiona ENTER aquí');
        console.log('');
        console.log('🎯 Acciones que se grabarán:');
        console.log('   ✅ Clics en botones/enlaces');
        console.log('   ✅ Hovers sobre elementos');
        console.log('   ✅ Scrolls en la página');
        console.log('   ✅ Esperas/pausas');
        console.log('');
        // Tomar screenshot inicial
        const initialScreenshot = path_1.default.join(downloadPath, `learning_initial_${session.sessionId}.png`);
        await page.screenshot({ path: initialScreenshot, fullPage: true });
        console.log(`📸 Screenshot inicial: ${initialScreenshot}`);
        // Configurar listeners para capturar acciones del usuario
        await setupActionListeners(page, session);
        // Configurar monitoreo de archivos descargados
        const initialFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
        console.log('🔴 GRABACIÓN INICIADA - Realiza tus acciones en el navegador...');
        console.log('');
        // Esperar a que el usuario termine
        await askQuestion('⏸️ Presiona ENTER cuando hayas completado la descarga: ');
        console.log('🔴 GRABACIÓN DETENIDA');
        // Verificar archivos descargados
        const finalFiles = fs_1.default.existsSync(downloadPath) ? fs_1.default.readdirSync(downloadPath) : [];
        const newFiles = finalFiles.filter(f => !initialFiles.includes(f));
        session.downloadedFiles = newFiles;
        if (newFiles.length > 0) {
            console.log('✅ Archivos descargados detectados:');
            newFiles.forEach((file, index) => {
                const filePath = path_1.default.join(downloadPath, file);
                const stats = fs_1.default.statSync(filePath);
                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
            });
            session.success = true;
        }
        else {
            console.log('⚠️ No se detectaron archivos descargados nuevos');
            session.success = false;
        }
        // Tomar screenshot final
        const finalScreenshot = path_1.default.join(downloadPath, `learning_final_${session.sessionId}.png`);
        await page.screenshot({ path: finalScreenshot, fullPage: true });
        console.log(`📸 Screenshot final: ${finalScreenshot}`);
        session.endTime = Date.now();
        // Mostrar resumen de acciones grabadas
        console.log('\n📋 RESUMEN DE ACCIONES GRABADAS:');
        console.log('================================');
        console.log(`⏱️ Duración: ${((session.endTime - session.startTime) / 1000).toFixed(2)} segundos`);
        console.log(`🖱️ Total de acciones: ${session.userActions.length}`);
        console.log(`📁 Archivos descargados: ${session.downloadedFiles.length}`);
        console.log(`✅ Éxito: ${session.success ? 'Sí' : 'No'}`);
        if (session.userActions.length > 0) {
            console.log('\n🎬 Secuencia de acciones:');
            session.userActions.forEach((action, index) => {
                const timeFromStart = ((action.timestamp - session.startTime) / 1000).toFixed(2);
                console.log(`   ${index + 1}. [${timeFromStart}s] ${action.type.toUpperCase()}`);
                if (action.target) {
                    console.log(`      Target: <${action.target.tagName}> "${action.target.text.substring(0, 30)}..."`);
                    console.log(`      XPath: ${action.target.xpath}`);
                }
            });
        }
        if (session.success) {
            console.log('\n🎉 ¡APRENDIZAJE COMPLETADO EXITOSAMENTE!');
            console.log('📝 Ahora se puede crear un script automático con estas acciones.');
            // Crear script automático
            await generateAutomaticScript(session, downloadPath);
        }
        else {
            console.log('\n⚠️ El aprendizaje se completó pero no se detectó descarga exitosa.');
            console.log('💡 Revisa las acciones grabadas para identificar posibles problemas.');
        }
    }
    catch (error) {
        console.error('❌ Error en modo aprendizaje:', error);
    }
    finally {
        rl.close();
    }
}
async function setupActionListeners(page, session) {
    // Función para generar XPath de un elemento
    await page.evaluateOnNewDocument(() => {
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
                if (parts.length > 8)
                    break; // Limitar profundidad
            }
            return '//' + parts.join('/');
        }
        // Hacer la función disponible globalmente
        window.generateXPath = generateXPath;
    });
    // Listener para clics
    await page.evaluateOnNewDocument(() => {
        document.addEventListener('click', (event) => {
            var _a, _b;
            const target = event.target;
            if (target) {
                const actionData = {
                    timestamp: Date.now(),
                    type: 'click',
                    target: {
                        tagName: target.tagName,
                        className: target.className || '',
                        id: target.id || '',
                        text: ((_b = (_a = target.textContent) === null || _a === void 0 ? void 0 : _a.trim()) === null || _b === void 0 ? void 0 : _b.substring(0, 100)) || '',
                        xpath: window.generateXPath(target),
                        cssSelector: target.id ? `#${target.id}` :
                            target.className ? `${target.tagName.toLowerCase()}.${target.className.split(' ').join('.')}` :
                                target.tagName.toLowerCase(),
                        position: {
                            x: event.clientX,
                            y: event.clientY
                        }
                    }
                };
                // Enviar datos al contexto de Node.js
                window.capturedActions = window.capturedActions || [];
                window.capturedActions.push(actionData);
            }
        }, true);
    });
    // Monitorear acciones cada segundo
    const actionMonitor = setInterval(async () => {
        try {
            const capturedActions = await page.evaluate(() => {
                const actions = window.capturedActions || [];
                window.capturedActions = []; // Limpiar después de obtener
                return actions;
            });
            // Agregar acciones capturadas a la sesión
            capturedActions.forEach((action) => {
                var _a, _b, _c;
                session.userActions.push(action);
                // Log en tiempo real
                const timeFromStart = ((action.timestamp - session.startTime) / 1000).toFixed(2);
                console.log(`[${timeFromStart}s] ${action.type.toUpperCase()}: ${(_a = action.target) === null || _a === void 0 ? void 0 : _a.tagName} "${(_c = (_b = action.target) === null || _b === void 0 ? void 0 : _b.text) === null || _c === void 0 ? void 0 : _c.substring(0, 20)}..."`);
            });
        }
        catch (error) {
            // Ignorar errores de monitoreo
        }
    }, 1000);
    // Limpiar el monitor cuando termine
    setTimeout(() => {
        clearInterval(actionMonitor);
    }, 300000); // 5 minutos máximo
}
async function generateAutomaticScript(session, downloadPath) {
    const scriptContent = `
// Archivo generado automáticamente desde el aprendizaje de acciones
// Sesión: ${session.sessionId}
// Trabajo: ${session.workTitle}
// Fecha: ${new Date().toISOString()}

import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { ElementHandle, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

export async function executeLearnedDownloadSequence(page: Page, downloadPath: string): Promise<boolean> {
    try {
        console.log('🤖 Ejecutando secuencia aprendida para descarga...');
        
        const filesBefore = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        
${session.userActions.map((action, index) => {
        const delay = index > 0 ? action.timestamp - session.userActions[index - 1].timestamp : 0;
        let actionCode = '';
        if (delay > 100) { // Si hay más de 100ms de diferencia, agregar espera
            actionCode += `        await page.waitForTimeout(${Math.min(delay, 5000)});\n`;
        }
        if (action.type === 'click' && action.target) {
            actionCode += `        // ${action.type.toUpperCase()}: ${action.target.text.substring(0, 50)}...\n`;
            actionCode += `        try {\n`;
            actionCode += `            const elements_${index} = await page.$x('${action.target.xpath}');\n`;
            actionCode += `            if (elements_${index}.length > 0) {\n`;
            actionCode += `                await (elements_${index}[0] as ElementHandle<Element>).click();\n`;
            actionCode += `                console.log('✅ Clic realizado en: ${action.target.tagName}');\n`;
            actionCode += `            } else {\n`;
            actionCode += `                console.log('⚠️ Elemento no encontrado: ${action.target.xpath}');\n`;
            actionCode += `            }\n`;
            actionCode += `        } catch (error) {\n`;
            actionCode += `            console.log('❌ Error en clic: \${error}');\n`;
            actionCode += `        }\n`;
        }
        return actionCode;
    }).join('\n')}
        
        // Esperar tiempo final para descarga
        console.log('⏳ Esperando descarga final...');
        await page.waitForTimeout(10000);
        
        // Verificar descarga
        const filesAfter = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
        
        if (newFiles.length > 0) {
            console.log('✅ Descarga exitosa:');
            newFiles.forEach(file => console.log(\`   📄 \${file}\`));
            return true;
        } else {
            console.log('❌ No se detectaron archivos descargados');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error ejecutando secuencia:', error);
        return false;
    }
}
`;
    const scriptPath = path_1.default.join(downloadPath, `learned_download_sequence_${session.sessionId}.ts`);
    fs_1.default.writeFileSync(scriptPath, scriptContent);
    console.log(`📝 Script automático generado: ${scriptPath}`);
    console.log('💡 Puedes usar este script para automatizar futuras descargas');
}
if (require.main === module) {
    learnDownloadActions()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
