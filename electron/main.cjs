// ===================================================================
// @AI-ENVIRONMENT-RULES: Electron 主进程 (Node.js 环境)
//
// 本文件运行在 Node.js 主进程, 拥有完整的系统权限 (文件 I/O、
// 系统对话框、进程管理)。这是安全敏感级别最高的代码层。
//
// ■ 环境约束：
//   1. 不存在 window / document / localStorage 等浏览器 API。
//   2. 所有数据持久化通过 fs 模块操作 JSON 文件实现。
//   3. 与渲染进程的唯一通信通道是 ipcMain.handle / ipcMain.on。
//
// ■ 安全边界 (CRITICAL)：
//   1. 任何新增的 ipcMain.handle 必须同步在 preload.cjs 中通过
//      contextBridge.exposeInMainWorld 暴露给渲染进程。
//   2. 绝不能直接在渲染进程中 require('electron') 或 require
//      Node.js 核心模块 (fs, path, child_process 等)。
//   3. 新增 IPC 通道名称必须有明确的命名空间前缀
//      (storage:/ desktop:/ 等)。
//   4. 文件路径必须校验, 防止路径遍历攻击。
//
// ■ 数据完整性：
//   1. 修改文件存储格式 (JSON 结构) 前必须确认 src/types/index.ts
//      中的接口定义已同步更新。
//   2. 原子写入：先写 .tmp 文件再 rename, 防止写入中断导致数据损坏。
//   3. 级联删除：删除 Notebook 时必须同步删除其关联 entries、
//      snapshots、reviewLogs。
//
// ■ 修改前必读文件：
//   - electron/preload.cjs (API 桥接层)
//   - src/types/index.ts (数据结构定义)
//   - src/services/db.ts (渲染进程数据库访问层)
// ===================================================================
const { app, BrowserWindow, Menu, ipcMain, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let dataDir = null;

function getDefaultDataDir() {
  return path.join(app.getPath('documents'), '错题本');
}

function getDataDir() {
  if (!dataDir) {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    try {
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (cfg.dataDir && fs.existsSync(cfg.dataDir)) {
          dataDir = cfg.dataDir;
          return dataDir;
        }
      }
    } catch { /* fall through to default */ }
    dataDir = getDefaultDataDir();
  }
  return dataDir;
}

function readConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const cfg = readConfig();
  cfg.dataDir = dataDir;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

function isIndexedDBMigrated() {
  return readConfig().indexedDBMigrated === true;
}

function markIndexedDBMigrated() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const cfg = readConfig();
  cfg.indexedDBMigrated = true;
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

function getDataFilePath() {
  return path.join(getDataDir(), 'cuotiben-data.json');
}

function readData() {
  const filePath = getDataFilePath();
  try {
    if (!fs.existsSync(filePath)) return { notebooks: [], entries: [], snapshots: [], reviewLogs: [] };
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.notebooks) data.notebooks = [];
    if (!data.entries) data.entries = [];
    if (!data.snapshots) data.snapshots = [];
    if (!data.reviewLogs) data.reviewLogs = [];
    return data;
  } catch {
    return { notebooks: [], entries: [], snapshots: [], reviewLogs: [] };
  }
}

