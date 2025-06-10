import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { coordinateBasedDownloader, closeBrowserSession } from './scripts/coordinate-based-downloader.js';
const app = express();
const PORT = parseInt(process.env.PORT || '3003', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const corsOptions = {
    origin: IS_PRODUCTION ?
        ['https://turnitin-downloader.onrender.com', 'https://tu-dominio-personalizado.com'] :
        true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.post('/api/student/request-ai-download', async (req, res) => {
    const { targetWorkTitle, submissionId } = req.body;
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
        const result = submissionId
            ? await coordinateBasedDownloader(undefined, submissionId)
            : await coordinateBasedDownloader(targetWorkTitle, undefined);
        if (result.success && result.filePath) {
            const confirmedFilePath = result.filePath;
            if (fs.existsSync(confirmedFilePath)) {
                console.log(`[API] Descarga exitosa usando ${searchType}. Enviando archivo: ${confirmedFilePath}`);
                res.download(confirmedFilePath, path.basename(confirmedFilePath), (err) => {
                    if (err) {
                        console.error("[API] Error al enviar el archivo:", err);
                        if (!res.headersSent) {
                            res.status(500).json({ success: false, message: "Error al enviar el archivo." });
                        }
                    }
                    else {
                        console.log(`[API] Archivo ${path.basename(confirmedFilePath)} enviado correctamente usando ${searchType}.`);
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
app.post('/api/admin/close-browser', async (req, res) => {
    try {
        console.log('[API] Solicitud de cierre de sesión del navegador recibida.');
        await closeBrowserSession();
        res.json({ success: true, message: 'Sesión del navegador cerrada exitosamente.' });
    }
    catch (error) {
        console.error('[API] Error cerrando sesión del navegador:', error);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});
app.get('/', (_req, res) => {
    if (IS_PRODUCTION) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
    else {
        const indexPath = path.join(__dirname, '../public/index.html');
        let htmlContent = fs.readFileSync(indexPath, 'utf8');
        const devNotice = `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <h4>🚀 Entorno de Desarrollo</h4>
            <p>Estás viendo esta aplicación en un entorno de desarrollo. Algunas características pueden no estar disponibles.</p>
        </div>
        `;
        htmlContent = htmlContent.replace('</body>', devNotice + '</body>');
        res.send(htmlContent);
    }
});
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
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
    console.log(`🔓 Navegador se mantendrá abierto entre solicitudes para mejor rendimiento.`);
    if (!IS_PRODUCTION) {
        console.log(`📱 Acceso local: http://localhost:${PORT}`);
    }
});
process.on('SIGTERM', async () => {
    console.log('🔄 Recibida señal SIGTERM, cerrando servidor...');
    await closeBrowserSession();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🔄 Recibida señal SIGINT, cerrando servidor...');
    await closeBrowserSession();
    process.exit(0);
});
export default app;
