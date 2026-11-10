export const GAME_VERSION = 1;

export const WORLD = Object.freeze({
  width: 960,
  height: 540,
  shipRadius: 10,
  boundsMargin: 90,
  maxSteps: 720,
  sampleEvery: 3,
  minSpeed: 2,
  maxSpeed: 8.5,
  maxAcceleration: 0.2,
});

const CLASSIC_LEVELS = [
  {
    id: 1,
    name: '初光校准',
    code: 'FIRST LIGHT',
    start: { x: 110, y: 400 },
    target: { x: 850, y: 140, radius: 26 },
    planets: [],
    hazards: [],
    par: { time: 2.3, power: 6.2 },
    defaultAim: { angle: -20, power: 0.63 },
  },
  {
    id: 2,
    name: '第一次借星',
    code: 'GRAVITY ASSIST',
    start: { x: 100, y: 400 },
    target: { x: 860, y: 145, radius: 26 },
    planets: [{ x: 475, y: 330, radius: 46, mu: 360, tone: 'gold' }],
    hazards: [],
    par: { time: 2.8, power: 6.4 },
    defaultAim: { angle: -22, power: 0.65 },
  },
  {
    id: 3,
    name: '弦月掠过',
    code: 'CRESCENT PASS',
    start: { x: 110, y: 270 },
    target: { x: 850, y: 270, radius: 26 },
    planets: [{ x: 480, y: 270, radius: 70, mu: 680, tone: 'coral', ring: true }],
    hazards: [],
    par: { time: 3.4, power: 6.5 },
    defaultAim: { angle: -17, power: 0.67 },
  },
  {
    id: 4,
    name: '双星摆渡',
    code: 'BINARY TRANSFER',
    start: { x: 90, y: 430 },
    target: { x: 870, y: 110, radius: 26 },
    planets: [
      { x: 345, y: 350, radius: 48, mu: 400, tone: 'cyan' },
      { x: 650, y: 185, radius: 58, mu: 560, tone: 'gold', ring: true },
    ],
    hazards: [],
    par: { time: 4, power: 6.7 },
    defaultAim: { angle: -20, power: 0.68 },
  },
  {
    id: 5,
    name: '潮汐之门',
    code: 'TIDAL GATE',
    start: { x: 90, y: 270 },
    target: { x: 870, y: 270, radius: 26 },
    planets: [
      { x: 430, y: 145, radius: 56, mu: 500, tone: 'cyan' },
      { x: 430, y: 395, radius: 56, mu: 500, tone: 'coral' },
    ],
    hazards: [{ x: 660, y: 270, radius: 48 }],
    par: { time: 4.4, power: 6.4 },
    defaultAim: { angle: -9, power: 0.7 },
  },
  {
    id: 6,
    name: '巨星与月',
    code: 'GIANT AND MOON',
    start: { x: 100, y: 440 },
    target: { x: 860, y: 105, radius: 26 },
    planets: [
      { x: 405, y: 285, radius: 74, mu: 760, tone: 'coral', ring: true },
      { x: 650, y: 205, radius: 34, mu: 230, tone: 'cyan' },
    ],
    hazards: [{ x: 540, y: 455, radius: 24 }],
    par: { time: 3.8, power: 5 },
    defaultAim: { angle: -25, power: 0.69 },
  },
  {
    id: 7,
    name: '暗礁星区',
    code: 'REEF OF STARS',
    start: { x: 90, y: 100 },
    target: { x: 870, y: 430, radius: 26 },
    planets: [
      { x: 300, y: 220, radius: 44, mu: 360, tone: 'gold' },
      { x: 590, y: 300, radius: 68, mu: 700, tone: 'cyan', ring: true },
    ],
    hazards: [
      { x: 430, y: 70, radius: 24 },
      { x: 470, y: 455, radius: 26 },
      { x: 760, y: 240, radius: 22 },
    ],
    par: { time: 4, power: 5.2 },
    defaultAim: { angle: 24, power: 0.72 },
  },
  {
    id: 8,
    name: '三体回廊',
    code: 'THREE-BODY RUN',
    start: { x: 80, y: 420 },
    target: { x: 880, y: 120, radius: 26 },
    planets: [
      { x: 285, y: 310, radius: 44, mu: 360, tone: 'gold' },
      { x: 500, y: 155, radius: 60, mu: 600, tone: 'coral', ring: true },
      { x: 700, y: 345, radius: 52, mu: 480, tone: 'cyan' },
    ],
    hazards: [
      { x: 480, y: 390, radius: 25 },
      { x: 800, y: 240, radius: 22 },
    ],
    par: { time: 4.5, power: 5.2 },
    defaultAim: { angle: -24, power: 0.73 },
  },
];

