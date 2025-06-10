async function replayLearnedSession() {
    console.log('🔄 Iniciando replay de sesión aprendida...');
    console.log('⚠️ Función de replay temporalmente deshabilitada');
}
async function replayAction(page, action) {
    console.log(`🔄 Reproduciendo: ${action.type} en ${action.selector}`);
    try {
        switch (action.type) {
            case 'click':
                if (action.selector) {
                    const elements = await page.$x(action.selector);
                    if (elements.length > 0) {
                        console.log(`   ✅ Elemento encontrado: ${action.selector}`);
                        if (action.coordinates) {
                            await page.mouse.click(action.coordinates.x, action.coordinates.y);
                            console.log(`   🖱️ Clic en coordenadas: (${action.coordinates.x}, ${action.coordinates.y})`);
                        }
                        else {
                            await page.evaluate((element) => {
                                if (element && 'click' in element && typeof element.click === 'function') {
                                    element.click();
                                }
                            }, elements[0]);
                            console.log(`   🖱️ Clic realizado con evaluate`);
                        }
                    }
                    else {
                        console.log(`   ❌ Elemento no encontrado: ${action.selector}`);
                    }
                }
                break;
            case 'type':
                if (action.selector && action.text) {
                    await page.type(action.selector, action.text);
                    console.log(`   ⌨️ Texto introducido: ${action.text}`);
                }
                break;
            case 'navigate':
                if (action.url) {
                    await page.goto(action.url, { waitUntil: 'networkidle2' });
                    console.log(`   🌐 Navegado a: ${action.url}`);
                }
                break;
            case 'wait':
                await page.waitForTimeout(action.time || 1000);
                console.log(`   ⏱️ Esperado: ${action.time || 1000}ms`);
                break;
            default:
                console.log(`   ⚠️ Tipo de acción no reconocida: ${action.type}`);
        }
    }
    catch (error) {
        console.error(`   💥 Error reproduciendo acción: ${error}`);
    }
}
if (require.main === module) {
    replayLearnedSession().catch(console.error);
}
export { replayLearnedSession, replayAction };
