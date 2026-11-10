/* Electron 主进程：统一管理主窗口、悬浮窗、按日统计、配置持久化与 IPC。 */
const { app, BrowserWindow, ipcMain, Menu, dialog, nativeTheme, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const ENGINE = require('./engine.js');
if (!app.requestSingleInstanceLock()) app.exit(0);
const STORE = require('./state-store.js');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const STATE_PATH = path.join(app.getPath('userData'), 'app-state.json');
const SAVE_INTERVAL = 5000;
let mainWin = null;
let floatWin = null;
let gameWin = null;
let muyuWin = null;
let defenseWin = null;
let defenseHiddenByBoss = false;
let lastDefenseBossToggle = 0;
const DEFENSE_PATH = path.join(app.getPath('userData'), 'moyu-defense.json');
let quitting = false;
let lastTick = Date.now();
let lastSave = 0;
let lastMuyuWalletPayload = '';


function readConfig() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch (_) { try { saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) {} }
  const merged = STORE.migrateState(saved, Object.assign({}, ENGINE.DEFAULTS, {
    dailyStats: {}, history: [], firedMilestones: [], settlementSeenDate: ''
  }));
  merged.slackCount = Math.max(0, Math.floor(Number(merged.slackCount) || 0));
  merged.unlockedSkins = Array.isArray(merged.unlockedSkins) ? merged.unlockedSkins : ['classic'];
  if (!merged.unlockedSkins.includes('classic')) merged.unlockedSkins.unshift('classic');
  if (merged.slackCount >= 10 && !merged.unlockedSkins.includes('orbit')) merged.unlockedSkins.push('orbit');
  if (!merged.unlockedSkins.includes(merged.skin)) merged.skin = 'classic';
  return merged;
}

let config = readConfig();

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function activeWorkDate(now) {
  const d = new Date(now || Date.now());
  const start = ENGINE.parseTime(config.shiftStart);
  const end = ENGINE.parseTime(config.shiftEnd);
  if (end < start && ENGINE.nowSec(d) <= end) d.setDate(d.getDate() - 1);
  return dateKey(d);
}

function ensureDaily(now) {
  const key = activeWorkDate(now);
  if (!config.dailyStats || config.dailyStats.date !== key) {
    config.dailyStats = { date: key, slackSeconds: 0, slackEarned: 0, slackEntered: false };
    config.firedMilestones = [];
  }
  return config.dailyStats;
}

function saveConfig(state = config) {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const temporary = STATE_PATH + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
    fs.renameSync(temporary, STATE_PATH);
    return true;
  } catch (error) {
    console.error('[config] save failed:', error.message);
    return false;
  }
}

function publicConfig() {
  const visible = Object.assign({}, config);
  delete visible.defenseProgress; delete visible.defenseActiveRun; delete visible.defenseActions; delete visible.defenseCompleted;
  return Object.assign({}, visible, {
    platform: process.platform,
    systemReduceMotion: nativeTheme.shouldUseReducedMotion
  });
}

function broadcast() {
  const payload = publicConfig();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('config', payload);
  if (floatWin && !floatWin.isDestroyed()) floatWin.webContents.send('config', payload);
  if (defenseWin && !defenseWin.isDestroyed()) defenseWin.webContents.send('defense-wallet', config.fishCoins);
  if (muyuWin && !muyuWin.isDestroyed()) { const wallet={ fishCoins:config.fishCoins, assetStyle:config.equipped && config.equipped.theme === 'theme-simple' ? 'simple' : 'polished' }; const signature=JSON.stringify(wallet); if(signature!==lastMuyuWalletPayload){lastMuyuWalletPayload=signature;muyuWin.webContents.send('muyu-wallet',wallet);} }
}

function updateHistory(now) {
  const date = activeWorkDate(now);
  const stats = ensureDaily(now);
  const progress = ENGINE.timeProgress(config, new Date(now));
  const entry = {
    date,
    earned: ENGINE.earnedToday(config, new Date(now)),
    progress,
    dailySalary: ENGINE.dailySalary(config),
    slackSeconds: stats.slackSeconds,
    slackEarned: stats.slackEarned,
    completed: progress >= 1,
    updatedAt: now
  };
  const history = Array.isArray(config.history) ? config.history : [];
  const index = history.findIndex(item => item.date === date);
  if (index >= 0) history[index] = Object.assign({}, history[index], entry);
  else history.push(entry);
  config.history = history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 370);
}

