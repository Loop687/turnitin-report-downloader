import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
async function interactiveAIPage() {
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
        console.log('🔄 PÁGINA INTERACTIVA DE REPORTE DE IA');
        console.log('====================================');
        console.log('Este script te permite hacer clic en cualquier elemento de la página del reporte de IA.');
        console.log('');
        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();
        await navigateToAIReportPage(scraper, page);
        if (!page.url().includes('integrity.turnitin.com')) {
            console.log('❌ No se pudo llegar a la página del reporte de IA');
            return;
        }
        console.log('✅ En la página del reporte de IA');
        console.log(`📍 URL: ${page.url()}`);
        let continueInteracting = true;
        while (continueInteracting) {
            await performInteractiveAnalysis(page, scraper.getDownloadPath());
            const continueResponse = await askQuestion('\n¿Quieres realizar otra acción? (s/n): ');
            continueInteracting = continueResponse.toLowerCase() === 's';
            if (continueInteracting) {
                await page.waitForTimeout(2000);
            }
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
async function navigateToAIReportPage(scraper, page) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const askQuestion = (question) => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };
    await scraper.navigateToTurnitinInbox(page);
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
        console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
        await askQuestion('');
        await scraper.navigateToTurnitinInbox(page);
    }
    const workTitle = await askQuestion('¿Cuál es el título del trabajo? (ej: "LA LECTURA.docx"): ');
    console.log(`\n🎯 Procesando: "${workTitle}"`);
    const clickSuccess = await scraper.findAndClickOnSubmission(page, workTitle);
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
    console.log(`📍 Página de trabajo: ${workingPage.url()}`);
    await workingPage.waitForTimeout(3000);
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
            console.log('⏳ Esperando que la página cargue completamente (10 segundos)...');
            await aiReportPage.waitForTimeout(10000);
            Object.assign(page, aiReportPage);
        }
        else {
            throw new Error('No se pudo acceder a la página del reporte de IA');
        }
    }
    else {
        throw new Error('No se encontró el botón de IA');
    }
    rl.close();
}
async function performInteractiveAnalysis(page, downloadPath) {
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
        console.log('\n🔍 ANALIZANDO ELEMENTOS ACTUALES...');
        const screenshotPath = path.join(downloadPath, `ai_page_interactive_${Date.now()}.png`);
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        console.log(`📸 Screenshot actualizado: ${screenshotPath}`);
        const elements = await page.evaluate(() => {
            const allElements = [];
            const selectors = ['button', 'a', '[role="button"]', '[onclick]', 'input[type="button"]', 'input[type="submit"]', 'div[onclick]', '*[class*="button"]', '*[class*="download"]'];
            selectors.forEach(selector => {
                try {
                    const foundElements = Array.from(document.querySelectorAll(selector));
                    foundElements.forEach((el, index) => {
                        const computedStyle = window.getComputedStyle(el);
                        const isVisible = computedStyle.display !== 'none' &&
                            computedStyle.visibility !== 'hidden' &&
                            el.offsetWidth > 0 &&
                            el.offsetHeight > 0;
                        if (isVisible) {
                            const getSimpleXPath = (element) => {
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
                                    if (parts.length > 8)
                                        break;
                                }
                                return '//' + parts.join('/');
                            };
                            allElements.push({
                                index: allElements.length + 1,
                                tag: el.tagName,
                                text: el.textContent?.trim() || '[Sin texto]',
                                className: el.className || '[Sin clases]',
                                id: el.id || '[Sin ID]',
                                xpath: getSimpleXPath(el),
                                cssSelector: el.id ? `#${el.id}` :
                                    el.className ? `${el.tagName.toLowerCase()}.${el.className.split(' ').filter(c => c.length > 0).join('.')}` :
                                        el.tagName.toLowerCase(),
                                rect: {
                                    x: Math.round(el.getBoundingClientRect().x),
                                    y: Math.round(el.getBoundingClientRect().y),
                                    width: Math.round(el.getBoundingClientRect().width),
                                    height: Math.round(el.getBoundingClientRect().height)
                                }
                            });
                        }
                    });
                }
                catch (error) {
                    console.log(`Error con selector ${selector}:`, error);
                }
            });
            return allElements;
        });
        console.log(`\n📊 ELEMENTOS INTERACTIVOS ENCONTRADOS: ${elements.length}`);
        console.log('================================================');
        if (elements.length === 0) {
            console.log('❌ No se encontraron elementos clickeables');
            const pageContent = await page.evaluate(() => ({
                title: document.title,
                bodyText: document.body.textContent?.substring(0, 300),
                htmlPreview: document.body.innerHTML.substring(0, 500)
            }));
            console.log('\n📝 CONTENIDO DE LA PÁGINA:');
            console.log(`Título: ${pageContent.title}`);
            console.log(`Texto: ${pageContent.bodyText}...`);
            console.log(`HTML: ${pageContent.htmlPreview}...`);
        }
        else {
            elements.forEach((el, index) => {
                console.log(`\n${el.index}. <${el.tag}>:`);
                console.log(`   📝 Texto: "${el.text.substring(0, 60)}${el.text.length > 60 ? '...' : ''}"`);
                console.log(`   🆔 ID: "${el.id}"`);
                console.log(`   🎨 Clases: "${el.className.substring(0, 50)}${el.className.length > 50 ? '...' : ''}"`);
                console.log(`   📐 Posición: (${el.rect.x}, ${el.rect.y}) ${el.rect.width}x${el.rect.height}`);
                console.log(`   🎯 XPath: ${el.xpath}`);
                console.log(`   🔗 CSS: ${el.cssSelector}`);
            });
            console.log('\n🎯 OPCIONES:');
            console.log(`1-${elements.length}: Hacer clic en el elemento correspondiente`);
            console.log('r: Reanalizar la página (refrescar elementos)');
            console.log('s: Tomar nuevo screenshot');
            console.log('w: Esperar 5 segundos y reanalizar');
            console.log('q: Salir del modo interactivo');
            const choice = await askQuestion('\n¿Qué quieres hacer?: ');
            if (choice.toLowerCase() === 'q') {
                console.log('👋 Saliendo del modo interactivo...');
                rl.close();
                return;
            }
            else if (choice.toLowerCase() === 'r') {
                console.log('🔄 Reanalizando...');
                rl.close();
                return;
            }
            else if (choice.toLowerCase() === 's') {
                const newScreenshot = path.join(downloadPath, `ai_page_manual_${Date.now()}.png`);
                await page.screenshot({ path: newScreenshot, fullPage: true });
                console.log(`📸 Nuevo screenshot: ${newScreenshot}`);
                rl.close();
                return;
            }
            else if (choice.toLowerCase() === 'w') {
                console.log('⏳ Esperando 5 segundos...');
                await page.waitForTimeout(5000);
                console.log('🔄 Reanalizando después de espera...');
                rl.close();
                return;
            }
            else {
                const elementIndex = parseInt(choice) - 1;
                if (isNaN(elementIndex) || elementIndex < 0 || elementIndex >= elements.length) {
                    console.log(`❌ Opción inválida. Debe ser un número entre 1 y ${elements.length}`);
                    rl.close();
                    return;
                }
                const selectedElement = elements[elementIndex];
                console.log(`\n🖱️ Haciendo clic en elemento ${elementIndex + 1}: <${selectedElement.tag}>`);
                console.log(`   📝 Texto: "${selectedElement.text}"`);
                console.log(`   🎯 XPath: ${selectedElement.xpath}`);
                const filesBefore = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                try {
                    const xpathElements = await page.$x(selectedElement.xpath);
                    if (xpathElements.length > 0) {
                        await xpathElements[0].click();
                        console.log('✅ Clic realizado con XPath');
                    }
                    else {
                        await page.click(selectedElement.cssSelector);
                        console.log('✅ Clic realizado con CSS selector');
                    }
                    console.log('⏳ Esperando respuesta (8 segundos)...');
                    await page.waitForTimeout(8000);
                    const newUrl = page.url();
                    console.log(`📍 URL después del clic: ${newUrl}`);
                    const filesAfter = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
                    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
                    if (newFiles.length > 0) {
                        console.log('🎉 ¡DESCARGA DETECTADA!');
                        newFiles.forEach((file, index) => {
                            console.log(`   📄 ${index + 1}. ${file}`);
                        });
                    }
                    else {
                        console.log('ℹ️ No se detectaron descargas nuevas');
                    }
                    const pageChanges = await page.evaluate(() => ({
                        newTitle: document.title,
                        hasNewElements: document.querySelectorAll('button, a').length,
                        bodyTextPreview: document.body.textContent?.substring(0, 200)
                    }));
                    console.log('\n📋 Estado de la página:');
                    console.log(`   📄 Título: ${pageChanges.newTitle}`);
                    console.log(`   🔘 Elementos clickeables: ${pageChanges.hasNewElements}`);
                    console.log(`   📝 Contenido: ${pageChanges.bodyTextPreview}...`);
                }
                catch (error) {
                    console.log(`❌ Error al hacer clic: ${error}`);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Error durante análisis interactivo:', error);
    }
    finally {
        rl.close();
    }
}
if (require.main === module) {
    interactiveAIPage()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
