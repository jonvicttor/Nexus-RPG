const { app, BrowserWindow } = require('electron');
const path = require('path');

// Substituímos a biblioteca externa por uma verificação nativa
const isDev = !app.isPackaged;

function createWindow() {
  // Cria a janela do navegador
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // Se tiver ícone, ele tenta carregar, se não, ignora
    icon: path.join(__dirname, 'favicon.ico') 
  });

  win.setMenuBarVisibility(false);

  // Carrega a URL do React (Localhost em dev, arquivo local em prod)
  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});