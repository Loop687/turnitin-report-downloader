import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
async function directLearnDownload() {
    const scraper = new ImprovedTurnitinScraperService(true);
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
        console.log('🎓 APRENDIZAJE DIRECTO DE DESCARGA');
        console.log('=================================');
        console.log('Este script usa la información exacta del archivo JSON para navegar');
        console.log('automáticamente hasta la página del reporte de IA y activar el modo aprendizaje.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        const session = {
            sessionId: `direct_learn_${Date.now()}`,
            workTitle: "LA LECTURA.docx",
            startTime: Date.now(),
            finalUrl: '',
            userActions: [],
            downloadedFiles: [],
            success: false
        };
        console.log('🚀 Navegando usando información del archivo JSON...');
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
            expectedUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500",
            submissionTrn: "trn:oid:::1:3272334500"
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
                console.log(`✅ Página de Carta encontrada: ${url}`);
                break;
            }
        }
        await workingPage.waitForTimeout(5000);
        console.log('🤖 Haciendo clic en botón de IA...');
        console.log(`   CSS Selector: ${jsonData.aiButtonCSS}`);
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
        console.log(`🔍 Elementos de IA encontrados: ${aiElements.length}`);
        if (aiElements.length > 0) {
            await aiElements[0].click();
            console.log('✅ Clic en IA realizado');
            console.log('⏳ Esperando nueva pestaña del reporte de IA...');
            aiReportPage = await pagePromise;
            if (aiReportPage) {
                await aiReportPage.waitForTimeout(8000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte obtenida: ${aiUrl}`);
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ ¡ÉXITO! Llegamos a la página del reporte de IA');
                    console.log(`   URL esperada: ${jsonData.expectedUrl}`);
                    console.log(`   URL obtenida: ${aiUrl}`);
                    session.finalUrl = aiUrl;
                    console.log('🎓 Iniciando modo aprendizaje en la página del reporte...');
                    await startLearningMode(aiReportPage, scraper.getDownloadPath(), session);
                }
                else {
                    console.log(`❌ URL inesperada: ${aiUrl}`);
                    console.log(`   Se esperaba algo que contenga: integrity.turnitin.com`);
                }
            }
            else {
                console.log('❌ No se abrió nueva pestaña del reporte');
                await workingPage.waitForTimeout(5000);
                const newUrl = workingPage.url();
                console.log(`📍 URL después del clic: ${newUrl}`);
                if (newUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ El reporte se abrió en la misma pestaña');
                    session.finalUrl = newUrl;
                    await startLearningMode(workingPage, scraper.getDownloadPath(), session);
                }
            }
        }
        else {
            console.log('❌ No se encontró el botón de IA');
            console.log('🔍 Elementos disponibles en la página:');
            const availableElements = await workingPage.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('tii-aiw-button, button, a'));
                return elements.map(el => ({
                    tag: el.tagName,
                    class: el.className,
                    id: el.id,
                    text: el.textContent?.trim().substring(0, 50)
                }));
            });
            availableElements.forEach((el, index) => {
                console.log(`   ${index + 1}. <${el.tag}> class="${el.class}" id="${el.id}" text="${el.text}"`);
            });
        }
        const sessionFile = path.join(scraper.getDownloadPath(), `direct_learning_session_${session.sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        console.log(`💾 Sesión guardada: ${sessionFile}`);
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
        console.log('1. La página del reporte de IA está lista en el navegador');
        console.log('2. Realiza MANUALMENTE todos los pasos para descargar el reporte');
        console.log('3. El script grabará AUTOMÁTICAMENTE todas tus acciones');
        console.log('4. Cuando hayas descargado el archivo, presiona ENTER aquí');
        console.log('');
        console.log('🎯 Se grabarán:');
        console.log('   ✅ Clics en botones/enlaces');
        console.log('   ✅ Hovers sobre elementos');
        console.log('   ✅ Movimientos del mouse');
        console.log('   ✅ Tiempos de espera');
        console.log('');
        const initialScreenshot = path.join(downloadPath, `direct_learning_initial_${session.sessionId}.png`);
        await page.screenshot({ path: initialScreenshot, fullPage: true });
        console.log(`📸 Screenshot inicial: ${initialScreenshot}`);
        await setupAdvancedActionListeners(page, session);
        const initialFiles = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        console.log('🔴 GRABACIÓN INICIADA');
        console.log('=====================');
        console.log('Realiza tus acciones en el navegador para descargar el reporte...');
        console.log('');
        await askQuestion('⏸️ Presiona ENTER cuando hayas completado la descarga: ');
        console.log('🔴 GRABACIÓN DETENIDA');
        const finalFiles = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        const newFiles = finalFiles.filter(f => !initialFiles.includes(f));
        session.downloadedFiles = newFiles.filter(f => f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'));
        if (session.downloadedFiles.length > 0) {
            console.log('✅ Archivos relevantes descargados:');
            session.downloadedFiles.forEach((file, index) => {
                const filePath = path.join(downloadPath, file);
                const stats = fs.statSync(filePath);
                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
            });
            session.success = true;
        }
        else {
            console.log('⚠️ No se detectaron descargas de reportes');
            if (newFiles.length > 0) {
                console.log('📁 Otros archivos descargados:');
                newFiles.forEach(file => console.log(`   - ${file}`));
            }
            session.success = false;
        }
        const finalScreenshot = path.join(downloadPath, `direct_learning_final_${session.sessionId}.png`);
        await page.screenshot({ path: finalScreenshot, fullPage: true });
        console.log(`📸 Screenshot final: ${finalScreenshot}`);
        session.endTime = Date.now();
        console.log('\n📋 RESUMEN DE LA SESIÓN:');
        console.log('========================');
        console.log(`⏱️ Duración: ${((session.endTime - session.startTime) / 1000).toFixed(2)} segundos`);
        console.log(`🖱️ Acciones grabadas: ${session.userActions.length}`);
        console.log(`📁 Archivos descargados: ${session.downloadedFiles.length}`);
        console.log(`✅ Éxito: ${session.success ? 'SÍ' : 'NO'}`);
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
            await generateFinalScript(session, downloadPath);
        }
    }
    catch (error) {
        console.error('❌ Error en modo aprendizaje:', error);
    }
    finally {
        rl.close();
    }
}
async function setupAdvancedActionListeners(page, session) {
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
                if (parts.length > 6)
                    break;
            }
            return '//' + parts.join('/');
        }
        window.generateXPath = generateXPath;
        window.capturedActions = [];
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target) {
                window.capturedActions.push({
                    timestamp: Date.now(),
                    type: 'click',
                    target: {
                        tagName: target.tagName,
                        className: target.className || '',
                        id: target.id || '',
                        text: target.textContent?.trim()?.substring(0, 100) || '',
                        xpath: window.generateXPath(target),
                        cssSelector: target.id ? `#${target.id}` :
                            target.className ? `${target.tagName.toLowerCase()}.${target.className.split(' ').join('.')}` :
                                target.tagName.toLowerCase(),
                        position: { x: event.clientX, y: event.clientY }
                    }
                });
            }
        }, true);
        document.addEventListener('mouseover', (event) => {
            const target = event.target;
            if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button')) {
                window.capturedActions.push({
                    timestamp: Date.now(),
                    type: 'hover',
                    target: {
                        tagName: target.tagName,
                        className: target.className || '',
                        id: target.id || '',
                        text: target.textContent?.trim()?.substring(0, 50) || '',
                        xpath: window.generateXPath(target),
                        cssSelector: target.id ? `#${target.id}` : target.tagName.toLowerCase(),
                        position: { x: event.clientX, y: event.clientY }
                    }
                });
            }
        });
    });
    const monitor = setInterval(async () => {
        try {
            const actions = await page.evaluate(() => {
                const captured = window.capturedActions || [];
                window.capturedActions = [];
                return captured;
            });
            actions.forEach((action) => {
                session.userActions.push(action);
                const time = ((action.timestamp - session.startTime) / 1000).toFixed(1);
                console.log(`[${time}s] ${action.type.toUpperCase()}: ${action.target?.tagName} "${action.target?.text?.substring(0, 20)}..."`);
            });
        }
        catch (error) {
        }
    }, 1000);
    setTimeout(() => clearInterval(monitor), 300000);
}
async function generateFinalScript(session, downloadPath) {
    const scriptContent = `// Script generado automáticamente - Descarga de Reporte de IA Turnitin
// Sesión: ${session.sessionId}
// Fecha: ${new Date().toISOString()}
// Éxito: ${session.success}

import { Page } from 'puppeteer';
import { ElementHandle } from 'puppeteer';

export async function executeAIReportDownload(page: Page): Promise<boolean> {
    console.log('🤖 Ejecutando secuencia aprendida para descarga de reporte de IA...');
    
    try {
${session.userActions.map((action, index) => {
        if (action.type !== 'click')
            return '';
        const delay = index > 0 ? Math.min(action.timestamp - session.userActions[index - 1].timestamp, 5000) : 1000;
        return `        // Acción ${index + 1}: ${action.target?.text?.substring(0, 40)}...
        await page.waitForTimeout(${delay});
        try {
            const elements = await page.$x('${action.target?.xpath}');
            if (elements.length > 0) {
                await (elements[0] as ElementHandle<Element>).click();
                console.log('✅ Clic: ${action.target?.tagName}');
            }
        } catch (error) {
            console.log('⚠️ Error en clic ${index + 1}:', error);
        }`;
    }).filter(Boolean).join('\n')}
        
        // Esperar descarga final
        await page.waitForTimeout(10000);
        console.log('✅ Secuencia de descarga completada');
        return true;
        
    } catch (error) {
        console.error('❌ Error en secuencia:', error);
        return false;
    }
}`;
    const scriptPath = path.join(downloadPath, `ai_download_sequence_${session.sessionId}.ts`);
    fs.writeFileSync(scriptPath, scriptContent);
    console.log(`📝 Script automático generado: ${scriptPath}`);
    console.log('💡 Este script se puede integrar en el sistema principal');
}
if (require.main === module) {
    directLearnDownload()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