const ADVANCED_NAMES = [
  ['引力缝隙', 'GRAVITY RIFT'], ['曲率迷宫', 'CURVATURE MAZE'], ['极星之舞', 'DANCE OF POLES'],
  ['虚空盲区', 'VOID BLINDSPOT'], ['斥力屏障', 'REPULSION FIELD'], ['深渊视界', 'EVENT HORIZON'],
  ['折叠走廊', 'FOLDED CORRIDOR'], ['蓝移海洋', 'BLUE SHIFT SEA'], ['赤色偏转', 'RED DEFLECTION'],
  ['等离子弧', 'PLASMA ARC'], ['双极漩涡', 'BIPOLAR VORTEX'], ['奇点掠影', 'SINGULARITY SKIM'],
  ['爱因斯坦环', 'EINSTEIN RING'], ['量子跳板', 'QUANTUM SPRING'], ['电荷峡谷', 'CHARGE CANYON'],
  ['磁流冲浪', 'MAGNETIC SURF'], ['反物质花园', 'ANTIMATTER GARDEN'], ['黑日潮汐', 'BLACK SUN TIDE'],
  ['虫洞驿站', 'WORMHOLE RELAY'], ['星风风暴', 'STELLAR GALE'], ['光帆回旋', 'SOLAR SAIL TURN'],
  ['引力共振', 'GRAVITY RESONANCE'], ['反向星海', 'INVERSE COSMOS'], ['视界切线', 'HORIZON TANGENT'],
  ['空间缝合', 'SPACETIME STITCH'], ['霍尔推进', 'HALL THRUSTER'], ['极光偏转', 'AURORA DEFLECTOR'],
  ['虚空秋千', 'VOID PENDULUM'], ['超导航道', 'SUPERCONDUCTOR'], ['引力棱镜', 'GRAVITY PRISM'],
  ['事件视界', 'EVENT CASCADE'], ['洛希口袋', 'ROCHE POCKET'], ['耦合星链', 'COUPLED STARS'],
  ['量子潮汐', 'QUANTUM TIDE'], ['星门回声', 'STARGATE ECHO'], ['混沌磁暴', 'CHAOS MAGNETAR'],
  ['暗能量帆', 'DARK ENERGY SAIL'], ['中子星弦', 'NEUTRON STRING'], ['多维折返', 'DIMENSIONAL RETURN'],
  ['终末奇点', 'FINAL SINGULARITY'], ['时空交响', 'SPACETIME SYMPHONY'], ['星海归途', 'COSMIC HOMECOMING'],
];

const CHAPTERS = ['引力学院', '反向宇宙', '黑洞边界', '电磁星海', '虫洞网络', '混合时空'];
const START_Y = [420, 120, 360, 180, 270, 440, 100];
const TARGET_Y = [120, 420, 150, 390, 270, 100, 440];
const CLASSIC_SOLUTIONS = [
  [-20, 0.64], [-24.5, 0.66], [-15, 0.58], [-38, 0.66],
  [-39, 0.22], [-45.5, 0.46], [3, 0.48], [-6, 0.48],
];
const ADVANCED_SOLUTIONS = [
  [-23.038, .95], [21.038, .8], [-20.318, .95], [15.818, .95], [-.5, .9], [-23.552, .1], [23.552, .1],
  [-23.288, .95], [21.038, .9], [-21.068, .95], [15.068, .9], [-.75, .95], [-23.552, .1], [23.552, .15],
  [-23.538, .95], [21.038, .95], [-21.818, .95], [16.068, .85], [-1.25, .9], [-23.552, .1], [23.552, .1],
  [-23.788, .95], [20.538, .95], [-22.818, .95], [15.068, .9], [-1.5, .95], [-23.552, .1], [23.552, .15],
  [-24.038, .95], [20.038, .95], [-23.568, .95], [16.068, .85], [-2, .95], [-23.552, .1], [23.552, .1],
  [-24.288, .95], [19.538, .95], [-24.318, .95], [15.068, .9], [-2.25, .95], [-23.552, .1], [23.552, .15],
];

