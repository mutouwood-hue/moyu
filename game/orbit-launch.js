import {
  LEVELS,
  WORLD,
  aimFromPoint,
  advanceFlightStep,
  calculateResult,
  parseProgress,
  recordLevelResult,
  simulateTrajectory,
  velocityFromAim,
} from './orbit-launch-core.js';

const STORAGE_KEY = 'orbit-launch:v1';
const STEP_MS = 1000 / 60;
const MAX_FRAME_STEPS = 5;
const PREVIEW_STEPS = 480;
const Matter = window.Matter;

const $ = (id) => document.getElementById(id);
const elements = {
  canvas: $('gameCanvas'),
  shell: $('gameShell'),
  stage: $('gameStage'),
  levelPicker: $('levelPicker'),
  levelName: $('levelName'),
  levelCode: $('levelCode'),
  levelCounter: $('levelCounter'),
  chapterName: $('chapterName'),
  mechanicName: $('mechanicName'),
  attemptCounter: $('attemptCounter'),
  bestStars: $('bestStars'),
  angleValue: $('angleValue'),
  powerValue: $('powerValue'),
  statusText: $('statusText'),
  liveStatus: $('liveStatus'),
  launchButton: $('launchButton'),
  resetButton: $('resetButton'),
  pauseButton: $('pauseButton'),
  soundButton: $('soundButton'),
  fullscreenButton: $('fullscreenButton'),
  resultOverlay: $('resultOverlay'),
  resultTitle: $('resultTitle'),
  resultStars: $('resultStars'),
  resultScore: $('resultScore'),
  resultTime: $('resultTime'),
  resultPower: $('resultPower'),
  replayButton: $('replayButton'),
  nextButton: $('nextButton'),
  dependencyNote: $('dependencyNote'),
  angleSlider: $('angleSlider'),
  powerSlider: $('powerSlider'),
};

const context = elements.canvas.getContext('2d');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  phase: 'boot',
  levelIndex: 0,
  attempts: 1,
  aim: { ...LEVELS[0].defaultAim },
  trajectory: null,
  engine: null,
  craft: null,
  fallbackCraft: null,
  flightSteps: 0,
  launchSpeed: 0,
  trail: [],
  stars: [],
  particles: [],
  pointerId: null,
  accumulator: 0,
  lastFrame: performance.now(),
  resetTimer: null,
  pausedFrom: null,
  autoPaused: false,
  audioContext: null,
  progress: loadProgress(),
  reducedMotion: reducedMotionQuery.matches,
  wormholeCooldown: 0,
};

function loadProgress() {
  try {
    return parseProgress(localStorage.getItem(STORAGE_KEY), LEVELS.length);
  } catch {
    return parseProgress(null, LEVELS.length);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  } catch {
    // Storage can be unavailable in private browsing; gameplay remains usable.
  }
}

function level() {
  return LEVELS[state.levelIndex];
}

function createPhysicsWorld() {
  const current = level();

  if (!Matter) {
    state.fallbackCraft = {
      position: { ...current.start },
      velocity: { x: 0, y: 0 },
      angle: 0,
    };
    state.engine = null;
    state.craft = null;
    elements.dependencyNote.hidden = false;
    return;
  }

  const { Engine, Bodies, Composite } = Matter;
  state.engine = Engine.create({ enableSleeping: false });
  state.engine.gravity.x = 0;
  state.engine.gravity.y = 0;
  state.engine.gravity.scale = 0;

  state.craft = Bodies.circle(current.start.x, current.start.y, WORLD.shipRadius, {
    label: 'craft',
    friction: 0,
    frictionAir: 0,
    restitution: 0,
    inertia: Infinity,
    collisionFilter: { group: 0, category: 0x0001, mask: 0 },
  });

  const sensors = [
    ...current.planets.map((planet) => Bodies.circle(planet.x, planet.y, planet.radius, {
      isStatic: true,
      isSensor: true,
      label: 'planet',
    })),
    ...current.hazards.map((hazard) => Bodies.circle(hazard.x, hazard.y, hazard.radius, {
      isStatic: true,
      isSensor: true,
      label: 'hazard',
    })),
    Bodies.circle(current.target.x, current.target.y, current.target.radius, {
      isStatic: true,
      isSensor: true,
      label: 'target',
    }),
  ];

  Composite.add(state.engine.world, [state.craft, ...sensors]);
  state.fallbackCraft = null;
  elements.dependencyNote.hidden = true;
}

function getCraftPosition() {
  return state.craft ? state.craft.position : state.fallbackCraft.position;
}

function getCraftVelocity() {
  return state.craft ? state.craft.velocity : state.fallbackCraft.velocity;
}

function setCraftVelocity(velocity) {
  if (state.craft) {
    Matter.Body.setVelocity(state.craft, velocity);
    return;
  }
  state.fallbackCraft.velocity = { ...velocity };
}

function setCraftPosition(position) {
  if (state.craft) {
    Matter.Body.setPosition(state.craft, position);
    return;
  }
  state.fallbackCraft.position = { ...position };
}

