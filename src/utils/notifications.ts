// Desktop notification utility that works in both browser and Electron
// Abstracts platform-specific notification APIs

interface DesktopNotificationOptions {
  title: string;
  message: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Shows a desktop notification using the appropriate platform API
 * Works in both browser and Electron environments
 */
export async function notifyDesktop(options: DesktopNotificationOptions): Promise<void> {
  try {
    // Check if we're in Electron environment
    if (window.electron?.notify) {
      // Electron environment - use the preload bridge
      await window.electron.notify(options);
      return;
    }

    // Browser environment - use Web Notification API
    if ('Notification' in window) {
      // Request permission if not already granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Desktop notification permission denied');
          return;
        }
      }

      // Check if permission is granted
      if (Notification.permission === 'granted') {
        const notification = new Notification(options.title, {
          body: options.message,
          icon: options.icon || '/favicon.ico',
          badge: options.badge,
          tag: options.tag,
          requireInteraction: options.requireInteraction,
          silent: false,
        });

        // Auto-close notification after 5 seconds if not requiring interaction
        if (!options.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 5000);
        }

        // Handle click events
        notification.onclick = () => {
          // Focus the window when notification is clicked
          window.focus();
          notification.close();
        };

        return;
      }
    }

    console.log('Desktop notifications not supported in this environment');
  } catch (error) {
    console.error('Error showing desktop notification:', error);
  }
}

/**
 * Check if desktop notifications are supported and permission is granted
 */
export function isDesktopNotificationSupported(): boolean {
  // Check Electron environment
  if (window.electron?.notify) {
    return true;
  }

  // Check browser environment
  if ('Notification' in window) {
    return Notification.permission === 'granted';
  }

  return false;
}

/**
 * Request permission for desktop notifications (browser only)
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  // In Electron, permissions are handled by the main process
  if (window.electron?.notify) {
    return true;
  }

  // In browser, request permission using Web Notification API
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Type declaration for window.electron bridge
declare global {
  interface Window {
    electron?: {
      notify: (options: DesktopNotificationOptions) => Promise<void>;
    };
  }
}
