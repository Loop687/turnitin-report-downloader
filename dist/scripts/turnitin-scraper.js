"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const turnitin_scraper_service_1 = require("../services/turnitin-scraper.service");
const path_1 = __importDefault(require("path"));
async function runScraper() {
    const debugMode = process.argv.includes('--debug');
    const scraper = new turnitin_scraper_service_1.TurnitinScraperService(debugMode);
    try {
        console.log('🤖 Iniciando scraper automático de Turnitin...');
        console.log('🔍 Modo:', debugMode ? 'DEBUG' : 'NORMAL');
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('1. ✅ El script abrirá un navegador automáticamente');
        console.log('2. ✅ Si te pide login, inicia sesión manualmente');
        console.log('3. ✅ El script buscará y descargará los reportes de IA automáticamente');
        console.log('');
        // Inicializar navegador
        await scraper.initializeBrowser();
        // Crear nueva página
        const page = await scraper.createNewPage();
        // Navegar directamente a la bandeja de entrada
        await scraper.navigateToTurnitinInbox(page);
        // Esperar un momento para verificar si necesita login
        console.log('⏳ Esperando 5 segundos para verificar el estado de la página...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Verificar si estamos en la página correcta
        const currentUrl = page.url();
        console.log(`📍 URL actual: ${currentUrl}`);
        if (currentUrl.includes('login') || currentUrl.includes('signin')) {
            console.log('🔐 Se detectó página de login. Por favor:');
            console.log('   1. Inicia sesión manualmente en la ventana del navegador');
            console.log('   2. Navega hasta la bandeja de entrada de trabajos');
            console.log('   3. Ve a la URL específica: https://www.turnitin.com/assignment/type/paper/inbox/170792714?lang=en_us');
            console.log('   4. Presiona ENTER aquí cuando estés en la página de trabajos...');
            await new Promise((resolve) => {
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.once('data', () => {
                    process.stdin.setRawMode(false);
                    resolve();
                });
            });
            console.log('✅ Continuando con el análisis...');
        }
        // Buscar reportes de forma interactiva
        let reports = await scraper.findSubmissionsWithAIReports(page);
        // Si no encontró reportes válidos, intentar método alternativo
        if (reports.length === 0) {
            console.log('\n🔄 Intentando método alternativo...');
            reports = await scraper.tryAlternativeMethodToFindReports(page);
        }
        if (reports.length === 0) {
            console.log('ℹ️ No se encontraron trabajos con reportes de IA disponibles');
            console.log('💡 Sugerencias:');
            console.log('   - Asegúrate de estar en la página de trabajos/asignaciones');
            console.log('   - Verifica que haya trabajos enviados por estudiantes');
            console.log('   - Confirma que los trabajos tengan reportes de IA generados');
            console.log('   - Revisa el archivo page-analysis.json para más detalles');
            // Mostrar información del análisis de página si está disponible
            try {
                const analysisFile = path_1.default.join(scraper['downloadPath'], 'page-analysis.json');
                if (require('fs').existsSync(analysisFile)) {
                    console.log('\n📄 Revisa el análisis detallado en:', analysisFile);
                }
            }
            catch (error) {
                // Ignorar errores del análisis
            }
            return;
        }
        console.log(`\n📋 Encontrados ${reports.length} trabajos para procesar:`);
        reports.forEach((report, index) => {
            console.log(`   ${index + 1}. ${report.studentName} - ${report.assignmentTitle}`);
            console.log(`      ID: ${report.studentId}`);
            console.log(`      URL: ${report.reportUrl.substring(0, 80)}...`);
        });
        console.log('\n🚀 Iniciando descarga de reportes de IA...');
        console.log('📝 Flujo esperado para cada trabajo:');
        console.log('   1. Navegar a la URL del trabajo (ev.turnitin.com/app/carta/...)');
        console.log('   2. Buscar y hacer clic en el botón/porcentaje de IA');
        console.log('   3. Descargar o capturar el reporte de IA');
        // Procesar cada reporte
        let successCount = 0;
        for (let i = 0; i < reports.length; i++) {
            const report = reports[i];
            console.log(`\n🎯 Procesando ${i + 1}/${reports.length}: ${report.studentName}`);
            const downloadedFile = await scraper.downloadAIReportFromSubmission(page, report);
            if (downloadedFile) {
                console.log(`✅ Reporte descargado: ${downloadedFile}`);
                // Guardar en el sistema para que los estudiantes puedan descargarlo
                await scraper.saveReportToSystem(report, downloadedFile);
                successCount++;
            }
            else {
                console.log(`⚠️ No se pudo descargar el reporte para ${report.studentName}`);
            }
            // Pausa entre descargas para no sobrecargar el servidor
            if (i < reports.length - 1) {
                console.log('⏳ Esperando 3 segundos antes del próximo reporte...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        console.log('\n✅ Proceso de scraping completado');
        console.log(`📊 Estadísticas:`);
        console.log(`   - Trabajos encontrados: ${reports.length}`);
        console.log(`   - Reportes descargados exitosamente: ${successCount}`);
        console.log(`   - Reportes fallidos: ${reports.length - successCount}`);
        console.log(`📁 Archivos descargados en: ${scraper['downloadPath']}`);
    }
    catch (error) {
        console.error('❌ Error en el proceso de scraping:', error);
    }
    finally {
        console.log('\n⏳ Presiona ENTER para cerrar el navegador y salir...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', async () => {
            process.stdin.setRawMode(false);
            await scraper.closeBrowser();
            process.exit(0);
        });
    }
}
// Ejecutar si se llama directamente
if (require.main === module) {
    runScraper()
        .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
