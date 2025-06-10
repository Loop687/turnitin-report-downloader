"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveTrackerService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class InteractiveTrackerService {
    constructor() {
        this.currentSession = null;
        this.trackingPath = path_1.default.join(__dirname, '..', '..', 'tracking-data');
        this.screenshotsPath = path_1.default.join(this.trackingPath, 'screenshots');
        if (!fs_1.default.existsSync(this.trackingPath)) {
            fs_1.default.mkdirSync(this.trackingPath, { recursive: true });
        }
        if (!fs_1.default.existsSync(this.screenshotsPath)) {
            fs_1.default.mkdirSync(this.screenshotsPath, { recursive: true });
        }
    }
    startTrackingSession(goal, startUrl) {
        this.currentSession = {
            sessionId: `session-${Date.now()}`,
            startUrl: startUrl,
            targetGoal: goal,
            actions: [],
            finalResult: 'failed',
            notes: ''
        };
        console.log('🎯 Iniciando sesión de rastreo...');
        console.log(`📋 Objetivo: ${goal}`);
        console.log(`🌐 URL inicial: ${startUrl}`);
        console.log(`📁 ID de sesión: ${this.currentSession.sessionId}`);
    }
    async recordAction(page, action, description, elementInfo) {
        if (!this.currentSession) {
            console.log('⚠️ No hay sesión de rastreo activa');
            return;
        }
        const stepNumber = this.currentSession.actions.length + 1;
        const currentUrl = page.url();
        const screenshotName = `step-${stepNumber.toString().padStart(2, '0')}-${action}.png`;
        const screenshotPath = path_1.default.join(this.screenshotsPath, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const trackedAction = {
            step: stepNumber,
            action: action,
            elementInfo: elementInfo || {},
            url: currentUrl,
            screenshot: screenshotName,
            timestamp: new Date(),
            description: description
        };
        this.currentSession.actions.push(trackedAction);
        console.log(`📸 Paso ${stepNumber}: ${action} - ${description}`);
        console.log(`   📍 URL: ${currentUrl}`);
        if (elementInfo?.text) {
            console.log(`   🎯 Elemento: "${elementInfo.text}"`);
        }
        console.log(`   📷 Screenshot: ${screenshotName}`);
    }
    async finishSession(result, notes = '') {
        if (!this.currentSession) {
            console.log('⚠️ No hay sesión activa para finalizar');
            return;
        }
        this.currentSession.finalResult = result;
        this.currentSession.notes = notes;
        const sessionFile = path_1.default.join(this.trackingPath, `${this.currentSession.sessionId}.json`);
        fs_1.default.writeFileSync(sessionFile, JSON.stringify(this.currentSession, null, 2));
        console.log(`\n✅ Sesión de rastreo finalizada`);
        console.log(`📊 Resultado: ${result}`);
        console.log(`📝 Pasos grabados: ${this.currentSession.actions.length}`);
        console.log(`💾 Guardado en: ${sessionFile}`);
        this.currentSession = null;
    }
    loadSession(sessionId) {
        try {
            const sessionFile = path_1.default.join(this.trackingPath, `${sessionId}.json`);
            if (fs_1.default.existsSync(sessionFile)) {
                const content = fs_1.default.readFileSync(sessionFile, 'utf8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            console.log(`Error cargando sesión ${sessionId}:`, error);
        }
        return null;
    }
    listSessions() {
        try {
            const files = fs_1.default.readdirSync(this.trackingPath);
            return files.filter(f => f.endsWith('.json') && f.startsWith('session-'));
        }
        catch (error) {
            return [];
        }
    }
}
exports.InteractiveTrackerService = InteractiveTrackerService;