function writeData(data) {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = getDataFilePath();
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// Register IPC handlers
// ── Desktop capture ─────────────────────────────────────────────────

ipcMain.handle('desktop:getSources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 240 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

// ── Migration ─────────────────────────────────────────────────────

ipcMain.handle('storage:isIndexedDBMigrated', () => {
  return isIndexedDBMigrated();
});

ipcMain.handle('storage:markIndexedDBMigrated', () => {
  markIndexedDBMigrated();
});

ipcMain.handle('storage:getAll', () => {
  const data = readData();
  return data.entries;
});

ipcMain.handle('storage:get', (_e, id) => {
  const data = readData();
  return data.entries.find((e) => e.id === id) ?? null;
});

ipcMain.handle('storage:put', (_e, entry) => {
  const data = readData();
  const idx = data.entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    data.entries[idx] = entry;
  } else {
    data.entries.push(entry);
  }
  writeData(data);
});

ipcMain.handle('storage:delete', (_e, id) => {
  const data = readData();
  data.entries = data.entries.filter((e) => e.id !== id);
  writeData(data);
});

ipcMain.handle('storage:putSnapshot', (_e, snapshot) => {
  const data = readData();
  const idx = data.snapshots.findIndex((s) => s.entryId === snapshot.entryId);
  if (idx >= 0) {
    data.snapshots[idx] = snapshot;
  } else {
    data.snapshots.push(snapshot);
  }
  writeData(data);
});

ipcMain.handle('storage:getSnapshot', (_e, entryId) => {
  const data = readData();
  return data.snapshots.find((s) => s.entryId === entryId) ?? null;
});

ipcMain.handle('storage:getAllSnapshots', () => {
  const data = readData();
  return data.snapshots;
});

ipcMain.handle('storage:deleteSnapshot', (_e, entryId) => {
  const data = readData();
  data.snapshots = data.snapshots.filter((s) => s.entryId !== entryId);
  writeData(data);
});

ipcMain.handle('storage:deleteAllSnapshots', () => {
  const data = readData();
  data.snapshots = [];
  writeData(data);
});

// ── Review log handlers ──────────────────────────────────────────

ipcMain.handle('storage:getAllReviewLogs', () => {
  const data = readData();
  return data.reviewLogs || [];
});

ipcMain.handle('storage:addReviewLog', (_e, log) => {
  const data = readData();
  if (!data.reviewLogs) data.reviewLogs = [];
  data.reviewLogs.push(log);
  writeData(data);
});

ipcMain.handle('storage:deleteReviewLogsByEntry', (_e, entryId) => {
  const data = readData();
  data.reviewLogs = (data.reviewLogs || []).filter((l) => l.entryId !== entryId);
  writeData(data);
});

// ── Notebook handlers ─────────────────────────────────────────────

ipcMain.handle('storage:getAllNotebooks', () => {
  return readData().notebooks || [];
});

ipcMain.handle('storage:putNotebook', (_e, notebook) => {
  const data = readData();
  if (!data.notebooks) data.notebooks = [];
  const idx = data.notebooks.findIndex((n) => n.id === notebook.id);
  if (idx >= 0) {
    data.notebooks[idx] = notebook;
  } else {
    data.notebooks.push(notebook);
  }
  writeData(data);
});

ipcMain.handle('storage:deleteNotebook', (_e, id) => {
  const data = readData();
  data.notebooks = (data.notebooks || []).filter((n) => n.id !== id);
  data.entries = (data.entries || []).filter((e) => e.notebookId !== id);
  const deletedIds = new Set((data.entries || []).map((e) => e.id));
  data.snapshots = (data.snapshots || []).filter((s) => deletedIds.has(s.entryId));
  data.reviewLogs = (data.reviewLogs || []).filter((l) => deletedIds.has(l.entryId));
  writeData(data);
});

ipcMain.handle('storage:getDataDir', () => getDataDir());

ipcMain.handle('storage:setDataDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择数据保存目录',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return getDataDir();
  const newDir = result.filePaths[0];
  // Migrate existing data to new directory
  const oldData = readData();
  const oldDir = getDataDir();
  dataDir = newDir;
  saveConfig();
  writeData(oldData);
  // Remove old data file if it exists
  try {
    const oldFile = path.join(oldDir, 'cuotiben-data.json');
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  } catch { /* ignore */ }
  return newDir;
});

ipcMain.handle('storage:exportAll', () => {
  return JSON.stringify(readData().entries, null, 2);
});

ipcMain.handle('storage:importAll', (_e, entries) => {
  const data = readData();
  const existingIds = new Set(data.entries.map((e) => e.id));
  for (const entry of entries) {
    if (!existingIds.has(entry.id)) {
      data.entries.push(entry);
      existingIds.add(entry.id);
    }
  }
  writeData(data);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '错题本',
    show: false,
    icon: path.join(__dirname, '..', 'dist', 'icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
