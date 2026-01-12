// Request permission and show desktop notifications
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function showDesktopNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    // Focus window on click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}
