"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instructorAuthMiddleware = exports.authMiddleware = void 0;
const authMiddleware = (req, res, next) => {
    const authReq = req;
    console.log('Ejecutando MOCK authMiddleware para estudiantes');
    authReq.user = { id: 'estudiante123', role: 'student' }; // <-- ANOTA ESTE ID. Por ejemplo, 'estudiante123'
    authReq.isAuthenticated = () => true;
    return next();
    // Lógica original (restaurar después de las pruebas):
    // if (authReq.isAuthenticated && authReq.isAuthenticated()) { // Usar authReq aquí
    //     return next();
    // }
    // res.status(401).json({ message: 'Acceso no autorizado. Por favor, inicia sesión.' });
};
exports.authMiddleware = authMiddleware;
const instructorAuthMiddleware = (req, res, next) => {
    const authReq = req; // Cast a AuthenticatedRequest
    // TEMPORAL: Simular autenticación para probar rutas de instructores
    console.log('Ejecutando MOCK instructorAuthMiddleware');
    authReq.user = { id: 'instructor789', role: 'instructor' }; // Simular usuario instructor
    authReq.isAuthenticated = () => true; // Asegurarse de que isAuthenticated esté definido
    return next();
    // Lógica original (restaurar después de las pruebas):
    // if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user && authReq.user.role === 'instructor') { // Usar authReq aquí
    //     return next();
    // }
    // res.status(403).json({ message: 'Prohibido. Se requiere acceso de instructor.' });
};
exports.instructorAuthMiddleware = instructorAuthMiddleware;
