export const authMiddleware = (req, res, next) => {
    const authReq = req;
    console.log('Ejecutando MOCK authMiddleware para estudiantes');
    authReq.user = { id: 'estudiante123', role: 'student' };
    authReq.isAuthenticated = () => true;
    return next();
};
export const instructorAuthMiddleware = (req, res, next) => {
    const authReq = req;
    console.log('Ejecutando MOCK instructorAuthMiddleware');
    authReq.user = { id: 'instructor789', role: 'instructor' };
    authReq.isAuthenticated = () => true;
    return next();
};
