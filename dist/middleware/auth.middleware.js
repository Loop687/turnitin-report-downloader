"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instructorAuthMiddleware = exports.authMiddleware = void 0;
const authMiddleware = (req, res, next) => {
    const authReq = req;
    console.log('Ejecutando MOCK authMiddleware para estudiantes');
    authReq.user = { id: 'estudiante123', role: 'student' };
    authReq.isAuthenticated = () => true;
    return next();
};
exports.authMiddleware = authMiddleware;
const instructorAuthMiddleware = (req, res, next) => {
    const authReq = req;
    console.log('Ejecutando MOCK instructorAuthMiddleware');
    authReq.user = { id: 'instructor789', role: 'instructor' };
    authReq.isAuthenticated = () => true;
    return next();
};
exports.instructorAuthMiddleware = instructorAuthMiddleware;
