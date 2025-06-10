import express from 'express';
import { coordinateBasedDownloader, closeBrowserSession } from './src/scripts/coordinate-based-downloader';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors()); // Permitir requests desde Render

// 🔥 NUEVO: Función para encontrar puerto disponible
async function findAvailablePort(startPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = app.listen(startPort, () => {
            const port = (server.address() as any)?.port;
            server.close(() => {
                resolve(port);
            });
        });
        
        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                // Probar el siguiente puerto
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}

// 🔥 MODIFICADO: Usar puerto dinámico
const preferredPort = 3001;
let actualPort: number;

// Endpoint para procesar descargas
app.post('/process-download', async (req, res) => {
    const { submissionId, targetWorkTitle } = req.body;
    const searchCriteria = submissionId || targetWorkTitle;
    const searchType = submissionId ? 'Submission ID' : 'título';
    
    console.log(`[Trabajador Local] Procesando ${searchType}: "${searchCriteria}"`);
    
    try {
        const result = await coordinateBasedDownloader(targetWorkTitle, submissionId);
        
        if (result.success && result.filePath) {
            console.log(`[Trabajador Local] ✅ Descarga exitosa: ${result.filePath}`);
            
            // Verificar que el archivo existe
            if (fs.existsSync(result.filePath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${path.basename(result.filePath)}"`);
                
                // Enviar el archivo
                res.sendFile(path.resolve(result.filePath), (err) => {
                    if (err) {
                        console.error("[Trabajador Local] Error enviando archivo:", err);
                        if (!res.headersSent) {
                            res.status(500).json({ message: "Error enviando archivo" });
                        }
                    } else {
                        console.log(`[Trabajador Local] ✅ Archivo enviado: ${path.basename(result.filePath)}`);
                        // Opcional: eliminar el archivo después de enviarlo
                        // fs.unlinkSync(result.filePath);
                    }
                });
            } else {
                console.error(`[Trabajador Local] ❌ Archivo no encontrado: ${result.filePath}`);
                res.status(404).json({ message: "Archivo descargado no encontrado" });
            }
        } else {
            console.error(`[Trabajador Local] ❌ Falló la descarga: ${result.message}`);
            res.status(400).json({ message: result.message });
        }
    } catch (error: any) {
        console.error(`[Trabajador Local] ❌ Error: ${error.message}`);
        res.status(500).json({ message: `Error del trabajador: ${error.message}` });
    }
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        worker: 'local',
        port: actualPort
    });
});

// 🔥 NUEVO: Endpoint para verificar estado del navegador
app.get('/browser-status', (req, res) => {
    res.json({ 
        browserActive: true, // Simplificado por ahora
        timestamp: new Date().toISOString()
    });
});

// 🔥 NUEVO: Función principal de inicio
async function startServer() {
    try {
        // Buscar puerto disponible
        actualPort = await findAvailablePort(preferredPort);
        
        console.log(`[Trabajador Local] 🔍 Puerto ${preferredPort} ${actualPort === preferredPort ? 'disponible' : 'ocupado, usando ' + actualPort}`);
        
        // Iniciar servidor
        app.listen(actualPort, () => {
            console.log(`[Trabajador Local] 🚀 Servidor escuchando en http://localhost:${actualPort}`);
            console.log(`[Trabajador Local] 🌐 Listo para recibir solicitudes de descarga`);
            console.log(`[Trabajador Local] 💡 Usa ngrok para exponer este servidor al internet:`);
            console.log(`[Trabajador Local] 📝 Comando: ngrok http ${actualPort}`);
            console.log('');
            console.log('🔧 INSTRUCCIONES PARA RENDER:');
            console.log('1. Ejecuta: ngrok http ' + actualPort);
            console.log('2. Copia la URL HTTPS que te proporciona ngrok (ej: https://abc123.ngrok.io)');
            console.log('3. En el dashboard de Render, agrega la variable de entorno:');
            console.log('   LOCAL_WORKER_URL=https://tu-url-de-ngrok.ngrok.io');
            console.log('4. ¡Tu aplicación web ya puede usar este trabajador local!');
            console.log('');
            console.log('⚠️  IMPORTANTE: Mantén este trabajador ejecutándose mientras usas la aplicación web');
        });
        
    } catch (error: any) {
        console.error('[Trabajador Local] ❌ Error iniciando servidor:', error.message);
        process.exit(1);
    }
}

// Cerrar navegador al terminar
process.on('SIGINT', async () => {
    console.log('[Trabajador Local] 🔄 Cerrando sesión del navegador...');
    await closeBrowserSession();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Trabajador Local] 🔄 Cerrando sesión del navegador...');
    await closeBrowserSession();
    process.exit(0);
});

// 🔥 NUEVO: Manejo de errores no capturadas
process.on('uncaughtException', async (error) => {
    console.error('[Trabajador Local] ❌ Error no capturado:', error);
    await closeBrowserSession();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('[Trabajador Local] ❌ Promesa rechazada no manejada:', reason);
    await closeBrowserSession();
    process.exit(1);
});

// Iniciar el servidor
startServer();
