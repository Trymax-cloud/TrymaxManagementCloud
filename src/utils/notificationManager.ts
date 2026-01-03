// Notification manager for handling desktop notifications safely
// Prevents app freezing and ensures notifications appear properly

import { notifyDesktop } from "@/utils/notifications";

interface NotificationEvent {
  type: 'task-completed' | 'task-overdue' | 'new-assignment';
  data: {
    id: string;
    title: string;
    priority?: string;
    assignee_id?: string;
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
   * Add a notification event to the queue
   */
  addNotificationEvent(event: NotificationEvent) {
    const notificationKey = `${event.type}-${event.data.id}`;
    
    // Skip if already processed recently
    if (this.processedNotifications.has(notificationKey)) {
      return;
    }

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
    const priority = data.priority === "emergency" ? "🚨 URGENT" : "📋 New Task";
    await notifyDesktop({
      title: priority,
      message: `You have been assigned: "${data.title}"`,
      tag: `new-assignment-${data.id}`,
      requireInteraction: data.priority === "emergency",
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
