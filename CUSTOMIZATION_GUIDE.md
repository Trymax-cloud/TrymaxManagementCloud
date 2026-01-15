# 🎨 App Customization Guide

## 📝 How to Change App Name and Branding

### 1. Update App Name and Metadata

#### In `package.json`:
```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "description": "Your App Description - Replace with your app's purpose",
  "author": "Your Name/Company"
}
```

#### In `electron-builder.json`:
```json
{
  "appId": "com.yourcompany.yourapp",
  "productName": "Your App Name",
  "copyright": "Copyright © 2026 Your Company",
  "publisherName": "Your Company",
  "shortcutName": "Your App Name"
}
```

### 2. 🖼️ Logo Replacement Guide

#### Required Logo Files:
You need to replace these files in the `public/` folder:

1. **Windows Icon** (`public/icon.ico`)
   - Format: ICO file
   - Size: 256x256 pixels (recommended)
   - Used for Windows executable and installer

2. **macOS Icon** (`public/icon.icns`)
   - Format: ICNS file
   - Sizes: 16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024
   - Used for macOS app bundle

3. **Linux Icon** (`public/icon.png`)
   - Format: PNG file
   - Size: 512x512 pixels (recommended)
   - Used for Linux AppImage and DEB packages

4. **Web Favicon** (`public/favicon.ico`)
   - Format: ICO file
   - Size: 32x32 or 64x64 pixels
   - Used for web version and Electron window

#### How to Create Icons:

**Option 1: Online Tools**
- Use [favicon.io](https://favicon.io/) to generate all formats from PNG
- Use [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)

**Option 2: Command Line**
```bash
# Install electron-icon-builder
npm install -g electron-icon-builder

# Create icons from PNG (minimum 1024x1024)
electron-icon-builder --input=your-logo.png --output=public/
```

**Option 3: Manual Creation**
- Create a high-resolution PNG (1024x1024)
- Convert to required formats using:
  - Windows: Use GIMP or online ICO converter
  - macOS: Use IconUtil (macOS) or online ICNS converter
  - Linux: Resize PNG to 512x512

### 3. 🚫 Removed File/Options Navbar (With Keyboard Shortcuts)

The File/Options navbar has been removed from the Electron app for a clean interface. However, keyboard shortcuts are still available:

#### Available Keyboard Shortcuts:
- **F11** - Toggle Full Screen
- **Ctrl+R** (or **Cmd+R** on Mac) - Reload the app
- **Ctrl+Shift+R** (or **Cmd+Shift+R** on Mac) - Hard Reload (clears cache)
- **F12** - Toggle Developer Tools (development mode only)

These shortcuts work globally even without the visible menu bar.

### 4. 🔄 App Title and Window Title

To change the window title, update in `electron/main.cjs`:
```javascript
mainWindow = new BrowserWindow({
  title: "Your App Name", // This sets the window title
  // ... other options
});
```

### 5. 📱 App Branding in React Components

#### Update App Title in HTML:
In `public/index.html`:
```html
<title>Your App Name</title>
```

#### Update Logo in React Components:
Replace logo references in your React components:
- Look for `<img>` tags with logo paths
- Update imports for logo files
- Check `src/components/layout/` for branding

### 6. 🎯 Complete Customization Checklist

- [ ] Update `package.json` name and description
- [ ] Update `electron-builder.json` product name and company
- [ ] Replace `public/icon.ico` (Windows)
- [ ] Replace `public/icon.icns` (macOS)
- [ ] Replace `public/icon.png` (Linux)
- [ ] Replace `public/favicon.ico` (Web)
- [ ] Update `public/index.html` title
- [ ] Update React component logos
- [ ] Update window title in `electron/main.cjs`
- [ ] Test build with `npm run electron:build`

### 7. 🧪 Testing Your Changes

After making changes:
```bash
# Test development version
npm run electron:dev

# Build and test production version
npm run electron:build
# Then run the built app from release/ folder
```

### 8. 📦 Final Build Output

Your customized app will be built as:
- Windows: `release/Your App Name Setup 1.0.0.exe`
- Portable: `release/Your App Name 1.0.0.exe`
- With your custom logo and name! 🎉

---

## 🎨 Design Tips

1. **Logo Design**: Keep it simple and recognizable at small sizes
2. **Color Scheme**: Use consistent colors across all platforms
3. **Icon Transparency**: Use transparent background for better integration
4. **Test on Different Platforms**: Ensure your logo looks good on Windows, macOS, and Linux

---

## 🔧 Troubleshooting

**Icons not showing?**
- Verify file names match exactly
- Check file formats are correct
- Ensure icons are in the `public/` folder

**Build errors?**
- Check electron-builder.json syntax
- Verify all required icon files exist
- Run `npm install` to update dependencies

---

## 📞 Need Help?

If you need help with logo creation or have questions:
- Check the [Electron documentation](https://www.electronjs.org/docs)
- Use online icon generators for quick results
- Test frequently to catch issues early
