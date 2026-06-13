const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Storage API
  getAll: () => ipcRenderer.invoke('storage:getAll'),
  get: (id) => ipcRenderer.invoke('storage:get', id),
  put: (entry) => ipcRenderer.invoke('storage:put', entry),
  delete: (id) => ipcRenderer.invoke('storage:delete', id),

  putSnapshot: (snapshot) => ipcRenderer.invoke('storage:putSnapshot', snapshot),
  getSnapshot: (entryId) => ipcRenderer.invoke('storage:getSnapshot', entryId),
  getAllSnapshots: () => ipcRenderer.invoke('storage:getAllSnapshots'),
  deleteSnapshot: (entryId) => ipcRenderer.invoke('storage:deleteSnapshot', entryId),
  deleteAllSnapshots: () => ipcRenderer.invoke('storage:deleteAllSnapshots'),

  getDataDir: () => ipcRenderer.invoke('storage:getDataDir'),
  setDataDir: () => ipcRenderer.invoke('storage:setDataDir'),

  exportAll: () => ipcRenderer.invoke('storage:exportAll'),
  importAll: (entries) => ipcRenderer.invoke('storage:importAll', entries),

  // Review log API
  getAllReviewLogs: () => ipcRenderer.invoke('storage:getAllReviewLogs'),
  addReviewLog: (log) => ipcRenderer.invoke('storage:addReviewLog', log),
  deleteReviewLogsByEntry: (entryId) => ipcRenderer.invoke('storage:deleteReviewLogsByEntry', entryId),
});
