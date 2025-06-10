const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build...');

const distPath = path.join(__dirname, '..', 'dist');
const appJsPath = path.join(distPath, 'app.js');

if (!fs.existsSync(distPath)) {
    console.error('❌ dist/ folder not found');
    process.exit(1);
}

if (!fs.existsSync(appJsPath)) {
    console.error('❌ dist/app.js not found');
    process.exit(1);
}

const stats = fs.statSync(appJsPath);
console.log(`✅ dist/app.js found (${stats.size} bytes)`);

// Check for coordinate-based-downloader
const coordinateFile = path.join(distPath, 'scripts', 'coordinate-based-downloader.js');
if (fs.existsSync(coordinateFile)) {
    console.log('✅ coordinate-based-downloader.js found');
} else {
    console.error('❌ coordinate-based-downloader.js not found');
    process.exit(1);
}

console.log('✅ Build verification passed');
