"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileChecker = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FileChecker {
    static checkDownloadedFiles() {
        const tempDownloads = path_1.default.join(__dirname, '..', '..', 'temp-downloads');
        const uploadsReports = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports');
        console.log('\n📁 Verificando archivos descargados...');
        if (fs_1.default.existsSync(tempDownloads)) {
            const tempFiles = fs_1.default.readdirSync(tempDownloads);
            console.log(`\n📂 Archivos en temp-downloads (${tempFiles.length}):`);
            tempFiles.forEach((file, index) => {
                const filePath = path_1.default.join(tempDownloads, file);
                const stats = fs_1.default.statSync(filePath);
                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB) - ${stats.mtime.toLocaleString()}`);
            });
        }
        else {
            console.log('📂 Directorio temp-downloads no existe');
        }
        if (fs_1.default.existsSync(uploadsReports)) {
            const reportFiles = fs_1.default.readdirSync(uploadsReports);
            console.log(`\n📂 Archivos en uploads/reports (${reportFiles.length}):`);
            reportFiles.forEach((file, index) => {
                const filePath = path_1.default.join(uploadsReports, file);
                const stats = fs_1.default.statSync(filePath);
                console.log(`   ${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB) - ${stats.mtime.toLocaleString()}`);
            });
        }
        else {
            console.log('📂 Directorio uploads/reports no existe');
        }
        const analysisFile = path_1.default.join(tempDownloads, 'page-analysis.json');
        if (fs_1.default.existsSync(analysisFile)) {
            console.log('\n🔍 Análisis de página disponible en:', analysisFile);
            try {
                const analysis = JSON.parse(fs_1.default.readFileSync(analysisFile, 'utf8'));
                console.log(`   - URL analizada: ${analysis.url}`);
                console.log(`   - Elementos encontrados: ${analysis.linksCount} enlaces, ${analysis.buttonsCount} botones`);
            }
            catch (error) {
                console.log('   - Error leyendo análisis:', error);
            }
        }
    }
}
exports.FileChecker = FileChecker;
