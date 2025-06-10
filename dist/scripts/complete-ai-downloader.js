import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
async function completeAIDownloader() {
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
        console.log('🚀 DESCARGADOR COMPLETO DE REPORTES DE IA - TURNITIN');
        console.log('====================================================');
        console.log('Este script automatiza todo el proceso de descarga.');
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
        const workTitle = await askQuestion('¿Cuál es el título del trabajo? (ej: "LA LECTURA.docx"): ');
        console.log(`\n🎯 Procesando: "${workTitle}"`);
        const success = await processCompleteWorkflow(scraper, page, workTitle);
        if (success) {
            console.log('\n🎉 ¡Proceso completado exitosamente!');
        }
        else {
            console.log('\n❌ No se pudo completar el proceso');
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
async function processCompleteWorkflow(scraper, page, workTitle) {
    try {
        console.log('📋 Paso 1: Abriendo trabajo...');
        const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
        if (!clickSuccess) {
            console.log('❌ No se pudo abrir el trabajo');
            return false;
        }
        console.log('🔍 Paso 2: Buscando ventana del reporte...');
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
        console.log('🤖 Paso 3: Haciendo clic en botón de IA...');
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
            if (aiReportPage) {
                console.log('🆕 Nueva pestaña del reporte de IA detectada');
                await aiReportPage.waitForTimeout(5000);
                const aiUrl = aiReportPage.url();
                console.log(`📍 URL del reporte: ${aiUrl}`);
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ Página correcta del reporte de IA');
                    console.log('📥 Paso 4: Descargando reporte...');
                    const downloadSuccess = await downloadReport(aiReportPage, scraper.getDownloadPath(), workTitle);
                    return downloadSuccess;
                }
                else {
                    console.log('❌ No se llegó a la página correcta del reporte');
                    return false;
                }
            }
            else {
                console.log('❌ No se abrió nueva pestaña');
                return false;
            }
        }
        else {
            console.log('❌ No se encontró el botón de IA');
            return false;
        }
    }
    catch (error) {
        console.error('❌ Error en el workflow:', error);
        return false;
    }
}
async function downloadReport(page, downloadPath, workTitle) {
    try {
        console.log('📥 Iniciando proceso de descarga...');
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });
        console.log('⏳ Esperando que la página del reporte cargue completamente (10 segundos)...');
        await page.waitForTimeout(10000);
        console.log('🔍 Secuencia de descarga de 2 pasos detectada...');
        const popoverButtonXPath = '//*[@id="download-popover"]/tii-sws-header-btn//tdl-button//button';
        console.log('🖱️ Paso 1: Abriendo popover de descarga...');
        console.log(`   XPath: ${popoverButtonXPath}`);
        try {
            const popoverElements = await page.$x(popoverButtonXPath);
            console.log(`   🔍 Elementos encontrados: ${popoverElements.length}`);
            if (popoverElements.length > 0) {
                await popoverElements[0].click();
                console.log('   ✅ Clic en botón de popover realizado');
                console.log('   ⏳ Esperando que aparezca el popover (3 segundos)...');
                await page.waitForTimeout(3000);
                const downloadButtonXPath = '//*[@id="download-popover"]/ul/li/button';
                console.log('🖱️ Paso 2: Haciendo clic en botón de descarga...');
                console.log(`   XPath: ${downloadButtonXPath}`);
                const downloadElements = await page.$x(downloadButtonXPath);
                console.log(`   🔍 Elementos de descarga encontrados: ${downloadElements.length}`);
                if (downloadElements.length > 0) {
                    const filesBefore = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                    console.log(`   📂 Archivos antes de descarga: ${filesBefore.length}`);
                    await downloadElements[0].click();
                    console.log('   ✅ Clic en descarga realizado');
                    console.log('⏳ Esperando descarga (15 segundos)...');
                    await page.waitForTimeout(15000);
                    const filesAfter = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
                    console.log(`📂 Archivos después de descarga: ${filesAfter.length}`);
                    console.log(`📄 Archivos nuevos detectados: ${newFiles.length}`);
                    if (newFiles.length > 0) {
                        console.log('✅ ¡Descarga exitosa!');
                        newFiles.forEach((file, index) => {
                            const filePath = path.join(downloadPath, file);
                            const stats = fs.statSync(filePath);
                            console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                        });
                        const pdfFile = newFiles.find(f => f.endsWith('.pdf'));
                        if (pdfFile) {
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const newName = `AI_Report_${workTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
                            const oldPath = path.join(downloadPath, pdfFile);
                            const newPath = path.join(downloadPath, newName);
                            try {
                                fs.renameSync(oldPath, newPath);
                                console.log(`📝 Archivo renombrado a: ${newName}`);
                            }
                            catch (error) {
                                console.log(`⚠️ No se pudo renombrar: ${error}`);
                            }
                        }
                        return true;
                    }
                    else {
                        console.log('⚠️ No se detectaron archivos nuevos');
                        console.log('🔍 Verificando descargas en proceso...');
                        await page.waitForTimeout(5000);
                        const filesAfterWait = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                        const newFilesAfterWait = filesAfterWait.filter(f => !filesBefore.includes(f));
                        if (newFilesAfterWait.length > 0) {
                            console.log('✅ ¡Descarga completada después de espera adicional!');
                            return true;
                        }
                    }
                }
                else {
                    console.log('❌ No se encontró el botón de descarga en el popover');
                    console.log('🔍 Analizando contenido del popover...');
                    const popoverAnalysis = await page.evaluate(() => {
                        const popover = document.getElementById('download-popover');
                        if (popover) {
                            return {
                                found: true,
                                innerHTML: popover.innerHTML.substring(0, 500),
                                buttons: Array.from(popover.querySelectorAll('button')).map(btn => ({
                                    text: btn.textContent?.trim(),
                                    className: btn.className,
                                    id: btn.id
                                })),
                                links: Array.from(popover.querySelectorAll('a')).map(link => ({
                                    text: link.textContent?.trim(),
                                    href: link.href,
                                    className: link.className
                                }))
                            };
                        }
                        return { found: false };
                    });
                    if (popoverAnalysis.found) {
                        console.log('📋 Contenido del popover:');
                        console.log(`   Botones encontrados: ${popoverAnalysis.buttons?.length || 0}`);
                        console.log(`   Enlaces encontrados: ${popoverAnalysis.links?.length || 0}`);
                        if (popoverAnalysis.buttons && popoverAnalysis.buttons.length > 0) {
                            console.log('   Botones disponibles:');
                            popoverAnalysis.buttons.forEach((btn, index) => {
                                console.log(`     ${index + 1}. "${btn.text}" (${btn.className})`);
                            });
                        }
                        if (popoverAnalysis.links && popoverAnalysis.links.length > 0) {
                            console.log('   Enlaces disponibles:');
                            popoverAnalysis.links.forEach((link, index) => {
                                console.log(`     ${index + 1}. "${link.text}" -> ${link.href}`);
                            });
                        }
                    }
                }
            }
            else {
                console.log('❌ No se encontró el botón para abrir el popover');
                console.log('🔄 Intentando métodos alternativos...');
                const alternativeSelectors = [
                    '#download-popover button',
                    '[id="download-popover"] button',
                    'tii-sws-header-btn button',
                    'tdl-button button',
                    'button[aria-label*="download"]',
                    'button[title*="download"]'
                ];
                for (const selector of alternativeSelectors) {
                    try {
                        console.log(`   🔍 Probando selector: ${selector}`);
                        await page.click(selector);
                        console.log(`   ✅ Clic exitoso con: ${selector}`);
                        await page.waitForTimeout(3000);
                        const downloadElements = await page.$x('//*[@id="download-popover"]/ul/li/button');
                        if (downloadElements.length > 0) {
                            await downloadElements[0].click();
                            console.log('   ✅ Descarga iniciada con método alternativo');
                            await page.waitForTimeout(10000);
                            return true;
                        }
                    }
                    catch (error) {
                        console.log(`   ❌ Falló ${selector}: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            console.log(`❌ Error en paso 1: ${error}`);
        }
        console.log('📸 Tomando screenshot para debugging...');
        const screenshotPath = path.join(downloadPath, `debug_screenshot_${Date.now()}.png`);
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        console.log(`💾 Screenshot guardado en: ${screenshotPath}`);
        return false;
    }
    catch (error) {
        console.error('❌ Error durante la descarga:', error);
        return false;
    }
}
if (require.main === module) {
    completeAIDownloader()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
