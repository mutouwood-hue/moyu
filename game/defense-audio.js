// The same feedback policy is shared by the renderer and the audio checks.
export function dropSound(rarity) {
  return rarity === 3 ? 'legendary_drop' : rarity >= 1 ? 'rare_drop' : null;
}

export function shotSound(moduleIds) {
  return moduleIds.includes('laser') ? 'laser_fire' : moduleIds.includes('tesla') ? 'electric_arc' : 'rifle_shot';
}

export function musicTrack(battle, paused) {
  if (!battle) return 'lobby_loop';
  return !paused && battle.status === 'playing' ? 'battle_loop' : null;
}

// Map actual game events to a single, testable feedback policy.
export function eventSound(event) {
  if (event.type === 'shot') return ({enemy:'bullet_hit',box:'crate_hit',boss:'boss_impact'})[event.target] || null;
  return ({boss:'boss_warning',intruder:'boss_warning',warning:'boss_warning',gate:'pass_gate',gateUpgrade:'gate_upgrade',kill:'zombie_down',loss:'soldier_lost'})[event.type] || null;
}

// Crowds can produce dozens of identical events in one frame. Limit repeated
// effects so a large formation remains audible without clipping or audio spam.
const cooldowns = {rifle_shot:145, laser_fire:300, electric_arc:220, bullet_hit:160,
  crate_hit:180, boss_impact:350, zombie_down:220, soldier_lost:180, gate_upgrade:180, boss_warning:400};
export function createEffectPlayer(makeAudio, now = () => performance.now()) {
  const last = new Map(), active = new Set();
  const play = (name, enabled) => {
    if (!enabled) return false;
    const t = now(), previous = last.get(name);
    if (previous !== undefined && t - previous < (cooldowns[name] || 0)) return false;
    last.set(name, t);
    const sound = makeAudio(name);
    sound.volume = name === 'rifle_shot' ? .12 : ['bullet_hit','crate_hit','zombie_down'].includes(name) ? .10 : .25;
    active.add(sound);
    sound.addEventListener?.('ended', () => active.delete(sound), {once:true});
    sound.addEventListener?.('error', () => active.delete(sound), {once:true});
    const playing = sound.play();
    if (playing && typeof playing.catch === 'function') playing.catch(() => active.delete(sound));
    return true;
  };
  play.stop = () => { for (const sound of active) { sound.pause?.(); sound.currentTime=0; } active.clear(); };
  return play;
}