function directAim(start, target, power = 0.72) {
  return { angle: Math.atan2(target.y - start.y, target.x - start.x) * (180 / Math.PI), power };
}

function makeAdvancedLevel(offset) {
  const id = offset + 9;
  const mode = offset % 7;
  const tier = Math.floor(offset / 7);
  const start = { x: 90, y: START_Y[offset % START_Y.length] };
  const target = { x: 870, y: TARGET_Y[offset % TARGET_Y.length], radius: 27 };
  const midY = (start.y + target.y) / 2;
  const bend = start.y < target.y ? -1 : 1;
  const planets = [];
  const hazards = [];
  const fields = [];
  const wormholes = [];
  let mechanic = '引力';

  if (mode === 0) {
    planets.push(
      { x: 390, y: midY + bend * (88 + tier * 3), radius: 38 + tier, mu: 480 + tier * 70, tone: 'cyan' },
      { x: 620, y: midY - bend * (82 + tier * 2), radius: 43 + tier, mu: 540 + tier * 75, tone: 'gold', ring: tier % 2 === 1 },
    );
    mechanic = '引力弹弓';
  } else if (mode === 1) {
    planets.push({ x: 480, y: midY + bend * 96, radius: 31 + tier, mu: -(180 + tier * 35), tone: 'repulsor', ring: true });
    hazards.push({ x: 600, y: midY - bend * 118, radius: 20 + tier });
    mechanic = '斥力绕行';
  } else if (mode === 2) {
    planets.push({ x: 500, y: midY + bend * (78 - tier * 3), radius: 34 + tier, mu: 1050 + tier * 150, tone: 'void', ring: true, blackHole: true });
    hazards.push({ x: 675, y: midY - bend * 105, radius: 20 + tier });
    mechanic = '黑洞掠过';
  } else if (mode === 3) {
    fields.push({ x: 455, y: midY, radius: 190, type: 'electric', strength: (tier % 2 ? -1 : 1) * (620 + tier * 85), tone: tier % 2 ? 'negative' : 'positive' });
    hazards.push({ x: 610, y: midY + bend * 62, radius: 30 });
    mechanic = '库仑电场';
  } else if (mode === 4) {
    fields.push({ x: 470, y: midY, radius: 225, type: 'magnetic', strength: bend * (0.032 + tier * 0.004), tone: bend > 0 ? 'north' : 'south' });
    hazards.push({ x: 565, y: midY - bend * 48, radius: 27 });
    mechanic = '洛伦兹偏转';
  } else if (mode === 5) {
    const entry = { x: 330, y: start.y + ((target.y - start.y) * 0.3), radius: 25 };
    const exit = { x: 690, y: start.y + ((target.y - start.y) * 0.77), radius: 25 };
    wormholes.push({ a: entry, b: exit, rotation: 0, tone: tier % 2 ? 'violet' : 'cyan' });
    hazards.push(
      { x: 500, y: midY - 48, radius: 38 },
      { x: 500, y: midY + 48, radius: 38 },
    );
    mechanic = '虫洞跳跃';
  } else {
    const entry = { x: 310, y: start.y + ((target.y - start.y) * 0.27), radius: 24 };
    const exit = { x: 650, y: start.y + ((target.y - start.y) * 0.72), radius: 24 };
    wormholes.push({ a: entry, b: exit, rotation: 0, tone: 'violet' });
    planets.push({ x: 500, y: midY + bend * 120, radius: 34, mu: tier % 2 ? -620 : 900, tone: tier % 2 ? 'repulsor' : 'void', blackHole: tier % 2 === 0 });
    fields.push({ x: 745, y: target.y - bend * 45, radius: 125, type: 'magnetic', strength: -bend * 0.022, tone: 'north' });
    hazards.push({ x: 480, y: midY, radius: 32 });
    mechanic = '混合时空';
  }

  const [solutionAngle, solutionPower] = ADVANCED_SOLUTIONS[offset];
  const solution = { angle: solutionAngle, power: solutionPower };
  return {
    id,
    name: ADVANCED_NAMES[offset][0],
    code: ADVANCED_NAMES[offset][1],
    chapter: CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor(offset / 7))],
    mechanic,
    start,
    target,
    planets,
    hazards,
    fields,
    wormholes,
    par: { time: 7.5 + tier * 0.35, power: 7.7 },
    solution,
    defaultAim: directAim(start, target, mode === 5 || mode === 6 ? 0.62 : 0.72),
  };
}

