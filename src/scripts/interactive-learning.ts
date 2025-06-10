import { TurnitinScraperService } from '../services/turnitin-scraper.service';
import { InteractiveTrackerService } from '../services/interactive-tracker.service';
import * as readline from 'readline';

async function interactiveLearningSession() {
    const scraper = new TurnitinScraperService(true);
    const tracker = new InteractiveTrackerService();
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };

    try {
        console.log('🎓 MODO APRENDIZAJE INTERACTIVO - Scraper de Turnitin');
        console.log('====================================================');
        console.log('En este modo, TÚ harás clic manualmente en el navegador');
        console.log('y el sistema grabará cada paso para luego automatizarlo.');
        console.log('');

        await scraper.initializeBrowser();
        const page = await scraper.createNewPage();

        tracker.startTrackingSession(
            'Descargar reporte de IA desde trabajo de estudiante',
            'https://www.turnitin.com/assignment/type/paper/inbox/170792714?lang=en_us'
        );

        console.log('\n🚀 PASO 1: Navegación inicial');
        await page.goto('https://www.turnitin.com/assignment/type/paper/inbox/170792714?lang=en_us', { waitUntil: 'networkidle2' });
        await tracker.recordAction(page, 'navigate', 'Navegación a bandeja de entrada de Turnitin');

        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            console.log('\n🔐 Se detectó página de login');
            await askQuestion('Por favor, inicia sesión manualmente en el navegador y presiona ENTER cuando estés en la página de trabajos...');
            await tracker.recordAction(page, 'wait', 'Esperando login manual del usuario');
        }

        console.log('\n📋 PASO 2: Selección de trabajo de estudiante');
        console.log('Instrucciones:');
        console.log('1. En el navegador, busca un trabajo de estudiante en la tabla');
        console.log('2. HAZ CLIC EN EL TÍTULO del trabajo (NO en el enlace del estudiante)');
        console.log('3. Esto debería abrirte la vista del trabajo (ev.turnitin.com/app/carta/...)');
        console.log('');

        const workTitle = await askQuestion('¿Cuál es el título del trabajo en el que hiciste clic? ');
        await askQuestion('Presiona ENTER después de hacer clic en el título del trabajo...');
        
        await tracker.recordAction(page, 'click', `Usuario hizo clic en trabajo: "${workTitle}"`, {
            text: workTitle
        });

        await page.waitForTimeout(5000);
        
        console.log('\n🤖 PASO 3: Localización del reporte de IA');
        console.log('Instrucciones:');
        console.log('1. Ahora deberías estar en la página del trabajo (carta)');
        console.log('2. Busca un botón, enlace o porcentaje relacionado con IA');
        console.log('3. Puede decir "AI", mostrar un porcentaje como "54%" o "AI Writing Report"');
        console.log('4. HAZ CLIC en ese elemento');
        console.log('');

        const aiElementText = await askQuestion('¿Qué texto tiene el elemento de IA en el que hiciste clic? ');
        await askQuestion('Presiona ENTER después de hacer clic en el elemento de IA...');

        await tracker.recordAction(page, 'click', `Usuario hizo clic en elemento de IA: "${aiElementText}"`, {
            text: aiElementText
        });

        await page.waitForTimeout(8000);

        console.log('\n📥 PASO 4: Descarga del reporte');
        console.log('Instrucciones:');
        console.log('1. Ahora deberías estar en la página del reporte de IA');
        console.log('2. Busca un botón de "Download", "Descargar" o similar');
        console.log('3. HAZ CLIC en ese botón para descargar el PDF');
        console.log('');

        const downloadResult = await askQuestion('¿Se descargó exitosamente el PDF? (s/n): ');
        
        if (downloadResult.toLowerCase() === 's') {
            const downloadButtonText = await askQuestion('¿Qué texto tenía el botón de descarga? ');
            await tracker.recordAction(page, 'download', `Usuario descargó usando botón: "${downloadButtonText}"`, {
                text: downloadButtonText
            });

            await tracker.finishSession('success', `Descarga exitosa del reporte de IA para trabajo: ${workTitle}`);
            
            console.log('\n🎉 ¡EXCELENTE! Sesión de aprendizaje completada exitosamente');
            console.log('El sistema ha grabado todos los pasos y puede ahora automatizar este proceso.');
            
        } else {
            await tracker.finishSession('failed', 'No se pudo completar la descarga');
            console.log('\n⚠️ Sesión marcada como fallida. Puedes intentar de nuevo.');
        }

    } catch (error) {
        console.error('❌ Error durante la sesión de aprendizaje:', error);
        if (tracker) {
            await tracker.finishSession('failed', `Error: ${error}`);
        }
    } finally {
        rl.close();
        await scraper.closeBrowser();
    }
}

if (require.main === module) {
    interactiveLearningSession()
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}
