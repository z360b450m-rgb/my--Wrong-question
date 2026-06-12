const { contextBridge } = require('electron');

// Expose any needed APIs to the renderer process
// Currently the app is fully self-contained in the browser, so this is minimal
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
