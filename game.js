(() => {
'use strict';

// ============== CONSTANTS ==============
const FIELD_W = 1200, FIELD_H = 700;
const GOAL_W = 40, GOAL_H = 160;
const PLAYER_R = 22, BALL_R = 14;
const TEAM_COLORS = {
  blue: { main: '#2196F3', dark: '#1565C0', light: '#64B5F6' },
  red: { main: '#F44336', dark: '#C62828', light: '#EF9A9A' },
  green: { main: '#4CAF50', dark: '#2E7D32', light: '#81C784' },
  yellow: { main: '#FFEB3B', dark: '#F9A825', light: '#FFF59D' },
  pink: { main: '#E91E63', dark: '#AD1457', light: '#F48FB1' },
  purple: { main: '#9C27B0', dark: '#6A1B9A', light: '#CE93D8' }
};
const AI_NAMES = ['MUITO FÁCIL','FÁCIL','TRANQUILA','NORMAL','COMPETITIVA','DIFÍCIL','MUITO DIFÍCIL','EXPERT','CAÓTICA'];
const AI_DESC = [
  'Lenta, erra muito, às vezes ignora a bola.',
  'Reage melhor, ainda comete erros.',
  'Defende e ataca de forma básica.',
  'Equilibrada, ataca e defende razoavelmente.',
  'Persegue a bola, intercepta, usa itens.',
  'Boa defesa, reação rápida, posicionamento.',
  'Antecipa, intercepta passes, usa espaços.',
  'Alta precisão, estratégia e decisões rápidas.',
  'Máxima inteligência: antecipa, bloqueia, ataca e usa itens.'
];
const ITEM_DEFS = [
  { id:'bomb', name:'BOMBA', emoji:'💣', rarity:'comum', color:'#333', w:0.22 },
  { id:'ray', name:'RAIO-X', emoji:'🔫', rarity:'incomum', color:'#00BCD4', w:0.12 },
  { id:'bread', name:'PÃO', emoji:'🍞', rarity:'comum', color:'#D4A574', w:0.18 },
  { id:'shoe', name:'TÊNIS', emoji:'👟', rarity:'comum', color:'#FF5722', w:0.16 },
  { id:'vortex', name:'VÓRTEX', emoji:'🌀', rarity:'raro', color:'#7B1FA2', w:0.08 },
  { id:'magnet', name:'ÍMÃ', emoji:'🧲', rarity:'incomum', color:'#E91E63', w:0.10 },
  { id:'speed', name:'RAIO', emoji:'⚡', rarity:'incomum', color:'#FFEB3B', w:0.12 },
  { id:'ice', name:'GELO', emoji:'🧊', rarity:'raro', color:'#81D4FA', w:0.08 },
  { id:'boomerang', name:'BUMERANGUE', emoji:'🪃', rarity:'raro', color:'#8D6E63', w:0.07 },
  { id:'balloon', name:'BALÃO', emoji:'🎈', rarity:'épico', color:'#F44336', w:0.05 }
];
const DURATIONS = [60, 120, 180, 300, 0];
const DUR_LABELS = ['1 min','2 min','3 min','5 min','SEM LIMITE'];

// ============== STATE ==============
const S = {
  state: 'MENU',
  mode: 'solo', // solo | coop | practice
  aiLevel: 4,
  teamP1: 'blue', teamP2: 'red',
  duration: 120,
  score: [0,0],
  timeLeft: 120,
  matchTime: 0,
  paused: false,
  goalFlash: 0,
  stats: { goals:[0,0], shots:[0,0], items:[0,0], passes:[0,0], ballTime:[0,0] },
  settings: {
    volume: 0.6, sfx: true, fullscreen: false,
    aiLevel: 4, duration: 120, shakeIntensity: 1, reduceEffects: false
  },
  keys: {},
  gamepads: [null, null],
  camera: { x:0, y:0, shake:0, shakeAmt:0 },
  particles: [],
  items: [],
  projectiles: [],
  effects: [],
  floatingTexts: [],
  crowd: [],
  lastSpawn: 0,
  winner: null,
  selectedBtn: 0,
  menuAnim: 0
};

let canvas, ctx, W, H, dpr = 1;
let lastT = 0, acc = 0;
const DT = 1/60;

// ============== ENTITIES ==============
class Player {
  constructor(x, y, team, isAI, ctrl) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.team = team;
    this.isAI = isAI;
    this.ctrl = ctrl; // 0 or 1
    this.r = PLAYER_R;
    this.angle = 0;
    this.kickCD = 0;
    this.item = null;
    this.itemCD = 0;
    this.speedBoost = 0;
    this.frozen = 0;
    this.knockback = 0;
    this.anim = 0;
    this.facing = 1;
    this.shape = Math.floor(Math.random()*4);
    this.acc = Math.random() > 0.5;
    this.hasBall = false;
    this.celebrate = 0;
  }
  get speed() {
    let s = 4.2;
    if (this.speedBoost > 0) s *= 1.6;
    if (this.frozen > 0) s *= 0.3;
    return s;
  }
  update(dt) {
    this.kickCD = Math.max(0, this.kickCD - dt);
    this.itemCD = Math.max(0, this.itemCD - dt);
    this.speedBoost = Math.max(0, this.speedBoost - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.knockback = Math.max(0, this.knockback - dt);
    this.celebrate = Math.max(0, this.celebrate - dt);
    this.anim += dt * 10;
    this.vx *= 0.85; this.vy *= 0.85;
    if (Math.abs(this.vx) > 0.3 || Math.abs(this.vy) > 0.3) this.facing = this.vx >= 0 ? 1 : -1;
    this.x += this.vx; this.y += this.vy;
    // bounds
    this.x = Math.max(this.r + 10, Math.min(FIELD_W - this.r - 10, this.x));
    this.y = Math.max(this.r + 10, Math.min(FIELD_H - this.r - 10, this.y));
  }
}

class Ball {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = FIELD_W/2; this.y = FIELD_H/2;
    this.vx = 0; this.vy = 0;
    this.r = BALL_R;
    this.spin = 0;
    this.owner = null;
    this.ice = 0;
    this.balloon = 0;
    this.lastTouch = -1;
  }
  update(dt) {
    this.ice = Math.max(0, this.ice - dt);
    this.balloon = Math.max(0, this.balloon - dt);
    let fric = this.ice > 0 ? 0.96 : (this.balloon > 0 ? 0.99 : 0.985);
    this.vx *= fric; this.vy *= fric;
    if (this.ice > 0) { this.vx *= 0.92; this.vy *= 0.92; }
    this.x += this.vx; this.y += this.vy;
    this.spin += this.vx * 0.15;
    // walls
    if (this.y < this.r + 8) { this.y = this.r + 8; this.vy = Math.abs(this.vy) * 0.85; sound('bounce'); }
    if (this.y > FIELD_H - this.r - 8) { this.y = FIELD_H - this.r - 8; this.vy = -Math.abs(this.vy) * 0.85; sound('bounce'); }
    // side walls except goals
    const gy1 = FIELD_H/2 - GOAL_H/2, gy2 = FIELD_H/2 + GOAL_H/2;
    if (this.x < this.r + 8) {
      if (this.y < gy1 || this.y > gy2) { this.x = this.r + 8; this.vx = Math.abs(this.vx)*0.85; sound('bounce'); }
    }
    if (this.x > FIELD_W - this.r - 8) {
      if (this.y < gy1 || this.y > gy2) { this.x = FIELD_W - this.r - 8; this.vx = -Math.abs(this.vx)*0.85; sound('bounce'); }
    }
  }
}

class ItemPickup {
  constructor(x, y, def) {
    this.x = x; this.y = y; this.def = def;
    this.life = 12; this.bob = Math.random()*Math.PI*2;
    this.r = 16;
  }
}

class Projectile {
  constructor(type, x, y, vx, vy, owner) {
    this.type = type; this.x = x; this.y = y;
    this.vx = vx; this.vy = vy; this.owner = owner;
    this.life = 4; this.rot = 0; this.r = 12;
    this.timer = type === 'bomb' ? 1.8 : 0;
    this.returned = false;
  }
}

// ============== SOUND ==============
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function sound(type) {
  if (!S.settings.sfx || S.settings.volume <= 0) return;
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const g = audioCtx.createGain();
  g.connect(audioCtx.destination);
  g.gain.value = S.settings.volume * 0.3;
  const o = audioCtx.createOscillator();
  o.connect(g);
  switch(type) {
    case 'kick': o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t+0.12); g.gain.exponentialRampToValueAtTime(0.001, t+0.12); o.type='square'; o.start(t); o.stop(t+0.12); break;
    case 'bounce': o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(100, t+0.08); g.gain.exponentialRampToValueAtTime(0.001, t+0.08); o.type='triangle'; o.start(t); o.stop(t+0.08); break;
    case 'goal': o.frequency.setValueAtTime(400, t); o.frequency.setValueAtTime(600, t+0.1); o.frequency.setValueAtTime(800, t+0.2); g.gain.exponentialRampToValueAtTime(0.001, t+0.5); o.type='sawtooth'; o.start(t); o.stop(t+0.5); break;
    case 'explosion': o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(30, t+0.3); g.gain.exponentialRampToValueAtTime(0.001, t+0.3); o.type='sawtooth'; o.start(t); o.stop(t+0.3); break;
    case 'pickup': o.frequency.setValueAtTime(600, t); o.frequency.setValueAtTime(900, t+0.08); g.gain.exponentialRampToValueAtTime(0.001, t+0.15); o.type='sine'; o.start(t); o.stop(t+0.15); break;
    case 'item': o.frequency.setValueAtTime(200, t); o.frequency.setValueAtTime(400, t+0.1); g.gain.exponentialRampToValueAtTime(0.001, t+0.2); o.type='square'; o.start(t); o.stop(t+0.2); break;
    case 'click': o.frequency.setValueAtTime(500, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.05); o.type='sine'; o.start(t); o.stop(t+0.05); break;
    case 'win': o.frequency.setValueAtTime(300, t); o.frequency.setValueAtTime(500, t+0.15); o.frequency.setValueAtTime(700, t+0.3); g.gain.exponentialRampToValueAtTime(0.001, t+0.6); o.type='triangle'; o.start(t); o.stop(t+0.6); break;
    case 'lose': o.frequency.setValueAtTime(300, t); o.frequency.setValueAtTime(150, t+0.3); g.gain.exponentialRampToValueAtTime(0.001, t+0.5); o.type='sawtooth'; o.start(t); o.stop(t+0.5); break;
  }
}

