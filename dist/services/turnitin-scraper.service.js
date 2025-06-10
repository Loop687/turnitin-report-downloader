"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnitinScraperService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const report_storage_service_1 = require("./report-storage.service");
class TurnitinScraperService {
    constructor(debugMode = false) {
        this.browser = null;
        this.reportStorageService = new report_storage_service_1.ReportStorageService();
        this.downloadPath = path_1.default.join(__dirname, '..', '..', 'temp-downloads');
        this.debugMode = debugMode;
        if (!fs_1.default.existsSync(this.downloadPath)) {
            fs_1.default.mkdirSync(this.downloadPath, { recursive: true });
        }
    }
    async initializeBrowser() {
        console.log('🚀 Iniciando navegador para scraping...');
        this.browser = await puppeteer_1.default.launch({
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
    async analyzeCurrentPageStructure(page) {
        console.log('🔍 Analizando estructura de la página actual...');
        try {
            const pageInfo = await page.evaluate(() => {
                const url = window.location.href;
                const title = document.title;
                const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.textContent?.trim(),
                    href: a.href,
                    classes: a.className
                })).filter(link => link.text && link.text.length > 0);
                const allButtons = Array.from(document.querySelectorAll('button')).map(btn => ({
                    text: btn.textContent?.trim(),
                    title: btn.title,
                    classes: btn.className
                })).filter(btn => btn.text && btn.text.length > 0);
                const tables = Array.from(document.querySelectorAll('table')).map(table => ({
                    headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()),
                    rows: Array.from(table.querySelectorAll('tr')).length
                }));
                const relevantElements = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    return (text.includes('student') || text.includes('assignment') ||
                        text.includes('submission') || text.includes('paper')) &&
                        text.length < 200;
                }).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.trim(),
                    classes: el.className,
                    id: el.id
                })).slice(0, 10);
                return {
                    url,
                    title,
                    linksCount: allLinks.length,
                    buttonsCount: allButtons.length,
                    tablesCount: tables.length,
                    tables,
                    relevantElements,
                    sampleLinks: allLinks.slice(0, 15),
                    sampleButtons: allButtons.slice(0, 10)
                };
            });
            console.log('📊 Información de la página:');
            console.log(`   URL: ${pageInfo.url}`);
            console.log(`   Título: ${pageInfo.title}`);
            console.log(`   Enlaces encontrados: ${pageInfo.linksCount}`);
            console.log(`   Botones encontrados: ${pageInfo.buttonsCount}`);
            console.log(`   Tablas encontradas: ${pageInfo.tablesCount}`);
            console.log('\n🔗 Enlaces de muestra:');
            pageInfo.sampleLinks.forEach((link, index) => {
                console.log(`   ${index + 1}. "${link.text}" -> ${link.href}`);
            });
            console.log('\n🔘 Botones de muestra:');
            pageInfo.sampleButtons.forEach((btn, index) => {
                console.log(`   ${index + 1}. "${btn.text}" (${btn.classes})`);
            });
            if (pageInfo.tables.length > 0) {
                console.log('\n📋 Tablas encontradas:');
                pageInfo.tables.forEach((table, index) => {
                    console.log(`   Tabla ${index + 1}: ${table.rows} filas, Headers: [${table.headers.join(', ')}]`);
                });
            }
            console.log('\n🎯 Elementos relevantes:');
            pageInfo.relevantElements.forEach((el, index) => {
                console.log(`   ${index + 1}. <${el.tag}> "${el.text?.substring(0, 50)}..." (${el.classes})`);
            });
            const analysisFile = path_1.default.join(this.downloadPath, 'page-analysis.json');
            fs_1.default.writeFileSync(analysisFile, JSON.stringify(pageInfo, null, 2));
            console.log(`\n💾 Análisis detallado guardado en: ${analysisFile}`);
        }
        catch (error) {
            console.error('❌ Error analizando la página:', error);
        }
    }
    async findSubmissionsWithAIReports(page) {
        console.log('🔍 Buscando trabajos con reportes de IA...');
        await this.analyzeCurrentPageStructure(page);
        try {
            const submissions = await page.evaluate(() => {
                const reports = [];
                const submissionTable = document.querySelector('table');
                if (submissionTable) {
                    const rows = Array.from(submissionTable.querySelectorAll('tbody tr'));
                    console.log(`Encontradas ${rows.length} filas en la tabla de trabajos`);
                    rows.forEach((row, index) => {
                        try {
                            const cells = Array.from(row.querySelectorAll('td'));
                            if (cells.length === 0)
                                return;
                            let studentName = `Estudiante-${index + 1}`;
                            let title = 'Trabajo sin título';
                            let reportUrl = '';
                            let submissionId = '';
                            if (cells[1]) {
                                const authorText = cells[1].textContent?.trim();
                                if (authorText && authorText.length > 2 && !authorText.includes('unavailable')) {
                                    studentName = authorText;
                                }
                            }
                            if (cells[2]) {
                                const titleElement = cells[2].querySelector('a');
                                if (titleElement && titleElement.href) {
                                    title = titleElement.textContent?.trim() || title;
                                    reportUrl = titleElement.href;
                                }
                            }
                            if (cells[3]) {
                                const submissionIdText = cells[3].textContent?.trim();
                                if (submissionIdText && submissionIdText.length > 2) {
                                    submissionId = submissionIdText;
                                }
                            }
                            const rowText = row.textContent || '';
                            if (!rowText.includes('unavailable') &&
                                !rowText.includes('No paper submitted') &&
                                reportUrl &&
                                reportUrl.length > 0) {
                                reports.push({
                                    studentName: studentName,
                                    studentId: submissionId || `estudiante-${index + 1}`,
                                    assignmentTitle: title,
                                    reportUrl: reportUrl,
                                    reportType: 'ai',
                                    elementInfo: {
                                        tag: row.tagName,
                                        classes: row.className,
                                        textPreview: rowText.substring(0, 100),
                                        cellsCount: cells.length,
                                        submissionId: submissionId
                                    }
                                });
                            }
                        }
                        catch (error) {
                            console.log(`Error procesando fila ${index}:`, error);
                        }
                    });
                }
                else {
                    console.log('No se encontró tabla de trabajos');
                }
                return reports;
            });
            console.log(`📋 Encontrados ${submissions.length} trabajos válidos con URLs`);
            if (submissions.length > 0) {
                console.log('\n📋 Trabajos encontrados:');
                submissions.forEach((sub, index) => {
                    console.log(`   ${index + 1}. ${sub.studentName} - ${sub.assignmentTitle}`);
                    console.log(`      ID: ${sub.studentId}`);
                    console.log(`      URL: ${sub.reportUrl}`);
                });
            }
            return submissions;
        }
        catch (error) {
            console.error('❌ Error al buscar trabajos:', error);
            return [];
        }
    }
    async tryAlternativeMethodToFindReports(page) {
        console.log('🔄 Intentando método alternativo para encontrar reportes...');
        try {
            const allReportLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const reportLinks = links.filter(link => link.href && (link.href.includes('carta') ||
                    link.href.includes('ev.turnitin.com') ||
                    link.href.includes('integrity.turnitin.com') ||
                    link.href.includes('view_submission')));
                return reportLinks.map((link, index) => ({
                    studentName: `Estudiante-FromLink-${index + 1}`,
                    studentId: `estudiante-link-${index + 1}`,
                    assignmentTitle: link.textContent?.trim() || 'Trabajo desde enlace',
                    reportUrl: link.href,
                    reportType: 'ai',
                    source: 'direct-link-search'
                }));
            });
            console.log(`🔗 Encontrados ${allReportLinks.length} enlaces directos a reportes`);
            return allReportLinks;
        }
        catch (error) {
            console.error('❌ Error en método alternativo:', error);
            return [];
        }
    }
    async downloadAIReportFromSubmission(page, report) {
        console.log(`📥 Descargando reporte de IA para: ${report.studentName}`);
        if (!report.reportUrl || report.reportUrl.trim() === '') {
            console.log('⚠️ URL vacía, saltando...');
            return null;
        }
        try {
            console.log(`🌐 Paso 1: Navegando a la vista del trabajo: ${report.reportUrl}`);
            await page.goto(report.reportUrl, { waitUntil: 'networkidle2' });
            await page.waitForTimeout(5000);
            const currentUrl = page.url();
            console.log(`📍 URL actual: ${currentUrl}`);
            if (!currentUrl.includes('ev.turnitin.com/app/carta')) {
                console.log('⚠️ No estamos en la página esperada de Turnitin Carta');
                return null;
            }
            console.log('🔍 Paso 2: Analizando página de vista del trabajo...');
            const aiAnalysis = await page.evaluate(() => {
                const aiElements = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const title = el.getAttribute('title')?.toLowerCase() || '';
                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    return (text.includes('ai') ||
                        text.includes('artificial intelligence') ||
                        text.includes('writing report') ||
                        title.includes('ai') ||
                        ariaLabel.includes('ai') ||
                        /\d+%/.test(text));
                }).map(el => ({
                    text: el.textContent?.trim().substring(0, 50),
                    tag: el.tagName,
                    classes: el.className,
                    id: el.id,
                    title: el.getAttribute('title'),
                    ariaLabel: el.getAttribute('aria-label'),
                    isClickable: el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button'
                }));
                const percentageElements = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent?.trim() || '';
                    return /^\d+%$/.test(text) && (el.tagName === 'BUTTON' ||
                        el.tagName === 'A' ||
                        el.getAttribute('role') === 'button' ||
                        window.getComputedStyle(el).cursor === 'pointer' ||
                        el.classList.contains('btn') ||
                        el.classList.contains('button'));
                }).map(el => ({
                    text: el.textContent?.trim(),
                    tag: el.tagName,
                    classes: el.className,
                    id: el.id
                }));
                return { aiElements, percentageElements };
            });
            console.log(`🤖 Elementos relacionados con IA encontrados: ${aiAnalysis.aiElements.length}`);
            console.log(`📊 Elementos con porcentajes encontrados: ${aiAnalysis.percentageElements.length}`);
            if (aiAnalysis.aiElements.length > 0) {
                console.log('🤖 Elementos de IA disponibles:');
                aiAnalysis.aiElements.slice(0, 5).forEach((el, index) => {
                    console.log(`   ${index + 1}. <${el.tag}> "${el.text}" (${el.classes}) - Clickeable: ${el.isClickable}`);
                });
            }
            if (aiAnalysis.percentageElements.length > 0) {
                console.log('📊 Elementos con porcentajes disponibles:');
                aiAnalysis.percentageElements.forEach((el, index) => {
                    console.log(`   ${index + 1}. <${el.tag}> "${el.text}" (${el.classes})`);
                });
            }
            console.log('🎯 Paso 3: Intentando hacer clic en el botón de IA...');
            let aiButtonFound = false;
            try {
                const percentageButtons = await page.$$eval('*', (elements) => {
                    return elements.filter(el => {
                        const text = el.textContent?.trim() || '';
                        return /^\d+%$/.test(text) && (el.tagName === 'BUTTON' ||
                            el.tagName === 'A' ||
                            el.getAttribute('role') === 'button' ||
                            window.getComputedStyle(el).cursor === 'pointer');
                    }).map(el => ({
                        selector: el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.split(' ').join('.')}` : ''),
                        text: el.textContent?.trim()
                    }));
                });
                if (percentageButtons.length > 0) {
                    console.log(`✅ Encontrados ${percentageButtons.length} botones con porcentajes`);
                    const firstPercentageButton = percentageButtons[0];
                    console.log(`🖱️ Haciendo clic en: "${firstPercentageButton.text}"`);
                    const xpath = `//button[text()="${firstPercentageButton.text}"] | //a[text()="${firstPercentageButton.text}"] | //*[@role="button"][text()="${firstPercentageButton.text}"]`;
                    const elements = await page.$x(xpath);
                    if (elements.length > 0) {
                        await elements[0].click();
                        console.log('✅ Clic realizado en el botón de porcentaje');
                        await page.waitForTimeout(8000);
                        aiButtonFound = true;
                    }
                }
            }
            catch (error) {
                console.log('⚠️ Error con estrategia de porcentajes:', error);
            }
            if (!aiButtonFound) {
                try {
                    const aiElements = await page.$x(`//button[contains(text(), "AI")] | //a[contains(text(), "AI")] | //*[@role="button"][contains(text(), "AI")]`);
                    if (aiElements.length > 0) {
                        console.log('✅ Encontrado elemento directo con "AI"');
                        await aiElements[0].click();
                        await page.waitForTimeout(8000);
                        aiButtonFound = true;
                    }
                }
                catch (error) {
                    console.log('⚠️ Error con estrategia directa de AI:', error);
                }
            }
            if (aiButtonFound) {
                console.log('🎯 Paso 4: Verificando si se abrió el reporte de IA...');
                const newUrl = page.url();
                console.log(`📍 Nueva URL: ${newUrl}`);
                const files = fs_1.default.readdirSync(this.downloadPath);
                const pdfFiles = files.filter(f => f.endsWith('.pdf'));
                if (pdfFiles.length > 0) {
                    const latestFile = pdfFiles[pdfFiles.length - 1];
                    console.log(`✅ Archivo descargado automáticamente: ${latestFile}`);
                    const newFileName = `${report.studentName.replace(/[^a-zA-Z0-9]/g, '_')}_AI_Report.pdf`;
                    const oldPath = path_1.default.join(this.downloadPath, latestFile);
                    const newPath = path_1.default.join(this.downloadPath, newFileName);
                    try {
                        fs_1.default.renameSync(oldPath, newPath);
                        return newFileName;
                    }
                    catch (error) {
                        return latestFile;
                    }
                }
                console.log('🔍 Buscando botón de descarga en la página del reporte de IA...');
                try {
                    const downloadElements = await page.$x(`//button[contains(text(), "Download")] | //a[contains(text(), "Download")] | //button[contains(text(), "Descargar")] | //a[contains(text(), "Descargar")]`);
                    if (downloadElements.length > 0) {
                        console.log('✅ Encontrado botón de descarga');
                        await downloadElements[0].click();
                        await page.waitForTimeout(10000);
                        const newFiles = fs_1.default.readdirSync(this.downloadPath);
                        const newPdfFiles = newFiles.filter(f => f.endsWith('.pdf'));
                        if (newPdfFiles.length > pdfFiles.length) {
                            const latestFile = newPdfFiles[newPdfFiles.length - 1];
                            console.log(`✅ Reporte descargado: ${latestFile}`);
                            return latestFile;
                        }
                    }
                }
                catch (error) {
                    console.log('⚠️ Error buscando botón de descarga:', error);
                }
            }
            console.log('📄 Método de respaldo: Guardando página como PDF...');
            const pdfFileName = `${report.studentName.replace(/[^a-zA-Z0-9]/g, '_')}_AI_Report_screenshot.pdf`;
            await page.pdf({
                path: path_1.default.join(this.downloadPath, pdfFileName),
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });
            return pdfFileName;
        }
        catch (error) {
            console.error(`❌ Error descargando reporte para ${report.studentName}:`, error);
            return null;
        }
    }
    async saveReportToSystem(report, downloadedFileName) {
        console.log(`💾 Guardando reporte en el sistema para: ${report.studentName}`);
        try {
            const sourcePath = path_1.default.join(this.downloadPath, downloadedFileName);
            const uploadsPath = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports');
            if (!fs_1.default.existsSync(uploadsPath)) {
                fs_1.default.mkdirSync(uploadsPath, { recursive: true });
            }
            const finalFileName = `${Date.now()}-${downloadedFileName}`;
            const finalPath = path_1.default.join(uploadsPath, finalFileName);
            fs_1.default.copyFileSync(sourcePath, finalPath);
            const reportDetails = {
                studentId: report.studentId,
                uploaderInstructorId: 'auto-scraper',
                originalFilename: downloadedFileName,
                storedFilename: finalFileName,
                filePath: finalPath,
                mimeType: 'application/pdf',
                uploadDate: new Date(),
            };
            await this.reportStorageService.saveReportMetadata(reportDetails);
            console.log(`✅ Reporte guardado exitosamente para ${report.studentName}`);
        }
        catch (error) {
            console.error(`❌ Error guardando reporte para ${report.studentName}:`, error);
        }
    }
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Navegador cerrado');
        }
    }
}
exports.TurnitinScraperService = TurnitinScraperService;
