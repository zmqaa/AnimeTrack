import { BrowserWindow, shell } from 'electron';

export function createMainWindow(origin: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const localOrigin = new URL(origin).origin;
  const openExternal = (targetUrl: string) => {
    try {
      const target = new URL(targetUrl);
      if (target.protocol === 'http:' || target.protocol === 'https:') {
        void shell.openExternal(target.href);
      }
    } catch {
      // Ignore invalid external URLs.
    }
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin === localOrigin) return;
    } catch {
      // Invalid navigation is blocked below.
    }
    event.preventDefault();
    openExternal(url);
  });

  window.once('ready-to-show', () => window.show());
  void window.loadURL(origin);
  return window;
}