// ============== PARTICLES ==============
function createParticles(x, y, amount, type) {
  if (S.settings.reduceEffects) amount = Math.ceil(amount/3);
  for (let i = 0; i < amount; i++) {
    const a = Math.random()*Math.PI*2;
    const sp = type === 'explosion' ? 3+Math.random()*6 : 1+Math.random()*4;
    S.particles.push({
      x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
      life: 0.4 + Math.random()*0.8, max: 1,
      size: 2 + Math.random()*6, rot: Math.random()*Math.PI*2,
      vr: (Math.random()-0.5)*0.3, type,
      color: type==='confetti' ? ['#F44336','#2196F3','#FFEB3B','#4CAF50','#E91E63','#FF9800'][Math.floor(Math.random()*6)]
           : type==='star' ? '#FFD700' : type==='spark' ? '#FFF' : type==='explosion' ? '#FF5722' : '#8D6E63',
      g: type==='confetti' || type==='dust' ? 0.15 : 0.05
    });
  }
}
function updateParticles(dt) {
  for (let i = S.particles.length-1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
    if (p.life <= 0) S.particles.splice(i,1);
  }
}
function floatText(x, y, text, color) {
  S.floatingTexts.push({ x, y, text, color: color||'#FFF', life: 1.2, vy: -1.5 });
}

// ============== GAME OBJECTS ==============
let players = [], ball, teams = [[],[]];

function spawnPlayers() {
  players = [];
  const c1 = TEAM_COLORS[S.teamP1], c2 = TEAM_COLORS[S.teamP2];
  // Team 1 (left)
  const p1 = new Player(200, FIELD_H/2, S.teamP1, false, 0);
  players.push(p1);
  if (S.mode === 'solo' || S.mode === 'practice') {
    // AI teammates optional - keep simple: 1v1 or 2v2 light
    const a1 = new Player(150, FIELD_H/2 - 80, S.teamP1, true, -1);
    const a2 = new Player(150, FIELD_H/2 + 80, S.teamP1, true, -1);
    players.push(a1, a2);
  } else {
    const p2 = new Player(200, FIELD_H/2 + 100, S.teamP1, false, 1);
    players.push(p2);
  }
  // Team 2 (right)
  if (S.mode === 'practice') {
    // passive opponents or none
    const a = new Player(FIELD_W-200, FIELD_H/2, S.teamP2, true, -1);
    a.passive = true;
    players.push(a);
  } else {
    const e1 = new Player(FIELD_W-200, FIELD_H/2, S.teamP2, true, -1);
    const e2 = new Player(FIELD_W-150, FIELD_H/2 - 90, S.teamP2, true, -1);
    const e3 = new Player(FIELD_W-150, FIELD_H/2 + 90, S.teamP2, true, -1);
    players.push(e1, e2, e3);
  }
  teams = [[],[]];
  players.forEach(p => {
    if (p.team === S.teamP1) teams[0].push(p);
    else teams[1].push(p);
  });
}

function resetPositions() {
  const left = teams[0], right = teams[1];
  left.forEach((p,i) => {
    p.x = 180 + (i%2)*40; p.y = FIELD_H/2 + (i-1)*90;
    p.vx = 0; p.vy = 0; p.item = null; p.speedBoost = 0; p.frozen = 0;
  });
  right.forEach((p,i) => {
    p.x = FIELD_W - 180 - (i%2)*40; p.y = FIELD_H/2 + (i-1)*90;
    p.vx = 0; p.vy = 0; p.item = null; p.speedBoost = 0; p.frozen = 0;
  });
  ball.reset();
  S.projectiles = []; S.items = [];
}

function startMatch() {
  S.score = [0,0]; S.matchTime = 0;
  S.timeLeft = S.settings.duration || S.duration;
  if (S.timeLeft === 0) S.timeLeft = 99999;
  S.stats = { goals:[0,0], shots:[0,0], items:[0,0], passes:[0,0], ballTime:[0,0] };
  S.particles = []; S.floatingTexts = []; S.effects = [];
  S.winner = null; S.goalFlash = 0; S.lastSpawn = 0;
  ball = new Ball();
  spawnPlayers();
  resetPositions();
  S.state = 'PLAYING';
  initCrowd();
}

