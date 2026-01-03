// Notification permission manager
// Handles requesting and managing notification permissions

import { useState, useEffect } from 'react';
import { isDesktopNotificationSupported, requestDesktopNotificationPermission } from "./notifications";

class NotificationPermissionManager {
  private static instance: NotificationPermissionManager;
  private permissionRequested = false;
  private permissionPromise: Promise<boolean> | null = null;

  private constructor() {}

  static getInstance(): NotificationPermissionManager {
    if (!NotificationPermissionManager.instance) {
      NotificationPermissionManager.instance = new NotificationPermissionManager();
    }
    return NotificationPermissionManager.instance;
  }

  /**
   * Request notification permission proactively
   * Call this early in the app lifecycle (e.g., after login)
   */
  async requestPermission(): Promise<boolean> {
    if (this.permissionPromise) {
      return this.permissionPromise;
    }

    this.permissionPromise = this.doRequestPermission();
    return this.permissionPromise;
  }

  private async doRequestPermission(): Promise<boolean> {
    try {
      // Check if already supported and granted
      if (isDesktopNotificationSupported()) {
        console.log('Notification permission already granted');
        return true;
      }

      // Request permission
      console.log('Requesting notification permission...');
      const granted = await requestDesktopNotificationPermission();
      
      if (granted) {
        console.log('Notification permission granted');
      } else {
        console.log('Notification permission denied');
      }

      this.permissionRequested = true;
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.permissionRequested = true;
      return false;
    }
  }

  /**
   * Check if permission has been requested
   */
  hasRequestedPermission(): boolean {
    return this.permissionRequested;
  }

  /**
   * Check if notifications are supported and permission is granted
   */
  isSupported(): boolean {
    return isDesktopNotificationSupported();
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }
}

export const notificationPermissionManager = NotificationPermissionManager.getInstance();

// React hook for notification permissions
export function useNotificationPermissions() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check initial status
    if ('Notification' in window) {
      setIsSupported(true);
      setPermissionStatus(Notification.permission);
    } else {
      setIsSupported(false);
      setPermissionStatus('denied');
    }
  }, []);

  const requestPermission = async () => {
    const granted = await notificationPermissionManager.requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
    return granted;
  };

  return {
    permissionStatus,
    isSupported,
    requestPermission,
    canShowNotifications: isSupported && permissionStatus === 'granted',
  };
}
