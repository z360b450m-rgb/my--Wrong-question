// ===================================================================
// @AI-ENVIRONMENT-RULES: Electron 预加载脚本 (Preload Bridge)
//
// 本文件运行在 preload 上下文, 是主进程与渲染进程之间唯一的安全桥梁。
// 通过 contextBridge.exposeInMainWorld 将有限的 API 暴露给 Vue 前端。
//
// ■ 环境约束：
//   1. 可以访问 Node.js API (require) 和部分 Electron API (ipcRenderer)。
//   2. 不能访问完整的 DOM (没有 document.body 等), 但可以访问 window。
//   3. 暴露的 API 挂载在 window.electronAPI 上, 通过 ipcRenderer.invoke
//      与主进程通信。
//
// ■ 安全边界 (CRITICAL) —— 这是安全防护的咽喉点：
//   1. 主进程 (main.cjs) 新增的每个 ipcMain.handle, 必须在此处添加
//      对应的 contextBridge 暴露函数, 否则渲染进程无法调用。
//   2. 绝不能直接暴露 ipcRenderer 给渲染进程 —— 只暴露命名的函数。
//   3. 严禁在 Vue 前端代码中直接 require('electron') 或 require
//      Node.js 核心模块 (fs, path, os 等)。所有跨进程通信必须通过
//      此处定义的 electronAPI 接口。
//   4. 此处暴露的每个函数都是攻击面 —— 需确保对应的 ipcMain handler
//      在主进程中做了权限校验。
//
// ■ API 契约：
//   1. 此处定义的函数签名是渲染进程与主进程之间的契约 —— 不可随意
//      删除或重命名已有方法, 只能追加新方法。
//   2. 所有通信使用 ipcRenderer.invoke (异步) 而非 ipcRenderer.send
//      (单向), 确保错误能正确传递到调用方。
//
// ■ 修改前必读文件：
//   - electron/main.cjs (主进程 IPC 处理程序)
//   - src/services/db.ts (渲染进程数据库访问层, 通过 window.electronAPI 调用)
// ===================================================================
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

  // Desktop capture
  getDesktopSources: () => ipcRenderer.invoke('desktop:getSources'),

  // Migration
  isIndexedDBMigrated: () => ipcRenderer.invoke('storage:isIndexedDBMigrated'),
  markIndexedDBMigrated: () => ipcRenderer.invoke('storage:markIndexedDBMigrated'),

  // Notebook API
  getAllNotebooks: () => ipcRenderer.invoke('storage:getAllNotebooks'),
  putNotebook: (notebook) => ipcRenderer.invoke('storage:putNotebook', notebook),
  deleteNotebook: (id) => ipcRenderer.invoke('storage:deleteNotebook', id),
});