export const LEVELS = Object.freeze([
  ...CLASSIC_LEVELS.map((level, index) => ({
    ...level,
    chapter: '基础航天',
    mechanic: index === 0 ? '惯性飞行' : '引力借力',
    fields: [],
    wormholes: [],
    solution: { angle: CLASSIC_SOLUTIONS[index][0], power: CLASSIC_SOLUTIONS[index][1] },
  })),
  ...Array.from({ length: 42 }, (_, index) => makeAdvancedLevel(index)),
]);

export function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.min(maximum, Math.max(minimum, numeric));
}

export function velocityFromAim(angle, power, options = {}) {
  const minimumSpeed = options.minSpeed ?? WORLD.minSpeed;
  const maximumSpeed = options.maxSpeed ?? WORLD.maxSpeed;
  const normalizedPower = clamp(power, 0, 1);
  const speed = minimumSpeed + (maximumSpeed - minimumSpeed) * normalizedPower;
  const radians = (Number(angle) || 0) * (Math.PI / 180);

  return {
    x: Math.cos(radians) * speed,
    y: Math.sin(radians) * speed,
    speed,
    power: normalizedPower,
    angle: ((Number(angle) || 0) + 360) % 360,
  };
}

export function aimFromPoint(origin, point, maximumDistance = 180) {
  const dx = Number(point?.x) - Number(origin?.x);
  const dy = Number(point?.y) - Number(origin?.y);
  const distance = Math.hypot(dx, dy);

  if (!Number.isFinite(distance) || distance < 0.001) {
    return { angle: 0, power: 0 };
  }

  return {
    angle: Math.atan2(dy, dx) * (180 / Math.PI),
    power: clamp(distance / Math.max(1, maximumDistance), 0, 1),
  };
}

export function segmentCircleIntersectionT(start, end, circle, extraRadius = 0) {
  const radius = Math.max(0, Number(circle?.radius) + Number(extraRadius || 0));
  const sx = Number(start?.x);
  const sy = Number(start?.y);
  const ex = Number(end?.x);
  const ey = Number(end?.y);
  const cx = Number(circle?.x);
  const cy = Number(circle?.y);

  if (![radius, sx, sy, ex, ey, cx, cy].every(Number.isFinite)) return null;

  const offsetX = sx - cx;
  const offsetY = sy - cy;
  const radiusSquared = radius * radius;
  if ((offsetX * offsetX) + (offsetY * offsetY) <= radiusSquared) return 0;

  const dx = ex - sx;
  const dy = ey - sy;
  const a = (dx * dx) + (dy * dy);
  if (a < Number.EPSILON) return null;

  const b = 2 * ((offsetX * dx) + (offsetY * dy));
  const c = (offsetX * offsetX) + (offsetY * offsetY) - radiusSquared;
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (first >= 0 && first <= 1) return first;
  if (second >= 0 && second <= 1) return second;
  return null;
}

export function segmentCircleHit(start, end, circle, extraRadius = 0) {
  return segmentCircleIntersectionT(start, end, circle, extraRadius) !== null;
}

