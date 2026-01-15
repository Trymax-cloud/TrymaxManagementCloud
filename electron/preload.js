const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title, body) => {
    ipcRenderer.invoke('show-notification', { title, body });
  },
  minimize: () => {
    ipcRenderer.invoke('minimize-window');
  },
  maximize: () => {
    ipcRenderer.invoke('maximize-window');
  },
  close: () => {
    ipcRenderer.invoke('close-window');
  },
  isElectron: true
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
