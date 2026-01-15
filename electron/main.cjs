const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Content Security Policy for production
      additionalArguments: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    },
    icon: path.join(__dirname, '../public/favicon.ico'), // Use existing favicon
    show: false, // Don't show until ready-to-show
    titleBarStyle: 'default'
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  let startUrl;
  
  if (isDev) {
    startUrl = 'http://localhost:5173';
  } else {
    // For production, load directly from file path
    startUrl = path.join(__dirname, '../dist/index.html');
  }
  
  console.log('Starting Electron app with file:', startUrl);
  
  mainWindow.loadFile(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Electron window ready to show');
    mainWindow.show();
    
    // Set up application menu
    const isDev = process.env.NODE_ENV === 'development';
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              mainWindow.webContents.reload();
            }
          },
          {
            label: 'Toggle Full Screen',
            accelerator: 'F11',
            click: () => {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
          // Only show DevTools in development
          ...(isDev ? [{
            label: 'Toggle Developer Tools',
            accelerator: 'F12',
            click: () => {
              mainWindow.webContents.toggleDevTools();
            }
          }] : [])
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    console.log('Electron window closed');
    mainWindow = null;
  });

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    console.error('Failed to load:', errorCode);
  });

  // Handle console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`Renderer [${level}]:`, message);
  });
}

// App ready event
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('show-notification', (event, { title, body }) => {
  new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, '../public/icon.png') // Optional: add icon
  }).show();
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, url) => {
    navigationEvent.preventDefault();
    require('electron').shell.openExternal(url);
  });
});
