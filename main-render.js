/* 主窗口：权威金额即时更新，视觉反馈独立聚合，不参与工资计算。 */
(function () {
  'use strict';
  var ipc = null;
  try { ipc = require('electron').ipcRenderer; } catch (_) {}
  var cfg = Object.assign({}, ENGINE.DEFAULTS, { dailyStats: {}, history: [], firedMilestones: [] });
  var firstConfig = true;
  var firstRender = true;
  var previousEarned = 0;
  var previousProgress = 0;
  var selectedDate = new Date(); selectedDate.setHours(0, 0, 0, 0);
  var calCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  var toastQueue = [], toastTimer = null;
  var settlementOpen = false;
  var lastCoinSound = 0;
  var $ = function (id) { return document.getElementById(id); };
  var jarPresenter = JAR_COINS.createPresenter($('jarFill'), $('coinStream'), $('jarStage'), 84, function () { playCoinSound(); });

  var MODE = {
    default: { name: '默认', headline: '今天也在稳稳挣钱', note: '不赶不卷，窝囊费依旧准时到账。' },
    work: { name: '工作', headline: '今天也在认真挣钱', note: '不是时间在流逝，是工资正在到账。' },
    slack: { name: '摸鱼', headline: '公司今日正在赞助你休息', note: '适当放空，也是一种可持续发展。' }
  };
  var SHOP = {
    'theme-classic': { name: '默认主题', price: 0, type: 'theme', image: 'assets/v1a/character/capybara_master.png' },
    'floating-classic': { name: '默认悬浮窗', price: 0, type: 'floating', image: 'assets/generated/salary-jar-full-ui.png' },
    'capybara-classic': { name: '默认卡皮巴拉', price: 0, type: 'capybara', image: 'assets/v1a/character/capybara_master.png' },
    'theme-office-night': { name: '办公室夜班', price: 500, type: 'theme', image: 'assets/v1a/character/capybara_work.png' },
    'theme-simple': { name: '质朴', price: 300, type: 'theme', image: 'assets/skins/simple/batch-a-character/capybara_master.png' },
    'floating-pixel': { name: '像素悬浮窗', price: 400, type: 'floating', image: 'assets/generated/salary-jar-full-ui.png' },
    'capybara-pajamas': { name: '睡衣卡皮巴拉', price: 200, type: 'capybara', image: 'assets/v1a/character/capybara_pajamas_clean.png' },
    'defense-soldier': { name: '蓝军小队长', price: 200, type: 'capybara', image: 'game/defense-assets/soldier-clean.png' },
    'defense-zombie': { name: '呆萌小僵尸', price: 200, type: 'capybara', image: 'game/defense-assets/zombie-clean.png' },
    'defense-runner': { name: '疾跑小僵尸', price: 200, type: 'capybara', image: 'game/defense-assets/enemy-runner.png' },
    'defense-boss': { name: '巨力首领', price: 200, type: 'capybara', image: 'game/defense-assets/boss-1.png' }
  };

  function todayKey() { return keyFor(new Date()); }
  function workDateKey() { return ENGINE.workDateKey(cfg, new Date()); }
  function keyFor(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function money(n) { return ENGINE.fmt(n); }
  function pct(n) { return Math.round(Math.max(0, n) * 100) + '%'; }
  function reducedMotion() { return cfg.reduceMotion === 'on' || (cfg.reduceMotion === 'system' && cfg.systemReduceMotion); }
  function history() { return Array.isArray(cfg.history) ? cfg.history : []; }
  function todayStats() { return Object.assign({ slackSeconds: 0, slackEarned: 0, slackEntered: false }, cfg.dailyStats || {}); }

  function setMode(mode, persist) {
    cfg.mode = mode;
    Array.prototype.forEach.call($('dashModes').children, function (button) { button.classList.toggle('active', button.dataset.v === mode); });
    var info = MODE[mode] || MODE.default;
    $('modeHeadline').textContent = info.headline;
    $('modeNote').textContent = mode === 'slack'
      ? '公司今日已赞助你休息 ' + money(todayStats().slackEarned) + '。' : info.note;
    $('modeChip').textContent = info.name;
    var slackCount = Math.max(0, Number(cfg.slackCount) || 0);
    $('slackProgressNote').textContent = slackCount >= 10 ? '已累计摸鱼 ' + slackCount + ' 次 · 星轨夜航皮肤已解锁' : '累计摸鱼 ' + slackCount + ' / 10 次，可解锁星轨夜航皮肤';
    $('heroState').textContent = mode === 'slack' ? '摸鱼中' : (mode === 'default' ? '默认中' : '工作中');
    $('headerState').textContent = $('heroState').textContent;
    renderCompanion();
    if (persist && ipc) ipc.send('set-mode', mode);
  }

  Array.prototype.forEach.call($('dashModes').children, function (button) {
    button.addEventListener('click', function () { setMode(button.dataset.v, true); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tabbar button'), function (button) {
    button.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tabbar button'), function (x) { x.classList.toggle('active', x === button); });
      Array.prototype.forEach.call(document.querySelectorAll('.view'), function (view) { view.classList.toggle('active', view.id === 'view-' + button.dataset.view); });
      $('content').scrollTop = 0;
      if (button.dataset.view === 'history') renderCalendar();
      if (button.dataset.view === 'house') renderHouse();
    });
  });

  function setViewMode(mode, persist) {
    cfg.viewMode = mode;
    $('viewJar').classList.toggle('active', mode === 'jar');
    $('viewBar').classList.toggle('active', mode === 'bar');
    $('jarView').hidden = mode !== 'jar';
    $('barView').hidden = mode !== 'bar';
    $('amountLabel').textContent = mode === 'jar' ? '今日已装入' : '今日已赚';
    if (persist && ipc) ipc.send('set-config', { viewMode: mode });
  }
  $('viewJar').onclick = function () { setViewMode('jar', true); };
  $('viewBar').onclick = function () { setViewMode('bar', true); };

  function finishTime() { return cfg.shiftEnd || '--:--'; }
  function statusCopy(progress, overtime) {
    if (overtime > 0) return '当前已进入额外章节';
    if (progress >= 1) return '今日副本通关，可以准备下班了';
    if (progress >= .9) return '胜利就在屏幕右下角';
    if (progress >= .5) return '今天已经熬过一半';
    if (progress > 0) return '不是时间在流逝，是工资正在到账';
    return '刚刚启动，窝囊费正在加载';
  }

  function renderDashboard() {
    var earned = ENGINE.earnedToday(cfg);
    var progress = ENGINE.timeProgress(cfg);
    var raw = ENGINE.rawTimeProgress(cfg);
    var overtime = ENGINE.overtimeSeconds(cfg);
    var daily = ENGINE.dailySalary(cfg);
    var remaining = ENGINE.remainingAmount(cfg);
    var p = Math.max(0, Math.min(1, progress));
    $('dashEarned').textContent = money(earned);
    $('dashPct').textContent = pct(progress);
    $('dashPs').textContent = ENGINE.fmt4(ENGINE.perSecond(cfg));
    $('dashDaily').textContent = money(daily);
    $('dashRemaining').textContent = money(remaining);
    $('finishAt').textContent = finishTime();
    var coins = jarPresenter.update(earned, cfg, !document.hidden && $('view-dash').classList.contains('active') && cfg.viewMode === 'jar' && cfg.animations !== false && !reducedMotion(), daily > 0 ? earned / daily : 0);
    var coinText = JAR_COINS.names.map(function (name, i) { return name + ' ' + coins.counts[i] + ' 枚'; }).join(' · ');
    $('jarCoinSummary').textContent = '币堆按工资进度示意 · 实际：' + coinText + (coins.remainder ? ' · 未折算 ¥' + (coins.remainder / 100).toFixed(2) : '');
    $('jarView').setAttribute('aria-label', '今日工资罐，' + coinText);
    $('largeFill').style.width = (p * 100) + '%';
    $('largePct').textContent = pct(progress);
    $('progressCopy').textContent = statusCopy(progress, overtime);
    $('heroDate').textContent = fmtDate(new Date()) + ' · ' + ['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()];
    $('salaryHero').classList.toggle('near-finish', p >= .9 && p < 1);
    $('salaryHero').classList.toggle('completed', p >= 1);
    $('overtimePanel').hidden = overtime <= 0;
    if (overtime > 0) {
      $('overtimeText').textContent = '已加班 ' + ENGINE.fmtDuration(overtime);
      $('overtimeReference').textContent = '参考 ' + money(ENGINE.overtimeReference(cfg));
    }
    var quantity = ENGINE.itemQuantity(earned, Number(cfg.itemPrice));
    var itemText = ENGINE.itemText(earned, cfg.itemName, Number(cfg.itemPrice));
    $('conversionTitle').textContent = '已经赚到 ' + itemText;
    $('conversionPrimary').textContent = Math.abs(quantity - Math.round(quantity)) < .05 ? Math.round(quantity) : quantity.toFixed(1);
    $('conversionPrimaryLabel').textContent = '个' + cfg.itemName;
    var wish = Number(cfg.moviePrice) > 0 ? (earned % Number(cfg.moviePrice)) / Number(cfg.moviePrice) : 0;
    $('wishProgress').textContent = Math.round(wish * 100) + '%';
    $('wishLabel').textContent = '下一个' + cfg.movieName;
    var mins = ENGINE.remainingMinutesForItem(cfg, earned, Number(cfg.itemPrice));
    $('conversionHint').textContent = mins === 0 ? '刚好又赚到一个' + cfg.itemName + '，小确幸已入账。' : '再工作约 ' + (mins == null ? '--' : mins) + ' 分钟，就能再赚到一个' + cfg.itemName + '。';
    checkMilestones(previousEarned, earned, previousProgress, progress);
    previousEarned = earned; previousProgress = raw;
    if (cfg.autoSettlement && progress >= 1 && cfg.settlementSeenDate !== workDateKey() && !settlementOpen) openSettlement();
  }

  function milestoneAllowed(type) {
    return type === 'amount' ? cfg.milestoneAmount !== false : type === 'time' ? cfg.milestoneTime !== false : cfg.milestoneItem !== false;
  }
  function fireMilestone(id, title, body, type) {
    if (!milestoneAllowed(type) || (cfg.firedMilestones || []).includes(id)) return;
    cfg.firedMilestones = (cfg.firedMilestones || []).concat(id);
    if (ipc) ipc.send('milestone-fired', id);
    toastQueue.push({ title: title, body: body });
    if (!$('toast').classList.contains('show')) showNextToast();
  }
  function checkMilestones(oldAmount, amount, oldProgress, progress) {
    if (firstRender) return;
    [10, 50, 100, 300].forEach(function (node) {
      if (oldAmount < node && amount >= node) fireMilestone('amount:' + node, '工资里程碑 · ' + money(node), node >= 100 ? '成功击败一个三位数！' : '今天的小确幸又多了一点。', 'amount');
    });
    [[.25,'25%','开局稳稳当当'],[.5,'50%','今天已经熬过一半'],[.75,'75%','下班开始出现在地平线'],[.9,'90%','胜利就在屏幕右下角'],[1,'100%','今日副本通关']].forEach(function (m) {
      if (oldProgress < m[0] && progress >= m[0]) fireMilestone('time:' + m[1], '工时里程碑 · ' + m[1], m[2], 'time');
    });
    var price = Number(cfg.itemPrice);
    if (price > 0 && oldAmount < price && amount >= price) fireMilestone('item:' + price, '第一个' + cfg.itemName + '赚到了', '今天的努力已经能换成一份具体的快乐。', 'item');
  }
  function showNextToast() {
    clearTimeout(toastTimer);
    var item = toastQueue.shift();
    if (!item) { $('toast').classList.remove('show'); return; }
    $('toastTitle').textContent = item.title; $('toastBody').textContent = item.body;
    $('toast').classList.add('show');
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); setTimeout(showNextToast, 190); }, 3200);
  }
  $('toastClose').onclick = function () { clearTimeout(toastTimer); $('toast').classList.remove('show'); setTimeout(showNextToast, 190); };
  $('toast').addEventListener('mouseenter', function () { clearTimeout(toastTimer); });
  $('toast').addEventListener('mouseleave', function () { if ($('toast').classList.contains('show')) toastTimer = setTimeout(function () { $('toastClose').click(); }, 1600); });

  function playCoinSound() {
    if (!cfg.sound || Date.now() - lastCoinSound < 5000) return;
    lastCoinSound = Date.now();
    try { var ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain(); osc.frequency.value = 880; gain.gain.setValueAtTime(.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .1); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .11); } catch (_) {}
  }
  function monthRows() {
    var y = calCursor.getFullYear(), m = calCursor.getMonth();
    return history().filter(function (row) { var d = new Date(row.date + 'T12:00:00'); return d.getFullYear() === y && d.getMonth() === m; });
  }
  function renderHistory() {
    var now = new Date(), rows = history().filter(function (row) { var d = new Date(row.date + 'T12:00:00'); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    var earned = rows.reduce(function (sum, row) { return sum + (row.earned || 0); }, 0);
    var completed = rows.filter(function (row) { return row.completed; });
    $('monthEarned').textContent = money(earned); $('monthDays').textContent = rows.filter(function (r) { return r.progress > 0; }).length; $('averageDaily').textContent = money(rows.length ? earned / rows.length : 0); $('monthSlack').textContent = money(rows.reduce(function (s,r) { return s + (r.slackEarned || 0); },0));
    var filter = $('historyFilter').value;
    var display = history().filter(function (row) { return filter === 'all' || (filter === 'complete' ? row.completed : row.progress === 0); }).slice(0, 31);
    $('hisList').innerHTML = display.length ? display.map(function (row) {
      var d = new Date(row.date + 'T12:00:00'), rest = row.progress === 0;
      return '<div class="record-row ' + (rest ? 'rest' : '') + '"><div><b>' + fmtDate(d) + '</b><small>' + (row.completed ? '今日通关' : rest ? '休息' : '累计中') + ' · ' + pct(row.progress || 0) + '</small></div><div class="record-amount">' + (row.completed ? '<img src="assets/generated/salary-coin.png" alt="">' : '') + money(row.earned || 0) + '</div></div>';
    }).join('') : '<div class="cal-detail">还没有累计记录，工资罐开始增长后会自动出现在这里。</div>';
  }
  $('historyFilter').onchange = renderHistory;

  function renderCalendar() {
    var y = calCursor.getFullYear(), m = calCursor.getMonth(), days = new Date(y, m + 1, 0).getDate(), first = (new Date(y, m, 1).getDay() + 6) % 7;
    $('calTitle').textContent = y + '年' + (m + 1) + '月';
    var rows = monthRows(), map = {}; rows.forEach(function (r) { map[r.date] = r; });
    var html = '';
    for (var i = 0; i < first; i++) html += '<span></span>';
    for (var day = 1; day <= days; day++) {
      var d = new Date(y,m,day), key = keyFor(d), row = map[key], cls = [];
      if (d.getDay() === 0 || d.getDay() === 6) cls.push('weekend'); if (key === todayKey()) cls.push('today'); if (key === keyFor(selectedDate)) cls.push('selected'); if (row && row.completed && d <= new Date()) cls.push('complete');
      html += '<button class="' + cls.join(' ') + '" data-day="' + day + '">' + day + '</button>';
    }
    $('calGrid').innerHTML = html;
    var active = map[keyFor(selectedDate)], dow = ['周日','周一','周二','周三','周四','周五','周六'][selectedDate.getDay()];
    $('calDetail').innerHTML = '<b>' + fmtDate(selectedDate) + '</b> · ' + dow + '<br>' + (active ? '当日已赚：<b>' + money(active.earned) + '</b> · 工时 ' + pct(active.progress) : '暂无当日记录');
  }
  $('calGrid').onclick = function (e) { var button = e.target.closest('button[data-day]'); if (!button) return; selectedDate = new Date(calCursor.getFullYear(), calCursor.getMonth(), Number(button.dataset.day)); renderCalendar(); };
  $('calPrev').onclick = function () { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); };
  $('calNext').onclick = function () { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); };

  function applySettings() {
    $('monthly').value = cfg.monthly; $('shiftStart').value = cfg.shiftStart; $('shiftEnd').value = cfg.shiftEnd;
    $('days').value = cfg.system === 'free' ? cfg.freeDays : cfg.payDays;
    $('daysLabel').childNodes[0].nodeValue = cfg.system === 'free' ? '计薪天数（自由班制）' : '计薪天数（固定班制）';
    Array.prototype.forEach.call($('system').children, function (b) { b.classList.toggle('active', b.dataset.v === cfg.system); });
    $('shiftHours').value = ENGINE.shiftHours(cfg).toFixed(1) + ' 小时';
    $('animations').checked = cfg.animations !== false; $('reduceMotion').value = cfg.reduceMotion || 'system'; $('sound').checked = !!cfg.sound; $('autoSettlement').checked = cfg.autoSettlement !== false;
    ['itemName','itemPrice','mealName','mealPrice','movieName','moviePrice'].forEach(function (id) { $(id).value = cfg[id]; });
    JAR_COINS.keys.forEach(function (id, i) { $(id).value = cfg[id] == null ? JAR_COINS.defaults[i] : cfg[id]; });
    $('jarConfigError').hidden = true;
  }
  Array.prototype.forEach.call($('system').children, function (b) { b.onclick = function () { cfg.system = b.dataset.v; applySettings(); }; });
  $('settingsForm').onsubmit = function (e) {
    e.preventDefault();
    var payload = { monthly:Number($('monthly').value)||0, system:cfg.system, shiftStart:$('shiftStart').value||'09:00', shiftEnd:$('shiftEnd').value||'18:00', animations:$('animations').checked, reduceMotion:$('reduceMotion').value, sound:$('sound').checked, autoSettlement:$('autoSettlement').checked };
    JAR_COINS.keys.forEach(function (id) { payload[id] = Number($(id).value); });
    if (!JAR_COINS.denominations(payload)) { $('jarConfigError').hidden = false; $('jarGold').focus(); return; }
    $('jarConfigError').hidden = true;
    payload[cfg.system === 'free' ? 'freeDays' : 'payDays'] = Number($('days').value) || (cfg.system === 'free' ? 22 : 21.75);
    ['itemName','mealName','movieName'].forEach(function (id) { payload[id] = $(id).value.trim() || cfg[id]; });
    ['itemPrice','mealPrice','moviePrice'].forEach(function (id) { payload[id] = Number($(id).value) || cfg[id]; });
    cfg = Object.assign(cfg,payload); if (ipc) ipc.send('set-config',payload); renderAll(); fireMilestone('settings:' + Date.now(), '设置已保存', 'Win 和 macOS 会使用同一套本地配置。', 'time');
  };

  function renderSettingsSummary() {
    $('settingPlan').textContent = (cfg.system === 'free' ? '自由班制' : '固定班制') + ' · ' + cfg.shiftStart + '–' + cfg.shiftEnd;
    $('settingMonthly').textContent = '¥' + Number(cfg.monthly || 0).toLocaleString('zh-CN'); $('settingDays').textContent = ENGINE.payDays(cfg) + ' 天'; $('settingDaily').textContent = money(ENGINE.dailySalary(cfg));
  }

  function renderSkin() {
    var unlocked = Array.isArray(cfg.unlockedSkins) ? cfg.unlockedSkins : ['classic'];
    var current = unlocked.includes(cfg.skin) ? cfg.skin : 'classic';
    document.body.classList.toggle('skin-orbit', current === 'orbit');
    var equippedTheme = cfg.equipped && cfg.equipped.theme;
    document.body.classList.toggle('theme-office-night', equippedTheme === 'theme-office-night');
    document.body.classList.toggle('theme-simple', equippedTheme === 'theme-simple');
    Array.prototype.forEach.call($('skinOptions').querySelectorAll('button[data-skin]'), function (button) {
      var available = unlocked.includes(button.dataset.skin);
      button.disabled = !available;
      button.classList.toggle('active', current === button.dataset.skin);
      var marker = button.querySelector('em');
      marker.innerHTML = available ? (current === button.dataset.skin ? '使用中' : '可使用') : '<i class="ph ph-lock"></i>';
    });
    var count = Math.max(0, Number(cfg.slackCount) || 0);
    $('skinProgress').textContent = count >= 10 ? '星轨夜航已解锁 · 已摸鱼 ' + count + ' 次' : '再摸鱼 ' + Math.max(0, 10 - count) + ' 次解锁新皮肤';
  }
  $('skinOptions').onclick = function (event) {
    var button = event.target.closest('button[data-skin]');
    if (!button || button.disabled) return;
    cfg.skin = button.dataset.skin;
    if (ipc) ipc.send('set-config', { skin: cfg.skin });
    renderSkin();
  };

  function renderCompanion() {
    if (!$('dashboardCapybara')) return;
    var simple = cfg.equipped && cfg.equipped.theme === 'theme-simple';
    var companion = cfg.equipped && cfg.equipped.capybara;
    var pajamas = companion === 'capybara-pajamas';
    var defenseCompanion = companion && companion.indexOf('defense-') === 0 && SHOP[companion];
    document.querySelector('.mode-card').dataset.companion = defenseCompanion ? companion : '';
    var mode = cfg.mode || 'work';
    var file = pajamas && !simple ? 'capybara_pajamas_clean.png' : (mode === 'slack' ? 'capybara_slack.png' : ENGINE.timeProgress(cfg) >= 1 ? 'capybara_offwork.png' : 'capybara_work.png');
    var base = simple ? 'assets/skins/simple/batch-a-character/' : 'assets/v1a/character/';
    $('dashboardCapybara').src = defenseCompanion ? defenseCompanion.image : base + file;
    $('dashboardCapybara').alt = defenseCompanion ? defenseCompanion.name : mode === 'slack' ? '正在钓鱼摸鱼的卡皮巴拉' : ENGINE.timeProgress(cfg) >= 1 ? '准备下班的卡皮巴拉' : '正在工作的卡皮巴拉';
  }

  function renderHouse() {
    if (!$('fishCoins')) return;
    $('fishCoins').textContent = Math.max(0, Number(cfg.fishCoins) || 0);
    if ($('openJimao')) $('openJimao').textContent = (cfg.unlockedGames || []).includes('jimao') ? '进入几猫' : '解锁 · 100 摸鱼币';
    var stats = cfg.gameStats || {};
    $('muyuGames').textContent = stats.muyuGames || 0; $('muyuBest').textContent = stats.muyuBestScore || 0; $('muyuCombo').textContent = stats.muyuBestCombo || 0;
    var owned = Array.isArray(cfg.ownedItems) ? cfg.ownedItems : [];
    Array.prototype.forEach.call(document.querySelectorAll('.shop-item[data-item]'), function (card) {
      var id = card.dataset.item, item = SHOP[id], button = card.querySelector('.shop-action');
      var isOwned = owned.includes(id), equipped = cfg.equipped && cfg.equipped[item.type] === id;
      button.disabled = equipped;
      button.innerHTML = equipped ? '<i class="ph ph-check"></i> 使用中' : isOwned ? '装备' : '<span class="fish-coin">◎</span>' + item.price;
      card.classList.toggle('owned', isOwned); card.classList.toggle('equipped', equipped);
    });
    var collected = owned.filter(function (id) { return SHOP[id]; });
    var collectionSignature = JSON.stringify([collected, cfg.equipped || {}]);
    if ($('collectionList').dataset.signature !== collectionSignature) {
    $('collectionList').innerHTML = collected.length ? collected.map(function (id) {
      var item = SHOP[id], equipped = cfg.equipped && cfg.equipped[item.type] === id;
      return '<article class="collection-item"><img src="' + item.image + '" alt=""><div><b>' + item.name + '</b><small>' + (equipped ? '当前使用中' : '已收藏') + '</small></div><button data-equip="' + id + '" ' + (equipped ? 'disabled' : '') + '>' + (equipped ? '使用中' : '装备') + '</button></article>';
    }).join('') : '<div class="cal-detail">完成一局木鱼暴击，攒币兑换第一件装扮吧。</div>';
    $('collectionList').dataset.signature = collectionSignature;
    }
    renderCompanion();
  }
  if ($('houseTabs')) $('houseTabs').onclick = function (event) {
    var button = event.target.closest('button[data-house]'); if (!button) return;
    Array.prototype.forEach.call($('houseTabs').children, function (b) { b.classList.toggle('active', b === button); });
    Array.prototype.forEach.call(document.querySelectorAll('.house-pane'), function (pane) { pane.classList.toggle('active', pane.id === 'house-' + button.dataset.house); });
  };
  if ($('openJimao')) $('openJimao').onclick = async function () {
    if (!ipc) return;
    var owned = (cfg.unlockedGames || []).includes('jimao');
    if (!owned && !window.confirm('花费 100 摸鱼币解锁几猫？解锁后可以无限次免费游玩。')) return;
    $('openJimao').disabled = true;
    try {
      var result = await ipc.invoke('open-jimao');
      if (!result.ok) showToastDirect(result.code === 'INSUFFICIENT' ? '摸鱼币不足，需要 100 枚才能解锁。' : '解锁未保存，请重试。');
    } catch (_) { showToastDirect('解锁未完成，请重试。'); }
    finally { $('openJimao').disabled = false; }
  };
  if ($('openDefense')) $('openDefense').onclick = function () { if (ipc) ipc.send('open-defense'); };
  if ($('openMuyu')) $('openMuyu').onclick = function () { if (ipc) ipc.send('open-muyu'); };
  if ($('openOrbit')) $('openOrbit').onclick = function () { if (ipc) ipc.send('open-orbit'); };

  async function equipOrBuy(itemId) {
    if (!ipc || !SHOP[itemId]) return;
    var owned = Array.isArray(cfg.ownedItems) && cfg.ownedItems.includes(itemId);
    var result = await ipc.invoke(owned ? 'equip-item' : 'purchase-item', itemId);
    if (!result.ok) { showToastDirect(result.code === 'INSUFFICIENT' ? '摸鱼币不足，再敲一局木鱼吧。' : result.code === 'SAVE_FAILED' ? '本地保存失败，本次操作未生效。' : '操作没有完成，请稍后再试。'); return; }
    cfg.ownedItems = result.ownedItems; cfg.equipped = result.equipped; cfg.fishCoins = result.fishCoins;
    renderHouse(); renderSkin();
    if (!owned) openPurchase(itemId);
  }
  function showToastDirect(body) { toastQueue.push({ title: '摸鱼屋', body: body }); if (!$('toast').classList.contains('show')) showNextToast(); }
  document.querySelector('.shop-grid').onclick = function (event) { var card = event.target.closest('.shop-item[data-item]'); if (card && event.target.closest('button')) equipOrBuy(card.dataset.item); };
  $('collectionList').onclick = function (event) { var button = event.target.closest('button[data-equip]'); if (button) equipOrBuy(button.dataset.equip); };
  function openPurchase(id) { var item = SHOP[id]; $('purchaseImage').src = item.image; $('purchaseName').textContent = item.name; $('purchasePrice').textContent = item.price; $('purchaseBalance').textContent = '余额 ' + cfg.fishCoins + ' 摸鱼币'; $('purchaseModal').hidden = false; }
  function closePurchase() { $('purchaseModal').hidden = true; }
  $('purchaseClose').onclick = closePurchase; $('purchaseDone').onclick = closePurchase;

  function openSettlement() {
    settlementOpen = true; var stats = todayStats();
    $('settlementDate').textContent = workDateKey().slice(5).replace('-', '月') + '日 · 今日通关'; $('settlementAmount').textContent = money(ENGINE.earnedToday(cfg)); $('settlementHours').textContent = ENGINE.fmtDuration(ENGINE.elapsedInShift(cfg)); $('settlementProgress').textContent = pct(ENGINE.timeProgress(cfg)); $('settlementSlack').textContent = ENGINE.fmtDuration(stats.slackSeconds); $('settlementItem').textContent = ENGINE.itemText(ENGINE.earnedToday(cfg),cfg.itemName,Number(cfg.itemPrice));
    $('settlementModal').hidden = false; document.body.style.overflow = 'hidden'; setTimeout(function () { $('settlementClose').focus(); },20);
  }
  function closeSettlement() { settlementOpen = false; cfg.settlementSeenDate = workDateKey(); $('settlementModal').hidden = true; document.body.style.overflow = ''; if (ipc) ipc.send('settlement-seen'); }
  $('settlementClose').onclick = closeSettlement; $('settlementDone').onclick = closeSettlement;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && settlementOpen) closeSettlement(); });

  $('toFloat').onclick = function () { if (ipc) ipc.send('to-float'); };
  $('quit').onclick = function () { if (ipc) ipc.send('confirm-quit'); };
  [['windowMinimize','minimize'],['windowMaximize','maximize'],['windowClose','close']].forEach(function (pair) {
    $(pair[0]).onclick = function () { if (ipc) ipc.send('main-window-action', pair[1]); };
  });

  function renderAll() {
    document.body.classList.toggle('reduce-motion', reducedMotion() || cfg.animations === false);
    setMode(cfg.mode || 'work', false); setViewMode(cfg.viewMode || 'jar', false);
    renderDashboard(); renderHistory(); renderCalendar(); renderSettingsSummary(); renderSkin(); renderHouse();
    firstRender = false;
  }

  if (ipc) {
    ipc.on('config', function (_event, next) {
      cfg = Object.assign({}, ENGINE.DEFAULTS, cfg, next || {});
      if (firstConfig || !document.activeElement || !$('settingsForm').contains(document.activeElement)) applySettings();
      firstConfig = false; renderAll();
    });
    ipc.send('get-config');
  } else { applySettings(); renderAll(); }
  setInterval(renderAll, 1000);
})();
