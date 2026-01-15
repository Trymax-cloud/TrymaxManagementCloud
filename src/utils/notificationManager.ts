// Notification manager for handling desktop notifications safely
// Prevents app freezing and ensures notifications appear properly
// Now respects user notification settings

import { notifyDesktop, isDesktopNotificationSupported } from "@/utils/notifications";
import { notificationPermissionManager } from "@/utils/notificationPermission";

// Global settings cache - updated by SettingsContext
let globalNotificationSettings: any = null;

// Function to update global settings from SettingsContext
export function updateNotificationSettings(settings: any) {
  globalNotificationSettings = settings;
}

interface NotificationEvent {
  type: 'task-completed' | 'task-overdue' | 'new-assignment' | 'new-meeting';
  data: {
    id: string;
    title: string;
    priority?: string;
    assignee_id?: string;
    date?: string; // For meetings
  };
  timestamp: number;
}

class NotificationManager {
  private static instance: NotificationManager;
  private notificationQueue: NotificationEvent[] = [];
  private processedNotifications = new Set<string>();
  private isProcessing = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Check if notification type is enabled in user settings
   */
  private async checkNotificationSettings(assigneeId: string, notificationType: string): Promise<boolean> {
    try {
      // Use global settings cache first
      if (globalNotificationSettings) {
        const notificationKey = this.getNotificationKey(notificationType);
        const enabled = globalNotificationSettings.notifications?.[notificationKey];
        console.log(`🔔 Settings check for ${notificationType} (${notificationKey}):`, enabled);
        return enabled ?? true; // Default to enabled if not set
      }

      // Fallback to localStorage if global settings not available
      const settings = localStorage.getItem('ewpm_user_settings');
      if (!settings) return true; // Default to enabled if no settings

      const parsedSettings = JSON.parse(settings);
      const notificationKey = this.getNotificationKey(notificationType);
      
      return parsedSettings.notifications?.[notificationKey] ?? true; // Default to enabled
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Map notification types to settings keys
   */
  private getNotificationKey(notificationType: string): string {
    const typeMap: Record<string, string> = {
      'task-overdue': 'emergencyAlerts',
      'new-assignment': 'assignmentReminders',
      'emergency': 'emergencyAlerts',
      'payment_reminder': 'paymentReminders',
      'payment_due': 'paymentReminders',
      'payment_overdue': 'paymentReminders',
      'daily_summary': 'dailySummary',
    };
    
    return typeMap[notificationType] || 'assignmentReminders';
  }

  /**
   * Add a notification event to the queue
   */
  addNotificationEvent(event: NotificationEvent) {
    const notificationKey = `${event.type}-${event.data.id}`;
    
    // Skip if already processed recently
    if (this.processedNotifications.has(notificationKey)) {
      return;
    }

    // Check if notifications are supported
    if (!isDesktopNotificationSupported()) {
      return;
    }

    // Request permission if not already requested
    if (!notificationPermissionManager.hasRequestedPermission()) {
      notificationPermissionManager.requestPermission().then(granted => {
        if (granted) {
          this.addToQueue(event);
        }
      });
    } else {
      // Permission already handled, add to queue
      this.addToQueue(event);
    }
  }

  private addToQueue(event: NotificationEvent) {
    // Add to queue
    this.notificationQueue.push({
      ...event,
      timestamp: Date.now()
    });

    // Start processing if not already running
    this.startProcessing();
  }

  /**
   * Start processing the notification queue
   */
  private startProcessing() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processQueue();
  }

  /**
   * Process the notification queue with delays to prevent freezing
   */
  private async processQueue() {
    while (this.notificationQueue.length > 0) {
      const event = this.notificationQueue.shift();
      if (!event) continue;

      try {
        // Add delay to prevent UI freezing
        await this.delay(500 + Math.random() * 500); // 500-1000ms random delay
        
        await this.processNotification(event);
        
        // Mark as processed
        const notificationKey = `${event.type}-${event.data.id}`;
        this.processedNotifications.add(notificationKey);
        
        // Clean up old processed notifications (keep for 5 minutes)
        this.cleanupOldNotifications();
        
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single notification event
   */
  private async processNotification(event: NotificationEvent) {
    switch (event.type) {
      case 'task-completed':
        await this.handleTaskCompleted(event.data);
        break;
      case 'task-overdue':
        await this.handleTaskOverdue(event.data);
        break;
      case 'new-assignment':
        await this.handleNewAssignment(event.data);
        break;
      case 'new-meeting':
        await this.handleNewMeeting(event.data);
        break;
    }
  }

  /**
   * Handle task completion notification
   */
  private async handleTaskCompleted(data: NotificationEvent['data']) {
    await notifyDesktop({
      title: "Task Completed! 🎉",
      message: `"${data.title}" has been marked as completed`,
      tag: `task-completed-${data.id}`,
      requireInteraction: false,
    });
  }

  /**
   * Handle overdue task notification
   */
  private async handleTaskOverdue(data: NotificationEvent['data']) {
    // Check if user has emergency alerts enabled
    const isEnabled = await this.checkNotificationSettings(data.assignee_id || '', 'task-overdue');
    if (!isEnabled) {
      console.log('🔔 Emergency alerts disabled in settings, skipping notification');
      return;
    }

    const priority = data.priority === "emergency" ? "🚨 URGENT" : "⚠️ Overdue";
    await notifyDesktop({
      title: priority,
      message: `"${data.title}" is overdue!`,
      tag: `task-overdue-${data.id}`,
      requireInteraction: data.priority === "emergency",
    });
  }

  /**
   * Handle new assignment notification
   */
  private async handleNewAssignment(data: NotificationEvent['data']) {
    // Check if user has assignment reminders enabled
    const isEnabled = await this.checkNotificationSettings(data.assignee_id || '', 'new-assignment');
    if (!isEnabled) {
      console.log('🔔 Assignment reminders disabled in settings, skipping notification');
      return;
    }

    const priority = data.priority === "emergency" ? "🚨 URGENT" : "📋 New Task";
    await notifyDesktop({
      title: priority,
      message: `You have been assigned: "${data.title}"`,
      tag: `new-assignment-${data.id}`,
      requireInteraction: data.priority === "emergency",
    });
  }

  /**
   * Handle new meeting notification
   */
  private async handleNewMeeting(data: NotificationEvent['data']) {
    const meetingDate = data.date ? new Date(data.date).toLocaleDateString() : 'Soon';
    await notifyDesktop({
      title: "📅 New Meeting",
      message: `Meeting "${data.title}" scheduled for ${meetingDate}`,
      tag: `new-meeting-${data.id}`,
      requireInteraction: false,
    });
  }

  /**
   * Clean up old processed notifications
   */
  private cleanupOldNotifications() {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // This is a simple cleanup - in production you might want a more sophisticated approach
    if (this.processedNotifications.size > 100) {
      this.processedNotifications.clear();
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all notifications (useful for testing/cleanup)
   */
  clear() {
    this.notificationQueue = [];
    this.processedNotifications.clear();
    this.isProcessing = false;
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }
}

export const notificationManager = NotificationManager.getInstance();
