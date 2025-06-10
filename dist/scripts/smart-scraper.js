"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSmartScraper = exports.smartScrapeSpecificSubmission = void 0;
const readline = __importStar(require("readline"));
// Función principal del smart scraper
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
        // Usar el coordinate-based downloader que SÍ funciona
        const { coordinateBasedDownloader } = await Promise.resolve().then(() => __importStar(require('./coordinate-based-downloader')));
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
exports.smartScrapeSpecificSubmission = smartScrapeSpecificSubmission;
// Función para inicializar el smart scraper
async function initializeSmartScraper() {
    console.log('🤖 Iniciando Smart Scraper...');
    await smartScrapeSpecificSubmission();
}
exports.initializeSmartScraper = initializeSmartScraper;
// Ejecutar si es llamado directamente
if (require.main === module) {
    initializeSmartScraper().catch(console.error);
}
