const fs = require('fs');
const path = require('path');

function checkDownloadedFiles() {
    const tempDownloads = path.join(__dirname, 'temp-downloads');
    const uploadsReports = path.join(__dirname, 'uploads', 'reports');
    
    console.log('\n📁 Verificando archivos descargados...');
    
    // Verificar temp-downloads
    if (fs.existsSync(tempDownloads)) {
        const tempFiles = fs.readdirSync(tempDownloads);
        console.log(`\n📂 Archivos en temp-downloads (${tempFiles.length}):`);
        tempFiles.forEach((file, index) => {
            const filePath = path.join(tempDownloads, file);
            const stats = fs.statSync(filePath);
            console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB) - ${stats.mtime.toLocaleString()}`);
        });
    } else {
        console.log('📂 Directorio temp-downloads no existe');
    }
    
    // Verificar uploads/reports
    if (fs.existsSync(uploadsReports)) {
        const reportFiles = fs.readdirSync(uploadsReports);
        console.log(`\n📂 Archivos en uploads/reports (${reportFiles.length}):`);
        reportFiles.forEach((file, index) => {
            const filePath = path.join(uploadsReports, file);
            const stats = fs.statSync(filePath);
            console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB) - ${stats.mtime.toLocaleString()}`);
        });
    } else {
        console.log('📂 Directorio uploads/reports no existe');
    }
    
    // Verificar análisis de página
    const analysisFile = path.join(tempDownloads, 'page-analysis.json');
    if (fs.existsSync(analysisFile)) {
        console.log('\n🔍 Análisis de página disponible en:', analysisFile);
        try {
            const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
            console.log(`   - URL analizada: ${analysis.url}`);
            console.log(`   - Elementos encontrados: ${analysis.linksCount} enlaces, ${analysis.buttonsCount} botones`);
        } catch (error) {
            console.log('   - Error leyendo análisis:', error);
        }
    }
}

checkDownloadedFiles();
