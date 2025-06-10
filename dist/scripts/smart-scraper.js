import * as readline from 'readline';
async function smartScrapeSpecificSubmission() {
    console.log('ℹ️ Usando coordinate-based downloader en lugar del método no implementado...');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const submissionId = await new Promise((resolve) => {
        rl.question('📋 Introduce el Submission ID que quieres procesar: ', resolve);
    });
    rl.close();
    if (!submissionId.trim()) {
        console.log('❌ Submission ID no válido');
        return;
    }
    console.log(`🎯 Procesando submission: ${submissionId}`);
    try {
        const { coordinateBasedDownloader } = await import('./coordinate-based-downloader');
        const result = await coordinateBasedDownloader(undefined, submissionId);
        if (result.success) {
            console.log(`✅ Descarga exitosa: ${result.message}`);
            if (result.filePath) {
                console.log(`📄 Archivo descargado: ${result.filePath}`);
            }
        }
        else {
            console.log(`❌ Error: ${result.message}`);
        }
    }
    catch (error) {
        console.error('❌ Error procesando submission:', error);
    }
}
async function initializeSmartScraper() {
    console.log('🤖 Iniciando Smart Scraper...');
    await smartScrapeSpecificSubmission();
}
if (require.main === module) {
    initializeSmartScraper().catch(console.error);
}
export { smartScrapeSpecificSubmission, initializeSmartScraper };
