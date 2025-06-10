"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log("<<<<< EXECUTING COMPILED dist/app.js >>>>>");
console.log(`Node.js version: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Current working directory: ${process.cwd()}`);
console.log("<<<<< END OF DIAGNOSTIC LOGS >>>>>");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3003', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOCAL_WORKER_URL = process.env.LOCAL_WORKER_URL;
const corsOptions = {
    origin: IS_PRODUCTION ?
        ['https://turnitin-downloader.onrender.com', 'https://tu-dominio-personalizado.com'] :
        true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        localWorkerConfigured: !!LOCAL_WORKER_URL
    });
});
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Turnitin AI Report Downloader',
        version: '1.0.0',
        status: 'running',
        features: [
            'AI Report Download via Local Worker',
            'Submission ID Search',
            'Title-based Search',
            'Remote Session Management'
        ]
    });
});
app.post('/api/student/request-ai-download', async (req, res) => {
    const { targetWorkTitle, submissionId } = req.body;
    const searchCriteria = submissionId || targetWorkTitle;
    const searchType = submissionId ? 'Submission ID' : 'Título';
    console.log(`[API] Solicitud de descarga recibida usando ${searchType}: ${searchCriteria}`);
    if (!LOCAL_WORKER_URL) {
        console.error('❌ LOCAL_WORKER_URL no está configurado en las variables de entorno.');
        return res.status(500).json({
            message: 'Error de configuración: El trabajador local no está configurado. Contacta al administrador.'
        });
    }
    if (!searchCriteria) {
        return res.status(400).json({
            message: 'Se requiere Submission ID o título del trabajo.'
        });
    }
    try {
        console.log(`📡 Enviando solicitud al trabajador local: ${LOCAL_WORKER_URL}/process-download`);
        const workerResponse = await axios_1.default.post(`${LOCAL_WORKER_URL}/process-download`, {
            submissionId: submissionId,
            targetWorkTitle: targetWorkTitle
        }, {
            responseType: 'arraybuffer',
            timeout: 300000,
            validateStatus: function (status) {
                return status < 500;
            }
        });
        if (workerResponse.status === 200) {
            console.log('✅ PDF recibido del trabajador local');
            res.setHeader('Content-Type', 'application/pdf');
            let filename = `report_${submissionId || targetWorkTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const contentDisposition = workerResponse.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+)"?/i);
                if (match && match[1]) {
                    filename = match[1];
                }
            }
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(workerResponse.data));
            console.log(`✅ Archivo "${filename}" enviado al estudiante`);
        }
        else {
            let errorMessage = 'Error en el trabajador local';
            try {
                const errorData = JSON.parse(Buffer.from(workerResponse.data).toString('utf8'));
                errorMessage = errorData.message || errorMessage;
            }
            catch (parseError) {
                console.warn('No se pudo parsear el error del trabajador');
            }
            console.error(`❌ Error del trabajador local (${workerResponse.status}): ${errorMessage}`);
            res.status(workerResponse.status).json({ message: errorMessage });
        }
    }
    catch (error) {
        console.error('[API] Error contactando al trabajador local:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            res.status(503).json({
                message: 'El trabajador local no está disponible. Verifica que esté ejecutándose y que ngrok esté activo.'
            });
        }
        else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            res.status(504).json({
                message: 'Timeout al procesar la solicitud. El proceso puede tomar varios minutos.'
            });
        }
        else {
            res.status(500).json({
                message: `Error interno: ${error.message}`
            });
        }
    }
});
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🌍 Modo: ${IS_PRODUCTION ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    console.log(`🔗 Trabajador local: ${LOCAL_WORKER_URL || 'NO CONFIGURADO'}`);
    if (!IS_PRODUCTION) {
        console.log(`📱 Acceso local: http://localhost:${PORT}`);
    }
});
process.on('SIGTERM', async () => {
    console.log('🔄 Recibida señal SIGTERM, cerrando servidor...');
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🔄 Recibida señal SIGINT, cerrando servidor...');
    process.exit(0);
});
exports.default = app;