function salaryTick() {
  const now = Date.now();
  const delta = Math.max(0, Math.min(5, (now - lastTick) / 1000));
  lastTick = now;
  const stats = ensureDaily(now);
  const progress = ENGINE.timeProgress(config, new Date(now));
  if (config.mode === 'slack' && progress > 0 && progress < 1) {
    stats.slackEntered = true;
    stats.slackSeconds += delta;
    stats.slackEarned += ENGINE.perSecond(config) * delta;
  }
  updateHistory(now);
  if (now - lastSave >= SAVE_INTERVAL) {
    lastSave = now;
    saveConfig();
    broadcast();
  }
}

async function confirmQuit(win) {
  if (quitting) return;
  const options = {
    type: 'question', title: '退出确认',
    message: '确定要退出「挣点窝囊费」吗？',
    detail: '退出后将停止实时统计，今日已保存的数据不会丢失。',
    buttons: ['退出', '继续挣钱'], defaultId: 1, cancelId: 1, noLink: true
  };
  const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  if (result.response === 0) {
    quitting = true;
    saveConfig();
    app.quit();
  }
}

function createMain() {
  const isMac = process.platform === 'darwin';
  mainWin = new BrowserWindow({
    width: 642, height: 940, minWidth: 520, minHeight: 720,
    backgroundColor: '#F3F7FA',
    icon: path.join(__dirname, 'assets', isMac ? 'app-icon.png' : 'wnf-icon.ico'),
    title: '挣点窝囊费',
    webPreferences: { contextIsolation: false, nodeIntegration: true }
  });
  installDefenseShortcutFallback(mainWin);
  mainWin.loadFile('index.html');
  mainWin.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    confirmQuit(mainWin);
  });
  mainWin.on('closed', () => { mainWin = null; });
}

function createFloat() {
  floatWin = new BrowserWindow({
    width: 372, height: 299, minWidth: 320, minHeight: 250,
    frame: false, transparent: true, alwaysOnTop: true, resizable: true,
    skipTaskbar: true, hasShadow: false,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'app-icon.png' : 'wnf-icon.ico'),
    webPreferences: { contextIsolation: false, nodeIntegration: true }
  });
  installDefenseShortcutFallback(floatWin);
  floatWin.loadFile('floating.html');
  try { floatWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
  floatWin.on('closed', () => { floatWin = null; });
}

function createGame() {
  if (gameWin && !gameWin.isDestroyed()) {
    gameWin.show();
    gameWin.focus();
    return;
  }
  gameWin = new BrowserWindow({
    width: 1120, height: 800, minWidth: 720, minHeight: 560,
    backgroundColor: '#07131f',
    title: '星轨弹射 · 摸鱼小游戏',
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'app-icon.png' : 'wnf-icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  gameWin.loadFile(path.join('game', 'orbit-launch.html'));
  gameWin.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error('[game]', message);
  });
  gameWin.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[game] load failed:', code, description);
  });
  gameWin.on('closed', () => { gameWin = null; });
}

function createMuyuGame() {
  if (muyuWin && !muyuWin.isDestroyed()) {
    muyuWin.show();
    muyuWin.focus();
    muyuWin.webContents.send('muyu-wallet', { fishCoins: config.fishCoins, assetStyle: config.equipped && config.equipped.theme === 'theme-simple' ? 'simple' : 'polished' });
    return;
  }
  muyuWin = new BrowserWindow({
    width: 480, height: 600, minWidth: 420, minHeight: 540, maxWidth: 560, maxHeight: 720,
    backgroundColor: '#08142E', title: '木鱼暴击 · 摸鱼乐园', resizable: true,
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'app-icon.png' : 'wnf-icon.ico'),
    webPreferences: { contextIsolation: false, nodeIntegration: true }
  });
  muyuWin.loadFile(path.join('game', 'muyu.html'));
  muyuWin.webContents.on('did-finish-load', () => muyuWin.webContents.send('muyu-wallet', { fishCoins: config.fishCoins, assetStyle: config.equipped && config.equipped.theme === 'theme-simple' ? 'simple' : 'polished' }));
  muyuWin.on('closed', () => { muyuWin = null; lastMuyuWalletPayload = ''; });
}

function installDefenseShortcutFallback(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.shift && (input.meta || input.control) && input.key.toLowerCase() === 'm' && defenseWin) {
      event.preventDefault(); toggleDefenseBoss();
    }
  });
}

function toggleDefenseBoss() {
  if (Date.now() - lastDefenseBossToggle < 250) return;
  lastDefenseBossToggle = Date.now();
  if (!defenseWin || defenseWin.isDestroyed()) return;
  if (defenseHiddenByBoss) { defenseHiddenByBoss = false; defenseWin.show(); defenseWin.focus(); }
  else if (defenseWin.isVisible()) { defenseWin.webContents.send('defense-pause'); defenseWin.hide(); defenseHiddenByBoss = true; }
}

