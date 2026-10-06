const fs = require('fs');
const path = require('path');

const srcFiles = ['index.html', 'style.css', 'app.js', 'rules.json', 'manifest.json', 'icon.svg', 'sw.js'];
const outDir = path.join(__dirname, 'www');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const file of srcFiles) {
  const src = path.join(__dirname, file);
  const dest = path.join(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file} -> www/${file}`);
  }
}

console.log('Build complete! Assets ready in www/');
