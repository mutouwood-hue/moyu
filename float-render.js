/* 悬浮窗：金额与主看板同口径，视觉落币每 5 秒聚合一次。 */
(function () {
  'use strict';
  var ipc = null;
  try { ipc = require('electron').ipcRenderer; } catch (_) {}
  var cfg = Object.assign({}, ENGINE.DEFAULTS, { dailyStats: {}, firedMilestones: [] });
  var hidden = false;
  var $ = function (id) { return document.getElementById(id); };
  var jarPresenter = JAR_COINS.createPresenter($('miniFill'), $('coinStream'), $('miniJar'), 24);

  function reducedMotion() { return cfg.reduceMotion === 'on' || (cfg.reduceMotion === 'system' && cfg.systemReduceMotion); }
  function updateMode() {
    Array.prototype.forEach.call(document.querySelectorAll('.modes button'), function (button) { button.classList.toggle('active', button.dataset.mode === (cfg.mode || 'work')); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.modes button'), function (button) {
    button.onclick = function () { cfg.mode = button.dataset.mode; updateMode(); if (ipc) ipc.send('set-mode', cfg.mode); render(); };
  });

  function render() {
    var earned = ENGINE.earnedToday(cfg), progress = ENGINE.timeProgress(cfg), p = Math.max(0, Math.min(1, progress));
    $('ps').textContent = ENGINE.fmt4(ENGINE.perSecond(cfg));
    $('earned').textContent = hidden ? '¥ • • •' : ENGINE.fmt(earned);
    $('fill').style.width = (p * 100) + '%'; $('pct').textContent = Math.round(progress * 100) + '%';
    jarPresenter.update(earned, cfg, !hidden && !document.hidden && cfg.animations !== false && !reducedMotion()); $('miniFill').style.visibility = hidden ? 'hidden' : ''; $('coinStream').style.visibility = hidden ? 'hidden' : '';
    var stats = cfg.dailyStats || {};
    $('slackCopy').textContent = cfg.mode === 'slack' ? '摸鱼 ' + ENGINE.fmt(stats.slackEarned || 0) : '';
    $('statusCopy').textContent = progress >= 1 ? '今日通关 · 双击查看结算' : progress >= .9 ? '胜利就在右下角' : '拖拽移动 · 双击展开看板';
    document.body.classList.toggle('reduce-motion', reducedMotion() || cfg.animations === false);
    document.body.classList.toggle('skin-orbit', cfg.skin === 'orbit');
    document.body.classList.toggle('theme-office-night', cfg.equipped && cfg.equipped.theme === 'theme-office-night');
    document.body.classList.toggle('theme-simple', cfg.equipped && cfg.equipped.theme === 'theme-simple');
    document.body.classList.toggle('floating-pixel', cfg.equipped && cfg.equipped.floating === 'floating-pixel');
    updateMode();
  }

  function showToast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout($('toast')._t); $('toast')._t = setTimeout(function () { $('toast').classList.remove('show'); }, 3200); }

  $('eye').onclick = function () { hidden = !hidden; $('eye').innerHTML = '<i class="ph ph-' + (hidden ? 'eye-slash' : 'eye') + '"></i>'; $('eye').setAttribute('aria-label', hidden ? '显示金额' : '隐藏金额'); render(); };
  $('expand').onclick = function () { if (ipc) ipc.send('expand'); };
  $('close').onclick = function () { if (ipc) ipc.send('confirm-quit'); };
  $('float').ondblclick = function (event) { if (!event.target.closest('button') && ipc) ipc.send('expand'); };

  if (ipc) {
    ipc.on('config', function (_event, next) { var oldMode = cfg.mode; cfg = Object.assign({}, ENGINE.DEFAULTS, cfg, next || {}); if (oldMode && oldMode !== cfg.mode) showToast(cfg.mode === 'slack' ? '摸鱼开始：公司今日赞助你休息' : '已切换为' + (cfg.mode === 'work' ? '工作' : '默认') + '模式'); render(); });
    ipc.send('float-ready');
  }
  render(); setInterval(render, 1000);
})();