export function computeGravityAcceleration(position, attractors = [], options = {}) {
  const bodyRadius = Math.max(0, Number(options.bodyRadius) || 0);
  const maximum = Math.max(0, Number(options.maxAcceleration) || WORLD.maxAcceleration);
  let x = 0;
  let y = 0;

  for (const attractor of attractors) {
    const dx = Number(attractor.x) - Number(position.x);
    const dy = Number(attractor.y) - Number(position.y);
    const mu = Number(attractor.mu) || 0;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 0.001 || mu === 0) continue;

    const minimumDistance = Math.max(1, Number(attractor.radius) + bodyRadius);
    const magnitude = Math.abs(mu) / Math.max(distance * distance, minimumDistance * minimumDistance);
    const boundedMagnitude = Math.min(maximum, magnitude);
    const acceleration = boundedMagnitude * Math.sign(mu);
    x += (dx / distance) * acceleration;
    y += (dy / distance) * acceleration;
  }

  const total = Math.hypot(x, y);
  if (total > maximum && total > 0) {
    const scale = maximum / total;
    x *= scale;
    y *= scale;
  }

  return { x, y };
}

export function computeFieldAcceleration(position, velocity, fields = [], options = {}) {
  const maximum = Math.max(0, Number(options.maxAcceleration) || WORLD.maxAcceleration);
  let x = 0;
  let y = 0;

  for (const field of fields) {
    const offsetX = Number(position.x) - Number(field.x);
    const offsetY = Number(position.y) - Number(field.y);
    const distance = Math.hypot(offsetX, offsetY);
    const radius = Math.max(1, Number(field.radius) || 1);
    if (!Number.isFinite(distance) || distance > radius) continue;

    if (field.type === 'electric') {
      const strength = Number(field.strength) || 0;
      if (distance < 0.001 || strength === 0) continue;
      const minimumDistance = Math.max(24, Number(options.bodyRadius) || 0);
      const magnitude = Math.min(maximum, Math.abs(strength) / Math.max(distance * distance, minimumDistance * minimumDistance));
      const direction = Math.sign(strength);
      x += (offsetX / distance) * magnitude * direction;
      y += (offsetY / distance) * magnitude * direction;
    } else if (field.type === 'magnetic') {
      const speed = Math.hypot(Number(velocity.x), Number(velocity.y));
      if (speed < 0.001) continue;
      const falloff = Math.max(0, 1 - (distance / radius));
      const magnitude = (Number(field.strength) || 0) * falloff * Math.min(1.5, speed / WORLD.maxSpeed);
      x += (-Number(velocity.y) / speed) * magnitude;
      y += (Number(velocity.x) / speed) * magnitude;
    }
  }

  const total = Math.hypot(x, y);
  if (total > maximum && total > 0) {
    const scale = maximum / total;
    x *= scale;
    y *= scale;
  }
  return { x, y };
}

export function computeFlightAcceleration(position, velocity, options = {}) {
  const gravity = computeGravityAcceleration(position, options.attractors || [], options);
  const field = computeFieldAcceleration(position, velocity, options.fields || [], options);
  const maximum = Math.max(0, Number(options.maxAcceleration) || WORLD.maxAcceleration);
  let x = gravity.x + field.x;
  let y = gravity.y + field.y;
  const total = Math.hypot(x, y);
  if (total > maximum && total > 0) {
    const scale = maximum / total;
    x *= scale;
    y *= scale;
  }
  return { x, y };
}

function firstCollision(start, end, target, obstacles, shipRadius) {
  const events = [];
  const targetHit = segmentCircleIntersectionT(start, end, target, shipRadius);
  if (targetHit !== null) events.push({ status: 'goal', at: targetHit, object: target });

  for (const obstacle of obstacles) {
    const obstacleHit = segmentCircleIntersectionT(start, end, obstacle, shipRadius);
    if (obstacleHit !== null) events.push({ status: 'crashed', at: obstacleHit, object: obstacle });
  }

  events.sort((left, right) => left.at - right.at || (left.status === 'crashed' ? -1 : 1));
  return events[0] || null;
}

