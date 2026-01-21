export interface NotificationOptions {
  tag?: string;
  silent?: boolean;
  urgency?: 'normal' | 'low' | 'critical';
  requireInteraction?: boolean;
  [key: string]: any;
}

export async function desktopNotify(
  title: string, 
  body: string, 
  actionUrl?: string, 
  options: NotificationOptions = {}
): Promise<{ success: boolean; id?: string; error?: string }> {
  if ((window as any)?.electronAPI?.isElectron) {
    try {
      const result = await (window as any).electronAPI.showNotification(title, body, actionUrl, options);
      return result;
    } catch (error) {
      console.error('Desktop notification failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  } else {
    console.log('Desktop notifications not available (not in Electron)');
    return { success: false, error: 'Not in Electron environment' };
  }
}

// Legacy compatibility
export function desktopNotifyLegacy(title: string, body: string): void {
  if ((window as any)?.electronAPI?.isElectron) {
    (window as any).electronAPI.notify(title, body);
  }
}
