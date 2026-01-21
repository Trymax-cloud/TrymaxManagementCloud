const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Enhanced Notification System
  showNotification: async (title, body, actionUrl, options = {}) => {
    return await ipcRenderer.invoke('show-notification', { title, body, actionUrl, options });
  },
  clearNotification: async (notificationId) => {
    return await ipcRenderer.invoke('clear-notification', { notificationId });
  },
  clearAllNotifications: async () => {
    return await ipcRenderer.invoke('clear-all-notifications');
  },
  
  // Legacy compatibility
  notify: (title, body) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  },
  
  // Window controls
  minimize: () => {
    ipcRenderer.invoke('minimize-window');
  },
  maximize: () => {
    ipcRenderer.invoke('maximize-window');
  },
  close: () => {
    ipcRenderer.invoke('close-window');
  },
  
  // App identification
  isElectron: true,
  
  // Navigation handler for notification clicks
  onNavigate: (callback) => {
    ipcRenderer.on('navigate-to', (event, url) => {
      callback(url);
    });
  }
});

// Handle window controls
window.addEventListener('DOMContentLoaded', () => {
  // Add window control buttons if needed (optional)
  const minimizeBtn = document.getElementById('window-minimize');
  const maximizeBtn = document.getElementById('window-maximize');
  const closeBtn = document.getElementById('window-close');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      window.electronAPI.minimize();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      window.electronAPI.maximize();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.close();
    });
  }
});
