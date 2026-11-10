/*
 * 窝囊费结算 · 计算引擎
 * 同时支持浏览器(直接打开 html)与 Electron 渲染进程。
 * 通过 UMD 暴露为 window.ENGINE / module.exports。
 *
 * 核心模型：
 *   - 班次起止时间(shiftStart/shiftEnd) 定义“上班窗口”，支持跨夜（结束<开始）。
 *   - 工时进度 = 当前时间在窗口内的占比（按自然时间流逝）。
 *   - 每秒金额 = 月薪 / 计薪天数 / 班次秒数 / 3600。
 *     这样进度到 100% 时，今日已赚恰好 = 日薪，进度与金额完全自洽。
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    monthly: 5000,      // 初始月薪
    system: 'fixed',    // 'fixed' 固定班制(21.75天) | 'free' 自由班制(自定义天数)
    payDays: 21.75,     // 固定班制计薪天数
    freeDays: 22,       // 自由班制计薪天数
    shiftStart: '09:00',// 班次开始
    shiftEnd: '18:00',  // 班次结束（可小于开始，表示跨夜）
    mode: 'work',
    viewMode: 'jar',
    animations: true,
    reduceMotion: 'system',
    sound: false,
    milestoneAmount: true,
    milestoneTime: true,
    milestoneItem: true,
    autoSettlement: true,
    itemName: '奶茶',
    itemPrice: 20,
    mealName: '工作餐',
    mealPrice: 30,
    movieName: '电影票',
    moviePrice: 45,
    slackCount: 0,
    unlockedSkins: ['classic'],
    skin: 'classic'
  };

  function parseTime(str) {
    var parts = String(str || '0:0').split(':');
    var h = parseFloat(parts[0]) || 0;
    var m = parseFloat(parts[1]) || 0;
    return h * 3600 + m * 60;
  }

  function nowSec(at) {
    var d = at || new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  function payDays(cfg) {
    return cfg.system === 'free' ? (cfg.freeDays || 22) : (cfg.payDays || 21.75);
  }

  // 班次总秒数（支持跨夜）：跨夜时 = 24h - 开始 + 结束
  function shiftSeconds(cfg) {
    var s = parseTime(cfg.shiftStart);
    var e = parseTime(cfg.shiftEnd);
    if (e === s) return 0;
    if (e > s) return e - s;
    return (24 * 3600 - s) + e; // 跨夜
  }

  // 当前在班次窗口内已过去的秒数（支持跨夜，封顶于班次总时长）
  function elapsedInShift(cfg, at) {
    var s = parseTime(cfg.shiftStart);
    var e = parseTime(cfg.shiftEnd);
    var total = shiftSeconds(cfg);
    if (total <= 0) return 0;
    var now = nowSec(at);
    var passed;
    if (e > s) {
      passed = now - s;                       // 当天窗口 [s,e)
    } else {
      // 跨夜窗口 [s,24) ∪ [0,e)；e..s 之间为非班次时段
      if (now >= s) passed = now - s;
      else if (now <= e) passed = (24 * 3600 - s) + now;
      else passed = -1;                       // 处于非班次时段
    }
    if (passed < 0) passed = 0;              // 还没开始 / 非班次
    if (passed > total) passed = total;      // 已下班
    return passed;
  }

  // 从本班次开始起的自然流逝秒数，不在标准工时结束处封顶。
  // 用于展示加班时长；工资主口径仍由 elapsedInShift 封顶，避免擅自推断加班费。
  function elapsedSinceShiftStart(cfg, at) {
    var s = parseTime(cfg.shiftStart);
    var e = parseTime(cfg.shiftEnd);
    var total = shiftSeconds(cfg);
    if (total <= 0) return 0;
    var now = nowSec(at);
    if (e > s) return now < s ? 0 : now - s;
    return now >= s ? now - s : (24 * 3600 - s) + now;
  }

  function overtimeSeconds(cfg, at) {
    return Math.max(0, elapsedSinceShiftStart(cfg, at) - shiftSeconds(cfg));
  }

  // 每秒金额 = 月薪 / 计薪天数 / 班次秒数
  // （日薪按班次秒数均摊到每秒；进度到 100% 时今日已赚恰好 = 日薪）
  function perSecond(cfg) {
    var secs = shiftSeconds(cfg);
    if (secs <= 0) return 0;
    var perDay = cfg.monthly / (payDays(cfg) || 1);
    return perDay / secs;
  }

  // 每分钟金额 = 每秒金额 × 60（通用换算工具；悬浮窗现已统一按秒展示，暂未调用）
  function perMinute(cfg) {
    return perSecond(cfg) * 60;
  }

  // 日薪 = 月薪 / 计薪天数（摸鱼模式颁奖时作为比例分母）
  function dailySalary(cfg) {
    return cfg.monthly / payDays(cfg);
  }

  // 摸鱼称号：按「摸鱼金额 ÷ 日薪」比例分级
  //   <1%      不颁奖（没怎么摸鱼，不发称号）
  //   1%~5%    摸鱼萌新
  //   5%~10%   摸鱼高手
  //   10%~20%  摸鱼模范
  //   ≥20%     摸鱼大王
  function slackTier(ratio) {
    if (ratio < 0.01) return null;       // 摸鱼金额占日薪不足 1%，不颁奖
    if (ratio < 0.05) return '摸鱼萌新';
    if (ratio < 0.10) return '摸鱼高手';
    if (ratio < 0.20) return '摸鱼模范';
    return '摸鱼大王';
  }

  // 工时进度：按自然时间流逝，在班次窗口内线性推进（支持跨夜）
  function timeProgress(cfg, at) {
    var total = shiftSeconds(cfg);
    if (total <= 0) return 0;
    return elapsedInShift(cfg, at) / total;
  }


  function rawTimeProgress(cfg, at) {
    var total = shiftSeconds(cfg);
    return total > 0 ? elapsedSinceShiftStart(cfg, at) / total : 0;
  }

  // 今日已赚 = 每秒金额 × 班次内已过秒数
  function earnedToday(cfg, at) {
    return perSecond(cfg) * elapsedInShift(cfg, at);
  }


  function overtimeReference(cfg, at) {
    return perSecond(cfg) * overtimeSeconds(cfg, at);
  }

  function remainingAmount(cfg, at) {
    return Math.max(0, dailySalary(cfg) - earnedToday(cfg, at));
  }

  function itemQuantity(amount, price) {
    return price > 0 ? Math.max(0, amount) / price : 0;
  }

  function itemText(amount, name, price) {
    var quantity = itemQuantity(amount, price);
    var shown = Math.abs(quantity - Math.round(quantity)) < 0.05
      ? String(Math.round(quantity)) : quantity.toFixed(1);
    return shown + ' ' + (name || '件小确幸');
  }

  function remainingMinutesForItem(cfg, amount, price) {
    var ps = perSecond(cfg);
    if (ps <= 0 || price <= 0) return null;
    var mod = Math.max(0, amount) % price;
    var remaining = mod === 0 && amount > 0 ? 0 : price - mod;
    return Math.ceil(remaining / ps / 60);
  }

  function fmtDuration(seconds) {
    var s = Math.max(0, Math.floor(Number(seconds) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h) return h + '小时' + (m ? m + '分钟' : '');
    return m + '分钟';
  }

  function fmt(n) {
    return '¥' + (Number(n) || 0).toFixed(2);
  }
  function fmt4(n) {
    return '¥' + (Number(n) || 0).toFixed(4);
  }
  function pct(n) {
    return Math.round((Number(n) || 0) * 100) + '%';
  }
  // 班次时长（小时，用于设置页展示）
  function shiftHours(cfg) {
    return (shiftSeconds(cfg) / 3600);
  }

  var ENGINE = {
    DEFAULTS: DEFAULTS,
    parseTime: parseTime,
    nowSec: nowSec,
    payDays: payDays,
    shiftSeconds: shiftSeconds,
    shiftHours: shiftHours,
    elapsedInShift: elapsedInShift,
    elapsedSinceShiftStart: elapsedSinceShiftStart,
    overtimeSeconds: overtimeSeconds,
    perSecond: perSecond,
    perMinute: perMinute,
    dailySalary: dailySalary,
    slackTier: slackTier,
    timeProgress: timeProgress,
    rawTimeProgress: rawTimeProgress,
    earnedToday: earnedToday,
    overtimeReference: overtimeReference,
    remainingAmount: remainingAmount,
    itemQuantity: itemQuantity,
    itemText: itemText,
    remainingMinutesForItem: remainingMinutesForItem,
    fmtDuration: fmtDuration,
    fmt: fmt,
    fmt4: fmt4,
    pct: pct
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ENGINE;
  }
  global.ENGINE = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
