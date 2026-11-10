// Rebuilds assets.js from assets/ah-icon.png. Run after replacing the icon file: node make-assets.js
const fs = require('fs');
const path = require('path');
const b64 = fs.readFileSync(path.join(__dirname, 'assets', 'ah-icon.png')).toString('base64');
fs.writeFileSync(
  path.join(__dirname, 'assets.js'),
  '/* The real AH icon (assets/ah-icon.png) as a data URI, so the watermark works when the page is opened straight from a folder. Regenerate with: node make-assets.js */\n' +
    'window.AH_ICON_DATA_URI = "data:image/png;base64,' + b64 + '";\n'
);
