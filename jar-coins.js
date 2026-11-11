/* 金额以分拆分为可配置面额；图形只是可视化，不参与计薪。 */
(function (global) {
  'use strict';
  var defaults = [10, 1, 0.1, 0.01];
  var names = ['金币', '银币', '金豆', '银豆'];
  var keys = ['jarGold', 'jarSilver', 'jarGoldBean', 'jarSilverBean'];
  function denominations(cfg) {
    var values = keys.map(function (key, i) { return cfg && cfg[key] != null ? Number(cfg[key]) : defaults[i]; });
    var cents = values.map(function (v) { return Math.round(v * 100); });
    if (values.some(function (v, i) { return !Number.isFinite(v) || v <= 0 || v > 1000000 || Math.abs(v * 100 - cents[i]) > 1e-7; }) || cents.some(function (v, i) { return i && v >= cents[i - 1]; })) return null;
    return cents;
  }
  function breakdown(amount, cfg) {
    var denoms = denominations(cfg) || denominations({});
    var total = Number.isFinite(Number(amount)) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(Number(Number(amount).toFixed(2)) * 100))) : 0;
    var left = total;
    var counts = denoms.map(function (value) { var n = Math.floor(left / value); left -= n * value; return n; });
    return { counts: counts, remainder: left, totalCount: counts.reduce(function (a, b) { return a + b; }, 0) };
  }
  function layout(value, limit) {
    var pieces = [], heights = [0,0,0,0,0,0,0,0], max = limit || 96;
    value.counts.forEach(function (count, kind) {
      for (var i = 0; i < count && pieces.length < max; i++) {
        var index = pieces.length, column = index % 8;
        pieces.push({key:kind + ':' + i, kind:kind, column:column,
          left:12 + column * 9.5 + ((index * 7) % 5 - 2) * .45,
          bottom:8 + heights[column], rotation:((index * 37) % 49) - 24});
        heights[column] += kind >= 2 ? 2.4 : 5.7;
      }
    });
    return pieces;
  }
  function render(element, amount, cfg, limit) {
    var value = breakdown(amount, cfg), max = limit || 96;
    var signature = JSON.stringify([value.counts, max]);
    if (element.dataset.coinSignature !== signature) {
      element.dataset.coinSignature = signature;
      var old = new Map(Array.from(element.children, function (node) { return [node.dataset.pieceKey, node]; }));
      var fragment = document.createDocumentFragment();
      layout(value, max).forEach(function (piece) {
          var key = piece.key, kind = piece.kind, coin = old.get(key);
          if (!coin) {
            coin = document.createElement('img'); coin.dataset.pieceKey = key;
            coin.src = kind >= 2 ? 'assets/generated/salary-gold-bean.png' : 'assets/generated/salary-coin.png'; coin.alt = '';
            coin.className = 'jar-piece jar-piece-' + kind;
          }
          coin.style.left = piece.left + '%';
          coin.style.bottom = piece.bottom + '%';
          coin.style.transform = 'rotate(' + piece.rotation + 'deg)';
          fragment.appendChild(coin);
      });
      element.replaceChildren(fragment);
    }
    return value;
  }
  // A shared world in jar coordinates keeps physics independent of window size.
  function createPhysicsWorld(Matter) {
    var Engine = Matter.Engine, Bodies = Matter.Bodies, Composite = Matter.Composite;
    var engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1;
    var wall = { isStatic: true, friction: .55, restitution: .08 };
    Composite.add(engine.world, [Bodies.rectangle(140, 342, 230, 12, wall),
      Bodies.rectangle(23, 200, 12, 285, wall), Bodies.rectangle(257, 200, 12, 285, wall)]);
    function add(piece, falling) {
      var radius = piece.kind >= 2 ? 6 : 10.5;
      var x = falling ? 110 + (piece.column % 4) * 17 : 280 * piece.left / 100 + radius;
      var y = falling ? 48 : 367 * (1 - piece.bottom / 100) - radius;
      var body = Bodies.circle(x, y, radius, { restitution: .18, friction: .45,
        frictionStatic: .6, frictionAir: .015, sleepThreshold: 55, density: .002 });
      body.pieceKey = piece.key; body.kind = piece.kind; body.fresh = falling;
      Composite.add(engine.world, body);
      return body;
    }
    return { engine: engine, add: add };
  }
  function createPresenter(layer, stream, stage, limit, onImpact) {
    var Matter = global.Matter || (typeof require === 'function' ? require('matter-js') : null), world = null, entries = new Map(), frame = 0, lastTime = 0;
    var previousAmount = null, previousDenoms = '', running = false;
    function stop() { if (frame) global.cancelAnimationFrame(frame); frame = 0; running = false; lastTime = 0; }
    function reset(snapshot) {
      stop(); world = null; entries.clear();
      render(layer, snapshot.amount, snapshot.cfg, limit);
      stream.replaceChildren();
    }
    function paint() {
      entries.forEach(function (entry) {
        var body = entry.body, el = entry.node;
        el.style.left = (body.position.x / 280 * 100) + '%';
        el.style.top = (body.position.y / 367 * 100) + '%';
        el.style.bottom = 'auto';
        el.style.transform = 'translate(-50%, -50%) rotate(' + body.angle + 'rad)';
      });
    }
    function tick(time) {
      if (!running) return;
      var delta = lastTime ? Math.min(33, Math.max(8, time - lastTime)) : 16.667;
      lastTime = time;
      Matter.Engine.update(world.engine, delta);
      paint();
      var awake = Array.from(entries.values()).some(function (entry) { return !entry.body.isSleeping; });
      if (awake) frame = global.requestAnimationFrame(tick);
      else stop();
    }
    function start() { if (!running) { running = true; lastTime = 0; frame = global.requestAnimationFrame(tick); } }
    function initialise(snapshot) {
      world = createPhysicsWorld(Matter); entries.clear();
      layer.replaceChildren(); layer.dataset.coinSignature = '';
      Matter.Events.on(world.engine, 'collisionStart', function (event) {
        var impact = false;
        event.pairs.forEach(function (pair) {
          [pair.bodyA, pair.bodyB].forEach(function (body) {
            if (body.fresh) { body.fresh = false; impact = true; }
          });
        });
        if (impact && onImpact) onImpact();
      });
      layout(breakdown(snapshot.amount, snapshot.cfg), limit).forEach(function (piece) { add(piece, false); });
      paint();
    }
    function add(piece, falling) {
      var node = document.createElement('img');
      node.alt = ''; node.dataset.pieceKey = piece.key;
      node.className = 'jar-piece jar-piece-' + piece.kind;
      node.src = piece.kind >= 2 ? 'assets/generated/salary-gold-bean.png' : 'assets/generated/salary-coin.png';
      layer.appendChild(node);
      entries.set(piece.key, { node: node, body: world.add(piece, falling) });
    }
    return {
      update: function (amount, cfg, animate) {
        var snapshot = { amount: amount, cfg: Object.assign({}, cfg) };
        var denoms = JSON.stringify(denominations(cfg));
        if (!animate || !Matter || !global.requestAnimationFrame) {
          reset(snapshot);
        } else if (!world || denoms !== previousDenoms || (previousAmount != null && amount < previousAmount)) {
          stop(); initialise(snapshot); start();
        } else {
          var pieces = layout(breakdown(amount, cfg), limit);
          var wanted = new Set(pieces.map(function (piece) { return piece.key; }));
          // Finish a fall before a denomination exchange removes that body.
          var fallingWouldDisappear = Array.from(entries.values()).some(function (entry) {
            return entry.body.fresh && !wanted.has(entry.body.pieceKey);
          });
          if (fallingWouldDisappear) { previousAmount = amount; previousDenoms = denoms; return breakdown(amount, cfg); }
          var removed = false;
          entries.forEach(function (entry, key) {
            if (!wanted.has(key)) { Matter.Composite.remove(world.engine.world, entry.body); entry.node.remove(); entries.delete(key); removed = true; }
          });
          var added = pieces.filter(function (piece) { return !entries.has(piece.key); });
          if (added.length) {
            entries.forEach(function (entry) { Matter.Sleeping.set(entry.body, false); });
            added.forEach(function (piece) { add(piece, true); });
            paint(); start();
          } else if (removed && entries.size) {
            entries.forEach(function (entry) { Matter.Sleeping.set(entry.body, false); });
            start();
          }
        }
        previousAmount = amount; previousDenoms = denoms;
        return breakdown(amount, cfg);
      }
    };
  }
  var api = { keys: keys, names: names, defaults: defaults, denominations: denominations, breakdown: breakdown, layout: layout, render: render, createPhysicsWorld: createPhysicsWorld, createPresenter: createPresenter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.JAR_COINS = api;
})(typeof window !== 'undefined' ? window : globalThis);
