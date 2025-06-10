import { ImprovedTurnitinScraperService } from '../services/improved-turnitin-scraper.service';
import { Page } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Información exacta del archivo JSON
const EXACT_JSON_DATA = {
    workTitle: "LA LECTURA.docx", // Usaremos esto para derivar el nombre del PDF esperado
    aiButtonCSS: "tii-aiw-button.hydrated",
    expectedFinalUrl: "https://awo-usw2.integrity.turnitin.com/trn:oid:::1:3272334500"
};

async function ultimateDownloadDetector() {
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

    let currentPage: Page | null = null; // Declarar fuera para el finally

    try {
        console.log('🎯 DETECTOR ULTIMATE DE DESCARGAS');
        console.log('=================================');
        console.log('Configura el navegador para descargar en la carpeta del proyecto');
        console.log('y monitorea múltiples ubicaciones de descarga.');
        console.log('');

        await scraper.initializeBrowser();
        currentPage = await scraper.createNewPage();
        
        const projectDownloadPath = scraper.getDownloadPath();
        console.log(`📁 Configurando descarga en: ${projectDownloadPath}`);
        
        try {
            const client = await currentPage.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: projectDownloadPath
            });
            console.log('✅ Carpeta de descarga configurada en el navegador');
        } catch (cdpError: any) {
            console.warn(`⚠️ No se pudo configurar la carpeta de descarga vía CDP: ${cdpError.message}`);
            console.warn(`   El archivo podría descargarse en la carpeta predeterminada del navegador.`);
        }
        
        const aiReportPageInstance = await navigateToAIReportPage(scraper, currentPage);
        
        if (!aiReportPageInstance) {
            console.log('❌ No se pudo obtener la instancia de la página del reporte de IA.');
            return;
        }
        
        currentPage = aiReportPageInstance; // Actualizar currentPage a la página del reporte
        const finalPageUrl = currentPage.url();
        console.log(`📍 URL final alcanzada: ${finalPageUrl}`);
        
        if (!finalPageUrl.includes('integrity.turnitin.com')) {
            console.log('❌ No se pudo llegar a la página del reporte de IA');
            console.log(`   URL actual: ${finalPageUrl}`);
            console.log(`   URL esperada: debe contener "integrity.turnitin.com"`);
            return;
        }
        
        console.log('✅ En la página del reporte de IA');
        
        await advancedDownloadMonitoring(currentPage, projectDownloadPath);
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        console.log('\nPresiona ENTER para cerrar...');
        await askQuestion('');
        if (scraper) { // Asegurarse que scraper está inicializado
            await scraper.closeBrowser();
        }
        rl.close();
    }
}

async function navigateToAIReportPage(scraper: ImprovedTurnitinScraperService, initialPage: Page): Promise<Page | null> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };

    let currentPageForNavigation = initialPage; 

    try {
        await scraper.navigateToTurnitinInbox(currentPageForNavigation);
        
        const currentUrl = currentPageForNavigation.url();
        if (currentUrl.includes('login')) {
            console.log('🔐 Inicia sesión manualmente y presiona ENTER...');
            await askQuestion('');
            await scraper.navigateToTurnitinInbox(currentPageForNavigation);
        }
        
        console.log(`🎯 Buscando trabajo: "${EXACT_JSON_DATA.workTitle}"`);
        
        const clickSuccess = await scraper.findAndClickOnSubmission(currentPageForNavigation, EXACT_JSON_DATA.workTitle);
        if (!clickSuccess) {
            throw new Error('No se pudo abrir el trabajo');
        }
        
        const browser = currentPageForNavigation.browser();
        let pages = await browser.pages(); // Obtener páginas actualizadas
        
        let cartaPage: Page | undefined = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));

        if (!cartaPage) {
            // Si findAndClickOnSubmission no abrió una nueva pestaña que sea carta,
            // la página actual podría ser la de carta.
            if (currentPageForNavigation.url().includes('ev.turnitin.com/app/carta')) {
                cartaPage = currentPageForNavigation;
            } else {
                 // Esperar un poco por si la navegación es lenta o se abre una nueva pestaña
                await new Promise(resolve => setTimeout(resolve, 3000));
                pages = await browser.pages();
                cartaPage = pages.find(p => p.url().includes('ev.turnitin.com/app/carta'));
                if (!cartaPage) {
                    throw new Error('Página de Carta no encontrada después de abrir el trabajo.');
                }
            }
        }
        console.log(`✅ Página de Carta encontrada/confirmada: ${cartaPage.url()}`);
        await cartaPage.waitForTimeout(5000); 
        
        console.log('🤖 Haciendo clic en botón de IA...');
        
        let aiReportPageInstance: Page | null = null;
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
        
        const aiElements = await cartaPage.$$(EXACT_JSON_DATA.aiButtonCSS);
        if (aiElements.length > 0) {
            await aiElements[0].click();
            console.log('✅ Clic en IA realizado');
            
            aiReportPageInstance = await pagePromise;
            
            if (aiReportPageInstance) {
                await aiReportPageInstance.bringToFront(); // Asegurar que la nueva pestaña esté activa
                await aiReportPageInstance.waitForTimeout(10000); 
                const aiUrl = aiReportPageInstance.url();
                console.log(`📍 URL del reporte (nueva pestaña): ${aiUrl}`);
                
                if (aiUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ Llegamos a la página del reporte de IA en nueva pestaña.');
                    await aiReportPageInstance.waitForTimeout(5000); 
                    console.log('✅ Página del reporte de IA lista para monitoreo.');
                    return aiReportPageInstance; 
                } else {
                    await aiReportPageInstance.close(); // Cerrar página incorrecta
                    throw new Error(`URL inesperada en nueva pestaña: ${aiUrl}`);
                }
            } else {
                console.log('⏳ No se detectó nueva pestaña, verificando URL actual de Carta...');
                await cartaPage.waitForTimeout(8000); 
                const newCartaUrl = cartaPage.url();
                console.log(`📍 URL después del clic (misma pestaña): ${newCartaUrl}`);
                if (newCartaUrl.includes('integrity.turnitin.com')) {
                    console.log('✅ El reporte se abrió en la misma pestaña (cartaPage).');
                    await cartaPage.waitForTimeout(5000); 
                    console.log('✅ Página del reporte de IA lista para monitoreo (misma pestaña).');
                    return cartaPage; 
                } else {
                    throw new Error('No se abrió nueva pestaña y la URL actual no cambió al reporte de IA.');
                }
            }
        } else {
            throw new Error('No se encontró el botón de IA en la página de Carta');
        }
        
    } finally {
        rl.close(); 
    }
}