function updatePrediction() {
  const current = level();
  const launch = velocityFromAim(state.aim.angle, state.aim.power);
  state.trajectory = simulateTrajectory({
    position: current.start,
    velocity: launch,
    attractors: current.planets,
    fields: current.fields,
    wormholes: current.wormholes,
    obstacles: [...current.planets, ...current.hazards],
    target: current.target,
    bounds: { width: WORLD.width, height: WORLD.height, margin: WORLD.boundsMargin },
    shipRadius: WORLD.shipRadius,
    maxSteps: PREVIEW_STEPS,
    sampleEvery: WORLD.sampleEvery,
  });
  updateHud();
}

function setStatus(message, announce = false) {
  elements.statusText.textContent = message;
  if (announce) {
    elements.liveStatus.textContent = '';
    window.setTimeout(() => {
      elements.liveStatus.textContent = message;
    }, 20);
  }
}

function renderLevelPicker() {
  elements.levelPicker.replaceChildren();

  LEVELS.forEach((entry, index) => {
    const button = document.createElement('button');
    const record = state.progress.levels[entry.id];
    const locked = entry.id > state.progress.unlocked;
    button.type = 'button';
    button.className = 'level-button';
    button.textContent = String(entry.id);
    button.disabled = locked;
    button.setAttribute('aria-label', locked
      ? `第 ${entry.id} 轨，尚未解锁`
      : `第 ${entry.id} 轨，${entry.name}，最佳 ${record.stars} 星`);
    button.title = locked ? '尚未解锁' : `${entry.name} · ${record.stars || 0} 星`;
    button.dataset.stars = String(record.stars || 0);
    if (index === state.levelIndex) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'step');
    }
    button.addEventListener('click', () => selectLevel(index));
    elements.levelPicker.append(button);
  });

  const active = elements.levelPicker.querySelector('.active');
  if (active) requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest', inline: 'center' }));
}

function iconMarkup(name, fallback) {
  return `<i data-lucide="${name}" aria-hidden="true">${fallback}</i>`;
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 2.1 } });
}

function updateControlIcons() {
  const paused = state.phase === 'paused';
  elements.pauseButton.innerHTML = iconMarkup(paused ? 'play' : 'pause', paused ? '▶' : 'Ⅱ');
  elements.pauseButton.setAttribute('aria-label', paused ? '继续飞行' : '暂停飞行');
  elements.pauseButton.title = paused ? '继续飞行' : '暂停飞行';

  const soundOn = state.progress.sound;
  elements.soundButton.innerHTML = iconMarkup(soundOn ? 'volume-2' : 'volume-x', soundOn ? '声' : '静');
  elements.soundButton.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
  elements.soundButton.title = soundOn ? '关闭音效' : '开启音效';
  elements.soundButton.setAttribute('aria-pressed', String(soundOn));

  const fullscreen = document.fullscreenElement === elements.shell || elements.shell.classList.contains('focus-mode');
  elements.fullscreenButton.innerHTML = iconMarkup(fullscreen ? 'minimize-2' : 'maximize-2', fullscreen ? '小' : '全');
  elements.fullscreenButton.setAttribute('aria-label', fullscreen ? '退出全屏' : '进入全屏');
  elements.fullscreenButton.title = fullscreen ? '退出全屏' : '进入全屏';
  refreshIcons();
}

function updateHud() {
  const current = level();
  const record = state.progress.levels[current.id];
  const launch = velocityFromAim(state.aim.angle, state.aim.power);
  const signedAngle = Math.round((((state.aim.angle + 180) % 360) + 360) % 360 - 180);

  elements.levelName.textContent = current.name;
  elements.levelCode.textContent = current.code;
  elements.levelCounter.textContent = `轨道 ${current.id} / ${LEVELS.length}`;
  elements.chapterName.textContent = current.chapter;
  elements.mechanicName.textContent = current.mechanic;
  elements.attemptCounter.textContent = `尝试 ${String(state.attempts).padStart(2, '0')}`;
  elements.bestStars.textContent = record.stars ? '★'.repeat(record.stars) : '尚无记录';
  elements.bestStars.setAttribute('aria-label', `最佳 ${record.stars} 星`);
  elements.angleValue.textContent = `${signedAngle}°`;
  elements.powerValue.textContent = `${Math.round(state.aim.power * 100)}%`;
  elements.angleSlider.value = String(signedAngle);
  elements.powerSlider.value = String(Math.round(state.aim.power * 100));
  elements.launchButton.disabled = !['ready', 'aiming'].includes(state.phase) || state.aim.power < 0.04;
  elements.resetButton.disabled = state.phase === 'boot';
  elements.pauseButton.disabled = !['flying', 'paused'].includes(state.phase);
  elements.canvas.style.cursor = ['ready', 'aiming'].includes(state.phase) ? 'crosshair' : 'default';

  if (state.phase === 'ready' || state.phase === 'aiming') {
    const predictionLabel = {
      goal: '航线可接入',
      crashed: '航线受阻',
      'out-of-bounds': '航线偏离',
      timeout: '航线未闭合',
    }[state.trajectory?.status] || '准备发射';
    setStatus(predictionLabel);
  }

  elements.launchButton.title = `发射速度 ${launch.speed.toFixed(1)}`;
  updateControlIcons();
}