function initCrowd() {
  S.crowd = [];
  for (let i = 0; i < 40; i++) {
    S.crowd.push({
      x: 30 + Math.random()*(FIELD_W-60),
      y: Math.random() < 0.5 ? 5 + Math.random()*25 : FIELD_H - 30 + Math.random()*25,
      color: ['#F44336','#2196F3','#FFEB3B','#4CAF50','#E91E63','#FFF'][Math.floor(Math.random()*6)],
      phase: Math.random()*Math.PI*2, size: 4+Math.random()*5
    });
  }
}

// ============== INPUT ==============
function setupInput() {
  window.addEventListener('keydown', e => {
    S.keys[e.code] = true;
    if (e.code === 'Escape') {
      if (S.state === 'PLAYING') { S.state = 'PAUSED'; sound('click'); }
      else if (S.state === 'PAUSED') { S.state = 'PLAYING'; sound('click'); }
    }
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { S.keys[e.code] = false; });
  window.addEventListener('blur', () => { S.keys = {}; });
}

function getAxis(ctrl) {
  let dx = 0, dy = 0;
  if (ctrl === 0) {
    if (S.keys['KeyW'] || S.keys['KeyZ']) dy -= 1;
    if (S.keys['KeyS']) dy += 1;
    if (S.keys['KeyA'] || S.keys['KeyQ']) dx -= 1;
    if (S.keys['KeyD']) dx += 1;
  } else if (ctrl === 1) {
    if (S.keys['ArrowUp']) dy -= 1;
    if (S.keys['ArrowDown']) dy += 1;
    if (S.keys['ArrowLeft']) dx -= 1;
    if (S.keys['ArrowRight']) dx += 1;
  }
  // gamepad
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps[ctrl];
  if (gp) {
    const ax = gp.axes[0]||0, ay = gp.axes[1]||0;
    if (Math.abs(ax) > 0.2) dx += ax;
    if (Math.abs(ay) > 0.2) dy += ay;
  }
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  return { dx, dy };
}
function wantsKick(ctrl) {
  if (ctrl === 0) return S.keys['Space'] || (navigator.getGamepads && navigator.getGamepads()[0] && navigator.getGamepads()[0].buttons[0]?.pressed);
  if (ctrl === 1) return S.keys['Enter'] || (navigator.getGamepads && navigator.getGamepads()[1] && navigator.getGamepads()[1].buttons[0]?.pressed);
  return false;
}
function wantsItem(ctrl) {
  if (ctrl === 0) return S.keys['ShiftLeft'] || S.keys['ShiftRight'];
  if (ctrl === 1) return S.keys['ControlRight'];
  return false;
}

// ============== AI ==============
function updateAI(p, dt) {
  if (p.passive) return;
  const lvl = S.aiLevel;
  const react = 0.15 + (9-lvl)*0.08;
  const speedMul = 0.55 + lvl * 0.05;
  const accuracy = 0.3 + lvl * 0.08;
  const aggress = 0.2 + lvl * 0.09;

  // decision delay
  if (!p._aiT) p._aiT = 0;
  p._aiT -= dt;
  if (p._aiT > 0 && lvl < 7) return;
  p._aiT = react * (0.5 + Math.random());

  const bx = ball.x, by = ball.y;
  const isAttack = (p.team === S.teamP1 && bx > FIELD_W*0.4) || (p.team === S.teamP2 && bx < FIELD_W*0.6);
  const goalX = p.team === S.teamP1 ? FIELD_W - 30 : 30;
  const ownGoalX = p.team === S.teamP1 ? 30 : FIELD_W - 30;
  const distBall = Math.hypot(p.x - bx, p.y - by);

  let tx = bx, ty = by;

  // strategy by level
  if (lvl >= 5 && distBall > 120) {
    // intercept prediction
    const pred = 0.3 + (lvl-5)*0.08;
    tx = bx + ball.vx * pred * 60;
    ty = by + ball.vy * pred * 60;
  }
  if (lvl >= 6 && !isAttack && distBall > 80) {
    // defend position
    tx = (ownGoalX + bx) / 2;
    ty = by * 0.6 + FIELD_H/2 * 0.4;
  }
  if (lvl >= 7 && isAttack) {
    tx = (goalX + bx) / 2;
    ty = by;
  }
  // sometimes ignore (low levels)
  if (lvl <= 2 && Math.random() < 0.25) { tx = p.x; ty = p.y; }

  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = p.speed * speedMul;
  p.vx += (dx/d) * sp * 0.35;
  p.vy += (dy/d) * sp * 0.35;

  // kick
  if (distBall < PLAYER_R + BALL_R + 18 && p.kickCD <= 0) {
    const shouldKick = Math.random() < accuracy * aggress;
    if (shouldKick || lvl >= 8) {
      const angle = Math.atan2(goalX - p.x, by - p.y ? goalX - bx : goalX - p.x);
      const power = 8 + lvl * 0.6 + Math.random()*3;
      const ang = Math.atan2(by - p.y, bx - p.x) + (Math.random()-0.5)*(1.2 - accuracy);
      // better aim high levels
      let aimX = goalX, aimY = FIELD_H/2 + (Math.random()-0.5)*GOAL_H*0.6;
      if (lvl >= 4) {
        const a2 = Math.atan2(aimY - p.y, aimX - p.x);
        ball.vx = Math.cos(a2) * power * (0.7 + accuracy*0.3);
        ball.vy = Math.sin(a2) * power * (0.7 + accuracy*0.3);
      } else {
        ball.vx = Math.cos(ang) * power;
        ball.vy = Math.sin(ang) * power;
      }
      ball.lastTouch = p.team === S.teamP1 ? 0 : 1;
      p.kickCD = 0.4;
      S.stats.shots[p.team === S.teamP1 ? 0 : 1]++;
      sound('kick');
      createParticles(ball.x, ball.y, 6, 'impact');
    }
  }

  // use item
  if (p.item && p.itemCD <= 0 && lvl >= 4 && Math.random() < 0.02 + lvl*0.008) {
    useItem(p);
  }
}

// ============== ITEMS ==============
function pickItemDef() {
  const r = Math.random();
  let acc = 0;
  for (const d of ITEM_DEFS) {
    acc += d.w;
    if (r <= acc) return d;
  }
  return ITEM_DEFS[0];
}
function spawnItem() {
  let x, y, ok = false, tries = 0;
  while (!ok && tries < 30) {
    x = 80 + Math.random()*(FIELD_W-160);
    y = 60 + Math.random()*(FIELD_H-120);
    ok = true;
    // not in goals
    if ((x < 60 || x > FIELD_W-60) && Math.abs(y - FIELD_H/2) < GOAL_H/2 + 20) ok = false;
    for (const p of players) if (Math.hypot(p.x-x,p.y-y) < 50) ok = false;
    for (const it of S.items) if (Math.hypot(it.x-x,it.y-y) < 40) ok = false;
    tries++;
  }
  if (ok) S.items.push(new ItemPickup(x, y, pickItemDef()));
}

function useItem(p) {
  if (!p.item || p.itemCD > 0) return;
  const id = p.item.id;
  p.itemCD = 0.8;
  S.stats.items[p.team === S.teamP1 ? 0 : 1]++;
  sound('item');
  floatText(p.x, p.y - 30, p.item.emoji + ' ' + p.item.name, '#FFD700');
  const dir = p.facing;
  switch(id) {
    case 'bomb':
      S.projectiles.push(new Projectile('bomb', p.x + dir*30, p.y, 0, 0, p));
      break;
    case 'ray': {
      // ray visual + push ball
      S.effects.push({ type:'ray', x:p.x, y:p.y, angle: Math.atan2(ball.y-p.y, ball.x-p.x), life:0.4, owner:p });
      const d = Math.hypot(ball.x-p.x, ball.y-p.y);
      if (d < 400) {
        const a = Math.atan2(ball.y-p.y, ball.x-p.x);
        ball.vx += Math.cos(a)*12; ball.vy += Math.sin(a)*12;
        createParticles(ball.x, ball.y, 12, 'spark');
      }
      break;
    }
    case 'bread':
      S.projectiles.push(new Projectile('bread', p.x, p.y, dir*9, (Math.random()-0.5)*4, p));
      break;
    case 'shoe':
      S.projectiles.push(new Projectile('shoe', p.x, p.y, dir*10, (Math.random()-0.5)*3, p));
      break;
    case 'vortex':
      S.effects.push({ type:'vortex', x: p.x + dir*80, y: p.y, life: 3.5, r: 50 });
      break;
    case 'magnet':
      p.magnet = 2.5;
      floatText(p.x, p.y-25, '🧲 ÍMÃ!', '#E91E63');
      break;
    case 'speed':
      p.speedBoost = 3.5;
      floatText(p.x, p.y-25, '⚡ SPEED!', '#FFEB3B');
      createParticles(p.x, p.y, 10, 'spark');
      break;
    case 'ice':
      ball.ice = 3.5;
      floatText(ball.x, ball.y-20, '🧊 GELO!', '#81D4FA');
      createParticles(ball.x, ball.y, 15, 'spark');
      break;
    case 'boomerang':
      S.projectiles.push(new Projectile('boomerang', p.x, p.y, dir*11, 0, p));
      break;
    case 'balloon':
      ball.balloon = 4;
      floatText(ball.x, ball.y-20, '🎈 LEVE!', '#F44336');
      break;
  }
  p.item = null;
}

function updateProjectiles(dt) {
  for (let i = S.projectiles.length-1; i >= 0; i--) {
    const pr = S.projectiles[i];
    pr.life -= dt; pr.rot += 0.2;
    if (pr.type === 'bomb') {
      pr.timer -= dt;
      if (pr.timer <= 0) {
        // explode
        sound('explosion');
        createParticles(pr.x, pr.y, 25, 'explosion');
        shakeCamera(12, 0.4);
        for (const p of players) {
          const d = Math.hypot(p.x-pr.x, p.y-pr.y);
          if (d < 120) {
            const a = Math.atan2(p.y-pr.y, p.x-pr.x);
            p.vx += Math.cos(a) * (14 - d/15);
            p.vy += Math.sin(a) * (14 - d/15);
            p.knockback = 0.3;
          }
        }
        const db = Math.hypot(ball.x-pr.x, ball.y-pr.y);
        if (db < 130) {
          const a = Math.atan2(ball.y-pr.y, ball.x-pr.x);
          ball.vx += Math.cos(a) * (16 - db/12);
          ball.vy += Math.sin(a) * (16 - db/12);
        }
        S.projectiles.splice(i,1);
        continue;
      }
    } else {
      pr.x += pr.vx; pr.y += pr.vy;
      pr.vx *= 0.99; pr.vy *= 0.99;
      if (pr.type === 'bread' || pr.type === 'shoe') {
        if (pr.y < 20 || pr.y > FIELD_H-20) pr.vy *= -0.9;
        if (pr.x < 20 || pr.x > FIELD_W-20) pr.vx *= -0.9;
      }
      if (pr.type === 'boomerang') {
        if (!pr.returned && pr.life < 2.2) {
          pr.returned = true;
        }
        if (pr.returned && pr.owner) {
          const a = Math.atan2(pr.owner.y - pr.y, pr.owner.x - pr.x);
          pr.vx += Math.cos(a)*0.8; pr.vy += Math.sin(a)*0.8;
        }
      }
      // hit players
      for (const p of players) {
        if (p === pr.owner) continue;
        if (Math.hypot(p.x-pr.x, p.y-pr.y) < p.r + pr.r) {
          const a = Math.atan2(p.y-pr.y, p.x-pr.x);
          p.vx += Math.cos(a)*8; p.vy += Math.sin(a)*8;
          createParticles(pr.x, pr.y, 8, 'impact');
          floatText(p.x, p.y-20, '💥', '#FFF');
          if (pr.type !== 'boomerang') { S.projectiles.splice(i,1); break; }
        }
      }
      // hit ball
      if (Math.hypot(ball.x-pr.x, ball.y-pr.y) < ball.r + pr.r + 5) {
        ball.vx += pr.vx * 0.4; ball.vy += pr.vy * 0.4;
        createParticles(pr.x, pr.y, 6, 'spark');
      }
    }
    if (pr.life <= 0) S.projectiles.splice(i,1);
  }
}

function updateEffects(dt) {
  for (let i = S.effects.length-1; i >= 0; i--) {
    const e = S.effects[i];
    e.life -= dt;
    if (e.type === 'vortex') {
      const d = Math.hypot(ball.x - e.x, ball.y - e.y);
      if (d < e.r + 30) {
        const a = Math.atan2(e.y - ball.y, e.x - ball.x);
        ball.vx += Math.cos(a) * 0.6; ball.vy += Math.sin(a) * 0.6;
      }
    }
    if (e.life <= 0) S.effects.splice(i,1);
  }
  // magnet
  for (const p of players) {
    if (p.magnet > 0) {
      p.magnet -= dt;
      const d = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (d < 200) {
        const a = Math.atan2(p.y - ball.y, p.x - ball.x);
        ball.vx += Math.cos(a) * 0.5; ball.vy += Math.sin(a) * 0.5;
      }
    }
  }
}

// ============== COLLISIONS ==============
function resolveCollisions() {
  // player-player
  for (let i = 0; i < players.length; i++) {
    for (let j = i+1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minD = a.r + b.r;
      if (dist < minD && dist > 0) {
        const nx = dx/dist, ny = dy/dist;
        const overlap = minD - dist;
        a.x -= nx * overlap/2; a.y -= ny * overlap/2;
        b.x += nx * overlap/2; b.y += ny * overlap/2;
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const imp = (dvx*nx + dvy*ny) * 0.5;
        a.vx -= imp * nx; a.vy -= imp * ny;
        b.vx += imp * nx; b.vy += imp * ny;
      }
    }
  }
  // player-ball
  for (const p of players) {
    const dx = ball.x - p.x, dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    const minD = p.r + ball.r;
    if (dist < minD && dist > 0) {
      const nx = dx/dist, ny = dy/dist;
      const overlap = minD - dist;
      ball.x += nx * overlap; ball.y += ny * overlap;
      const speed = Math.hypot(p.vx, p.vy);
      ball.vx += nx * (2 + speed*0.4) + p.vx*0.3;
      ball.vy += ny * (2 + speed*0.4) + p.vy*0.3;
      ball.lastTouch = p.team === S.teamP1 ? 0 : 1;
      if (speed > 2) { sound('bounce'); createParticles(ball.x, ball.y, 4, 'dust'); }
    }
  }
  // pickups
  for (let i = S.items.length-1; i >= 0; i--) {
    const it = S.items[i];
    it.life -= 1/60; it.bob += 0.1;
    if (it.life <= 0) { S.items.splice(i,1); continue; }
    for (const p of players) {
      if (p.isAI && S.aiLevel < 3) continue;
      if (Math.hypot(p.x-it.x, p.y-it.y) < p.r + it.r) {
        if (!p.item) {
          p.item = it.def;
          sound('pickup');
          floatText(p.x, p.y-30, '✨ ' + it.def.name, '#FFD700');
          createParticles(it.x, it.y, 10, 'star');
          S.items.splice(i,1);
          break;
        }
      }
    }
  }
}

// ============== GOALS ==============
function checkGoals() {
  const gy1 = FIELD_H/2 - GOAL_H/2, gy2 = FIELD_H/2 + GOAL_H/2;
  if (ball.x < -5 && ball.y > gy1 && ball.y < gy2) {
    onGoal(1);
  } else if (ball.x > FIELD_W + 5 && ball.y > gy1 && ball.y < gy2) {
    onGoal(0);
  }
}
function onGoal(team) {
  S.score[team]++;
  S.stats.goals[team]++;
  S.state = 'GOAL';
  S.goalFlash = 2.2;
  sound('goal');
  shakeCamera(10, 0.5);
  createParticles(ball.x, FIELD_H/2, 40, 'confetti');
  createParticles(ball.x, FIELD_H/2, 20, 'star');
  players.forEach(p => { if (p.team === (team===0?S.teamP1:S.teamP2)) p.celebrate = 2; });
  floatText(FIELD_W/2, FIELD_H/2 - 40, '⚽ GOOOOOOOL!', '#FFD700');
}

// ============== CAMERA ==============
function shakeCamera(amt, dur) {
  if (S.settings.reduceEffects) amt *= 0.3;
  S.camera.shakeAmt = Math.max(S.camera.shakeAmt, amt * S.settings.shakeIntensity);
  S.camera.shake = Math.max(S.camera.shake, dur);
}
function updateCamera(dt) {
  let tx = ball.x - W/(2*dpr), ty = ball.y - H/(2*dpr);
  // follow action
  S.camera.x += (tx - S.camera.x) * 0.08;
  S.camera.y += (ty - S.camera.y) * 0.08;
  S.camera.x = Math.max(-50, Math.min(FIELD_W - W/dpr + 50, S.camera.x));
  S.camera.y = Math.max(-30, Math.min(FIELD_H - H/dpr + 30, S.camera.y));
  if (S.camera.shake > 0) {
    S.camera.shake -= dt;
    S.camera.x += (Math.random()-0.5) * S.camera.shakeAmt;
    S.camera.y += (Math.random()-0.5) * S.camera.shakeAmt;
    S.camera.shakeAmt *= 0.9;
  }
}

// ============== UPDATE ==============
function update(dt) {
  S.menuAnim += dt;
  if (S.state === 'GOAL') {
    S.goalFlash -= dt;
    updateParticles(dt);
    if (S.goalFlash <= 0) {
      resetPositions();
      S.state = 'PLAYING';
    }
    return;
  }
  if (S.state !== 'PLAYING') return;

  // timer
  if (S.duration > 0 || S.settings.duration > 0) {
    S.timeLeft -= dt;
    if (S.timeLeft <= 0) {
      endMatch();
      return;
    }
  }
  S.matchTime += dt;

  // input players
  for (const p of players) {
    if (!p.isAI) {
      const { dx, dy } = getAxis(p.ctrl);
      p.vx += dx * p.speed * 0.4;
      p.vy += dy * p.speed * 0.4;
      if (wantsKick(p.ctrl) && p.kickCD <= 0) {
        const dist = Math.hypot(ball.x-p.x, ball.y-p.y);
        if (dist < p.r + ball.r + 25) {
          const a = Math.atan2(ball.y-p.y, ball.x-p.x);
          const power = 11 + Math.random()*3;
          ball.vx = Math.cos(a)*power; ball.vy = Math.sin(a)*power;
          ball.lastTouch = p.team === S.teamP1 ? 0 : 1;
          p.kickCD = 0.35;
          S.stats.shots[p.team === S.teamP1 ? 0 : 1]++;
          sound('kick');
          createParticles(ball.x, ball.y, 8, 'impact');
        }
      }
      if (wantsItem(p.ctrl)) useItem(p);
    } else {
      updateAI(p, dt);
    }
    p.update(dt);
  }

  ball.update(dt);
  resolveCollisions();
  checkGoals();
  updateProjectiles(dt);
  updateEffects(dt);
  updateParticles(dt);

  // floating texts
  for (let i = S.floatingTexts.length-1; i>=0; i--) {
    const f = S.floatingTexts[i];
    f.life -= dt; f.y += f.vy;
    if (f.life <= 0) S.floatingTexts.splice(i,1);
  }

  // spawn items
  S.lastSpawn += dt;
  if (S.lastSpawn > 4 + Math.random()*3 && S.items.length < 4) {
    spawnItem();
    S.lastSpawn = 0;
  }

  // ball possession time
  if (ball.lastTouch >= 0) S.stats.ballTime[ball.lastTouch] += dt;

  updateCamera(dt);
}

function endMatch() {
  S.state = 'GAME_OVER';
  if (S.score[0] > S.score[1]) { S.winner = 0; sound('win'); }
  else if (S.score[1] > S.score[0]) { S.winner = 1; sound('lose'); }
  else { S.winner = -1; sound('click'); }
  saveSettings();
}

// ============== RENDER ==============
function drawField() {
  // grass
  ctx.fillStyle = '#2d8f2d';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  // stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i%2===0 ? '#2d8f2d' : '#278027';
    ctx.fillRect(i*(FIELD_W/12), 0, FIELD_W/12, FIELD_H);
  }
  // lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, FIELD_W-40, FIELD_H-40);
  // center
  ctx.beginPath();
  ctx.moveTo(FIELD_W/2, 20); ctx.lineTo(FIELD_W/2, FIELD_H-20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(FIELD_W/2, FIELD_H/2, 70, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(FIELD_W/2, FIELD_H/2, 6, 0, Math.PI*2);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  // areas
  ctx.strokeRect(20, FIELD_H/2 - 120, 100, 240);
  ctx.strokeRect(FIELD_W-120, FIELD_H/2 - 120, 100, 240);
  ctx.strokeRect(20, FIELD_H/2 - 70, 45, 140);
  ctx.strokeRect(FIELD_W-65, FIELD_H/2 - 70, 45, 140);
  // goals
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, FIELD_H/2 - GOAL_H/2, GOAL_W, GOAL_H);
  ctx.fillRect(FIELD_W - GOAL_W, FIELD_H/2 - GOAL_H/2, GOAL_W, GOAL_H);
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, FIELD_H/2 - GOAL_H/2, GOAL_W, GOAL_H);
  ctx.strokeRect(FIELD_W - GOAL_W, FIELD_H/2 - GOAL_H/2, GOAL_W, GOAL_H);
  // net
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(0, FIELD_H/2-GOAL_H/2 + i*GOAL_H/7); ctx.lineTo(GOAL_W, FIELD_H/2-GOAL_H/2 + i*GOAL_H/7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FIELD_W, FIELD_H/2-GOAL_H/2 + i*GOAL_H/7); ctx.lineTo(FIELD_W-GOAL_W, FIELD_H/2-GOAL_H/2 + i*GOAL_H/7); ctx.stroke();
  }
  // crowd
  for (const c of S.crowd) {
    const bob = Math.sin(S.menuAnim*3 + c.phase)*3;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, c.size, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.celebrate > 0) ctx.translate(0, -Math.sin(p.celebrate*15)*8);
  const col = TEAM_COLORS[p.team] || TEAM_COLORS.blue;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, p.r+2, p.r*0.9, 6, 0, 0, Math.PI*2); ctx.fill();
  // body
  ctx.fillStyle = col.main;
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = 3;
  if (p.shape === 0) { // round
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  } else if (p.shape === 1) { // square
    ctx.beginPath();
    roundRect(-p.r, -p.r, p.r*2, p.r*2, 8);
    ctx.fill(); ctx.stroke();
  } else if (p.shape === 2) { // tall
    ctx.beginPath();
    roundRect(-p.r*0.8, -p.r*1.1, p.r*1.6, p.r*2.2, 10);
    ctx.fill(); ctx.stroke();
  } else { // wide
    ctx.beginPath();
    roundRect(-p.r*1.15, -p.r*0.75, p.r*2.3, p.r*1.5, 10);
    ctx.fill(); ctx.stroke();
  }
  // face
  ctx.fillStyle = '#FFF';
  ctx.beginPath(); ctx.arc(-6*p.facing, -4, 5, 0, Math.PI*2); ctx.arc(6*p.facing, -4, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-6*p.facing, -4, 2.5, 0, Math.PI*2); ctx.arc(6*p.facing, -4, 2.5, 0, Math.PI*2); ctx.fill();
  // smile
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 4, 6, 0.2, Math.PI-0.2); ctx.stroke();
  // accessories
  if (p.acc) {
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, -p.r-4, 20, 5);
  }
  // speed trail
  if (p.speedBoost > 0) {
    ctx.strokeStyle = 'rgba(255,235,59,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-p.facing*p.r-5, 0); ctx.lineTo(-p.facing*p.r-20, 0); ctx.stroke();
  }
  // frozen
  if (p.frozen > 0) {
    ctx.fillStyle = 'rgba(129,212,250,0.4)';
    ctx.beginPath(); ctx.arc(0,0,p.r+4,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  // item indicator
  if (p.item) {
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.item.emoji, p.x, p.y - p.r - 12);
  }
}

