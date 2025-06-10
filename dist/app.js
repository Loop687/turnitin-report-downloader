"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const coordinate_based_downloader_1 = require("./scripts/coordinate-based-downloader");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
// Comentar importaciones problemáticas temporalmente
// import './scripts/replay-learned-session';
// import './scripts/smart-scraper';
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3003', 10);
// 🔥 NUEVO: Configuración para producción
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?
    process.env.ALLOWED_ORIGINS.split(',') :
    ['http://localhost:3003', 'https://localhost:3003'];
// 🔥 MEJORADO: CORS más específico para producción
const corsOptions = {
    origin: (origin, callback) => {
        // Permitir requests sin origin (apps móviles, Postman, etc.)
        if (!origin)
            return callback(null, true);
        if (IS_PRODUCTION) {
            // En producción, solo permitir orígenes específicos
            if (ALLOWED_ORIGINS.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('No permitido por CORS'));
            }
        }
        else {
            // En desarrollo, permitir todo
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Nueva ruta para la solicitud de descarga del estudiante
app.post('/api/student/request-ai-download', async (req, res) => {
    const { targetWorkTitle, submissionId } = req.body;
    // Priorizar Submission ID sobre título
    if (!submissionId && !targetWorkTitle) {
        return res.status(400).json({
            success: false,
            message: "Se requiere el Submission ID (recomendado) o el título del trabajo."
        });
    }
    const searchCriteria = submissionId || targetWorkTitle;
    const searchType = submissionId ? 'Submission ID' : 'título';
    console.log(`[API] Solicitud de descarga recibida usando ${searchType}: ${searchCriteria}`);
    try {
        // Pasar solo el parámetro relevante
        const result = submissionId
            ? await (0, coordinate_based_downloader_1.coordinateBasedDownloader)(undefined, submissionId) // Solo Submission ID
            : await (0, coordinate_based_downloader_1.coordinateBasedDownloader)(targetWorkTitle, undefined); // Solo título
        if (result.success && result.filePath) {
            const confirmedFilePath = result.filePath;
            if (fs_1.default.existsSync(confirmedFilePath)) {
                console.log(`[API] Descarga exitosa usando ${searchType}. Enviando archivo: ${confirmedFilePath}`);
                res.download(confirmedFilePath, path_1.default.basename(confirmedFilePath), (err) => {
                    if (err) {
                        console.error("[API] Error al enviar el archivo:", err);
                        if (!res.headersSent) {
                            res.status(500).json({ success: false, message: "Error al enviar el archivo." });
                        }
                    }
                    else {
                        console.log(`[API] Archivo ${path_1.default.basename(confirmedFilePath)} enviado correctamente usando ${searchType}.`);
                        console.log(`[API] ✅ Navegador mantenido abierto para futuras solicitudes de descarga.`);
                    }
                });
            }
            else {
                console.error(`[API] Archivo no encontrado en la ruta: ${confirmedFilePath}`);
                res.status(404).json({ success: false, message: `Archivo descargado no encontrado en el servidor: ${confirmedFilePath}` });
            }
        }
        else {
            console.log(`[API] Falló la descarga usando ${searchType}: ${result.message}`);
            res.status(500).json({ success: false, message: result.message });
        }
    }
    catch (error) {
        console.error("[API] Error catastrófico durante la descarga:", error);
        res.status(500).json({ success: false, message: `Error interno del servidor: ${error.message}` });
    }
});
// 🔥 ACTUALIZADO: Endpoint para cerrar la sesión del navegador
app.post('/api/admin/close-browser', async (req, res) => {
    try {
        console.log('[API] Solicitud de cierre de sesión del navegador recibida.');
        await (0, coordinate_based_downloader_1.closeBrowserSession)();
        res.json({ success: true, message: 'Sesión del navegador cerrada exitosamente.' });
    }
    catch (error) {
        console.error('[API] Error cerrando sesión del navegador:', error);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});
// Ruta principal para servir index.html
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// 🔥 NUEVO: Endpoint de salud para Railway
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// 🔥 NUEVO: Información de la aplicación
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Turnitin AI Report Downloader',
        version: '1.0.0',
        status: 'running',
        features: [
            'AI Report Download',
            'Submission ID Search',
            'Title-based Search',
            'Session Management'
        ]
    });
});
// 🔥 MEJORADO: Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    if (err.message === 'No permitido por CORS') {
        return res.status(403).json({
            success: false,
            message: 'Acceso no permitido desde este origen'
        });
    }
    res.status(500).json({
        success: false,
        message: IS_PRODUCTION ? 'Error interno del servidor' : err.message
    });
});
// 🔥 MEJORADO: Inicio del servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🌍 Modo: ${IS_PRODUCTION ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    console.log(`🔓 Navegador se mantendrá abierto entre solicitudes para mejor rendimiento.`);
    if (!IS_PRODUCTION) {
        console.log(`📱 Acceso local: http://localhost:${PORT}`);
    }
});
// 🔥 NUEVO: Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Recibida señal SIGTERM, cerrando servidor...');
    await (0, coordinate_based_downloader_1.closeBrowserSession)();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🔄 Recibida señal SIGINT, cerrando servidor...');
    await (0, coordinate_based_downloader_1.closeBrowserSession)();
    process.exit(0);
});
exports.default = app;