function createDefenseGame() {
  if (defenseWin && !defenseWin.isDestroyed()) { defenseHiddenByBoss = false; defenseWin.show(); defenseWin.focus(); return; }
  defenseWin = new BrowserWindow({ width: 480, height: 600, minWidth: 420, minHeight: 540, maxWidth: 560, maxHeight: 720, useContentSize: true,
    backgroundColor: '#edf3f7', title: '摸鱼防线 · 摸鱼乐园',
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'app-icon.png' : 'wnf-icon.ico'),
    webPreferences: { contextIsolation: false, nodeIntegration: true } });
  const shortcutOk = globalShortcut.register('CommandOrControl+Shift+M', toggleDefenseBoss);
  globalShortcut.register('F10', toggleDefenseBoss);
  if (process.env.MOYU_DEFENSE_QA === '1') defenseWin.webContents.on('console-message', (_event, _level, message) => console.log('[defense-qa]', message));
  defenseWin.loadFile(path.join('game', 'defense.html'));
  defenseWin.webContents.on('did-finish-load', () => defenseWin.webContents.send('defense-shortcut', shortcutOk));
  defenseWin.on('blur', () => { if (defenseWin && !defenseWin.isDestroyed()) defenseWin.webContents.send('defense-pause'); });
  defenseWin.on('closed', () => { globalShortcut.unregister('F10'); globalShortcut.unregister('CommandOrControl+Shift+M'); defenseWin = null; defenseHiddenByBoss = false; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureDaily(Date.now());
  updateHistory(Date.now());
  createMain();
  setInterval(salaryTick, 1000);

  ipcMain.on('get-config', event => event.reply('config', publicConfig()));
  ipcMain.on('set-config', (_event, next) => {
    const allowed = ['viewMode','monthly','system','shiftStart','shiftEnd','animations','reduceMotion','sound','autoSettlement','freeDays','payDays','itemName','itemPrice','mealName','mealPrice','movieName','moviePrice','skin'];
    const incoming = Object.fromEntries(Object.entries(next || {}).filter(([key]) => allowed.includes(key)));
    if (incoming.skin && !(config.unlockedSkins || []).includes(incoming.skin)) delete incoming.skin;
    config = Object.assign({}, config, incoming);
    ensureDaily(Date.now()); updateHistory(Date.now()); saveConfig(); broadcast();
  });
  ipcMain.on('set-mode', (_event, mode) => {
    if (!['default', 'work', 'slack'].includes(mode)) return;
    const enteringSlack = mode === 'slack' && config.mode !== 'slack';
    config.mode = mode;
    if (mode === 'slack') {
      ensureDaily(Date.now()).slackEntered = true;
      if (enteringSlack) {
        config.slackCount = Math.max(0, Math.floor(Number(config.slackCount) || 0)) + 1;
        if (config.slackCount >= 10 && !config.unlockedSkins.includes('orbit')) config.unlockedSkins.push('orbit');
      }
    }
    saveConfig(); broadcast();
  });
  ipcMain.on('open-defense', () => createDefenseGame());
  ipcMain.on('defense-boss', event => { if (defenseWin && event.sender === defenseWin.webContents) toggleDefenseBoss(); });
  const isDefense = event => defenseWin && !defenseWin.isDestroyed() && event.sender === defenseWin.webContents;
  ipcMain.handle('defense-read', event => {
    if (!isDefense(event)) return { ok:false };
    if (!Object.prototype.hasOwnProperty.call(config, 'defenseProgress')) {
      let legacy = null;
      try { legacy = JSON.parse(fs.readFileSync(DEFENSE_PATH, 'utf8')); } catch (_) {}
      const next = Object.assign({}, config, { defenseProgress: legacy });
      if (!saveConfig(next)) return { ok:false, code:'SAVE_FAILED' };
      config = next;
    }
    return { ok:true, progress:config.defenseProgress, active:config.defenseActiveRun || null, fishCoins:config.fishCoins };
  });
  ipcMain.handle('defense-save', (event, data) => {
    if (!isDefense(event) || !data || typeof data !== 'object') return false;
    try { if (JSON.stringify(data).length > 1000000) return false; const next=Object.assign({},config,{defenseProgress:data}); if(!saveConfig(next)) return false; config=next; return true; }
    catch (_) { return false; }
  });
  ipcMain.handle('defense-transaction', (event, request) => {
    if (!isDefense(event) || !request || typeof request !== 'object') return {ok:false,code:'INVALID'};
    if (request.action === 'start' && request.launch && request.launch.level > (config.defenseProgress?.unlockedLevel || 1)) return {ok:false,code:'LOCKED'};
    if (request.action === 'start-endless' && !(config.defenseProgress?.cleared || []).includes(30)) return {ok:false,code:'LOCKED'};
    const result=STORE.defenseTransaction(config,request.action,request.id,Date.now(),request.launch);
    if (result.ok && result.code !== 'DUPLICATE') { if(!saveConfig(result.state)) return {ok:false,code:'SAVE_FAILED'}; config=result.state; broadcast(); }
    return {ok:result.ok,code:result.code,fishCoins:config.fishCoins,progress:config.defenseProgress,active:config.defenseActiveRun||null};
  });
  ipcMain.handle('defense-resume', (event, request) => {
    if (!isDefense(event) || !request || typeof request.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(request.id)) return {ok:false,code:'INVALID'};
    const checkpoint=config.defenseProgress && config.defenseProgress.endless;
    if (!checkpoint || !checkpoint.battle || !Number.isInteger(checkpoint.wave)) return {ok:false,code:'NOT_FOUND'};
    const current=config.defenseActiveRun;
    const active=current && current.endless ? current : {id:request.id, level:30, endless:true, seed:checkpoint.battle.seed};
    if (active !== current) {const next=Object.assign({},config,{defenseActiveRun:active});if(!saveConfig(next))return {ok:false,code:'SAVE_FAILED'};config=next;}
    return {ok:true,active,progress:config.defenseProgress,fishCoins:config.fishCoins};
  });
  ipcMain.handle('defense-finish', (event, request) => {
    if (!isDefense(event) || !request || typeof request.id !== 'string' || !request.progress || typeof request.progress !== 'object') return {ok:false,code:'INVALID'};
    const result=STORE.finishDefense(config,request.id,request.progress);
    if(result.ok && result.code!=='DUPLICATE'){if(!saveConfig(result.state))return {ok:false,code:'SAVE_FAILED'};config=result.state;}
    return {ok:result.ok,code:result.code,progress:config.defenseProgress,fishCoins:config.fishCoins};
  });
  ipcMain.on('open-muyu', () => createMuyuGame());
  ipcMain.on('open-orbit', () => createGame());
  ipcMain.on('muyu-finish', (event, result) => {
    const awarded = STORE.awardMuyu(config, result, Date.now());
    config = awarded.state;
    updateHistory(Date.now());
    saveConfig();
    broadcast();
    event.reply('muyu-result', { reward: awarded.reward, fishCoins: config.fishCoins });
  });
  ipcMain.handle('purchase-item', (_event, itemId) => {
    const result = STORE.transactPurchase(config, itemId, Date.now());
    if (result.ok && !saveConfig(result.state)) return { ok: false, code: 'SAVE_FAILED' };
    if (result.ok) { config = result.state; broadcast(); }
    return { ok: result.ok, code: result.code, item: result.item, fishCoins: config.fishCoins, equipped: config.equipped, ownedItems: config.ownedItems };
  });
  ipcMain.handle('equip-item', (_event, itemId) => {
    const result = STORE.equipItem(config, itemId);
    if (result.ok && !saveConfig(result.state)) return { ok: false, code: 'SAVE_FAILED' };
    if (result.ok) { config = result.state; broadcast(); }
    return { ok: result.ok, code: result.code, item: result.item, fishCoins: config.fishCoins, equipped: config.equipped, ownedItems: config.ownedItems };
  });
  ipcMain.on('milestone-fired', (_event, id) => {
    if (!id) return;
    const list = Array.isArray(config.firedMilestones) ? config.firedMilestones : [];
    if (!list.includes(id)) list.push(id);
    config.firedMilestones = list; saveConfig();
  });
  ipcMain.on('settlement-seen', () => {
    config.settlementSeenDate = activeWorkDate(Date.now()); saveConfig(); broadcast();
  });
  ipcMain.on('to-float', () => {
    if (!floatWin) createFloat();
    floatWin.show();
    try { floatWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    if (mainWin) mainWin.hide();
  });
  ipcMain.on('expand', () => {
    if (!mainWin) createMain();
    mainWin.show(); mainWin.focus();
    if (floatWin) floatWin.hide();
  });
  ipcMain.on('float-ready', () => { if (floatWin) floatWin.webContents.send('config', publicConfig()); });
  ipcMain.on('confirm-quit', () => confirmQuit(null));
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('second-instance', () => { if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); } });

app.on('activate', () => {
  if (!mainWin) createMain();
  else mainWin.show();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (!floatWin || !floatWin.isVisible())) app.quit();
});