function firstWormholeTransit(start, end, wormholes, shipRadius) {
  const events = [];
  wormholes.forEach((pair, pairIndex) => {
    for (const entranceKey of ['a', 'b']) {
      const at = segmentCircleIntersectionT(start, end, pair[entranceKey], shipRadius * 0.35);
      if (at !== null) events.push({ at, pair, pairIndex, entranceKey });
    }
  });
  events.sort((left, right) => left.at - right.at);
  return events[0] || null;
}

export function advanceFlightStep(options) {
  const previous = { x: Number(options.position.x), y: Number(options.position.y) };
  const velocity = { x: Number(options.velocity.x), y: Number(options.velocity.y) };
  const shipRadius = Number(options.shipRadius) || WORLD.shipRadius;
  const acceleration = computeFlightAcceleration(previous, velocity, {
    attractors: options.attractors || [],
    fields: options.fields || [],
    bodyRadius: shipRadius,
    maxAcceleration: options.maxAcceleration,
  });
  velocity.x += acceleration.x;
  velocity.y += acceleration.y;
  let position = { x: previous.x + velocity.x, y: previous.y + velocity.y };
  let cooldown = Math.max(0, Math.round(Number(options.wormholeCooldown) || 0) - 1);
  const collision = firstCollision(previous, position, options.target, options.obstacles || [], shipRadius);
  const transit = cooldown === 0
    ? firstWormholeTransit(previous, position, options.wormholes || [], shipRadius)
    : null;

  if (transit && (!collision || transit.at < collision.at)) {
    const exit = transit.pair[transit.entranceKey === 'a' ? 'b' : 'a'];
    const rotation = (Number(transit.pair.rotation) || 0) * (Math.PI / 180) * (transit.entranceKey === 'a' ? 1 : -1);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rotated = {
      x: (velocity.x * cos) - (velocity.y * sin),
      y: (velocity.x * sin) + (velocity.y * cos),
    };
    const speed = Math.max(0.001, Math.hypot(rotated.x, rotated.y));
    const clearance = Number(exit.radius) + shipRadius + 4;
    velocity.x = rotated.x;
    velocity.y = rotated.y;
    position = {
      x: Number(exit.x) + (rotated.x / speed) * clearance,
      y: Number(exit.y) + (rotated.y / speed) * clearance,
    };
    cooldown = 10;
    return {
      position,
      velocity,
      acceleration,
      event: { status: 'wormhole', at: transit.at, entrance: transit.pair[transit.entranceKey], exit, pairIndex: transit.pairIndex },
      wormholeCooldown: cooldown,
    };
  }

  if (collision) {
    position = {
      x: previous.x + ((position.x - previous.x) * collision.at),
      y: previous.y + ((position.y - previous.y) * collision.at),
    };
  }
  return { position, velocity, acceleration, event: collision, wormholeCooldown: cooldown };
}

export function simulateTrajectory(options) {
  const position = { x: Number(options.position.x), y: Number(options.position.y) };
  const velocity = { x: Number(options.velocity.x), y: Number(options.velocity.y) };
  const attractors = options.attractors || [];
  const fields = options.fields || [];
  const wormholes = options.wormholes || [];
  const obstacles = options.obstacles || attractors;
  const target = options.target;
  const bounds = options.bounds || { width: WORLD.width, height: WORLD.height, margin: WORLD.boundsMargin };
  const shipRadius = Number(options.shipRadius) || WORLD.shipRadius;
  const maximumSteps = Math.max(1, Math.round(Number(options.maxSteps) || WORLD.maxSteps));
  const sampleEvery = Math.max(1, Math.round(Number(options.sampleEvery) || WORLD.sampleEvery));
  const points = [{ ...position }];
  let status = 'flying';
  let collision = null;
  let steps = 0;
  let wormholeCooldown = 0;

  for (steps = 1; steps <= maximumSteps; steps += 1) {
    const step = advanceFlightStep({
      position,
      velocity,
      attractors,
      fields,
      wormholes,
      wormholeCooldown,
      obstacles,
      target,
      shipRadius,
      maxAcceleration: options.maxAcceleration,
    });
    position.x = step.position.x;
    position.y = step.position.y;
    velocity.x = step.velocity.x;
    velocity.y = step.velocity.y;
    wormholeCooldown = step.wormholeCooldown;

    if (![position.x, position.y, velocity.x, velocity.y].every(Number.isFinite)) {
      status = 'invalid';
      break;
    }

    collision = step.event;
    if (collision?.status === 'wormhole') {
      points.push({ ...collision.entrance });
      points.push({ ...position, jump: true });
    } else if (collision) {
      status = collision.status;
      points.push({ ...position });
      break;
    }

    const margin = Number(bounds.margin) || 0;
    if (
      position.x < -margin
      || position.y < -margin
      || position.x > Number(bounds.width) + margin
      || position.y > Number(bounds.height) + margin
    ) {
      status = 'out-of-bounds';
      points.push({ ...position });
      break;
    }

    if (steps % sampleEvery === 0) points.push({ ...position });
  }

  if (status === 'flying' && steps > maximumSteps) status = 'timeout';

  return {
    status,
    position: { ...position },
    velocity: { ...velocity },
    points,
    steps: Math.min(steps, maximumSteps),
    collision,
  };
}

