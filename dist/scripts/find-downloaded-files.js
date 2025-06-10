"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
async function findDownloadedFiles() {
    console.log('🔍 BUSCADOR DE ARCHIVOS DESCARGADOS');
    console.log('===================================');
    console.log('Busca archivos de reporte de IA en ubicaciones comunes');
    console.log('');
    const searchLocations = [
        path_1.default.join(os_1.default.homedir(), 'Downloads'),
        path_1.default.join(os_1.default.homedir(), 'Desktop'),
        path_1.default.join(os_1.default.homedir(), 'Documents'),
        path_1.default.join('D:', 'Protus', 'turnitin-report-downloader', 'temp-downloads'),
        'C:\\Users\\' + os_1.default.userInfo().username + '\\Downloads',
    ];
    const searchPatterns = [
        /turnitin/i,
        /ai.*report/i,
        /report.*ai/i,
        /writing.*detection/i,
        /detection.*writing/i,
        /.pdf$/i,
        /la.*lectura/i
    ];
    console.log('📁 Buscando en las siguientes ubicaciones:');
    searchLocations.forEach(location => {
        console.log(`   • ${location}`);
    });
    console.log('');
    const foundFiles = [];
    searchLocations.forEach(location => {
        if (fs_1.default.existsSync(location)) {
            try {
                const files = fs_1.default.readdirSync(location);
                files.forEach(file => {
                    const isRelevant = searchPatterns.some(pattern => pattern.test(file));
                    if (isRelevant) {
                        const filePath = path_1.default.join(location, file);
                        const stats = fs_1.default.statSync(filePath);
                        const ageHours = (Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60);
                        if (ageHours <= 24) {
                            foundFiles.push({ location, file, stats });
                        }
                    }
                });
            }
            catch (error) {
                console.log(`⚠️ Error accediendo a ${location}`);
            }
        }
    });
    if (foundFiles.length > 0) {
        console.log('🎉 ¡ARCHIVOS RELEVANTES ENCONTRADOS!');
        console.log('===================================');
        foundFiles.forEach((item, index) => {
            const sizeKB = (item.stats.size / 1024).toFixed(2);
            const age = Math.round((Date.now() - item.stats.birthtime.getTime()) / (1000 * 60));
            console.log(`\n${index + 1}. ${item.file}`);
            console.log(`   📁 Ubicación: ${item.location}`);
            console.log(`   📊 Tamaño: ${sizeKB} KB`);
            console.log(`   🕒 Creado hace: ${age} minutos`);
            console.log(`   📅 Fecha: ${item.stats.birthtime.toLocaleString()}`);
        });
        console.log('\n💡 Estos archivos parecen ser reportes de IA de Turnitin recientes.');
    }
    else {
        console.log('❌ No se encontraron archivos relevantes recientes');
        console.log('');
        console.log('💡 Sugerencias:');
        console.log('   • Verifica tu carpeta de Descargas del navegador');
        console.log('   • Busca archivos PDF creados recientemente');
        console.log('   • El archivo puede tener un nombre genérico como "document.pdf"');
    }
}
if (require.main === module) {
    findDownloadedFiles();
}