function clearResetTimer() {
  if (state.resetTimer !== null) {
    window.clearTimeout(state.resetTimer);
    state.resetTimer = null;
  }
}

function resetLevel(options = {}) {
  clearResetTimer();
  const current = level();
  if (options.incrementAttempt) state.attempts += 1;
  if (!options.preserveAim) state.aim = { ...current.defaultAim };
  state.phase = 'ready';
  state.flightSteps = 0;
  state.launchSpeed = 0;
  state.trail = [];
  state.particles = [];
  state.pointerId = null;
  state.accumulator = 0;
  state.pausedFrom = null;
  state.autoPaused = false;
  state.wormholeCooldown = 0;
  state.result = null;
  elements.resultOverlay.hidden = true;
  createPhysicsWorld();
  updatePrediction();
}

function selectLevel(index) {
  if (index < 0 || index >= LEVELS.length || index + 1 > state.progress.unlocked) return;
  state.levelIndex = index;
  state.attempts = 1;
  state.aim = { ...level().defaultAim };
  generateStarfield();
  resetLevel();
  renderLevelPicker();
}

function launch() {
  if (!['ready', 'aiming'].includes(state.phase) || state.aim.power < 0.04) return;
  const velocity = velocityFromAim(state.aim.angle, state.aim.power);
  setCraftVelocity(velocity);
  state.launchSpeed = velocity.speed;
  state.flightSteps = 0;
  state.trail = [{ ...getCraftPosition(), alpha: 1 }];
  state.phase = 'flying';
  state.pointerId = null;
  state.accumulator = 0;
  state.lastFrame = performance.now();
  setStatus('飞行中', true);
  playSound('launch');
  updateHud();
}

function stepPhysics() {
  if (state.phase !== 'flying') return;
  const current = level();
  const previous = { ...getCraftPosition() };
  const velocity = getCraftVelocity();
  const step = advanceFlightStep({
    position: previous,
    velocity,
    attractors: current.planets,
    fields: current.fields,
    wormholes: current.wormholes,
    wormholeCooldown: state.wormholeCooldown,
    obstacles: [...current.planets, ...current.hazards],
    target: current.target,
    shipRadius: WORLD.shipRadius,
    maxAcceleration: WORLD.maxAcceleration,
  });
  const nextVelocity = step.velocity;

  if (![nextVelocity.x, nextVelocity.y].every(Number.isFinite)) {
    finishFailure('导航失效', 'invalid');
    return;
  }

  setCraftVelocity(nextVelocity);
  setCraftPosition(step.position);
  state.wormholeCooldown = step.wormholeCooldown;
  if (state.fallbackCraft) state.fallbackCraft.angle = Math.atan2(nextVelocity.y, nextVelocity.x);

  state.flightSteps += 1;
  const position = getCraftPosition();
  const collision = step.event;
  if (collision?.status === 'wormhole') {
    state.trail.push({ ...collision.entrance, alpha: 1 });
    state.trail.push({ ...collision.exit, alpha: 1, jump: true });
    spawnImpact(collision.entrance, 'cyan', 12);
    spawnImpact(collision.exit, 'violet', 16);
    if (navigator.vibrate) navigator.vibrate(18);
  } else if (collision) {
    if (collision.status === 'goal') finishSuccess();
    else finishFailure('撞击星体', 'crashed');
    return;
  }

  if (
    position.x < -WORLD.boundsMargin
    || position.y < -WORLD.boundsMargin
    || position.x > WORLD.width + WORLD.boundsMargin
    || position.y > WORLD.height + WORLD.boundsMargin
  ) {
    finishFailure('偏离航线', 'out-of-bounds');
    return;
  }

  if (state.flightSteps >= WORLD.maxSteps) {
    finishFailure('轨道未闭合', 'timeout');
    return;
  }

  if (state.flightSteps % 2 === 0) {
    state.trail.push({ ...position, alpha: 1 });
    if (state.trail.length > 180) state.trail.shift();
  }
}

function finishFailure(message, phase) {
  if (state.phase !== 'flying') return;
  state.phase = phase;
  spawnImpact(getCraftPosition(), phase === 'crashed' ? 'coral' : 'gold');
  setStatus(message, true);
  playSound('failure');
  updateHud();
  state.resetTimer = window.setTimeout(() => {
    resetLevel({ incrementAttempt: true, preserveAim: true });
  }, state.reducedMotion ? 450 : 900);
}

function finishSuccess() {
  if (state.phase !== 'flying') return;
  state.phase = 'level-clear';
  const current = level();
  const metrics = {
    time: state.flightSteps / 60,
    power: state.launchSpeed,
    firstAttempt: state.attempts === 1,
  };
  const result = calculateResult(metrics, current.par);
  state.progress = recordLevelResult(state.progress, state.levelIndex, result, metrics, LEVELS.length);
  saveProgress();
  spawnImpact(current.target, 'cyan', 28);
  playSound('success');
  showResult(result, metrics);
  renderLevelPicker();
  setStatus('轨道接入成功', true);
  updateHud();
}

