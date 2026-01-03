// Debug component for testing notifications
import { Button } from "@/components/ui/button";
import { notificationManager } from "@/utils/notificationManager";
import { notificationPermissionManager } from "@/utils/notificationPermission";

export function NotificationDebugger() {
  const handleTestNotification = () => {
    console.log('Testing notification...');
    
    // Test notification
    notificationManager.addNotificationEvent({
      type: 'task-completed',
      data: {
        id: 'test-' + Date.now(),
        title: 'Test Task',
        priority: 'normal',
        assignee_id: 'test-user',
      },
      timestamp: Date.now(),
    });
  };

  const handleCheckPermission = () => {
    const status = notificationPermissionManager.getPermissionStatus();
    const supported = notificationPermissionManager.isSupported();
    console.log('Notification status:', status);
    console.log('Supported:', supported);
  };

  const handleRequestPermission = async () => {
    const granted = await notificationPermissionManager.requestPermission();
    console.log('Permission granted:', granted);
  };

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-background border rounded-lg shadow-lg z-50">
      <h3 className="text-sm font-medium mb-2">Notification Debugger</h3>
      <div className="space-y-2">
        <Button size="sm" onClick={handleTestNotification}>
          Test Notification
        </Button>
        <Button size="sm" variant="outline" onClick={handleCheckPermission}>
          Check Permission
        </Button>
        <Button size="sm" variant="outline" onClick={handleRequestPermission}>
          Request Permission
        </Button>
      </div>
    </div>
  );
}