function roundRect(x,y,w,h,r) {
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.spin);
  // squash
  const sp = Math.hypot(ball.vx, ball.vy);
  const sx = 1 + Math.min(sp*0.02, 0.25);
  const sy = 1 - Math.min(sp*0.015, 0.15);
  ctx.scale(sx, sy);
  ctx.fillStyle = '#FFF';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0,0,ball.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // pattern
  ctx.strokeStyle = '#222';
  ctx.beginPath(); ctx.arc(0,0,ball.r*0.5,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-ball.r,0); ctx.lineTo(ball.r,0); ctx.stroke();
  if (ball.ice > 0) {
    ctx.fillStyle = 'rgba(129,212,250,0.35)';
    ctx.beginPath(); ctx.arc(0,0,ball.r+4,0,Math.PI*2); ctx.fill();
  }
  if (ball.balloon > 0) {
    ctx.strokeStyle = 'rgba(244,67,54,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,ball.r+6,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawItems() {
  for (const it of S.items) {
    const bob = Math.sin(it.bob)*5;
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    ctx.fillStyle = it.def.color;
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,it.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.def.emoji, 0, 1);
    ctx.restore();
  }
  for (const pr of S.projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.rot);
    if (pr.type === 'bomb') {
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#F44336';
      ctx.fillRect(-2,-20,4,8);
      // timer ring
      ctx.strokeStyle = '#FFEB3B';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,18, -Math.PI/2, -Math.PI/2 + (1-pr.timer/1.8)*Math.PI*2); ctx.stroke();
    } else if (pr.type === 'bread') {
      ctx.fillStyle = '#D4A574';
      ctx.beginPath(); roundRect(-12,-8,24,16,4); ctx.fill();
    } else if (pr.type === 'shoe') {
      ctx.fillStyle = '#FF5722';
      ctx.beginPath(); roundRect(-14,-8,28,16,6); ctx.fill();
    } else if (pr.type === 'boomerang') {
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0,0,12,0.2,Math.PI-0.2); ctx.stroke();
    }
    ctx.restore();
  }
  for (const e of S.effects) {
    if (e.type === 'vortex') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(S.menuAnim*4);
      ctx.strokeStyle = `rgba(123,31,162,${Math.min(1,e.life)})`;
      ctx.lineWidth = 4;
      for (let i=0;i<3;i++) {
        ctx.beginPath(); ctx.arc(0,0,e.r - i*12, 0, Math.PI*1.5); ctx.stroke();
      }
      ctx.restore();
    } else if (e.type === 'ray') {
      ctx.strokeStyle = `rgba(0,188,212,${e.life*2})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle)*350, e.y + Math.sin(e.angle)*350);
      ctx.stroke();
      createParticles(e.x + Math.cos(e.angle)*100, e.y + Math.sin(e.angle)*100, 2, 'spark');
    }
  }
}

function drawParticles() {
  for (const p of S.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.type === 'confetti') {
      ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
    } else {
      ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const f of S.floatingTexts) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  // score
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W/(2*dpr)-160, 8, 320, 48);
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(W/(2*dpr)-160, 8, 320, 48);
  const c1 = TEAM_COLORS[S.teamP1], c2 = TEAM_COLORS[S.teamP2];
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = c1.main;
  ctx.fillText(S.teamP1.toUpperCase(), W/(2*dpr)-90, 28);
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 28px Arial';
  ctx.fillText(S.score[0] + ' - ' + S.score[1], W/(2*dpr), 38);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = c2.main;
  ctx.fillText(S.teamP2.toUpperCase(), W/(2*dpr)+90, 28);
  // time
  const mins = Math.floor(Math.max(0,S.timeLeft)/60);
  const secs = Math.floor(Math.max(0,S.timeLeft)%60);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(`${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`, W/(2*dpr), 52);
  // items HUD
  const humans = players.filter(p => !p.isAI);
  humans.forEach((p, idx) => {
    const hx = 20 + idx * 140;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hx, H/dpr - 50, 120, 40);
    ctx.fillStyle = '#FFF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('P'+(idx+1)+' ITEM', hx+8, H/dpr-32);
    if (p.item) {
      ctx.font = '20px serif';
      ctx.fillText(p.item.emoji + ' ' + p.item.name, hx+8, H/dpr-12);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillText('—', hx+8, H/dpr-12);
    }
  });
}

function drawGoalOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  const scale = 1 + Math.sin(S.goalFlash*10)*0.05;
  ctx.save();
  ctx.translate(W/(2*dpr), H/(2*dpr));
  ctx.scale(scale, scale);
  ctx.strokeText('GOOOOOOOL!', 0, 0);
  ctx.fillText('GOOOOOOOL!', 0, 0);
  ctx.restore();
}

// ============== UI SCREENS ==============
function drawButton(x, y, w, h, text, hover) {
  ctx.fillStyle = hover ? '#FF9800' : '#FF5722';
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundRect(x, y, w, h, 12);
  ctx.fill(); ctx.stroke();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  roundRect(x+3, y+4, w, h, 12);
  ctx.fill();
  ctx.fillStyle = hover ? '#FF9800' : '#FF5722';
  ctx.beginPath();
  roundRect(x, y, w, h, 12);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x+w/2, y+h/2);
}

let mouse = { x:0, y:0, click:false };
function setupMouse() {
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (W/r.width) / dpr;
    mouse.y = (e.clientY - r.top) * (H/r.height) / dpr;
  });
  canvas.addEventListener('click', e => {
    mouse.click = true;
    ensureAudio();
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    mouse.x = (t.clientX - r.left) * (W/r.width) / dpr;
    mouse.y = (t.clientY - r.top) * (H/r.height) / dpr;
    mouse.click = true;
    ensureAudio();
  }, {passive:false});
}
function hitBtn(x,y,w,h) {
  return mouse.x >= x && mouse.x <= x+w && mouse.y >= y && mouse.y <= y+h;
}

function renderMenu() {
  // bg
  const g = ctx.createLinearGradient(0,0,0,H/dpr);
  g.addColorStop(0, '#1a237e'); g.addColorStop(1, '#4a148c');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W/dpr,H/dpr);
  // bouncing ball
  const bx = W/(2*dpr) + Math.sin(S.menuAnim)*80;
  const by = H/(2*dpr) + 120 + Math.abs(Math.sin(S.menuAnim*3))*40;
  ctx.fillStyle = '#FFF';
  ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth=2; ctx.stroke();
  // particles
  if (Math.random()<0.3) createParticles(Math.random()*W/dpr, Math.random()*H/dpr, 1, 'star');
  updateParticles(1/60);
  drawParticles();
  // title
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px Arial';
  ctx.fillStyle = '#FFEB3B';
  ctx.strokeStyle = '#F44336';
  ctx.lineWidth = 6;
  ctx.strokeText('CRAZY', W/(2*dpr), 90);
  ctx.fillText('CRAZY', W/(2*dpr), 90);
  ctx.fillStyle = '#4CAF50';
  ctx.strokeStyle = '#1B5E20';
  ctx.strokeText('CARTOON', W/(2*dpr), 150);
  ctx.fillText('CARTOON', W/(2*dpr), 150);
  ctx.fillStyle = '#2196F3';
  ctx.strokeStyle = '#0D47A1';
  ctx.strokeText('FOOTBALL', W/(2*dpr), 210);
  ctx.fillText('FOOTBALL', W/(2*dpr), 210);

  const bw = 280, bh = 52, bx0 = W/(2*dpr)-bw/2;
  const labels = ['JOGAR SOZINHO','COOPERATIVO','TREINO','CONFIGURAÇÕES'];
  const states = ['DIFFICULTY_SELECT','TEAM_SELECT','TEAM_SELECT','SETTINGS'];
  labels.forEach((lab,i) => {
    const by = 260 + i*65;
    const hov = hitBtn(bx0, by, bw, bh);
    drawButton(bx0, by, bw, bh, lab, hov);
    if (mouse.click && hov) {
      sound('click');
      if (i === 0) { S.mode = 'solo'; S.state = 'DIFFICULTY_SELECT'; }
      else if (i === 1) { S.mode = 'coop'; S.state = 'TEAM_SELECT'; }
      else if (i === 2) { S.mode = 'practice'; S.state = 'TEAM_SELECT'; }
      else S.state = 'SETTINGS';
    }
  });
  mouse.click = false;
}

function renderDifficulty() {
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SELECIONE A IA', W/(2*dpr), 50);
  const startY = 80;
  for (let i = 0; i < 9; i++) {
    const y = startY + i * 42;
    const hov = hitBtn(W/(2*dpr)-200, y, 400, 38);
    ctx.fillStyle = hov || S.aiLevel === i+1 ? '#FF9800' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(W/(2*dpr)-200, y, 400, 38);
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2;
    ctx.strokeRect(W/(2*dpr)-200, y, 400, 38);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText((i+1) + '  ' + AI_NAMES[i], W/(2*dpr)-180, y+25);
    if (mouse.click && hov) {
      S.aiLevel = i+1; S.settings.aiLevel = i+1; sound('click');
    }
  }
  ctx.fillStyle = '#AAA';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(AI_DESC[S.aiLevel-1], W/(2*dpr), H/dpr - 80);
  // next
  const nx = W/(2*dpr)-100, ny = H/dpr - 55;
  drawButton(nx, ny, 200, 40, 'CONTINUAR →', hitBtn(nx,ny,200,40));
  if (mouse.click && hitBtn(nx,ny,200,40)) { sound('click'); S.state = 'TEAM_SELECT'; }
  // back
  if (mouse.click && hitBtn(20,20,100,35)) { sound('click'); S.state = 'MENU'; }
  drawButton(20,20,100,35, '← VOLTAR', hitBtn(20,20,100,35));
  mouse.click = false;
}

function renderTeamSelect() {
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ESCOLHA OS TIMES', W/(2*dpr), 50);
  const cols = Object.keys(TEAM_COLORS);
  ctx.font = 'bold 18px Arial';
  ctx.fillText('TIME JOGADOR 1', W/(2*dpr)-150, 100);
  ctx.fillText('TIME ADVERSÁRIO', W/(2*dpr)+150, 100);
  cols.forEach((c,i) => {
    const x1 = W/(2*dpr)-220 + (i%3)*90;
    const y1 = 130 + Math.floor(i/3)*70;
    const x2 = W/(2*dpr)+50 + (i%3)*90;
    const y2 = 130 + Math.floor(i/3)*70;
    const col = TEAM_COLORS[c];
    // p1
    ctx.fillStyle = col.main;
    ctx.beginPath(); ctx.arc(x1+30, y1+25, 22, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = S.teamP1===c ? '#FFD700' : '#FFF';
    ctx.lineWidth = S.teamP1===c ? 4 : 2;
    ctx.stroke();
    if (mouse.click && hitBtn(x1,y1,60,50)) { S.teamP1 = c; sound('click'); }
    // p2
    ctx.fillStyle = col.main;
    ctx.beginPath(); ctx.arc(x2+30, y2+25, 22, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = S.teamP2===c ? '#FFD700' : '#FFF';
    ctx.lineWidth = S.teamP2===c ? 4 : 2;
    ctx.stroke();
    if (mouse.click && hitBtn(x2,y2,60,50)) { S.teamP2 = c; sound('click'); }
  });
  // duration
  ctx.fillStyle = '#FFF';
  ctx.font = '16px Arial';
  ctx.fillText('DURAÇÃO', W/(2*dpr), 300);
  DUR_LABELS.forEach((lab,i) => {
    const x = W/(2*dpr)-220 + i*95;
    const hov = hitBtn(x, 320, 85, 35);
    ctx.fillStyle = (S.duration===DURATIONS[i] || S.settings.duration===DURATIONS[i]) ? '#FF9800' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(x,320,85,35);
    ctx.strokeStyle='#FFF'; ctx.strokeRect(x,320,85,35);
    ctx.fillStyle='#FFF'; ctx.font='13px Arial';
    ctx.fillText(lab, x+42, 342);
    if (mouse.click && hov) { S.duration = DURATIONS[i]; S.settings.duration = DURATIONS[i]; sound('click'); }
  });
  // start
  const sx = W/(2*dpr)-110, sy = H/dpr - 70;
  drawButton(sx, sy, 220, 48, '▶ COMEÇAR', hitBtn(sx,sy,220,48));
  if (mouse.click && hitBtn(sx,sy,220,48)) {
    sound('click');
    if (S.teamP1 === S.teamP2) S.teamP2 = S.teamP1==='blue'?'red':'blue';
    startMatch();
  }
  drawButton(20,20,100,35, '← VOLTAR', hitBtn(20,20,100,35));
  if (mouse.click && hitBtn(20,20,100,35)) {
    sound('click');
    S.state = S.mode==='solo' ? 'DIFFICULTY_SELECT' : 'MENU';
  }
  mouse.click = false;
}

function renderSettings() {
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CONFIGURAÇÕES', W/(2*dpr), 50);
  const opts = [
    { label:'Volume', key:'volume', type:'slider' },
    { label:'Efeitos Sonoros', key:'sfx', type:'toggle' },
    { label:'Screen Shake', key:'shakeIntensity', type:'slider' },
    { label:'Reduzir Efeitos', key:'reduceEffects', type:'toggle' }
  ];
  opts.forEach((o,i) => {
    const y = 100 + i*60;
    ctx.fillStyle = '#FFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(o.label, W/(2*dpr)-180, y+20);
    if (o.type === 'slider') {
      const val = S.settings[o.key];
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(W/(2*dpr), y, 180, 20);
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(W/(2*dpr), y, 180*val, 20);
      if (mouse.click && hitBtn(W/(2*dpr), y, 180, 20)) {
        S.settings[o.key] = Math.max(0, Math.min(1, (mouse.x - W/(2*dpr))/180));
        sound('click');
      }
    } else {
      const on = S.settings[o.key];
      ctx.fillStyle = on ? '#4CAF50' : '#F44336';
      ctx.fillRect(W/(2*dpr), y, 80, 28);
      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(on?'ON':'OFF', W/(2*dpr)+40, y+19);
      if (mouse.click && hitBtn(W/(2*dpr), y, 80, 28)) {
        S.settings[o.key] = !on; sound('click');
      }
    }
  });
  // fullscreen
  drawButton(W/(2*dpr)-100, H/dpr-120, 200, 40, '⛶ TELA CHEIA', hitBtn(W/(2*dpr)-100,H/dpr-120,200,40));
  if (mouse.click && hitBtn(W/(2*dpr)-100,H/dpr-120,200,40)) {
    toggleFullscreen(); sound('click');
  }
  drawButton(W/(2*dpr)-80, H/dpr-60, 160, 40, '← VOLTAR', hitBtn(W/(2*dpr)-80,H/dpr-60,160,40));
  if (mouse.click && hitBtn(W/(2*dpr)-80,H/dpr-60,160,40)) {
    saveSettings(); S.state = S.state==='PAUSED'?'PAUSED':'MENU'; sound('click');
    if (S.state !== 'PAUSED') S.state = 'MENU';
  }
  mouse.click = false;
}

function renderPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSA', W/(2*dpr), 120);
  const btns = [
    { t:'CONTINUAR', a:()=>{ S.state='PLAYING'; } },
    { t:'REINICIAR', a:()=>{ startMatch(); } },
    { t:'CONFIGURAÇÕES', a:()=>{ S.state='SETTINGS'; } },
    { t:'MENU PRINCIPAL', a:()=>{ S.state='MENU'; } }
  ];
  btns.forEach((b,i) => {
    const y = 180 + i*60;
    const hov = hitBtn(W/(2*dpr)-120, y, 240, 45);
    drawButton(W/(2*dpr)-120, y, 240, 45, b.t, hov);
    if (mouse.click && hov) { sound('click'); b.a(); }
  });
  mouse.click = false;
}

function renderGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0,0,W/dpr,H/dpr);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FIM DA PARTIDA!', W/(2*dpr), 80);
  let msg = 'EMPATE!';
  if (S.winner === 0) msg = 'TIME ' + S.teamP1.toUpperCase() + ' VENCEU!';
  if (S.winner === 1) msg = 'TIME ' + S.teamP2.toUpperCase() + ' VENCEU!';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 28px Arial';
  ctx.fillText(msg, W/(2*dpr), 130);
  ctx.font = 'bold 48px Arial';
  ctx.fillText(S.score[0] + ' - ' + S.score[1], W/(2*dpr), 190);
  // stats
  ctx.font = '16px Arial';
  ctx.fillStyle = '#CCC';
  const st = S.stats;
  ctx.fillText(`Gols: ${st.goals[0]}-${st.goals[1]}  |  Chutes: ${st.shots[0]}-${st.shots[1]}`, W/(2*dpr), 240);
  ctx.fillText(`Itens: ${st.items[0]}-${st.items[1]}  |  Tempo bola: ${st.ballTime[0]|0}s-${st.ballTime[1]|0}s`, W/(2*dpr), 265);
  drawButton(W/(2*dpr)-200, 320, 180, 45, 'JOGAR NOVAMENTE', hitBtn(W/(2*dpr)-200,320,180,45));
  drawButton(W/(2*dpr)+20, 320, 180, 45, 'MENU', hitBtn(W/(2*dpr)+20,320,180,45));
  if (mouse.click && hitBtn(W/(2*dpr)-200,320,180,45)) { sound('click'); startMatch(); }
  if (mouse.click && hitBtn(W/(2*dpr)+20,320,180,45)) { sound('click'); S.state='MENU'; }
  mouse.click = false;
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W/dpr, H/dpr);

  if (S.state === 'MENU') { renderMenu(); return; }
  if (S.state === 'DIFFICULTY_SELECT') { renderDifficulty(); return; }
  if (S.state === 'TEAM_SELECT') { renderTeamSelect(); return; }
  if (S.state === 'SETTINGS' && S.state !== 'PAUSED') { renderSettings(); return; }
  if (S.state === 'GAME_OVER') {
    // still draw field under
  }

  // game world
  ctx.save();
  ctx.translate(-S.camera.x, -S.camera.y);
  drawField();
  drawItems();
  if (players) players.forEach(drawPlayer);
  if (ball) drawBall();
  drawParticles();
  ctx.restore();

  if (S.state === 'PLAYING' || S.state === 'GOAL' || S.state === 'PAUSED') drawHUD();
  if (S.state === 'GOAL') drawGoalOverlay();
  if (S.state === 'PAUSED') renderPause();
  if (S.state === 'SETTINGS') renderSettings();
  if (S.state === 'GAME_OVER') renderGameOver();

  // controls hint coop
  if (S.state === 'PLAYING' && S.mode === 'coop') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('P1: WASD+SPACE+SHIFT  |  P2: SETAS+ENTER+CTRL', 10, H/dpr - 8);
  }
}

// ============== LOOP & INIT ==============
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function saveSettings() {
  try {
    localStorage.setItem('ccf_settings', JSON.stringify(S.settings));
  } catch(e) {}
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ccf_settings'));
    if (s) Object.assign(S.settings, s);
    S.aiLevel = S.settings.aiLevel || 4;
    S.duration = S.settings.duration || 120;
  } catch(e) {}
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000) || DT;
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  setupInput();
  setupMouse();
  loadSettings();
  ball = new Ball();
  initCrowd();
  requestAnimationFrame(loop);
}

init();
})();
