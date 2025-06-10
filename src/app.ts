console.log("<<<<< EXECUTING COMPILED dist/app.js >>>>>"); // Log de diagnóstico
console.log(`Node.js version: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Current working directory: ${process.cwd()}`);
console.log("<<<<< END OF DIAGNOSTIC LOGS >>>>>");

import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cors, { CorsOptions } from 'cors';
import axios from 'axios'; // <--- AÑADIR AXIOS

const app = express();
const PORT = parseInt(process.env.PORT || '3003', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// URL de tu trabajador local (expuesto por ngrok). Configúralo en las variables de entorno de Render.
const LOCAL_WORKER_URL = process.env.LOCAL_WORKER_URL;

// 🔥 NUEVO: Configuración para producción
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 🔥 NUEVO: CORS configurado para producción
const corsOptions: CorsOptions = {
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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Nueva ruta para la solicitud de descarga del estudiante
app.post('/api/student/request-ai-download', async (req, res) => {
    const { targetWorkTitle, submissionId } = req.body;
    const searchCriteria = submissionId || targetWorkTitle;
    const searchType = submissionId ? 'Submission ID' : 'Título';

    console.log(`[API] Solicitud de descarga recibida usando ${searchType}: ${searchCriteria}`);

    if (!LOCAL_WORKER_URL) {
        console.error('❌ LOCAL_WORKER_URL no está configurado en las variables de entorno.');
        return res.status(500).json({ message: 'Error de configuración del servidor: El trabajador local no está configurado.' });
    }

    if (!searchCriteria) {
        return res.status(400).json({ message: 'Se requiere Submission ID o título del trabajo.' });
    }

    try {
        console.log(`📡 Enviando solicitud al trabajador local: ${LOCAL_WORKER_URL}/process-download`);
        const workerResponse = await axios.post(`${LOCAL_WORKER_URL}/process-download`, 
            { 
                submissionId: submissionId, 
                targetWorkTitle: targetWorkTitle 
            },
            {
                responseType: 'arraybuffer', // Para recibir el archivo PDF
                timeout: 300000 // Timeout de 5 minutos para la operación del trabajador
            }
        );

        if (workerResponse.status === 200 && workerResponse.headers['content-type'] === 'application/pdf') {
            console.log('✅ PDF recibido del trabajador local.');
            res.setHeader('Content-Type', 'application/pdf');
            
            let filename = `report_${submissionId || targetWorkTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const contentDisposition = workerResponse.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+)"?/i);
                if (match && match[1]) filename = match[1];
            }
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(workerResponse.data));
        } else {
            // Si el trabajador devuelve un JSON con error
            const errorData = JSON.parse(Buffer.from(workerResponse.data).toString('utf8'));
            console.error('❌ Error desde el trabajador local:', errorData.message || workerResponse.status);
            res.status(workerResponse.status || 500).json({ message: errorData.message || 'Error al procesar la solicitud en el trabajador local.' });
        }

    } catch (error: any) {
        console.error('[API] Error contactando al trabajador local o procesando su respuesta:', error.message);
        if (error.response) {
            // El servidor del trabajador local respondió con un código de error
            try {
                const errorResponseData = JSON.parse(Buffer.from(error.response.data).toString('utf8'));
                 res.status(error.response.status || 500).json({ message: `Error del trabajador local: ${errorResponseData.message || error.message}` });
            } catch (parseError) {
                 res.status(error.response.status || 500).json({ message: `Error del trabajador local: ${error.message}` });
            }
        } else if (error.request) {
            // La solicitud se hizo pero no se recibió respuesta (ej. ngrok caído, trabajador no responde)
            res.status(503).json({ message: 'El servicio del trabajador local no está disponible o no respondió a tiempo.' });
        } else {
            // Algo más causó el error
            res.status(500).json({ message: `Error interno del servidor: ${error.message}` });
        }
    }
});

// 🔥 ACTUALIZADO: Endpoint para cerrar la sesión del navegador
app.post('/api/admin/close-browser', async (req, res) => {
    try {
        console.log('[API] Solicitud de cierre de sesión del navegador recibida.');
        await closeBrowserSession();
        res.json({ success: true, message: 'Sesión del navegador cerrada exitosamente.' });
    } catch (error: any) {
        console.error('[API] Error cerrando sesión del navegador:', error);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});

// Ruta principal para servir index.html
app.get('/', (_req, res) => {
    if (IS_PRODUCTION) {
        // En producción, servir directamente index.html
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        // En desarrollo, servir index.html con información adicional
        const indexPath = path.join(__dirname, '../public/index.html');
        let htmlContent = fs.readFileSync(indexPath, 'utf8');
        
        // Inyectar información sobre el entorno de desarrollo
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

// 🔥 NUEVO: Endpoint de salud para Render
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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    // await closeBrowserSession(); // Ya no se necesita aquí
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Recibida señal SIGINT, cerrando servidor...');
    // await closeBrowserSession(); // Ya no se necesita aquí
    process.exit(0);
});

export default app;