function showResult(result, metrics) {
  const lastLevel = state.levelIndex === LEVELS.length - 1;
  elements.resultTitle.textContent = lastLevel ? '巡航全部完成' : '轨道接入成功';
  elements.resultStars.textContent = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`;
  elements.resultStars.setAttribute('aria-label', `本次获得 ${result.stars} 星`);
  elements.resultScore.textContent = result.score.toLocaleString('zh-CN');
  elements.resultTime.textContent = `${metrics.time.toFixed(2)} 秒`;
  elements.resultPower.textContent = metrics.power.toFixed(1);
  elements.nextButton.innerHTML = `${iconMarkup(lastLevel ? 'rotate-ccw' : 'arrow-right', lastLevel ? '↻' : '→')}<span>${lastLevel ? '重返初光' : '下一轨道'}</span>`;
  elements.resultOverlay.hidden = false;
  refreshIcons();
  window.setTimeout(() => elements.nextButton.focus(), 20);
}

function setPaused(paused, automatic = false) {
  if (paused) {
    if (state.phase !== 'flying') return;
    state.pausedFrom = state.phase;
    state.phase = 'paused';
    state.autoPaused = automatic;
    setStatus('飞行已暂停', true);
  } else {
    if (state.phase !== 'paused') return;
    state.phase = state.pausedFrom || 'flying';
    state.pausedFrom = null;
    state.autoPaused = false;
    state.accumulator = 0;
    state.lastFrame = performance.now();
    setStatus('飞行中', true);
  }
  updateHud();
}

function canvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
  };
}

function updateAimFromPointer(event) {
  const maximumDistance = 190;
  state.aim = aimFromPoint(level().start, canvasPoint(event), maximumDistance);
  updatePrediction();
}

function onPointerDown(event) {
  if (!['ready', 'aiming'].includes(state.phase)) return;
  state.phase = 'aiming';
  state.pointerId = event.pointerId;
  elements.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  updateAimFromPointer(event);
}

function onPointerMove(event) {
  if (state.phase !== 'aiming' || event.pointerId !== state.pointerId) return;
  updateAimFromPointer(event);
}

function onPointerUp(event) {
  if (state.phase !== 'aiming' || event.pointerId !== state.pointerId) return;
  updateAimFromPointer(event);
  state.pointerId = null;
  const touchInput = event.pointerType === 'touch';
  if (!touchInput && state.aim.power >= 0.04) launch();
  else {
    state.phase = 'ready';
    updateHud();
    if (touchInput) {
      setStatus('航向已设定，点按发射', true);
      if (navigator.vibrate) navigator.vibrate(8);
    }
  }
}

function onPointerCancel(event) {
  if (event.pointerId !== state.pointerId) return;
  state.pointerId = null;
  state.phase = 'ready';
  updateHud();
}

function onKeyDown(event) {
  const fromInteractiveControl = event.target instanceof Element
    && event.target.closest('button, a[href], input, textarea, select, summary, [contenteditable]:not([contenteditable="false"])');
  if (fromInteractiveControl && event.key !== 'Escape') return;
  const adjustable = ['ready', 'aiming'].includes(state.phase);
  const angleStep = event.shiftKey ? 5 : 1;

  if (adjustable && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    if (event.key === 'ArrowLeft') state.aim.angle -= angleStep;
    if (event.key === 'ArrowRight') state.aim.angle += angleStep;
    if (event.key === 'ArrowUp') state.aim.power = Math.min(1, state.aim.power + 0.02);
    if (event.key === 'ArrowDown') state.aim.power = Math.max(0, state.aim.power - 0.02);
    updatePrediction();
    return;
  }

  if (event.code === 'Space' && adjustable) {
    event.preventDefault();
    launch();
    return;
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetLevel({ incrementAttempt: state.flightSteps > 0, preserveAim: true });
    return;
  }

  if (event.key === 'Escape' && elements.shell.classList.contains('focus-mode')) {
    event.preventDefault();
    toggleFullscreen();
    return;
  }

  if (event.key === 'Escape' && ['flying', 'paused'].includes(state.phase)) {
    event.preventDefault();
    setPaused(state.phase === 'flying');
  }
}

function mulberry32(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStarfield() {
  const random = mulberry32(2317 + (state.levelIndex * 997));
  state.stars = Array.from({ length: 120 }, () => ({
    x: random() * WORLD.width,
    y: random() * WORLD.height,
    radius: 0.5 + (random() * 1.25),
    alpha: 0.18 + (random() * 0.64),
    phase: random() * Math.PI * 2,
  }));
}

function spawnImpact(position, tone, count = 18) {
  if (state.reducedMotion) return;
  const random = mulberry32(Math.round(position.x * 13 + position.y * 17 + state.flightSteps));
  const colors = {
    coral: ['#e8603f', '#f5a07b', '#f3efe4'],
    cyan: ['#38bdf8', '#7dd3fc', '#e0b458'],
    gold: ['#e0b458', '#f4d995', '#f3efe4'],
    violet: ['#c084fc', '#7c3aed', '#e9d5ff'],
  }[tone] || ['#f3efe4'];

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const speed = 0.7 + (random() * 3.5);
    state.particles.push({
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 1.5 + (random() * 3),
      color: colors[index % colors.length],
    });
  }
}

function updateParticles(deltaFrames) {
  for (const particle of state.particles) {
    particle.x += particle.vx * deltaFrames;
    particle.y += particle.vy * deltaFrames;
    particle.vx *= 0.985 ** deltaFrames;
    particle.vy *= 0.985 ** deltaFrames;
    particle.life -= 0.018 * deltaFrames;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function drawBackground(time) {
  const backdrop = context.createRadialGradient(680, 120, 20, 480, 270, 720);
  backdrop.addColorStop(0, '#182852');
  backdrop.addColorStop(0.38, '#0a1933');
  backdrop.addColorStop(0.72, '#070d20');
  backdrop.addColorStop(1, '#03060f');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  const nebula = context.createRadialGradient(190, 450, 10, 190, 450, 360);
  nebula.addColorStop(0, 'rgba(126, 34, 206, .16)');
  nebula.addColorStop(.48, 'rgba(14, 165, 233, .07)');
  nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = nebula;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  context.strokeStyle = 'rgba(243, 239, 228, 0.035)';
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 120) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD.height);
    context.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += 90) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD.width, y);
    context.stroke();
  }

  for (const star of state.stars) {
    const twinkle = state.reducedMotion ? 1 : 0.75 + (Math.sin((time * 0.0015) + star.phase) * 0.25);
    context.globalAlpha = star.alpha * twinkle;
    context.fillStyle = star.radius > 1.35 ? '#e0b458' : '#f3efe4';
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function planetPalette(tone) {
  return {
    gold: ['#f0cd7a', '#8a672c', '#2e2414'],
    cyan: ['#7dd3fc', '#167587', '#0c2f36'],
    coral: ['#f39a79', '#a83f2e', '#341813'],
    void: ['#0f0518', '#2b1049', '#05010a'],
    repulsor: ['#ffffff', '#a5f3fc', '#0891b2'],
  }[tone] || ['#d8d4c9', '#6f766f', '#202820'];
}

function drawPlanet(planet, time) {
  const palette = planetPalette(planet.tone);
  context.save();
  context.translate(planet.x, planet.y);

  if (planet.tone === 'void' || planet.blackHole) {
    const halo = context.createRadialGradient(0, 0, planet.radius * .55, 0, 0, planet.radius * 2.15);
    halo.addColorStop(0, 'rgba(0,0,0,1)');
    halo.addColorStop(.35, 'rgba(34,8,65,.92)');
    halo.addColorStop(.55, 'rgba(244,114,182,.45)');
    halo.addColorStop(.72, 'rgba(250,204,21,.2)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, planet.radius * 2.2, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.rotate(state.reducedMotion ? -.18 : (time * .00018) - .18);
    context.strokeStyle = 'rgba(251, 191, 36, .75)';
    context.lineWidth = Math.max(4, planet.radius * .16);
    context.beginPath();
    context.ellipse(0, 0, planet.radius * 1.7, planet.radius * .38, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(232, 121, 249, .68)';
    context.lineWidth *= .45;
    context.beginPath();
    context.ellipse(0, 0, planet.radius * 1.42, planet.radius * .27, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  } else {
    context.shadowColor = palette[0];
    context.shadowBlur = Math.max(12, planet.radius * .55);
    context.globalAlpha = .25;
    context.fillStyle = palette[0];
    context.beginPath();
    context.arc(0, 0, planet.radius * 1.14, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }

  if (planet.ring) {
    context.save();
    context.rotate(-0.22);
    context.strokeStyle = `${palette[0]}99`;
    context.lineWidth = Math.max(2, planet.radius * 0.08);
    context.beginPath();
    context.ellipse(0, 0, planet.radius * 1.52, planet.radius * 0.34, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  const gradient = context.createRadialGradient(
    -planet.radius * 0.34,
    -planet.radius * 0.38,
    planet.radius * 0.05,
    0,
    0,
    planet.radius,
  );
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.55, palette[1]);
  gradient.addColorStop(1, palette[2]);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, planet.radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(0, 0, planet.radius - 1, 0, Math.PI * 2);
  context.clip();
  context.globalAlpha = .22;
  context.strokeStyle = palette[0];
  context.lineWidth = Math.max(2, planet.radius * .07);
  for (let latitude = -0.55; latitude <= .55; latitude += .28) {
    context.beginPath();
    context.ellipse(0, planet.radius * latitude, planet.radius * 1.05, planet.radius * .16, -.12, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  context.strokeStyle = `${palette[0]}aa`;
  context.lineWidth = 1.5;
  context.stroke();

  if (!['void', 'repulsor'].includes(planet.tone)) {
    context.globalAlpha = 0.24;
    context.fillStyle = palette[2];
    context.beginPath();
    context.arc(planet.radius * 0.24, -planet.radius * 0.12, planet.radius * 0.13, 0, Math.PI * 2);
    context.arc(-planet.radius * 0.2, planet.radius * 0.28, planet.radius * 0.09, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  if (!state.reducedMotion) {
    const orbitPhase = (time * 0.00035) % (Math.PI * 2);
    context.fillStyle = palette[0];
    context.beginPath();
    context.arc(Math.cos(orbitPhase) * (planet.radius + 11), Math.sin(orbitPhase) * (planet.radius + 11), 1.8, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawField(field, time) {
  const electric = field.type === 'electric';
  const color = electric
    ? (field.strength > 0 ? '#fb7185' : '#60a5fa')
    : (field.strength > 0 ? '#22d3ee' : '#c084fc');
  context.save();
  context.translate(field.x, field.y);
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, field.radius);
  glow.addColorStop(0, `${color}24`);
  glow.addColorStop(.72, `${color}0c`);
  glow.addColorStop(1, `${color}00`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, field.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `${color}70`;
  context.lineWidth = 1.5;
  context.setLineDash([5, 10]);
  const phase = state.reducedMotion ? 0 : time * .00045;
  for (let radius = field.radius * .3; radius < field.radius; radius += field.radius * .23) {
    context.beginPath();
    if (electric) context.arc(0, 0, radius, phase, phase + Math.PI * 1.65);
    else context.ellipse(0, 0, radius, radius * .42, phase, 0, Math.PI * 2);
    context.stroke();
  }
  context.setLineDash([]);
  context.fillStyle = color;
  context.font = '700 14px Archivo, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(electric ? (field.strength > 0 ? '+' : '−') : '∮B', 0, 0);
  context.restore();
}

function drawWormhole(pair, time) {
  [pair.a, pair.b].forEach((node, index) => {
    const color = pair.tone === 'violet' ? '#c084fc' : '#22d3ee';
    context.save();
    context.translate(node.x, node.y);
    context.rotate((index ? -1 : 1) * (state.reducedMotion ? .35 : time * .001));
    context.shadowColor = color;
    context.shadowBlur = 18;
    for (let ring = 0; ring < 3; ring += 1) {
      context.strokeStyle = ring === 1 ? '#f8fafc' : color;
      context.globalAlpha = .85 - ring * .2;
      context.lineWidth = 3 - ring * .6;
      context.beginPath();
      context.ellipse(0, 0, node.radius + ring * 7, node.radius * (.48 + ring * .08), ring * .35, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = 'rgba(2, 6, 23, .92)';
    context.beginPath();
    context.ellipse(0, 0, node.radius * .72, node.radius * .32, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawHazard(hazard) {
  const random = mulberry32(Math.round(hazard.x * 17 + hazard.y * 29));
  context.save();
  context.translate(hazard.x, hazard.y);
  context.fillStyle = '#414b45';
  context.strokeStyle = '#9ba49d';
  context.lineWidth = 2;
  context.beginPath();
  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * Math.PI * 2;
    const radius = hazard.radius * (0.78 + (random() * 0.22));
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#222a25';
  context.globalAlpha = 0.7;
  context.beginPath();
  context.arc(-hazard.radius * 0.22, -hazard.radius * 0.1, hazard.radius * 0.14, 0, Math.PI * 2);
  context.arc(hazard.radius * 0.25, hazard.radius * 0.2, hazard.radius * 0.1, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTarget(target, time) {
  const rotation = state.reducedMotion ? 0 : time * 0.0012;
  context.save();
  context.translate(target.x, target.y);
  context.rotate(rotation);
  context.strokeStyle = '#38bdf8';
  context.lineWidth = 3;
  context.setLineDash([10, 7]);
  context.beginPath();
  context.arc(0, 0, target.radius + 10, 0, Math.PI * 2);
  context.stroke();
  context.rotate(-rotation * 1.7);
  context.strokeStyle = '#e0b458';
  context.lineWidth = 2;
  context.setLineDash([5, 9]);
  context.beginPath();
  context.arc(0, 0, target.radius + 2, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = 'rgba(56, 189, 248, 0.18)';
  context.beginPath();
  context.arc(0, 0, target.radius - 3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f3efe4';
  context.rotate(Math.PI / 4);
  context.fillRect(-4, -4, 8, 8);
  context.restore();
}

function drawPrediction() {
  if (!state.trajectory || !['ready', 'aiming'].includes(state.phase)) return;
  const color = {
    goal: '#38bdf8',
    crashed: '#e8603f',
    'out-of-bounds': '#e0b458',
    timeout: 'rgba(243, 239, 228, 0.5)',
  }[state.trajectory.status] || 'rgba(243, 239, 228, 0.5)';

  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.setLineDash([3, 8]);
  context.beginPath();
  state.trajectory.points.forEach((point, index) => {
    if (index === 0 || point.jump) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.setLineDash([]);

  state.trajectory.points.forEach((point, index) => {
    if (index % 4 !== 0) return;
    const alpha = 0.22 + ((index / state.trajectory.points.length) * 0.58);
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawAim() {
  if (!['ready', 'aiming'].includes(state.phase)) return;
  const origin = level().start;
  const radians = state.aim.angle * (Math.PI / 180);
  const length = 66 + (state.aim.power * 118);
  const end = {
    x: origin.x + (Math.cos(radians) * length),
    y: origin.y + (Math.sin(radians) * length),
  };

  context.save();
  context.strokeStyle = '#e0b458';
  context.fillStyle = '#e0b458';
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.translate(end.x, end.y);
  context.rotate(radians);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-13, -7);
  context.lineTo(-10, 0);
  context.lineTo(-13, 7);
  context.closePath();
  context.fill();
  context.restore();

  context.save();
  context.translate(origin.x, origin.y);
  context.strokeStyle = 'rgba(224, 180, 88, 0.28)';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 22, -Math.PI / 2, (Math.PI * 2 * state.aim.power) - (Math.PI / 2));
  context.stroke();
  context.restore();
}

function drawTrail() {
  if (state.trail.length < 2) return;
  context.save();
  context.lineCap = 'round';
  for (let index = 1; index < state.trail.length; index += 1) {
    if (state.trail[index].jump) continue;
    const alpha = index / state.trail.length;
    context.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.58})`;
    context.lineWidth = 1 + (alpha * 2.5);
    context.beginPath();
    context.moveTo(state.trail[index - 1].x, state.trail[index - 1].y);
    context.lineTo(state.trail[index].x, state.trail[index].y);
    context.stroke();
  }
  context.restore();
}

