'use strict';

const DATA_VERSION = 2;

const SHOP_ITEMS = Object.freeze({
  'theme-office-night': { id: 'theme-office-night', type: 'theme', name: '办公室夜班', price: 500 },
  'theme-simple': { id: 'theme-simple', type: 'theme', name: '质朴', price: 300 },
  'floating-pixel': { id: 'floating-pixel', type: 'floating', name: '像素悬浮窗', price: 400 },
  'capybara-pajamas': { id: 'capybara-pajamas', type: 'capybara', name: '睡衣卡皮巴拉', price: 200 }
});

function uniqueStrings(value, fallback) {
  const values = Array.isArray(value) ? value.filter(item => typeof item === 'string' && item) : [];
  return Array.from(new Set(values.length ? values : fallback));
}

function migrateState(saved, defaults) {
  const legacy = saved && typeof saved === 'object' ? saved : {};
  const state = Object.assign({}, defaults || {}, legacy);
  state.dataVersion = DATA_VERSION;
  state.fishCoins = Math.max(0, Math.floor(Number(legacy.fishCoins ?? 128) || 0));
  state.totalFishCoinsEarned = Math.max(state.fishCoins, Math.floor(Number(legacy.totalFishCoinsEarned ?? state.fishCoins) || 0));
  state.totalFishCoinsSpent = Math.max(0, Math.floor(Number(legacy.totalFishCoinsSpent) || 0));
  state.ownedItems = uniqueStrings(legacy.ownedItems, ['theme-classic', 'floating-classic', 'capybara-classic']);
  ['theme-classic', 'floating-classic', 'capybara-classic'].forEach(id => {
    if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
  });
  const equipped = legacy.equipped && typeof legacy.equipped === 'object' ? legacy.equipped : {};
  state.equipped = {
    theme: state.ownedItems.includes(equipped.theme) ? equipped.theme : 'theme-classic',
    floating: state.ownedItems.includes(equipped.floating) ? equipped.floating : 'floating-classic',
    capybara: state.ownedItems.includes(equipped.capybara) ? equipped.capybara : 'capybara-classic'
  };
  state.fishCoinTransactions = Array.isArray(legacy.fishCoinTransactions) ? legacy.fishCoinTransactions.slice(-200) : [];
  state.gameStats = Object.assign({ muyuGames: 0, muyuBestScore: 0, muyuBestCombo: 0 }, legacy.gameStats || {});
  state.history = Array.isArray(legacy.history) ? legacy.history : [];
  state.dailyStats = legacy.dailyStats && typeof legacy.dailyStats === 'object' ? legacy.dailyStats : {};
  state.firedMilestones = Array.isArray(legacy.firedMilestones) ? legacy.firedMilestones : [];
  state.unlockedSkins = uniqueStrings(legacy.unlockedSkins, ['classic']);
  if (!state.unlockedSkins.includes('classic')) state.unlockedSkins.unshift('classic');
  return state;
}

function transactPurchase(current, itemId, now) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { ok: false, code: 'NOT_FOUND', state: current };
  if ((current.ownedItems || []).includes(itemId)) return { ok: false, code: 'OWNED', state: current };
  if ((Number(current.fishCoins) || 0) < item.price) return { ok: false, code: 'INSUFFICIENT', state: current };
  const state = migrateState(JSON.parse(JSON.stringify(current)), {});
  state.fishCoins -= item.price;
  state.totalFishCoinsSpent += item.price;
  state.ownedItems.push(itemId);
  state.equipped[item.type] = itemId;
  state.fishCoinTransactions.push({ id: 'buy-' + (now || Date.now()), type: 'spend', amount: -item.price, itemId, at: now || Date.now() });
  state.fishCoinTransactions = state.fishCoinTransactions.slice(-200);
  return { ok: true, code: 'PURCHASED', item, state };
}

function equipItem(current, itemId) {
  const defaults = {
    'theme-classic': { id: 'theme-classic', type: 'theme', name: '默认主题' },
    'floating-classic': { id: 'floating-classic', type: 'floating', name: '默认悬浮窗' },
    'capybara-classic': { id: 'capybara-classic', type: 'capybara', name: '默认卡皮巴拉' }
  };
  const item = SHOP_ITEMS[itemId] || defaults[itemId];
  if (!item || !(current.ownedItems || []).includes(itemId)) return { ok: false, code: 'NOT_OWNED', state: current };
  const state = migrateState(JSON.parse(JSON.stringify(current)), {});
  state.equipped[item.type] = itemId;
  return { ok: true, code: 'EQUIPPED', item, state };
}

