export function desktopNotify(title: string, body: string) {
  if ((window as any)?.electronAPI?.isElectron) {
    (window as any).electronAPI.notify(title, body);
  }
}