async function advancedDownloadMonitoring(page: Page, projectDownloadPath: string): Promise<void> {
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
        console.log('\n🕵️ MONITOREO AVANZADO DE DESCARGAS');
        console.log('===================================');
        
        const downloadLocations = [
            projectDownloadPath, // Carpeta del proyecto configurada
            path.join(os.homedir(), 'Downloads'), // Carpeta de Descargas estándar del usuario
            path.join(os.homedir(), 'Desktop'), // Escritorio
        ].filter(loc => fs.existsSync(loc)); // Solo monitorear carpetas que realmente existen

        console.log('📁 Monitoreando las siguientes ubicaciones existentes:');
        downloadLocations.forEach((location, index) => {
            console.log(`   ${index + 1}. ${location}`);
        });
        
        // Tomar una "foto" del estado de los directorios ANTES de que el usuario haga la descarga manual
        const initialFileStates: Map<string, Set<string>> = new Map();
        downloadLocations.forEach(loc => {
            initialFileStates.set(loc, new Set(fs.readdirSync(loc)));
        });
        
        // Marcar el tiempo justo antes de ceder el control al usuario para la descarga
        const preManualDownloadTimestamp = Date.now();

        console.log('\n🎮 CONTROL MANUAL MEJORADO');
        console.log('===========================');
        console.log('Ahora, por favor, ve al navegador y haz clic en el botón/enlace para descargar el reporte.');
        console.log('Una vez que la descarga haya comenzado/completado, usa la opción "scan".');
        console.log('');
        console.log('Opciones disponibles:');
        console.log('1. scan - Escanear todas las ubicaciones en busca de nuevos archivos PDF');
        console.log('2. screenshot - Tomar screenshot de la página actual');
        console.log('3. help - Ayuda para encontrar el botón de descarga');
        console.log('4. done - Terminar');
        console.log('');
        
        let continueMonitoring = true;
        while (continueMonitoring) {
            const choice = await askQuestion('¿Qué quieres hacer?: ');
            
            switch (choice.toLowerCase()) {
                case '1':
                case 'scan':
                    console.log('\n🔍 ESCANEANDO UBICACIONES DE DESCARGA...');
                    console.log('========================================');
                    
                    let foundAndCopiedFiles = false;
                    // El nombre base esperado del archivo, ej. "LA LECTURA"
                    const expectedFileBaseName = EXACT_JSON_DATA.workTitle.split('.')[0].toLowerCase(); 

                    for (const location of downloadLocations) {
                        console.log(`\n   Verificando en: ${location}`);
                        if (!fs.existsSync(location)) continue;

                        const filesInLocation = fs.readdirSync(location);
                        
                        for (const file of filesInLocation) {
                            const filePath = path.join(location, file);
                            const fileNameLower = file.toLowerCase();

                            // Criterio 1: Es un archivo PDF
                            if (!fileNameLower.endsWith('.pdf')) {
                                continue;
                            }

                            // Criterio 2: El nombre contiene la base del título del trabajo
                            // O es un archivo "nuevo" desde que se cedió el control (comparando con el estado inicial)
                            // O es un archivo modificado muy recientemente (después de preManualDownloadTimestamp)
                            
                            let isPotentiallyTheFile = false;
                            let reason = "";

                            try {
                                const stats = fs.statSync(filePath);
                                const isNewSinceInitialScan = !initialFileStates.get(location)?.has(file);
                                const isRecentModification = stats.mtimeMs > preManualDownloadTimestamp - (5 * 60 * 1000); // Modificado en los últimos 5 mins
                                
                                if (fileNameLower.includes(expectedFileBaseName)) {
                                    isPotentiallyTheFile = true;
                                    reason = "Nombre coincide";
                                } else if (isNewSinceInitialScan && isRecentModification) {
                                    isPotentiallyTheFile = true;
                                    reason = "Nuevo y modificado recientemente";
                                } else if (isRecentModification) {
                                    // Si solo es reciente pero no coincide el nombre, podría ser, pero con menor certeza
                                    isPotentiallyTheFile = true;
                                    reason = "Modificado recientemente (nombre no coincide)";
                                }

                                if (isPotentiallyTheFile) {
                                    const sizeKB = (stats.size / 1024).toFixed(2);
                                    console.log(`     ✨ Archivo PDF encontrado: ${file} (${sizeKB} KB)`);
                                    console.log(`        Razón: ${reason}, Modificado: ${stats.mtime.toLocaleString()}`);

                                    // Copiar al directorio del proyecto si aún no está allí o si es una versión más nueva
                                    const safeOriginalFileName = file.replace(/[^a-zA-Z0-9_.-]/g, '_');
                                    const newFileNameInProject = `TurnitinReport_${EXACT_JSON_DATA.workTitle.split('.')[0]}_${new Date().toISOString().replace(/[:.]/g, '-')}_${safeOriginalFileName}`;
                                    const destPath = path.join(projectDownloadPath, newFileNameInProject);
                                    
                                    let shouldCopy = true;
                                    if (fs.existsSync(destPath)) {
                                        const destStats = fs.statSync(destPath);
                                        if (destStats.mtimeMs >= stats.mtimeMs && destStats.size === stats.size) {
                                            shouldCopy = false; // Ya existe una copia idéntica o más nueva
                                            console.log(`        ℹ️  Ya existe una copia idéntica/más nueva en temp-downloads: ${newFileNameInProject}`);
                                        }
                                    }

                                    if (shouldCopy) {
                                        fs.copyFileSync(filePath, destPath);
                                        console.log(`        ✅ COPIADO a temp-downloads como: ${newFileNameInProject}`);
                                        foundAndCopiedFiles = true;
                                    }
                                }
                            } catch (statError: any) {
                                console.log(`     ⚠️ No se pudo obtener info de ${file}: ${statError.message}`);
                            }
                        }
                    }
                    
                    if (foundAndCopiedFiles) {
                        console.log('\n🎉 ¡SE ENCONTRARON Y COPIARON ARCHIVOS PDF RELEVANTES AL PROYECTO!');
                        const shouldFinish = await askQuestion('\n✅ ¿Descarga completada y verificada? ¿Terminar? (s/n): ');
                        if (shouldFinish.toLowerCase() === 's') {
                            continueMonitoring = false;
                        }
                    } else {
                        console.log('\n❌ No se encontraron archivos PDF nuevos o relevantes que coincidan con los criterios.');
                        console.log('💡 Asegúrate de haber hecho clic en el botón de descarga en el navegador.');
                        console.log('   El archivo esperado debería ser un PDF y contener algo como "' + expectedFileBaseName + '".');
                        console.log('   Si se descargó con otro nombre o formato, este script podría no detectarlo.');
                    }
                    break;
                    
                case '2':
                case 'screenshot':
                    const screenshot = path.join(projectDownloadPath, `advanced_screenshot_${Date.now()}.png`);
                    await page.screenshot({ path: screenshot, fullPage: true });
                    console.log(`📸 Screenshot: ${screenshot}`);
                    break;
                    
                case '3':
                case 'help':
                    console.log('\n💡 AYUDA PARA ENCONTRAR EL BOTÓN DE DESCARGA:');
                    console.log('===============================================');
                    console.log('🔍 Busca estos elementos en la página:');
                    console.log('   • Botón que diga "Download" o "Descargar"');
                    console.log('   • Ícono de descarga (flecha hacia abajo) ⬇️');
                    console.log('   • Menú de tres puntos ⋮ que abra opciones');
                    console.log('   • Botón en la parte superior derecha');
                    console.log('   • Enlaces que digan "Export" o "Exportar"');
                    console.log('');
                    console.log('📍 Ubicaciones comunes:');
                    console.log('   • Esquina superior derecha de la página');
                    console.log('   • Barra de herramientas superior');
                    console.log('   • Menú contextual (clic derecho)');
                    console.log('   • Botones flotantes en la página');
                    console.log('');
                    console.log('🎯 Después de hacer clic, usa "scan" para verificar la descarga');
                    break;
                    
                case '4':
                case 'done':
                    continueMonitoring = false;
                    break;
                    
                default:
                    console.log('❌ Opción no válida. Usa: scan, screenshot, help, o done');
            }
            console.log('');
        }
        
    } catch (error: any) {
        console.error('❌ Error en monitoreo:', error.message);
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    ultimateDownloadDetector()
        .catch(error => {
            // El error ya se maneja en el bloque try/catch de ultimateDownloadDetector
            // y el finally se encarga de cerrar.
            // No es necesario un console.error aquí si ya se hizo.
            process.exit(1); // Salir si hay un error fatal no capturado antes
        });
}