function awardMuyu(current, result, now) {
  const safe = result && typeof result === 'object' ? result : {};
  const score = Math.max(0, Math.floor(Number(safe.score) || 0));
  const combo = Math.max(0, Math.floor(Number(safe.combo) || 0));
  const hits = Math.max(0, Math.floor(Number(safe.hits) || 0));
  const reward = hits > 0 ? Math.max(10, Math.min(25, 10 + Math.floor(score / 80) + Math.floor(combo / 20))) : 0;
  const state = migrateState(JSON.parse(JSON.stringify(current)), {});
  state.fishCoins += reward;
  state.totalFishCoinsEarned += reward;
  state.gameStats.muyuGames += 1;
  state.gameStats.muyuBestScore = Math.max(state.gameStats.muyuBestScore, score);
  state.gameStats.muyuBestCombo = Math.max(state.gameStats.muyuBestCombo, combo);
  state.fishCoinTransactions.push({ id: 'muyu-' + (now || Date.now()), type: 'earn', amount: reward, game: 'muyu', at: now || Date.now() });
  state.fishCoinTransactions = state.fishCoinTransactions.slice(-200);
  return { reward, state };
}

// Wallet and defense progression are committed together by the host's atomic save.
const DEFENSE_EXCHANGE_RATE = 100;
function defenseTransaction(current, action, requestId, now, launch) {
  if (!['start', 'start-endless', 'exchange'].includes(action) || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return { ok: false, code: 'INVALID', state: current };
  const existing = Array.isArray(current.defenseActions) ? current.defenseActions : [];
  const prior = existing.find(item => item.id === requestId);
  if (prior) return { ok: prior.action === action, code: prior.action === action ? 'DUPLICATE' : 'INVALID', state: current };
  if (action !== 'exchange' && (!launch || !Number.isInteger(launch.level) || launch.level < 1 || launch.level > 30 || !Number.isInteger(launch.seed) || launch.seed < 0 || launch.seed > 4294967295 || typeof launch.endless !== 'boolean' || launch.endless !== (action === 'start-endless'))) return { ok: false, code: 'INVALID', state: current };
  if ((Number(current.fishCoins) || 0) < 1) return { ok: false, code: 'INSUFFICIENT', state: current };
  const state = migrateState(JSON.parse(JSON.stringify(current)), {});
  state.fishCoins -= 1;
  state.totalFishCoinsSpent += 1;
  state.defenseProgress = state.defenseProgress && typeof state.defenseProgress === 'object' ? state.defenseProgress : { version: 2, supply: 0 };
  if (action === 'exchange') { const supply=Math.max(0, Math.floor(Number(state.defenseProgress.supply) || 0)); if (!Number.isSafeInteger(supply) || supply > Number.MAX_SAFE_INTEGER - DEFENSE_EXCHANGE_RATE) return { ok:false,code:'INVALID',state:current }; state.defenseProgress.supply = supply + DEFENSE_EXCHANGE_RATE; }
  else state.defenseActiveRun = { id: requestId, ...launch };
  if (action === 'start-endless') state.defenseProgress.endless = null;
  state.defenseActions = existing.concat({ id: requestId, action, at: now || Date.now() }).slice(-200);
  state.fishCoinTransactions.push({ id: 'defense-' + requestId, type: 'spend', amount: -1, game: 'defense', purpose: action, at: now || Date.now() });
  state.fishCoinTransactions = state.fishCoinTransactions.slice(-200);
  return { ok: true, code: 'OK', state };
}

function finishDefense(current, requestId, progress) {
  if (typeof requestId !== 'string' || !progress || typeof progress !== 'object') return {ok:false,code:'INVALID',state:current};
  const done=Array.isArray(current.defenseCompleted)?current.defenseCompleted:[];
  if(done.includes(requestId)) return {ok:true,code:'DUPLICATE',state:current};
  if(!current.defenseActiveRun || current.defenseActiveRun.id!==requestId) return {ok:false,code:'INVALID',state:current};
  try {if(JSON.stringify(progress).length>1000000) return {ok:false,code:'INVALID',state:current};}catch(_){return {ok:false,code:'INVALID',state:current};}
  const state=Object.assign({},current,{defenseProgress:progress,defenseActiveRun:null,defenseCompleted:done.concat(requestId).slice(-200)});
  return {ok:true,code:'OK',state};
}

module.exports = { DATA_VERSION, SHOP_ITEMS, migrateState, transactPurchase, equipItem, awardMuyu, DEFENSE_EXCHANGE_RATE, defenseTransaction, finishDefense };