function drawShip() {
  const position = getCraftPosition();
  const velocity = state.phase === 'flying' ? getCraftVelocity() : velocityFromAim(state.aim.angle, state.aim.power);
  const angle = Math.atan2(velocity.y, velocity.x);
  context.save();
  context.translate(position.x, position.y);
  context.rotate(angle);

  if (state.phase === 'flying') {
    context.shadowColor = '#38bdf8';
    context.shadowBlur = 16;
    const plume = context.createLinearGradient(-30, 0, -10, 0);
    plume.addColorStop(0, 'rgba(56,189,248,0)');
    plume.addColorStop(.55, '#38bdf8');
    plume.addColorStop(1, '#f8fafc');
    context.fillStyle = plume;
    context.beginPath();
    context.moveTo(-11, -4);
    context.lineTo(-29 - (state.reducedMotion ? 0 : Math.random() * 5), 0);
    context.lineTo(-11, 4);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
  }

  context.fillStyle = '#6d28d9';
  context.strokeStyle = '#c4b5fd';
  context.lineWidth = 1.3;
  context.beginPath();
  context.moveTo(4, -4);
  context.lineTo(-14, -14);
  context.lineTo(-8, -2);
  context.lineTo(-14, 14);
  context.lineTo(4, 4);
  context.closePath();
  context.fill();
  context.stroke();

  const hull = context.createLinearGradient(-10, -8, 17, 8);
  hull.addColorStop(0, '#94a3b8');
  hull.addColorStop(.42, '#f8fafc');
  hull.addColorStop(1, '#67e8f9');
  context.fillStyle = hull;
  context.strokeStyle = '#fbbf24';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(19, 0);
  context.quadraticCurveTo(5, -10, -11, -7);
  context.lineTo(-7, 0);
  context.lineTo(-11, 7);
  context.quadraticCurveTo(5, 10, 19, 0);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowColor = '#22d3ee';
  context.shadowBlur = 9;
  context.fillStyle = '#082f49';
  context.strokeStyle = '#67e8f9';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(5, 0, 5.2, 3.5, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawParticles() {
  context.save();
  for (const particle of state.particles) {
    context.globalAlpha = particle.life;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPaused() {
  if (state.phase !== 'paused') return;
  context.fillStyle = 'rgba(7, 21, 15, 0.58)';
  context.fillRect(0, 0, WORLD.width, WORLD.height);
  context.fillStyle = '#f3efe4';
  context.fillRect((WORLD.width / 2) - 17, (WORLD.height / 2) - 30, 11, 60);
  context.fillRect((WORLD.width / 2) + 6, (WORLD.height / 2) - 30, 11, 60);
}

function drawScene(time) {
  context.clearRect(0, 0, WORLD.width, WORLD.height);
  drawBackground(time);
  level().fields.forEach((field) => drawField(field, time));
  level().wormholes.forEach((pair) => drawWormhole(pair, time));
  drawPrediction();
  level().hazards.forEach(drawHazard);
  level().planets.forEach((planet) => drawPlanet(planet, time));
  drawTarget(level().target, time);
  drawTrail();
  drawAim();
  drawShip();
  drawParticles();
  drawPaused();
}

function frame(time) {
  const delta = Math.min(100, Math.max(0, time - state.lastFrame));
  state.lastFrame = time;

  if (state.phase === 'flying') {
    state.accumulator += delta;
    let steps = 0;
    while (state.accumulator >= STEP_MS && steps < MAX_FRAME_STEPS && state.phase === 'flying') {
      stepPhysics();
      state.accumulator -= STEP_MS;
      steps += 1;
    }
    if (steps === MAX_FRAME_STEPS) state.accumulator = 0;
  }

  if (!state.reducedMotion && state.particles.length) {
    updateParticles(delta / STEP_MS);
  }

  drawScene(time);
  requestAnimationFrame(frame);
}

function getAudioContext() {
  if (!state.progress.sound) return null;
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    state.audioContext = new AudioContext();
  }
  if (state.audioContext.state === 'suspended') state.audioContext.resume();
  return state.audioContext;
}

function playTone(frequency, delay, duration, gain = 0.05, type = 'sine') {
  const audio = getAudioContext();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(kind) {
  if (!state.progress.sound) return;
  if (kind === 'launch') {
    playTone(180, 0, 0.18, 0.04, 'sawtooth');
    playTone(310, 0.08, 0.18, 0.035, 'sine');
  } else if (kind === 'failure') {
    playTone(150, 0, 0.2, 0.055, 'square');
    playTone(90, 0.1, 0.28, 0.04, 'sawtooth');
  } else if (kind === 'success') {
    playTone(440, 0, 0.22, 0.045);
    playTone(660, 0.1, 0.24, 0.045);
    playTone(880, 0.2, 0.35, 0.04);
  }
}

async function toggleFullscreen() {
  const focusMode = elements.shell.classList.contains('focus-mode');
  try {
    if (document.fullscreenElement === elements.shell) {
      await document.exitFullscreen();
    } else if (focusMode) {
      elements.shell.classList.remove('focus-mode');
      document.body.classList.remove('game-focus-mode');
      updateControlIcons();
    } else if (typeof elements.shell.requestFullscreen === 'function') {
      await elements.shell.requestFullscreen();
      const mobileLayout = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
      const orientationLock = mobileLayout ? screen.orientation?.lock?.('portrait-primary') : null;
      if (orientationLock?.catch) await orientationLock.catch(() => {});
    } else {
      elements.shell.classList.add('focus-mode');
      document.body.classList.add('game-focus-mode');
      updateControlIcons();
    }
  } catch {
    elements.shell.classList.add('focus-mode');
    document.body.classList.add('game-focus-mode');
    updateControlIcons();
  }
}

function bindEvents() {
  elements.canvas.addEventListener('pointerdown', onPointerDown);
  elements.canvas.addEventListener('pointermove', onPointerMove);
  elements.canvas.addEventListener('pointerup', onPointerUp);
  elements.canvas.addEventListener('pointercancel', onPointerCancel);
  elements.launchButton.addEventListener('click', launch);
  elements.resetButton.addEventListener('click', () => {
    resetLevel({ incrementAttempt: state.flightSteps > 0, preserveAim: true });
  });
  elements.pauseButton.addEventListener('click', () => setPaused(state.phase === 'flying'));
  elements.soundButton.addEventListener('click', () => {
    state.progress.sound = !state.progress.sound;
    saveProgress();
    if (state.progress.sound) playTone(520, 0, 0.12, 0.035);
    updateControlIcons();
  });
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);
  elements.angleSlider.addEventListener('input', (event) => {
    if (!['ready', 'aiming'].includes(state.phase)) return;
    state.phase = 'ready';
    state.aim.angle = Number(event.target.value);
    updatePrediction();
  });
  elements.powerSlider.addEventListener('input', (event) => {
    if (!['ready', 'aiming'].includes(state.phase)) return;
    state.phase = 'ready';
    state.aim.power = Number(event.target.value) / 100;
    updatePrediction();
  });
  elements.replayButton.addEventListener('click', () => {
    state.attempts = 1;
    resetLevel({ preserveAim: true });
  });
  elements.nextButton.addEventListener('click', () => {
    const nextIndex = state.levelIndex === LEVELS.length - 1 ? 0 : state.levelIndex + 1;
    selectLevel(nextIndex);
  });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove('game-focus-mode');
      try { screen.orientation?.unlock?.(); } catch { /* Unsupported outside fullscreen. */ }
    }
    updateControlIcons();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.phase === 'flying') setPaused(true, true);
    else if (!document.hidden && state.phase === 'paused' && state.autoPaused) setPaused(false, true);
  });
  reducedMotionQuery.addEventListener('change', (event) => {
    state.reducedMotion = event.matches;
    if (event.matches) state.particles = [];
  });
}

function initialize() {
  elements.canvas.width = WORLD.width * Math.min(window.devicePixelRatio || 1, 2);
  elements.canvas.height = WORLD.height * Math.min(window.devicePixelRatio || 1, 2);
  const scale = elements.canvas.width / WORLD.width;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, state.progress.unlocked - 1));
  state.aim = { ...level().defaultAim };
  generateStarfield();
  renderLevelPicker();
  bindEvents();
  resetLevel();
  state.phase = 'ready';
  updateHud();
  refreshIcons();
  requestAnimationFrame(frame);
}

initialize();
