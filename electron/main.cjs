const { app, BrowserWindow, ipcMain, Notification, Menu, globalShortcut } = require('electron');
const path = require('path');

// Keep a global reference of the window object
let mainWindow;
const activeNotifications = new Map(); // Track active notifications to prevent duplicates

// Set AppUserModelID for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.trymaxfurnaces.trymaxmanagement');
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    title: "TrymaxManagement",
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready-to-show
    autoHideMenuBar: true,
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
    icon: path.join(__dirname, '../public/icon.ico'), // Use existing favicon
    titleBarStyle: 'default'
  });

  // Maximize window after creation
  mainWindow.maximize();

  // Enable developer tools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Disable DevTools explicitly in production (defense-in-depth)
  if (app.isPackaged) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // Add keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Production: Block all shortcuts except allowed ones
    if (app.isPackaged) {
      const isAllowed = 
        (input.key === 'F11') || // F11 - Toggle Maximize
        ((input.control || input.meta) && input.key === 'r'); // Ctrl+R or Ctrl+Shift+R
      
      if (!isAllowed) {
        event.preventDefault();
        return;
      }
    }

    // F12 - Toggle DevTools (development only)
    if (input.key === 'F12' && !app.isPackaged) {
      mainWindow.webContents.toggleDevTools();
      return;
    }
    
    // F11 - Toggle Maximize/Unmaximize
    if (input.key === 'F11') {
      event.preventDefault(); // Prevent default behavior
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return;
    }
    
    // Ctrl+R or Ctrl+Shift+R - Reload
    if ((input.control || input.meta) && input.key === 'r') {
      event.preventDefault(); // Prevent default browser behavior
      if (input.shift) {
        mainWindow.webContents.reloadIgnoringCache();
      } else {
        mainWindow.reload();
      }
      return;
    }
  });

  // Load the app
  const isDev = false; // Force production mode
  let startUrl;
  
  if (isDev) {
    startUrl = 'http://localhost:8080';
  } else {
    // For production, load directly from file path
    startUrl = path.join(__dirname, '../dist/index.html');
  }
  
  console.error('Starting Electron app with file:', startUrl);
  
  if (isDev) {
    mainWindow.loadURL(startUrl);
  } else {
    mainWindow.loadFile(startUrl);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Completely remove menu bar
    Menu.setApplicationMenu(null);
    
    // Register global shortcuts for functionality
    const isDev = process.env.NODE_ENV === 'development';
    
    // F11 - Toggle Maximize/Unmaximize
    globalShortcut.register('F11', () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
    });
    
    // Ctrl+R - Reload
    globalShortcut.register('CommandOrControl+R', () => {
      if (mainWindow) {
        mainWindow.webContents.reload();
      }
    });
    
    // Ctrl+Shift+R - Hard Reload (clear cache)
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      if (mainWindow) {
        mainWindow.webContents.reloadIgnoringCache();
      }
    });
    
    // F12 - DevTools (development only)
    if (!app.isPackaged) {
      globalShortcut.register('F12', () => {
        if (mainWindow) {
          mainWindow.webContents.toggleDevTools();
        }
      });
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    console.error('Failed to load:', errorCode);
  });

  // Handle console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message) => {
    // Only log errors in production
    if (level >= 2) { // 2 = warning, 3 = error
      console.error(`Renderer [${level}]:`, message);
    }
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
// Enhanced Desktop Notification System
ipcMain.handle('show-notification', (event, { title, body, actionUrl, options = {} }) => {
  try {
    // Generate unique notification ID to prevent duplicates
    const notificationId = options.tag || `${title}-${body}-${Date.now()}`;
    
    // Check if similar notification is already active
    if (activeNotifications.has(notificationId)) {
      return { success: false, reason: 'duplicate' };
    }

    // Create notification with enhanced options
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../public/icon.png'),
      tag: notificationId,
      silent: options.silent || false,
      urgency: options.urgency || 'normal',
      requireInteraction: options.requireInteraction || false,
      ...options
    });

    // Handle notification click
    notification.on('click', () => {
      // Focus and show the main window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
        
        // Navigate to action URL if provided
        if (actionUrl) {
          mainWindow.webContents.send('navigate-to', actionUrl);
        }
      }
      
      // Close the notification
      notification.close();
      activeNotifications.delete(notificationId);
    });

    // Handle notification close
    notification.on('close', () => {
      activeNotifications.delete(notificationId);
    });

    // Handle notification error
    notification.on('error', (error) => {
      console.error('🔔 Notification error:', error);
      activeNotifications.delete(notificationId);
    });

    // Show notification and track it
    notification.show();
    activeNotifications.set(notificationId, notification);
    
    return { success: true, id: notificationId };
    
  } catch (error) {
    console.error('🔔 Failed to show notification:', error);
    return { success: false, error: error.message };
  }
});

// Clear specific notification
ipcMain.handle('clear-notification', (event, { notificationId }) => {
  if (activeNotifications.has(notificationId)) {
    const notification = activeNotifications.get(notificationId);
    notification.close();
    activeNotifications.delete(notificationId);
    return { success: true };
  }
  return { success: false, reason: 'not_found' };
});

// Clear all notifications
ipcMain.handle('clear-all-notifications', () => {
  activeNotifications.forEach((notification) => {
    notification.close();
  });
  activeNotifications.clear();
  return { success: true, cleared: activeNotifications.size };
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
