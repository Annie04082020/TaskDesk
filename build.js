const fs = require('fs');
const path = require('path');

const srcFiles = ['index.html', 'style.css', 'app.js', 'rules.json', 'manifest.json', 'icon.svg', 'sw.js'];
const outDir = path.join(__dirname, 'www');
const vendorDir = path.join(outDir, 'vendor');

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

const localNotificationsPlugin = path.join(__dirname, 'node_modules', '@capacitor', 'local-notifications', 'dist', 'plugin.js');
if (fs.existsSync(localNotificationsPlugin)) {
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.copyFileSync(localNotificationsPlugin, path.join(vendorDir, 'capacitor-local-notifications.js'));
  console.log('Copied: Capacitor Local Notifications plugin -> www/vendor/');
}

console.log('Build complete! Assets ready in www/');
