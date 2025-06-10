import { Page, ElementHandle } from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface TrackedAction {
    step: number;
    action: 'click' | 'navigate' | 'wait' | 'download';
    elementInfo: {
        selector?: string;
        text?: string;
        xpath?: string;
        coordinates?: { x: number, y: number };
    };
    url: string;
    screenshot?: string;
    timestamp: Date;
    description: string;
}

interface LearningSession {
    sessionId: string;
    startUrl: string;
    targetGoal: string;
    actions: TrackedAction[];
    finalResult: 'success' | 'failed';
    notes: string;
}

export class InteractiveTrackerService {
    private currentSession: LearningSession | null = null;
    private trackingPath: string;
    private screenshotsPath: string;

    constructor() {
        this.trackingPath = path.join(__dirname, '..', '..', 'tracking-data');
        this.screenshotsPath = path.join(this.trackingPath, 'screenshots');
        
        // Crear directorios si no existen
        if (!fs.existsSync(this.trackingPath)) {
            fs.mkdirSync(this.trackingPath, { recursive: true });
        }
        if (!fs.existsSync(this.screenshotsPath)) {
            fs.mkdirSync(this.screenshotsPath, { recursive: true });
        }
    }

    startTrackingSession(goal: string, startUrl: string): void {
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

    async recordAction(
        page: Page, 
        action: TrackedAction['action'], 
        description: string, 
        elementInfo?: TrackedAction['elementInfo']
    ): Promise<void> {
        if (!this.currentSession) {
            console.log('⚠️ No hay sesión de rastreo activa');
            return;
        }

        const stepNumber = this.currentSession.actions.length + 1;
        const currentUrl = page.url();
        
        // Tomar screenshot del paso actual
        const screenshotName = `step-${stepNumber.toString().padStart(2, '0')}-${action}.png`;
        const screenshotPath = path.join(this.screenshotsPath, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        const trackedAction: TrackedAction = {
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

    async finishSession(result: 'success' | 'failed', notes: string = ''): Promise<void> {
        if (!this.currentSession) {
            console.log('⚠️ No hay sesión activa para finalizar');
            return;
        }

        this.currentSession.finalResult = result;
        this.currentSession.notes = notes;

        // Guardar la sesión
        const sessionFile = path.join(this.trackingPath, `${this.currentSession.sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(this.currentSession, null, 2));

        console.log(`\n✅ Sesión de rastreo finalizada`);
        console.log(`📊 Resultado: ${result}`);
        console.log(`📝 Pasos grabados: ${this.currentSession.actions.length}`);
        console.log(`💾 Guardado en: ${sessionFile}`);
        
        this.currentSession = null;
    }

    loadSession(sessionId: string): LearningSession | null {
        try {
            const sessionFile = path.join(this.trackingPath, `${sessionId}.json`);
            if (fs.existsSync(sessionFile)) {
                const content = fs.readFileSync(sessionFile, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.log(`Error cargando sesión ${sessionId}:`, error);
        }
        return null;
    }

    listSessions(): string[] {
        try {
            const files = fs.readdirSync(this.trackingPath);
            return files.filter(f => f.endsWith('.json') && f.startsWith('session-'));
        } catch (error) {
            return [];
        }
    }
}
