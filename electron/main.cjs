const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
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

function saveConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ dataDir }, null, 2), 'utf-8');
}

function getDataFilePath() {
  return path.join(getDataDir(), 'cuotiben-data.json');
}

function readData() {
  const filePath = getDataFilePath();
  try {
    if (!fs.existsSync(filePath)) return { entries: [], snapshots: [], reviewLogs: [] };
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [], snapshots: [], reviewLogs: [] };
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
    icon: path.join(__dirname, '..', 'dist', 'icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

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
