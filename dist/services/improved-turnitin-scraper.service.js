import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { ReportStorageService } from './report-storage.service';
export class ImprovedTurnitinScraperService {
    constructor(debugMode = false) {
        this.browser = null;
        this.reportStorageService = new ReportStorageService();
        this.downloadPath = path.join(__dirname, '..', '..', 'temp-downloads');
        this.debugMode = debugMode;
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
        }
    }
    getDownloadPath() {
        return this.downloadPath;
    }
    async initializeBrowser() {
        console.log('🚀 Iniciando navegador mejorado para scraping...');
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        });
    }
    async createNewPage() {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call initializeBrowser() first.');
        }
        const page = await this.browser.newPage();
        try {
            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: this.downloadPath,
            });
        }
        catch (error) {
            console.log('⚠️ No se pudo configurar descarga automática:', error);
        }
        return page;
    }
    async navigateToTurnitinInbox(page) {
        console.log('🌐 Navegando a la bandeja de entrada de Turnitin...');
        const inboxUrl = 'https://www.turnitin.com/assignment/type/paper/inbox/170792714?lang=en_us';
        await page.goto(inboxUrl, { waitUntil: 'networkidle2' });
        console.log('✅ Navegación completada');
        await page.waitForTimeout(3000);
    }
    async findAndClickOnSubmission(page, targetTitle) {
        console.log(`🔍 Buscando trabajo: "${targetTitle}"`);
        try {
            const browser = page.browser();
            let newPage = null;
            const pagePromise = new Promise((resolve) => {
                const onTargetCreated = async (target) => {
                    if (target.type() === 'page') {
                        const page = await target.page();
                        resolve(page);
                    }
                };
                browser.on('targetcreated', onTargetCreated);
                setTimeout(() => {
                    browser.off('targetcreated', onTargetCreated);
                    resolve(null);
                }, 10000);
            });
            console.log(`🔍 Buscando trabajo: "${targetTitle}"`);
            const clickSuccess = await page.evaluate((title) => {
                const rows = Array.from(document.querySelectorAll('table tbody tr'));
                for (const row of rows) {
                    const titleCell = row.querySelector('td:nth-child(3)');
                    if (titleCell) {
                        const titleLink = titleCell.querySelector('a');
                        if (titleLink && titleLink.textContent?.includes(title)) {
                            titleLink.click();
                            return true;
                        }
                    }
                }
                return false;
            }, targetTitle);
            if (clickSuccess) {
                console.log(`✅ Clic exitoso en trabajo: "${targetTitle}"`);
                console.log('⏳ Esperando que se abra nueva ventana...');
                newPage = await pagePromise;
                if (newPage) {
                    console.log('🪟 Nueva ventana detectada, cambiando contexto...');
                    await newPage.waitForTimeout(5000);
                    const newUrl = newPage.url();
                    console.log(`📍 Nueva URL: ${newUrl}`);
                    if (newUrl.includes('ev.turnitin.com/app/carta')) {
                        console.log('✅ Ventana correcta del reporte detectada');
                        return true;
                    }
                    else {
                        console.log('⚠️ La nueva ventana no es la esperada');
                    }
                }
                else {
                    console.log('⚠️ No se detectó nueva ventana, esperando en la actual...');
                    await page.waitForTimeout(5000);
                }
                return true;
            }
            else {
                console.log(`⚠️ No se encontró el trabajo: "${targetTitle}"`);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ Error buscando trabajo: ${error}`);
            return false;
        }
    }
    async debugAIButtonSearch(page) {
        console.log('🔍 MODO DEBUG: Analizando elementos de IA disponibles...');
        try {
            const debugInfo = await page.evaluate(() => {
                const allButtons = Array.from(document.querySelectorAll('button'));
                const aiRelatedElements = [];
                allButtons.forEach((button, index) => {
                    const buttonInfo = {
                        index: index,
                        tag: button.tagName,
                        text: button.textContent?.trim() || '',
                        ariaLabel: button.getAttribute('aria-label') || '',
                        title: button.getAttribute('title') || '',
                        className: button.className || '',
                        id: button.id || '',
                        dataAttributes: {},
                        innerHTML: button.innerHTML.substring(0, 100)
                    };
                    Array.from(button.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-')) {
                            buttonInfo.dataAttributes[attr.name] = attr.value;
                        }
                    });
                    const isAIRelated = buttonInfo.text.toLowerCase().includes('ai') ||
                        buttonInfo.ariaLabel.toLowerCase().includes('ai') ||
                        buttonInfo.title.toLowerCase().includes('ai') ||
                        /\d+%/.test(buttonInfo.text) ||
                        /\d+%/.test(buttonInfo.ariaLabel) ||
                        buttonInfo.className.includes('ev') ||
                        buttonInfo.className.includes('aiw') ||
                        buttonInfo.id.includes('ai') ||
                        Object.values(buttonInfo.dataAttributes).some((val) => val.toLowerCase().includes('ai') || val.toLowerCase().includes('indicator') || val.toLowerCase().includes('aiw'));
                    if (isAIRelated) {
                        aiRelatedElements.push(buttonInfo);
                    }
                });
                const tiiComponents = Array.from(document.querySelectorAll('tii-aiw-button, tii-aiw-ev-button, tdl-tooltip'));
                const tiiInfo = tiiComponents.map((comp, index) => ({
                    index: index,
                    tag: comp.tagName,
                    label: comp.getAttribute('label') || '',
                    parent: comp.parentElement?.tagName || '',
                    parentClasses: comp.parentElement?.className || '',
                    parentAttributes: comp.parentElement ?
                        Array.from(comp.parentElement.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ') : '',
                    innerHTML: comp.innerHTML.substring(0, 150)
                }));
                return {
                    totalButtons: allButtons.length,
                    aiRelatedButtons: aiRelatedElements,
                    tiiComponents: tiiInfo,
                    currentUrl: window.location.href
                };
            });
            console.log(`📊 Total de botones en la página: ${debugInfo.totalButtons}`);
            console.log(`🎯 Botones potencialmente relacionados con IA: ${debugInfo.aiRelatedButtons.length}`);
            console.log(`🔧 Componentes Turnitin AI: ${debugInfo.tiiComponents.length}`);
            console.log(`📍 URL actual: ${debugInfo.currentUrl}`);
            if (debugInfo.aiRelatedButtons.length > 0) {
                console.log('\n🤖 BOTONES RELACIONADOS CON IA ENCONTRADOS:');
                debugInfo.aiRelatedButtons.forEach((btn, index) => {
                    console.log(`   ${index + 1}. Botón #${btn.index}:`);
                    console.log(`      Texto: "${btn.text}"`);
                    console.log(`      Aria-label: "${btn.ariaLabel}"`);
                    console.log(`      Clases: "${btn.className}"`);
                    console.log(`      ID: "${btn.id}"`);
                    console.log(`      Data-attributes: ${JSON.stringify(btn.dataAttributes)}`);
                    console.log(`      HTML: ${btn.innerHTML}`);
                    console.log('');
                });
            }
            if (debugInfo.tiiComponents.length > 0) {
                console.log('\n🔧 COMPONENTES TURNITIN AI:');
                debugInfo.tiiComponents.forEach((comp, index) => {
                    console.log(`   ${index + 1}. Componente <${comp.tag}>:`);
                    console.log(`      Label: "${comp.label}"`);
                    console.log(`      Padre: <${comp.parent}> con clases: "${comp.parentClasses}"`);
                    console.log(`      Atributos del padre: ${comp.parentAttributes}`);
                    console.log(`      HTML: ${comp.innerHTML}`);
                    console.log('');
                });
            }
            const debugFile = path.join(this.downloadPath, `ai-button-debug-${Date.now()}.json`);
            fs.writeFileSync(debugFile, JSON.stringify(debugInfo, null, 2));
            console.log(`💾 Información de debug guardada en: ${debugFile}`);
        }
        catch (error) {
            console.error('❌ Error en análisis de debug:', error);
        }
    }
    async debugAIButtonSearchOnPage(targetPage) {
        console.log('🔍 MODO DEBUG: Analizando elementos de IA en la página específica...');
        try {
            const debugInfo = await targetPage.evaluate(() => {
                const allButtons = Array.from(document.querySelectorAll('button'));
                const aiRelatedElements = [];
                allButtons.forEach((button, index) => {
                    const buttonInfo = {
                        index: index,
                        tag: button.tagName,
                        text: button.textContent?.trim() || '',
                        ariaLabel: button.getAttribute('aria-label') || '',
                        title: button.getAttribute('title') || '',
                        className: button.className || '',
                        id: button.id || '',
                        dataAttributes: {},
                        innerHTML: button.innerHTML.substring(0, 100)
                    };
                    Array.from(button.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-')) {
                            buttonInfo.dataAttributes[attr.name] = attr.value;
                        }
                    });
                    const isAIRelated = buttonInfo.text.toLowerCase().includes('ai') ||
                        buttonInfo.ariaLabel.toLowerCase().includes('ai') ||
                        buttonInfo.title.toLowerCase().includes('ai') ||
                        /\d+%/.test(buttonInfo.text) ||
                        /\d+%/.test(buttonInfo.ariaLabel) ||
                        buttonInfo.className.includes('ev') ||
                        buttonInfo.className.includes('aiw') ||
                        buttonInfo.id.includes('ai') ||
                        Object.values(buttonInfo.dataAttributes).some((val) => val.toLowerCase().includes('ai') || val.toLowerCase().includes('indicator') || val.toLowerCase().includes('aiw'));
                    if (isAIRelated) {
                        aiRelatedElements.push(buttonInfo);
                    }
                });
                const tiiComponents = Array.from(document.querySelectorAll('tii-aiw-button, tii-aiw-ev-button, tdl-tooltip'));
                const tiiInfo = tiiComponents.map((comp, index) => ({
                    index: index,
                    tag: comp.tagName,
                    label: comp.getAttribute('label') || '',
                    parent: comp.parentElement?.tagName || '',
                    parentClasses: comp.parentElement?.className || '',
                    parentAttributes: comp.parentElement ?
                        Array.from(comp.parentElement.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ') : '',
                    innerHTML: comp.innerHTML.substring(0, 150)
                }));
                return {
                    totalButtons: allButtons.length,
                    aiRelatedButtons: aiRelatedElements,
                    tiiComponents: tiiInfo,
                    currentUrl: window.location.href
                };
            });
            console.log(`📊 Total de botones en la página: ${debugInfo.totalButtons}`);
            console.log(`🎯 Botones potencialmente relacionados con IA: ${debugInfo.aiRelatedButtons.length}`);
            console.log(`🔧 Componentes Turnitin AI: ${debugInfo.tiiComponents.length}`);
            console.log(`📍 URL actual: ${debugInfo.currentUrl}`);
            if (debugInfo.aiRelatedButtons.length > 0) {
                console.log('\n🤖 BOTONES RELACIONADOS CON IA ENCONTRADOS:');
                debugInfo.aiRelatedButtons.forEach((btn, index) => {
                    console.log(`   ${index + 1}. Botón #${btn.index}:`);
                    console.log(`      Texto: "${btn.text}"`);
                    console.log(`      Aria-label: "${btn.ariaLabel}"`);
                    console.log(`      Clases: "${btn.className}"`);
                    console.log(`      ID: "${btn.id}"`);
                    console.log(`      Data-attributes: ${JSON.stringify(btn.dataAttributes)}`);
                    console.log(`      HTML: ${btn.innerHTML}`);
                    console.log('');
                });
            }
            if (debugInfo.tiiComponents.length > 0) {
                console.log('\n🔧 COMPONENTES TURNITIN AI:');
                debugInfo.tiiComponents.forEach((comp, index) => {
                    console.log(`   ${index + 1}. Componente <${comp.tag}>:`);
                    console.log(`      Label: "${comp.label}"`);
                    console.log(`      Padre: <${comp.parent}> con clases: "${comp.parentClasses}"`);
                    console.log(`      Atributos del padre: ${comp.parentAttributes}`);
                    console.log(`      HTML: ${comp.innerHTML}`);
                    console.log('');
                });
            }
            const debugFile = path.join(this.downloadPath, `ai-button-debug-carta-${Date.now()}.json`);
            fs.writeFileSync(debugFile, JSON.stringify(debugInfo, null, 2));
            console.log(`💾 Información de debug guardada en: ${debugFile}`);
        }
        catch (error) {
            console.error('❌ Error en análisis de debug:', error);
        }
    }
    async findAndClickOnSubmissionById(page, submissionId) {
        console.log(`   🕵️‍♂️ Intentando encontrar Submission ID: "${submissionId}" en la página.`);
        try {
            await page.waitForTimeout(3000);
            console.log(`   🔍 Estrategia específica para la estructura de Turnitin...`);
            const clickResult = await page.evaluate((targetId) => {
                const allElements = Array.from(document.querySelectorAll('*'));
                let submissionFound = false;
                let paperTitleLink = null;
                for (let element of allElements) {
                    const textContent = element.textContent || '';
                    if (textContent.includes('Paper ID:') && textContent.includes(targetId)) {
                        console.log('Submission ID encontrado en:', textContent);
                        submissionFound = true;
                        let container = element.closest('tr') || element.closest('tbody') || element.closest('div');
                        if (container) {
                            const links = Array.from(container.querySelectorAll('a'));
                            for (let link of links) {
                                const linkText = link.textContent || '';
                                const linkTitle = link.title || '';
                                const linkHref = link.href || '';
                                if (linkText.includes('Paper Title:') ||
                                    linkText.includes('Open paper in Feedback Studio') ||
                                    linkTitle.includes('Open paper in Feedback Studio') ||
                                    linkHref.includes('carta')) {
                                    paperTitleLink = link;
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
                if (submissionFound && paperTitleLink) {
                    try {
                        paperTitleLink.click();
                        return {
                            success: true,
                            reason: `Clic realizado en enlace del paper para Submission ID "${targetId}"`,
                            linkText: paperTitleLink.textContent?.trim(),
                            linkHref: paperTitleLink.href
                        };
                    }
                    catch (clickError) {
                        return {
                            success: false,
                            reason: `Error al hacer clic: ${clickError?.message || 'Error desconocido'}`,
                            found: true
                        };
                    }
                }
                else if (submissionFound) {
                    return {
                        success: false,
                        reason: `Submission ID "${targetId}" encontrado pero no se pudo localizar el enlace del paper`,
                        found: true
                    };
                }
                else {
                    return {
                        success: false,
                        reason: `Submission ID "${targetId}" no encontrado en la página`,
                        found: false
                    };
                }
            }, submissionId);
            if (clickResult.success) {
                console.log(`   ✅ ${clickResult.reason}`);
                console.log(`   📎 Enlace: ${clickResult.linkHref}`);
                await page.waitForTimeout(2000);
                return true;
            }
            else {
                console.log(`   ❌ ${clickResult.reason}`);
                if (clickResult.found) {
                    console.log(`   🔄 Intentando estrategia alternativa con selectors CSS...`);
                    const alternativeResult = await page.evaluate((targetId) => {
                        const tables = Array.from(document.querySelectorAll('table tbody tr'));
                        for (let row of tables) {
                            const rowText = row.textContent || '';
                            if (rowText.includes(targetId)) {
                                const links = Array.from(row.querySelectorAll('a[href*="carta"], a[title*="Feedback Studio"]'));
                                if (links.length > 0) {
                                    try {
                                        const firstLink = links[0];
                                        firstLink.click();
                                        return {
                                            success: true,
                                            reason: `Clic alternativo realizado para Submission ID "${targetId}"`,
                                            linkHref: firstLink.href
                                        };
                                    }
                                    catch (e) {
                                        return {
                                            success: false,
                                            reason: `Error en clic alternativo: ${e?.message || 'Error desconocido'}`
                                        };
                                    }
                                }
                            }
                        }
                        return {
                            success: false,
                            reason: 'Estrategia alternativa también falló'
                        };
                    }, submissionId);
                    if (alternativeResult.success) {
                        console.log(`   ✅ ${alternativeResult.reason}`);
                        await page.waitForTimeout(2000);
                        return true;
                    }
                    else {
                        console.log(`   ❌ ${alternativeResult.reason}`);
                    }
                }
            }
            const availableIds = await page.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                const foundIds = [];
                for (let element of allElements) {
                    const textContent = element.textContent || '';
                    if (textContent.includes('Paper ID:')) {
                        const match = textContent.match(/Paper ID:\s*(\d+)/);
                        if (match && match[1]) {
                            foundIds.push(match[1]);
                        }
                    }
                }
                return [...new Set(foundIds)];
            });
            console.log(`   📋 Submission IDs disponibles en la página: ${availableIds.join(', ')}`);
            if (availableIds.length > 0 && !availableIds.includes(submissionId)) {
                console.log(`   ⚠️ El Submission ID "${submissionId}" no está en la lista de IDs disponibles.`);
                console.log(`   💡 IDs disponibles: ${availableIds.join(', ')}`);
            }
            return false;
        }
        catch (error) {
            console.error(`   💥 Error buscando/haciendo clic por Submission ID "${submissionId}":`, error);
            return false;
        }
    }
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Navegador cerrado');
        }
    }
}
