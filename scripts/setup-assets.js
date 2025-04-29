const fs = require('fs');
const path = require('path');

// Create directory structure if it doesn't exist
const fontawesomeDest = path.join(__dirname, '../public/vendor/fontawesome');
if (!fs.existsSync(fontawesomeDest)) {
    fs.mkdirSync(fontawesomeDest, { recursive: true });
}

// Copy the Font Awesome CSS files
const fontawesomeSrc = path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free');
if (fs.existsSync(fontawesomeSrc)) {
    // Copy CSS
    const cssSrc = path.join(fontawesomeSrc, 'css');
    const cssDest = path.join(fontawesomeDest, 'css');
    if (!fs.existsSync(cssDest)) {
        fs.mkdirSync(cssDest, { recursive: true });
    }
    
    // Copy the all.min.css file
    fs.copyFileSync(
        path.join(cssSrc, 'all.min.css'), 
        path.join(cssDest, 'all.min.css')
    );
    
    // Copy the webfonts folder
    const webfontsSrc = path.join(fontawesomeSrc, 'webfonts');
    const webfontsDest = path.join(fontawesomeDest, 'webfonts');
    if (!fs.existsSync(webfontsDest)) {
        fs.mkdirSync(webfontsDest, { recursive: true });
    }
    
    // Copy all files from webfonts directory
    const webfontsFiles = fs.readdirSync(webfontsSrc);
    webfontsFiles.forEach(file => {
        fs.copyFileSync(
            path.join(webfontsSrc, file),
            path.join(webfontsDest, file)
        );
    });
    
    console.log('Font Awesome files copied successfully!');
} else {
    console.error('Font Awesome source directory not found. Please run npm install first.');
} 