export function calculateResult(metrics, par) {
  const time = Math.max(0.001, Number(metrics.time) || 0.001);
  const power = Math.max(0.001, Number(metrics.power) || 0.001);
  const parTime = Math.max(0.001, Number(par.time) || 0.001);
  const parPower = Math.max(0.001, Number(par.power) || 0.001);
  const firstAttempt = Boolean(metrics.firstAttempt);
  const stars = clamp(1 + (time <= parTime ? 1 : 0) + (power <= parPower ? 1 : 0), 1, 3);
  const score = 1000
    + Math.round(1000 * Math.min(1, parTime / time))
    + Math.round(1000 * Math.min(1, parPower / power))
    + (firstAttempt ? 250 : 0);

  return { stars, score };
}

export function createDefaultProgress(levelCount = LEVELS.length) {
  const levels = {};
  for (let id = 1; id <= levelCount; id += 1) {
    levels[id] = { stars: 0, bestScore: 0, bestTime: null, minPower: null };
  }

  return {
    version: GAME_VERSION,
    unlocked: 1,
    sound: true,
    levels,
  };
}

export function parseProgress(value, levelCount = LEVELS.length) {
  const fallback = createDefaultProgress(levelCount);
  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== GAME_VERSION) return fallback;

  const progress = createDefaultProgress(levelCount);
  progress.unlocked = Math.round(clamp(parsed.unlocked, 1, levelCount));
  progress.sound = parsed.sound !== false;

  for (let id = 1; id <= levelCount; id += 1) {
    const record = parsed.levels?.[id];
    if (!record || typeof record !== 'object') continue;

    progress.levels[id] = {
      stars: Math.round(clamp(record.stars, 0, 3)),
      bestScore: Math.max(0, Math.round(Number(record.bestScore) || 0)),
      bestTime: Number.isFinite(Number(record.bestTime)) && Number(record.bestTime) > 0
        ? Number(record.bestTime)
        : null,
      minPower: Number.isFinite(Number(record.minPower)) && Number(record.minPower) > 0
        ? Number(record.minPower)
        : null,
    };
  }

  return progress;
}

export function recordLevelResult(progressValue, levelIndex, result, metrics, levelCount = LEVELS.length) {
  const progress = parseProgress(progressValue, levelCount);
  const id = Math.round(clamp(Number(levelIndex) + 1, 1, levelCount));
  const previous = progress.levels[id];
  const time = Math.max(0.001, Number(metrics.time) || 0.001);
  const power = Math.max(0.001, Number(metrics.power) || 0.001);

  progress.levels[id] = {
    stars: Math.max(previous.stars, Math.round(clamp(result.stars, 1, 3))),
    bestScore: Math.max(previous.bestScore, Math.max(0, Math.round(Number(result.score) || 0))),
    bestTime: previous.bestTime === null ? time : Math.min(previous.bestTime, time),
    minPower: previous.minPower === null ? power : Math.min(previous.minPower, power),
  };
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelCount, id + 1));

  return progress;
}
