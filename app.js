/* Reps: a small workout log for two.
   Everything lives on the phone (localStorage). An optional Google script keeps a shared copy so
   training partners on different phones can see each other's workouts and progress. */
'use strict';

const VERSION = '1.0.0';
const LS_KEY = 'reps:v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const DAY = 86400000;

/* ---------- exercises ---------- */
// type: w = weight × reps, a = assisted (assistance kg × reps, less is harder), bw = reps only, t = hold in seconds, c = cardio minutes
const EX = [
  ['goblet-squat', 'Goblet squat', 'w', 'Legs', 'Dumbbell', 2],
  ['hexbar-dl', 'Hex bar deadlift', 'w', 'Legs', 'Barbell', 5],
  ['leg-press', 'Leg press (horizontal)', 'w', 'Legs', 'Machine', 5],
  ['leg-press-v', 'Leg press (vertical)', 'w', 'Legs', 'Machine', 5],
  ['leg-curl', 'Leg curl', 'w', 'Legs', 'Machine', 2.5],
  ['leg-ext', 'Leg extension', 'w', 'Legs', 'Machine', 2.5],
  ['rdl', 'Romanian deadlift (dumbbell)', 'w', 'Legs', 'Dumbbell', 2, { each: 1 }],
  ['glute-bridge', 'Glute bridge', 'w', 'Legs', 'Bodyweight', 2.5],
  ['hip-thrust', 'Hip thrust', 'w', 'Legs', 'Barbell', 5],
  ['split-squat', 'Split squat', 'w', 'Legs', 'Dumbbell', 2, { each: 1 }],
  ['step-up', 'Step-up', 'w', 'Legs', 'Dumbbell', 2, { each: 1 }],
  ['db-bench', 'Dumbbell bench press', 'w', 'Chest', 'Dumbbell', 2, { each: 1 }],
  ['bb-bench', 'Barbell bench press', 'w', 'Chest', 'Barbell', 2.5],
  ['incline-db', 'Incline dumbbell press', 'w', 'Chest', 'Dumbbell', 2, { each: 1 }],
  ['chest-press', 'Chest press (machine)', 'w', 'Chest', 'Machine', 2.5],
  ['push-up', 'Push-up', 'bw', 'Chest', 'Bodyweight', 1],
  ['cable-row', 'Seated cable row', 'w', 'Back', 'Cable', 2.5],
  ['low-row', 'Low row', 'w', 'Back', 'Machine', 2.5],
  ['assisted-pullup', 'Assisted pull-up', 'a', 'Back', 'Machine', 2.5],
  ['lat-pulldown', 'Lat pulldown', 'w', 'Back', 'Cable', 2.5],
  ['cs-row', 'Chest-supported dumbbell row', 'w', 'Back', 'Dumbbell', 2, { each: 1 }],
  ['face-pull', 'Face pull', 'w', 'Shoulders', 'Cable', 2.5],
  ['lateral-raise', 'Lateral raise', 'w', 'Shoulders', 'Dumbbell', 1, { each: 1 }],
  ['db-ohp', 'Dumbbell overhead press', 'w', 'Shoulders', 'Dumbbell', 2, { each: 1 }],
  ['biceps-curl', 'Biceps curl', 'w', 'Arms', 'Dumbbell', 1, { each: 1 }],
  ['hammer-curl', 'Hammer curl', 'w', 'Arms', 'Dumbbell', 1, { each: 1 }],
  ['triceps-pushdown', 'Triceps rope pushdown', 'w', 'Arms', 'Cable', 2.5],
  ['oh-triceps', 'Overhead triceps extension', 'w', 'Arms', 'Cable', 2.5],
  ['plank', 'Plank', 't', 'Core', 'Bodyweight', 5],
  ['side-plank', 'Side plank', 't', 'Core', 'Bodyweight', 5, { side: 1 }],
  ['dead-bug', 'Dead bug', 'bw', 'Core', 'Bodyweight', 1, { side: 1 }],
  ['incline-walk', 'Incline walk', 'c', 'Cardio', 'Treadmill', 1],
  ['bike', 'Bike', 'c', 'Cardio', 'Machine', 1],
  ['rower', 'Rower', 'c', 'Cardio', 'Machine', 1],
  ['elliptical', 'Elliptical', 'c', 'Cardio', 'Machine', 1],
].map(([id, name, type, m, eq, inc, f]) => Object.assign({ id, name, type, m, eq, inc }, f || {}));
const EX_BY = Object.fromEntries(EX.map(e => [e.id, e]));
const GROUPS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];
const TYPE_NAMES = { w: 'Weight and reps', a: 'Assisted (machine helps)', bw: 'Reps only', t: 'Hold for time', c: 'Cardio minutes' };

const TEMPLATES = [
  { name: 'Workout A', items: [
    { ex: 'goblet-squat', n: 3, lo: 8, hi: 12, rest: 120 },
    { ex: 'db-bench', n: 3, lo: 8, hi: 12, rest: 120 },
    { ex: 'cable-row', n: 3, lo: 10, hi: 12, rest: 120 },
    { ex: 'leg-curl', n: 3, lo: 10, hi: 12, rest: 60 },
    { ex: 'face-pull', n: 3, lo: 15, hi: 15, rest: 60 },
    { ex: 'biceps-curl', n: 2, lo: 12, hi: 12, rest: 60, g: 'arms' },
    { ex: 'triceps-pushdown', n: 2, lo: 12, hi: 12, rest: 60, g: 'arms' },
    { ex: 'plank', n: 3, lo: 20, hi: 30, rest: 60 },
    { ex: 'incline-walk', n: 1, lo: 15, hi: 20, rest: 0 },
  ] },
  { name: 'Workout B', items: [
    { ex: 'hexbar-dl', n: 3, lo: 8, hi: 8, rest: 150 },
    { ex: 'leg-press', n: 3, lo: 10, hi: 12, rest: 120 },
    { ex: 'bb-bench', n: 3, lo: 8, hi: 10, rest: 120 },
    { ex: 'assisted-pullup', n: 3, lo: 6, hi: 10, rest: 120 },
    { ex: 'low-row', n: 3, lo: 10, hi: 12, rest: 90 },
    { ex: 'lateral-raise', n: 3, lo: 12, hi: 15, rest: 60 },
    { ex: 'face-pull', n: 3, lo: 15, hi: 15, rest: 60 },
    { ex: 'biceps-curl', n: 2, lo: 12, hi: 12, rest: 60, g: 'arms' },
    { ex: 'triceps-pushdown', n: 2, lo: 12, hi: 12, rest: 60, g: 'arms' },
    { ex: 'side-plank', n: 2, lo: 20, hi: 30, rest: 60 },
    { ex: 'incline-walk', n: 1, lo: 15, hi: 20, rest: 0 },
  ] },
];

/* ---------- icons ---------- */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  today: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  progress: svg('<path d="M4 19h16M5 15l4-4 4 3 6-7"/>'),
  history: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  plan: svg('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6M9 17h3"/>'),
  more: svg('<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  dots: svg('<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  swap: svg('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  trash: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  chart: svg('<path d="M4 19h16M5 15l4-4 4 3 6-7"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  play: svg('<path d="M7 5l12 7-12 7V5z"/>'),
};

/* ---------- storage ---------- */
function blank() { return { records: {}, dirty: {}, me: null, sync: null, active: null, settings: { goal: 2, sound: true, shareBody: false } }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY));
    if (d && d.records) { const b = blank(); return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}) }); }
  } catch (e) { /* fall through */ }
  return blank();
}
let D = load();
let saveFailed = false;
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(D)); saveFailed = false; }
  catch (e) { if (!saveFailed) toast("Couldn't save on this phone. Storage may be full."); saveFailed = true; }
}

function put(rec) {
  rec.updated = Math.max(Date.now(), (rec.updated || 0) + 1);
  D.records[rec.id] = rec;
  D.dirty[rec.id] = rec.updated;
  save();
  queueSync();
  return rec;
}
function remove(rec) { rec.deleted = true; put(rec); }
const recs = (kind, person) => Object.values(D.records).filter(r => r.kind === kind && !r.deleted && (person == null || r.person === person));
const people = () => recs('person').sort((a, b) => a.created - b.created);
const me = () => (D.me && D.records[D.me] && !D.records[D.me].deleted ? D.records[D.me] : null);
const pcls = pid => 'pc' + Math.max(0, people().findIndex(p => p.id === pid)) % 3;
const pname = pid => (D.records[pid] ? D.records[pid].name : 'Someone');
const routines = pid => recs('routine', pid).sort((a, b) => (a.order - b.order) || (a.created - b.created));
const workouts = pid => recs('workout', pid).sort((a, b) => b.start - a.start);
const exById = id => EX_BY[id] || (D.records[id] && D.records[id].kind === 'exercise' ? D.records[id] : { id, name: 'Exercise', type: 'w', m: 'Other', inc: 2.5 });
const allExercises = () => EX.concat(recs('exercise').sort((a, b) => a.name.localeCompare(b.name)));

function createPerson(name) {
  const p = put({ id: uid(), kind: 'person', name: name.trim().slice(0, 30), created: Date.now() });
  TEMPLATES.forEach((t, i) => put({ id: uid(), kind: 'routine', person: p.id, name: t.name, order: i, created: Date.now() + i, items: t.items.map(x => Object.assign({ k: uid() }, x)) }));
  return p;
}

/* ---------- formatting ---------- */
const fmtN = n => (n == null || n === '' || isNaN(n) ? '' : String(Math.round(Number(n) * 100) / 100));
const parseNum = v => { if (v == null) return null; const s = String(v).replace(',', '.').trim(); if (s === '') return null; const n = Number(s); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const pad = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const weekStart = t => { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDay = t => { const d = new Date(t); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtShortDate = t => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]}`; };
function fmtWhen(t) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return WD[new Date(t).getDay()];
  return fmtShortDate(t);
}
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
function fmtDur(ms) { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`; }
const fmtRest = s => (!s ? 'no rest' : s % 60 === 0 ? `rest ${s / 60} min` : `rest ${mmss(s)}`);
const rng = (lo, hi) => (lo === hi || hi == null ? `${lo}` : `${lo}–${hi}`);
function targetText(it, ex) {
  if (ex.type === 'c') return `${rng(it.lo, it.hi)} min`;
  const reps = ex.type === 't' ? `${rng(it.lo, it.hi)} s` : rng(it.lo, it.hi);
  const side = ex.side ? (ex.type === 't' ? ' each side' : '/side') : '';
  return `${it.n} × ${reps}${side} · ${fmtRest(it.rest)}`;
}
function fmtSet(type, s, short) {
  if (!s) return '';
  const x = short ? '×' : ' × ';
  if (type === 'w') return s.w ? `${fmtN(s.w)}${short ? '' : ' kg'}${x}${s.r || 0}` : `${s.r || 0} reps`;
  if (type === 'a') return `${short ? '−' : 'assist '}${fmtN(s.w || 0)}${short ? '' : ' kg'}${x}${s.r || 0}`;
  if (type === 'bw') return `${s.r || 0} reps`;
  if (type === 't') return `${s.t || 0} s`;
  if (type === 'c') return `${fmtN(s.m || 0)} min`;
  return '';
}
const fieldsFor = type => (type === 'w' || type === 'a' ? ['w', 'r'] : type === 'bw' ? ['r'] : type === 't' ? ['t'] : ['m']);
const FIELD_LABEL = { w: 'kg', r: 'reps', t: 'sec', m: 'min' };

/* ---------- history lookups ---------- */
function lastEntry(pid, ex, beforeStart, skipId) {
  for (const w of workouts(pid)) {
    if (w.id === skipId || (beforeStart && w.start >= beforeStart)) continue;
    const it = w.items.find(i => i.ex === ex && i.sets.length);
    if (it) return { w, it };
  }
  return null;
}
const e1rm = s => (s.w || 0) * (1 + Math.min(s.r || 0, 15) / 30);
// One number per session for an exercise, higher is better (assisted: less help, then more reps).
function score(type, sets) {
  if (!sets.length) return null;
  if (type === 'w') return Math.max(...sets.map(s => (s.w ? e1rm(s) : (s.r || 0) / 100)));
  if (type === 'a') return Math.max(...sets.filter(s => s.r > 0).map(s => -(s.w || 0) + (s.r || 0) / 1000), -1e9);
  if (type === 'bw') return Math.max(...sets.map(s => s.r || 0));
  if (type === 't') return Math.max(...sets.map(s => s.t || 0));
  return null;
}
function bestSet(type, sets) {
  let best = null, bs = -Infinity;
  sets.forEach(s => { const v = score(type, [s]); if (v != null && v > bs) { bs = v; best = s; } });
  return best;
}
function computePRs(w) {
  const prs = [];
  w.items.forEach(it => {
    const ex = exById(it.ex);
    if (ex.type === 'c' || !it.sets.length) return;
    let prior = -Infinity, had = false;
    workouts(w.person).forEach(o => {
      if (o.id === w.id || o.start >= w.start) return;
      o.items.forEach(oi => { if (oi.ex === it.ex && oi.sets.length) { had = true; prior = Math.max(prior, score(ex.type, oi.sets)); } });
    });
    const now = score(ex.type, it.sets);
    if (had && now != null && now > prior + 1e-9) prs.push({ ex: it.ex, label: fmtSet(ex.type, bestSet(ex.type, it.sets)) });
  });
  return prs;
}
function nextRoutine(pid) {
  const rs = routines(pid);
  if (!rs.length) return null;
  const last = workouts(pid).find(w => rs.some(r => r.id === w.routine));
  if (!last) return rs[0];
  return rs[(rs.findIndex(r => r.id === last.routine) + 1) % rs.length];
}

/* ---------- app state ---------- */
const S = { tab: 'today', view: null, viewP: null, sheet: null, rest: null, startMode: 'new', syncBusy: false };
const viewPerson = () => (S.viewP && D.records[S.viewP] && !D.records[S.viewP].deleted ? S.viewP : D.me);

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2800);
}

/* ---------- render ---------- */
function render() {
  const main = $('#main');
  document.body.classList.toggle('no-user', !me());
  if (!me()) { document.body.classList.remove('in-workout'); main.innerHTML = renderStart(); return; }
  if (S.view === 'workout' && D.active) {
    document.body.classList.add('in-workout');
    main.innerHTML = renderWorkout();
    renderRest();
    return;
  }
  S.view = null;
  document.body.classList.remove('in-workout');
  $('#rest').hidden = true;
  main.innerHTML = ({ today: renderToday, progress: renderProgress, history: renderHistory, plan: renderPlan, more: renderMore })[S.tab]();
  renderTabs();
  bindCharts(main);
}
function renderTabs() {
  const tabs = [['today', 'Today'], ['progress', 'Progress'], ['history', 'History'], ['plan', 'Plan'], ['more', 'More']];
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<button class="tab" data-act="tab" data-tab="${k}"${S.tab === k ? ' aria-current="page"' : ''}>${I[k]}<span>${l}</span></button>`).join('');
}
function personChips(pid, act) {
  const ps = people();
  if (ps.length < 2) return '';
  return `<div class="chips" role="group" aria-label="Whose">${ps.map(p => `<button class="chip ${pcls(p.id)}" data-act="${act || 'view-p'}" data-p="${p.id}" aria-pressed="${p.id === pid}"><span class="dot"></span>${esc(p.id === D.me ? `${p.name} (you)` : p.name)}</button>`).join('')}</div>`;
}

/* ---------- start / welcome ---------- */
function painsHtml() {
  return `<div class="pains">
    <div class="pain"><b>“What did I lift last time?”</b><span>Every set shows last session's weight and reps, and fills the weight in for you.</span></div>
    <div class="pain"><b>“Am I actually getting stronger?”</b><span>Each exercise gets a chart, and Reps tells you when you've earned a heavier weight.</span></div>
    <div class="pain"><b>“Guessing how long I've rested.”</b><span>Tick a set and the rest timer starts on its own, with a beep when it's time.</span></div>
    <div class="pain"><b>“We train together but track apart.”</b><span>You each log on your own phone and can see each other's workouts and progress.</span></div>
  </div>`;
}
function renderStart() {
  let form;
  if (S.startMode === 'join') {
    form = `<div class="card stack"><h2>Join your partner</h2>
      <p class="small muted">On their phone: More › Train together › Copy invite code. Paste it here.</p>
      <input type="text" id="join-code" placeholder="reps:…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn primary wide" data-act="join">Join</button>
      <button class="link" data-act="start-mode" data-m="new">Start fresh instead</button></div>`;
  } else if (S.startMode === 'pick') {
    const ps = people();
    form = `<div class="card stack"><h2>Which one is you?</h2>
      <div class="menu">${ps.map(p => `<button data-act="pick-me" data-p="${p.id}"><span class="dot ${pcls(p.id)}"></span>${esc(p.name)}</button>`).join('')}</div>
      <p class="small muted">New here? Enter your name to get your own Workout A and B.</p>
      <input type="text" id="start-name" placeholder="Your name" autocomplete="given-name" maxlength="30">
      <button class="btn primary wide" data-act="start">I'm new</button></div>`;
  } else {
    form = `<div class="card stack"><h2>Let's set you up</h2>
      <input type="text" id="start-name" placeholder="Your name" autocomplete="given-name" maxlength="30">
      <button class="btn primary wide" data-act="start">Start with Workout A and B</button>
      <button class="link" data-act="start-mode" data-m="join">Have an invite code from your partner? Join instead</button></div>`;
  }
  return `<div class="welcome"><img class="welcome-mark" src="icons/plates-180.png" alt="">
    <div class="hero"><span class="brand">Reps</span><h1>Lifting gets easier when you can see it.</h1></div>
    ${painsHtml()}${form}</div>`;
}

/* ---------- today ---------- */
function renderToday() {
  const p = me(), now = Date.now();
  const nx = nextRoutine(p.id);
  let h = `<div class="hero"><span class="lab">${fmtDay(now)}</span><h1>${D.active ? 'Workout in progress' : nx ? `${esc(nx.name)} is next` : `Hi ${esc(p.name)}`}</h1></div>`;
  if (D.active && !D.active.editing) {
    h += `<div class="card resume"><div><h3>${esc(D.active.name)}</h3><p class="small muted">Started ${fmtDur(now - D.active.start)} ago · ${countDone(D.active)} sets done</p></div><button class="btn primary" data-act="resume">Resume</button></div>`;
  } else if (nx) {
    const names = nx.items.map(i => exById(i.ex).name);
    h += `<div class="card"><h2>${esc(nx.name)}</h2><div class="next-list">${names.map(n => `<span>${esc(n)}</span>`).join('')}</div>
      <button class="btn primary wide" data-act="start-wk" data-r="${nx.id}">${I.play} Start ${esc(nx.name)}</button>
      <div class="alt-row">${routines(p.id).filter(r => r.id !== nx.id).map(r => `<button class="link" data-act="start-wk" data-r="${r.id}">Do ${esc(r.name)} instead</button>`).join('')}<button class="link" data-act="start-wk" data-r="">Empty workout</button></div></div>`;
  } else {
    h += `<div class="empty"><p>You don't have a plan yet.</p><button class="btn primary" data-act="start-wk" data-r="">Start an empty workout</button></div>`;
  }
  // this week
  const ws = weekStart(now), mine = workouts(p.id).filter(w => w.start >= ws);
  const daysOn = new Set(mine.map(w => dayKey(w.start)));
  const goal = D.settings.goal || 2;
  h += `<div class="sec-head"><h2>This week</h2><span class="pill ${mine.length >= goal ? 'good' : ''}">${mine.length} of ${goal}</span></div>
    <div class="card flat"><div class="week">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const t = ws + i * DAY + 3600000 * 12, on = daysOn.has(dayKey(t)), today = dayKey(t) === dayKey(now);
      return `<div class="wd${on ? ' on' : ''}${today ? ' today' : ''}"><span class="lab">${WD[new Date(t).getDay()].slice(0, 1)}</span><i>${on ? I.check : new Date(t).getDate()}</i></div>`;
    }).join('')}</div></div>`;
  // partners
  const others = people().filter(o => o.id !== p.id);
  if (others.length) {
    h += `<div class="sec-head"><h2>Training together</h2>${syncPill()}</div><div class="card flat">${others.map(o => {
      const lw = workouts(o.id)[0];
      const wk = workouts(o.id).filter(w => w.start >= ws).length;
      const meta = lw ? `${esc(lw.name)} · ${fmtWhen(lw.start)}${lw.prs && lw.prs.length ? ` · ${lw.prs.length} new best${lw.prs.length > 1 ? 's' : ''}` : ''}` : 'No workouts yet';
      return `<button class="mate ${pcls(o.id)}" data-act="${lw ? 'open-wk' : 'view-progress'}" data-w="${lw ? lw.id : ''}" data-p="${o.id}"><span class="dot"></span><span><span class="mate-name">${esc(o.name)}</span><span class="mate-meta" style="display:block">${meta}</span></span><span class="pill">${wk} this week</span></button>`;
    }).join('')}</div>`;
  } else if (!syncOn()) {
    h += `<div class="sec-head"><h2>Training together</h2></div><div class="note">Want to see your partner's progress? Set up sharing in <button class="link" data-act="tab" data-tab="more">More › Train together</button>.</div>`;
  }
  // recent bests
  const bests = [];
  workouts(p.id).slice(0, 8).forEach(w => (w.prs || []).forEach(pr => bests.push({ pr, w })));
  if (bests.length) {
    h += `<div class="sec-head"><h2>Recent bests</h2></div><div class="list">${bests.slice(0, 5).map(({ pr, w }) => `<button class="row" data-act="open-ex" data-ex="${esc(pr.ex)}" data-p="${p.id}"><span><span class="row-name">${esc(exById(pr.ex).name)}</span><span class="row-meta">${fmtWhen(w.start)}</span></span><span class="row-side up">${esc(pr.label)}</span></button>`).join('')}</div>`;
  }
  return h;
}
const countDone = a => a.items.reduce((n, it) => n + it.sets.filter(s => s.done).length, 0);

/* ---------- workout ---------- */
function defaultsFor(ex) {
  if (ex.type === 'c') return { n: 1, lo: 15, hi: 20, rest: 0 };
  if (ex.type === 't') return { n: 3, lo: 20, hi: 30, rest: 60 };
  return { n: 3, lo: 8, hi: 12, rest: 90 };
}
function makeItem(pid, t, before) {
  const prev = lastEntry(pid, t.ex, before);
  const ps = prev ? prev.it.sets : [];
  const sets = [];
  for (let i = 0; i < (t.n || 1); i++) {
    const p = ps[i] || ps[ps.length - 1];
    const ex = exById(t.ex);
    sets.push({ w: (ex.type === 'w' || ex.type === 'a') && p && p.w != null ? p.w : null, r: null, t: null, m: null, done: false });
  }
  return { k: uid(), ex: t.ex, n: t.n, lo: t.lo, hi: t.hi, rest: t.rest, g: t.g || null, sets };
}
function startWorkout(rid) {
  if (D.active) { S.view = 'workout'; render(); wake(true); return; }
  const r = rid ? D.records[rid] : null;
  D.active = { id: uid(), kind: 'workout', person: D.me, routine: r ? r.id : null, name: r ? r.name : 'Workout', start: Date.now(), items: (r ? r.items : []).map(t => makeItem(D.me, t)) };
  save();
  S.view = 'workout';
  render();
  window.scrollTo(0, 0);
  wake(true);
  unlockAudio();
}
function renderWorkout() {
  const a = D.active;
  let h = `<header class="wk-head"><button class="icon-btn" data-act="wk-hide" aria-label="Back to Today">${I.back}</button>
    <div class="wk-title"><h2>${esc(a.name)}</h2><p class="lab num" id="wk-clock">${a.editing ? fmtDay(a.start) : mmss((Date.now() - a.start) / 1000)}</p></div>
    <button class="btn small primary" data-act="wk-finish">${a.editing ? 'Save' : 'Finish'}</button></header><div class="wk-body">`;
  const items = a.items;
  if (!items.length) h += `<div class="empty"><p>Add the first exercise to get going.</p></div>`;
  for (let i = 0; i < items.length;) {
    const it = items[i];
    let j = i + 1;
    if (it.g) while (j < items.length && items[j].g === it.g) j++;
    if (j - i > 1) {
      h += `<div class="superset"><p class="lab ss-lab">${I.link} Superset · alternate, rest after both</p>${items.slice(i, j).map(exCard).join('')}</div>`;
      i = j;
    } else { h += exCard(it); i++; }
  }
  h += `<div class="wk-actions"><button class="btn wide" data-act="pick" data-mode="add-active">${I.plus} Add exercise</button>
    ${a.editing ? '<button class="btn wide quiet" data-act="wk-cancel-edit">Cancel editing</button>' : '<button class="btn wide quiet danger" data-act="wk-discard">Discard workout</button>'}</div></div>`;
  return h;
}
function exCard(it) {
  const a = D.active, ex = exById(it.ex);
  const prev = lastEntry(a.person, it.ex, a.editing ? a.start : null, a.id);
  const ps = prev ? prev.it.sets : [];
  const f = fieldsFor(ex.type);
  const head = f.map(x => `<span class="lab" style="text-align:center">${x === 'w' ? (ex.type === 'a' ? 'assist' : ex.each ? 'kg each' : 'kg') : FIELD_LABEL[x]}</span>`).join('');
  return `<section class="ex" id="ex-${it.k}">
    <div class="ex-top"><div><h3>${esc(ex.name)}</h3><p class="tgt">${esc(targetText(it, ex))}</p></div><button class="icon-btn" data-act="ex-menu" data-k="${it.k}" aria-label="Options for ${esc(ex.name)}">${I.dots}</button></div>
    ${hintFor(it, ex, prev)}
    <div class="sets"><div class="set-head c${f.length}"><span class="lab" style="text-align:center">set</span><span class="lab">last time</span>${head}<span></span></div>
    ${it.sets.map((s, i) => setRow(it, ex, s, i, ps[i])).join('')}</div>
    <div class="ex-foot"><button class="btn small quiet" data-act="set-add" data-k="${it.k}">${I.plus} Set</button>${it.sets.length > 1 ? `<button class="btn small quiet" data-act="set-remove" data-k="${it.k}">${I.minus} Set</button>` : ''}</div>
  </section>`;
}
function placeholderFor(f, p, it) {
  if (f === 'w') return p && p.w != null ? fmtN(p.w) : '';
  if (f === 'r') return p && p.r != null ? p.r : (it.hi || '');
  if (f === 't') return p && p.t != null ? p.t : (it.lo || '');
  if (f === 'm') return p && p.m != null ? fmtN(p.m) : (it.lo || '');
  return '';
}
function setRow(it, ex, s, i, p) {
  const f = fieldsFor(ex.type);
  const inputs = f.map(x => `<input class="in num" data-f="${x}" inputmode="${x === 'r' || x === 't' ? 'numeric' : 'decimal'}" enterkeyhint="done" value="${s[x] == null ? '' : fmtN(s[x])}" placeholder="${esc(placeholderFor(x, p, it))}" aria-label="Set ${i + 1} ${FIELD_LABEL[x]}">`).join('');
  return `<div class="set-row c${f.length}${s.done ? ' done' : ''}" data-k="${it.k}" data-i="${i}"><span class="sn">${i + 1}</span><span class="prev num">${p ? esc(fmtSet(ex.type, p, true)) : '—'}</span>${inputs}<button class="tick" data-act="tick" aria-label="Set ${i + 1} done" aria-pressed="${s.done ? 'true' : 'false'}">${I.check}</button></div>`;
}
function hintFor(it, ex, prev) {
  if (!prev) {
    if (ex.type === 'w') return `<div class="hint first"><p>First time: pick a weight you can lift ${rng(it.lo, it.hi)} times with 1–3 reps to spare.</p></div>`;
    if (ex.type === 'a') return `<div class="hint first"><p>First time: pick enough assistance to do ${rng(it.lo, it.hi)} clean reps. Less assistance is harder.</p></div>`;
    return '';
  }
  const ps = prev.it.sets;
  if (ex.type === 'c' || !it.hi || ps.length < it.n) return '';
  const key = ex.type === 't' ? 't' : 'r';
  if (!ps.slice(0, it.n).every(s => (s[key] || 0) >= it.hi)) return '';
  if (ex.type === 'w') {
    const top = Math.max(...ps.map(s => s.w || 0));
    if (!top) return '';
    const sug = Math.round((top + (ex.inc || 2.5)) * 100) / 100;
    return `<div class="hint"><p>You hit ${it.hi} on every set last time. Time to go heavier.</p><button class="btn small primary" data-act="apply" data-k="${it.k}" data-v="${sug}">Use ${fmtN(sug)} kg</button></div>`;
  }
  if (ex.type === 'a') {
    const low = Math.min(...ps.map(s => (s.w == null ? 0 : s.w)));
    if (!low) return `<div class="hint"><p>You did every set with no assistance. Nice.</p></div>`;
    const sug = Math.max(0, Math.round((low - (ex.inc || 2.5)) * 100) / 100);
    return `<div class="hint"><p>You hit ${it.hi} on every set last time. Take away some help.</p><button class="btn small primary" data-act="apply" data-k="${it.k}" data-v="${sug}">Use ${fmtN(sug)} kg</button></div>`;
  }
  if (ex.type === 't') return `<div class="hint"><p>You held ${it.hi} s on every set last time. Try holding a little longer.</p></div>`;
  return `<div class="hint"><p>You hit ${it.hi} on every set last time. Try a couple more reps.</p></div>`;
}
const itemOf = k => D.active && D.active.items.find(i => i.k === k);
function redrawCard(k) {
  const it = itemOf(k), el = document.getElementById('ex-' + k);
  if (it && el) el.outerHTML = exCard(it); else render();
}
function onSetInput(inp) {
  const row = inp.closest('.set-row'); if (!row || !D.active) return;
  const it = itemOf(row.dataset.k); if (!it) return;
  const s = it.sets[Number(row.dataset.i)]; if (!s) return;
  s[inp.dataset.f] = parseNum(inp.value);
  inp.classList.remove('flag');
  save();
}
function tick(btn) {
  const row = btn.closest('.set-row');
  const it = itemOf(row.dataset.k); if (!it) return;
  const s = it.sets[Number(row.dataset.i)];
  if (s.done) { s.done = false; row.classList.remove('done'); btn.setAttribute('aria-pressed', 'false'); save(); return; }
  const ex = exById(it.ex);
  let missing = null;
  fieldsFor(ex.type).forEach(f => {
    const inp = row.querySelector(`[data-f="${f}"]`);
    if (s[f] == null) {
      const v = parseNum(inp.placeholder);
      if (v == null) { if (!missing) missing = inp; inp.classList.add('flag'); }
      else { s[f] = v; inp.value = fmtN(v); }
    }
  });
  if (missing) { missing.focus(); toast(`Enter the ${missing.dataset.f === 'w' ? (ex.type === 'a' ? 'assistance' : 'weight') : FIELD_LABEL[missing.dataset.f]} first.`); save(); return; }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  s.done = true;
  row.classList.add('done'); btn.setAttribute('aria-pressed', 'true');
  save();
  unlockAudio();
  // In a superset, rest only after the last exercise of the pair.
  const a = D.active;
  if (it.g) { const grp = a.items.filter(x => x.g === it.g); if (grp.length > 1 && grp[grp.length - 1].k !== it.k) return; }
  const remaining = a.items.some(x => x.sets.some(y => !y.done));
  if (it.rest && remaining) startRest(it.rest);
}

/* rest timer */
function startRest(sec) { S.rest = { end: Date.now() + sec * 1000, total: sec, rang: false }; renderRest(); }
function renderRest() {
  const bar = $('#rest');
  if (!S.rest || S.view !== 'workout') { bar.hidden = true; return; }
  const left = (S.rest.end - Date.now()) / 1000;
  const over = left <= 0;
  if (over && !S.rest.rang) { S.rest.rang = true; ding(); setTimeout(() => { if (S.rest && S.rest.rang && Date.now() - S.rest.end > 3500) { S.rest = null; renderRest(); } }, 4000); }
  const pct = Math.max(0, Math.min(100, (left / S.rest.total) * 100));
  bar.hidden = false;
  bar.classList.toggle('over', over);
  bar.innerHTML = `<div class="rest-in"><div><span class="lab">${over ? 'Rest done' : 'Resting'}</span><div class="rest-time num">${over ? 'Go' : mmss(left)}</div></div>
    <div class="btn-row"><button class="btn small" data-act="rest-add" data-v="-15">−15</button><button class="btn small" data-act="rest-add" data-v="15">+15</button><button class="btn small primary" data-act="rest-skip">${over ? 'OK' : 'Skip'}</button></div>
    <div class="rest-track"><i style="width:${pct}%"></i></div></div>`;
}
let actx = null;
function unlockAudio() {
  if (!D.settings.sound) return;
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
}
function ding() {
  if (navigator.vibrate) { try { navigator.vibrate([180, 90, 180]); } catch (e) { /* ignore */ } }
  if (!D.settings.sound || !actx) return;
  try {
    [0, 0.22].forEach(off => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + off;
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* ignore */ }
}
let lock = null;
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; }
}

/* finish */
function finishSheet() {
  const a = D.active;
  const total = a.items.reduce((n, it) => n + it.sets.length, 0), done = countDone(a);
  const draft = toRecord(a);
  const prs = done ? computePRs(draft) : [];
  openSheet({ kind: 'html', html: `<div class="sheet-head"><h2>${a.editing ? 'Save changes?' : done ? 'Nice work' : 'Nothing logged yet'}</h2>${closeBtn()}</div>
    <div class="stack">
      <div class="tiles"><div class="tile"><span class="lab">Time</span><b class="num">${a.editing ? fmtDur((a.end || a.start) - a.start) : fmtDur(Date.now() - a.start)}</b></div><div class="tile"><span class="lab">Sets</span><b class="num">${done}</b></div><div class="tile"><span class="lab">New bests</span><b class="num">${prs.length}</b></div></div>
      ${prs.length ? `<div class="list">${prs.map(p => `<div class="row"><span class="row-name">${esc(exById(p.ex).name)}</span><span class="row-side up">${esc(p.label)}</span></div>`).join('')}</div>` : ''}
      ${done < total ? `<p class="note">${total - done} set${total - done > 1 ? 's' : ''} not ticked. Only ticked sets are saved.</p>` : ''}
      <button class="btn primary wide" data-act="wk-save" ${done ? '' : 'disabled'}>${a.editing ? 'Save changes' : 'Save workout'}</button>
      <button class="btn wide" data-act="close">Keep going</button>
    </div>` });
}
function toRecord(a) {
  const base = a.editing ? clone(D.records[a.id]) : { id: a.id, kind: 'workout', person: a.person, routine: a.routine, name: a.name, start: a.start, end: Date.now() };
  base.items = a.items.map(it => ({ ex: it.ex, n: it.n, lo: it.lo, hi: it.hi, sets: it.sets.filter(s => s.done).map(s => {
    const o = {}; fieldsFor(exById(it.ex).type).forEach(f => { o[f] = s[f] == null ? 0 : s[f]; }); return o;
  }) })).filter(it => it.sets.length);
  return base;
}
function saveWorkout() {
  const a = D.active;
  const rec = toRecord(a);
  rec.prs = computePRs(rec);
  put(rec);
  // Later workouts may have had a best that this edit changes.
  if (a.editing) workouts(rec.person).filter(w => w.start > rec.start).forEach(w => { const p = computePRs(w); if (JSON.stringify(p) !== JSON.stringify(w.prs || [])) { w.prs = p; put(w); } });
  D.active = null; S.rest = null; save();
  closeSheet(); wake(false);
  S.view = null; S.tab = a.editing ? 'history' : 'today';
  render(); window.scrollTo(0, 0);
  toast(a.editing ? 'Changes saved.' : rec.prs.length ? `Saved. ${rec.prs.length} new best${rec.prs.length > 1 ? 's' : ''}!` : 'Workout saved.');
}
function editWorkout(id) {
  if (D.active && !D.active.editing) { toast('Finish or discard the workout in progress first.'); return; }
  const w = D.records[id];
  D.active = { id: w.id, kind: 'workout', person: w.person, routine: w.routine, name: w.name, start: w.start, end: w.end, editing: true,
    items: w.items.map(it => Object.assign({}, it, { k: uid(), g: null, rest: 0, sets: it.sets.map(s => Object.assign({ w: null, r: null, t: null, m: null }, s, { done: true })) })) };
  save(); closeSheet(); S.view = 'workout'; render(); window.scrollTo(0, 0);
}

/* ---------- progress ---------- */
function sessionsFor(pid, exId) {
  const out = [];
  workouts(pid).forEach(w => w.items.forEach(it => { if (it.ex === exId && it.sets.length) out.push({ t: w.start, sets: it.sets, w }); }));
  return out.sort((a, b) => a.t - b.t);
}
const METRICS = {
  w: [['top', 'Heaviest', 'kg'], ['e1rm', 'Est. 1-rep max', 'kg'], ['vol', 'Volume', 'kg']],
  a: [['assist', 'Assistance (lower is better)', 'kg']],
  bw: [['reps', 'Most reps', 'reps']],
  t: [['hold', 'Longest hold', 's']],
  c: [['mins', 'Minutes', 'min']],
};
function metricVal(m, sets) {
  if (m === 'top') return Math.max(...sets.map(s => s.w || 0));
  if (m === 'e1rm') return Math.round(Math.max(...sets.map(e1rm)) * 10) / 10;
  if (m === 'vol') return sets.reduce((n, s) => n + (s.w || 0) * (s.r || 0), 0);
  if (m === 'assist') return Math.min(...sets.map(s => s.w || 0));
  if (m === 'reps') return Math.max(...sets.map(s => s.r || 0));
  if (m === 'hold') return Math.max(...sets.map(s => s.t || 0));
  if (m === 'mins') return sets.reduce((n, s) => n + (s.m || 0), 0);
  return 0;
}
function streakWeeks(pid) {
  const goal = D.settings.goal || 2, counts = {};
  workouts(pid).forEach(w => { const k = weekStart(w.start); counts[k] = (counts[k] || 0) + 1; });
  let wk = weekStart(Date.now()), n = 0;
  if ((counts[wk] || 0) < goal) wk = weekStart(wk - DAY);
  while ((counts[wk] || 0) >= goal) { n++; wk = weekStart(wk - DAY); }
  return n;
}
function renderProgress() {
  const pid = viewPerson(), mine = pid === D.me, now = Date.now();
  const ws = workouts(pid);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  let h = `<div class="hero"><span class="lab">Progress</span><h1>${mine ? 'How you’re doing' : `How ${esc(pname(pid))} is doing`}</h1></div>${personChips(pid)}`;
  h += `<div class="tiles"><div class="tile"><span class="lab">This week</span><b class="num">${ws.filter(w => w.start >= weekStart(now)).length}/${D.settings.goal || 2}</b></div>
    <div class="tile"><span class="lab">Weeks on target</span><b class="num">${streakWeeks(pid)}</b></div>
    <div class="tile"><span class="lab">This month</span><b class="num">${ws.filter(w => w.start >= monthStart).length}</b></div></div>`;
  // body weight (shown for you, and for a partner only if they share it)
  const body = recs('body', pid).sort((a, b) => a.date.localeCompare(b.date));
  if (mine || body.length) {
    const last = body[body.length - 1], first = body[0];
    const diff = last && first && last !== first ? Math.round((last.kg - first.kg) * 10) / 10 : null;
    h += `<div class="sec-head"><h2>Body weight</h2>${mine ? `<button class="btn small" data-act="body">${body.length ? 'Log' : 'Start logging'}</button>` : ''}</div>`;
    if (body.length) {
      h += `<div class="card flat"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><b style="font-family:var(--display);font-size:26px">${fmtN(last.kg)} kg</b><span class="small muted">${diff == null ? fmtShortDate(Date.parse(last.date)) : `${diff > 0 ? '+' : ''}${fmtN(diff)} kg since ${fmtShortDate(Date.parse(first.date))}`}</span></div>
        ${body.length > 1 ? chart([{ pid, name: pname(pid), pts: body.map(b => [Date.parse(b.date + 'T12:00'), b.kg]) }], 'kg', 'body') : ''}
        ${mine ? `<p class="small muted" style="margin-top:6px">${D.settings.shareBody ? 'Shared with your partner.' : 'Only on this phone. Change this when you log.'}</p>` : ''}</div>`;
    } else h += `<div class="note">Optional. Log your weight once a week, same time of day, to see the trend.</div>`;
  }
  // exercises
  const exIds = [];
  routines(pid).forEach(r => r.items.forEach(i => { if (!exIds.includes(i.ex)) exIds.push(i.ex); }));
  ws.forEach(w => w.items.forEach(i => { if (!exIds.includes(i.ex)) exIds.push(i.ex); }));
  const rows = exIds.map(id => ({ id, ex: exById(id), ss: sessionsFor(pid, id) })).filter(x => x.ss.length);
  h += `<div class="sec-head"><h2>Exercises</h2></div>`;
  if (!rows.length) h += `<div class="empty"><p>${mine ? 'Finish your first workout and your progress shows up here.' : `${esc(pname(pid))} hasn't logged a workout yet.`}</p></div>`;
  else h += `<div class="list">${rows.map(({ id, ex, ss }) => {
    const m = METRICS[ex.type][0][0];
    const vals = ss.map(s => metricVal(m, s.sets));
    const lastS = ss[ss.length - 1];
    const d = vals[vals.length - 1] - vals[0];
    const unit = METRICS[ex.type][0][2];
    const better = ex.type === 'a' ? d < 0 : d > 0;
    const change = ss.length > 1 && d !== 0 ? `<span class="${better ? 'up' : ''}">${d > 0 ? '+' : '−'}${fmtN(Math.abs(d))} ${unit}</span>` : `<span class="muted">${ss.length} session${ss.length > 1 ? 's' : ''}</span>`;
    const label = ex.type === 'c' ? fmtSet('c', { m: metricVal('mins', lastS.sets) }) : fmtSet(ex.type, bestSet(ex.type, lastS.sets));
    return `<button class="row" data-act="open-ex" data-ex="${esc(id)}" data-p="${pid}"><span><span class="row-name">${esc(ex.name)}</span><span class="row-meta">${esc(label)} · ${fmtWhen(lastS.t)}</span></span><span class="row-side">${change}${vals.length > 1 ? spark(vals, pcls(pid)) : ''}</span></button>`;
  }).join('')}</div>`;
  return h;
}
function spark(vals, cls) {
  const w = 72, h = 26, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 4) + 2, h - 3 - ((v - lo) / span) * (h - 6)]);
  return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${pts.map(p => p.map(n => n.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="var(--pc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.5" fill="var(--pc)"/></svg>`;
}
function niceTicks(lo, hi) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / 3, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= raw) || raw;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const CHARTS = {};
// series: [{pid, name, pts:[[time, value]]}]
function chart(series, unit, id) {
  series = series.filter(s => s.pts.length);
  if (!series.length) return '';
  const W = 340, H = 170, L = 40, R = 14, T = 12, B = 24;
  const xs = series.flatMap(s => s.pts.map(p => p[0])), ys = series.flatMap(s => s.pts.map(p => p[1]));
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 3 * DAY; x1 += 3 * DAY; }
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys)), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = t => L + ((t - x0) / (x1 - x0)) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  let g = ticks.map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${fmtN(v)}</text>`).join('');
  g += `<text class="ax" x="${L}" y="${H - 6}">${fmtShortDate(x0)}</text><text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShortDate(x1)}</text>`;
  series.forEach(s => {
    const c = pcls(s.pid);
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
    g += `<g class="${c}">${s.pts.length > 1 ? `<path class="ln" d="${d}"/>` : ''}${s.pts.map(p => `<circle class="pt" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4"/>`).join('')}</g>`;
  });
  CHARTS[id] = { series, unit, X, Y, W, H, T, B, L, R };
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span class="${pcls(s.pid)}"><i class="dot"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s => `${s.name}: latest ${fmtN(s.pts[s.pts.length - 1][1])} ${unit}`).join(', '))}">${g}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div></div>`;
}
function bindCharts(root) {
  root.querySelectorAll('.chart[data-chart]').forEach(el => {
    const c = CHARTS[el.dataset.chart]; if (!c) return;
    const svgEl = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = el.querySelector('.xh');
    const show = e => {
      const r = svgEl.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * c.W;
      let best = null;
      c.series.forEach(s => s.pts.forEach(p => { const dx = Math.abs(c.X(p[0]) - x); if (!best || dx < best.dx) best = { dx, t: p[0] }; }));
      if (!best) return;
      const lines = c.series.map(s => { const p = s.pts.find(q => q[0] === best.t) || s.pts.find(q => dayKey(q[0]) === dayKey(best.t)); return p ? `${c.series.length > 1 ? esc(s.name) + ': ' : ''}${fmtN(p[1])} ${c.unit}` : ''; }).filter(Boolean);
      const px = c.X(best.t);
      xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${fmtDay(best.t)}</b><br>${lines.join('<br>')}`;
      tip.hidden = false;
      const left = (px / c.W) * r.width;
      tip.style.left = Math.max(60, Math.min(r.width - 60, left)) + 'px';
      tip.style.top = '-' + (tip.offsetHeight + 4) + 'px';
    };
    const hide = () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); };
    svgEl.addEventListener('pointerdown', show);
    svgEl.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
    svgEl.addEventListener('pointerleave', hide);
  });
}
function exSheet(exId, pid, metric) {
  const ex = exById(exId), ms = METRICS[ex.type];
  const m = ms.find(x => x[0] === metric) || ms[0];
  const series = people().map(p => ({ pid: p.id, name: p.name, pts: sessionsFor(p.id, exId).map(s => [s.t, metricVal(m[0], s.sets)]) })).filter(s => s.pts.length);
  const ss = sessionsFor(pid, exId).reverse();
  const html = `<div class="sheet-head"><div><span class="lab">${esc(ex.m || '')}</span><h2>${esc(ex.name)}</h2></div>${closeBtn()}</div>
    <div class="stack">
      ${ms.length > 1 ? `<div class="seg">${ms.map(x => `<button data-act="ex-metric" data-ex="${esc(exId)}" data-p="${pid}" data-m="${x[0]}" aria-pressed="${x[0] === m[0]}">${x[1]}</button>`).join('')}</div>` : `<p class="small muted">${m[1]}</p>`}
      ${m[0] === 'e1rm' ? '<p class="small muted">An estimate of the most you could lift once, worked out from your weight and reps. It goes up when either one does.</p>' : ''}
      <div class="card flat">${series.length ? chart(series, m[2], 'ex') : '<p class="muted">No sessions yet.</p>'}</div>
      ${people().length > 1 ? personChips(pid, 'ex-person').replace(/data-act="ex-person"/g, `data-act="ex-person" data-ex="${esc(exId)}" data-m="${m[0]}"`) : ''}
      <div class="list">${ss.length ? ss.map(s => `<button class="row" data-act="open-wk" data-w="${s.w.id}"><span><span class="row-name">${fmtDay(s.t)}</span><span class="row-meta">${esc(s.sets.map(x => fmtSet(ex.type, x)).join(', '))}</span></span><span class="row-side">${(s.w.prs || []).some(p => p.ex === exId) ? '<span class="pill good">Best</span>' : ''}</span></button>`).join('') : `<p class="muted" style="padding:12px 0">${esc(pname(pid))} hasn't done this one yet.</p>`}</div>
    </div>`;
  openSheet({ kind: 'html', html });
}
function bodySheet() {
  const today = dayKey(Date.now());
  const body = recs('body', D.me).sort((a, b) => b.date.localeCompare(a.date));
  openSheet({ kind: 'html', html: `<div class="sheet-head"><h2>Body weight</h2>${closeBtn()}</div><div class="stack">
    <div class="r-fields" style="grid-template-columns:1fr 1fr"><label><span class="lab">kg</span><input type="text" inputmode="decimal" id="bw-kg" placeholder="${body[0] ? fmtN(body[0].kg) : '70'}"></label><label><span class="lab">Date</span><input type="date" id="bw-date" value="${today}" max="${today}"></label></div>
    <button class="btn primary wide" data-act="body-save">Save</button>
    <div class="toggle-row"><span><b>Share with your partner</b><span class="small muted" style="display:block">Off keeps it on this phone only.</span></span><button class="switch" role="switch" data-act="share-body" aria-checked="${!!D.settings.shareBody}" aria-label="Share body weight"></button></div>
    ${body.length ? `<div class="list">${body.slice(0, 12).map(b => `<div class="row"><span><span class="row-name">${fmtN(b.kg)} kg</span><span class="row-meta">${fmtDay(Date.parse(b.date + 'T12:00'))}</span></span><button class="icon-btn" data-act="body-del" data-id="${b.id}" aria-label="Delete">${I.trash}</button></div>`).join('')}</div>` : ''}
  </div>` });
}

/* ---------- history ---------- */
function renderHistory() {
  const pid = viewPerson(), ws = workouts(pid);
  let h = `<div class="hero"><span class="lab">History</span><h1>${ws.length} workout${ws.length === 1 ? '' : 's'}</h1></div>${personChips(pid)}`;
  if (!ws.length) return h + `<div class="empty"><p>${pid === D.me ? 'Your finished workouts show up here.' : `${esc(pname(pid))} hasn't logged a workout yet.`}</p></div>`;
  let month = '';
  ws.forEach(w => {
    const d = new Date(w.start), m = `${MON[d.getMonth()]} ${d.getFullYear()}`;
    if (m !== month) { if (month) h += '</div>'; month = m; h += `<h2 class="month">${m}</h2><div class="list">`; }
    const sets = w.items.reduce((n, i) => n + i.sets.length, 0);
    h += `<button class="row" data-act="open-wk" data-w="${w.id}"><span><span class="row-name">${esc(w.name)}</span><span class="row-meta">${fmtDay(w.start)} · ${fmtDur((w.end || w.start) - w.start)} · ${sets} sets</span></span><span class="row-side">${w.prs && w.prs.length ? `<span class="pill good">${w.prs.length} best${w.prs.length > 1 ? 's' : ''}</span>` : ''}</span></button>`;
  });
  return h + '</div>';
}
function workoutSheet(id) {
  const w = D.records[id]; if (!w) return;
  const mine = w.person === D.me;
  const prEx = new Set((w.prs || []).map(p => p.ex));
  openSheet({ kind: 'html', html: `<div class="sheet-head"><div><span class="lab"><span class="dot ${pcls(w.person)}" style="display:inline-block;margin-right:6px"></span>${esc(pname(w.person))}</span><h2>${esc(w.name)}</h2><p class="small muted">${fmtDay(w.start)} · ${fmtDur((w.end || w.start) - w.start)}</p></div>${closeBtn()}</div>
    <div class="stack"><div class="card flat ws">${w.items.map(it => { const ex = exById(it.ex); const best = prEx.has(it.ex) ? bestSet(ex.type, it.sets) : null; return `<div class="ws-ex"><h3>${esc(ex.name)}${prEx.has(it.ex) ? ' <span class="pill good">New best</span>' : ''}</h3><div class="ws-sets">${it.sets.map(s => `<span class="num${s === best ? ' pr' : ''}">${esc(fmtSet(ex.type, s))}</span>`).join('')}</div></div>`; }).join('')}</div>
    ${mine ? `<div class="btn-row"><button class="btn" data-act="wk-edit" data-w="${w.id}">${I.edit} Edit</button><button class="btn danger" data-act="wk-delete" data-w="${w.id}">${I.trash} Delete</button></div>` : ''}</div>` });
}

/* ---------- plan ---------- */
function renderPlan() {
  const pid = viewPerson(), mine = pid === D.me, rs = routines(pid), nx = nextRoutine(pid);
  let h = `<div class="hero"><span class="lab">Plan</span><h1>${mine ? 'Your workouts' : `${esc(pname(pid))}'s workouts`}</h1></div>${personChips(pid)}`;
  if (!mine) h += `<p class="note" style="margin-bottom:12px">Only ${esc(pname(pid))} can change this plan.</p>`;
  if (!rs.length) h += `<div class="empty"><p>No workouts in this plan.</p></div>`;
  rs.forEach(r => {
    h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>${esc(r.name)}</h2>${nx && nx.id === r.id ? '<span class="pill good">Next up</span>' : ''}</div>
      <ul class="plan-items">${r.items.map(it => { const ex = exById(it.ex); return `<li class="${it.g && r.items.filter(x => x.g === it.g).length > 1 ? 'ss' : ''}"><span>${esc(ex.name)}</span><span class="muted small num">${esc(targetText(it, ex).split(' · ')[0])}</span></li>`; }).join('')}</ul>
      ${mine ? `<div class="btn-row"><button class="btn" data-act="r-edit" data-r="${r.id}">${I.edit} Edit</button><button class="btn primary" data-act="start-wk" data-r="${r.id}">${I.play} Start</button></div>` : ''}</div>`;
  });
  if (mine) h += `<div style="margin-top:12px"><button class="btn wide" data-act="r-new">${I.plus} New workout</button></div>
    <p class="small muted" style="margin-top:14px">Workouts take turns in this order. Linked exercises are done as a superset.</p>`;
  return h;
}
const RESTS = [0, 30, 45, 60, 90, 120, 150, 180, 240];
function routineSheet(rid) {
  const r = D.records[rid]; if (!r) return;
  const items = r.items.map((it, i) => {
    const ex = exById(it.ex), unit = ex.type === 't' ? 'sec' : ex.type === 'c' ? 'min' : 'reps';
    const linked = !!(it.g && r.items[i + 1] && r.items[i + 1].g === it.g);
    return `<div class="r-item"><div class="r-line"><b>${esc(ex.name)}</b><span class="r-tools">
        <button class="icon-btn" data-act="ri-move" data-r="${rid}" data-i="${i}" data-d="-1" aria-label="Move up"${i ? '' : ' disabled'}>${I.up}</button>
        <button class="icon-btn" data-act="ri-move" data-r="${rid}" data-i="${i}" data-d="1" aria-label="Move down"${i < r.items.length - 1 ? '' : ' disabled'}>${I.down}</button>
        <button class="icon-btn" data-act="ri-del" data-r="${rid}" data-i="${i}" aria-label="Remove">${I.trash}</button></span></div>
      <div class="r-fields">
        <label><span class="lab">Sets</span><input type="number" inputmode="numeric" min="1" max="10" data-rf="n" data-r="${rid}" data-i="${i}" value="${it.n}"></label>
        <label><span class="lab">Min ${unit}</span><input type="number" inputmode="numeric" min="1" data-rf="lo" data-r="${rid}" data-i="${i}" value="${it.lo}"></label>
        <label><span class="lab">Max ${unit}</span><input type="number" inputmode="numeric" min="1" data-rf="hi" data-r="${rid}" data-i="${i}" value="${it.hi}"></label>
        <label><span class="lab">Rest</span><select data-rf="rest" data-r="${rid}" data-i="${i}">${RESTS.concat(RESTS.includes(it.rest) ? [] : [it.rest]).map(s => `<option value="${s}"${s === it.rest ? ' selected' : ''}>${s ? mmss(s) : 'None'}</option>`).join('')}</select></label>
      </div>
      ${i < r.items.length - 1 ? `<button class="link-btn" data-act="ri-link" data-r="${rid}" data-i="${i}" aria-pressed="${linked}">${I.link} ${linked ? 'Superset with the next one' : 'Make a superset with the next one'}</button>` : ''}</div>`;
  }).join('');
  openSheet({ kind: 'routine', rid, html: `<div class="sheet-head"><input type="text" data-rf="name" data-r="${rid}" value="${esc(r.name)}" aria-label="Workout name" style="font-family:var(--display);font-weight:650;font-size:19px">${closeBtn()}</div>
    <div class="stack"><div class="list">${items || '<p class="muted" style="padding:12px 0">No exercises yet.</p>'}</div>
      <button class="btn wide" data-act="pick" data-mode="add-routine" data-r="${rid}">${I.plus} Add exercise</button>
      <button class="btn primary wide" data-act="close">Done</button>
      <button class="btn wide quiet danger" data-act="r-delete" data-r="${rid}">Delete this workout</button></div>` });
}
function routineField(el) {
  const r = D.records[el.dataset.r]; if (!r) return;
  const f = el.dataset.rf;
  if (f === 'name') { const v = el.value.trim(); if (v) { r.name = v.slice(0, 40); put(r); } return; }
  const it = r.items[Number(el.dataset.i)]; if (!it) return;
  let v = Math.round(Number(el.value));
  if (!isFinite(v) || v < (f === 'rest' ? 0 : 1)) { el.value = it[f]; return; }
  if (f === 'n') v = Math.min(10, v);
  it[f] = v;
  if (f === 'lo' && it.hi < v) it.hi = v;
  if (f === 'hi' && it.lo > v) it.lo = v;
  put(r);
}

/* ---------- picker ---------- */
function pickerSheet(mode, ctx) {
  S.pick = { mode, ctx, q: S.pick && S.pick.mode === mode ? S.pick.q : '' };
  openSheet({ kind: 'html', html: `<div class="sheet-head"><h2>${mode === 'swap' ? 'Swap for' : 'Add exercise'}</h2>${closeBtn()}</div>
    <input type="search" id="pick-q" placeholder="Search or name a new one" autocomplete="off" value="${esc(S.pick.q)}"><div id="pick-list"></div>` });
  drawPicker();
}
function drawPicker() {
  const q = (S.pick.q || '').trim().toLowerCase();
  const list = allExercises().filter(e => !q || e.name.toLowerCase().includes(q) || (e.m || '').toLowerCase().includes(q) || (e.eq || '').toLowerCase().includes(q));
  let h = '';
  GROUPS.forEach(g => {
    const xs = list.filter(e => (e.m || 'Other') === g);
    if (xs.length) h += `<p class="lab pick-grp">${g}</p><div class="menu">${xs.map(e => `<button data-act="pick-ex" data-ex="${esc(e.id)}"><span style="flex:1">${esc(e.name)}</span><span class="small muted">${esc(e.eq || TYPE_NAMES[e.type])}</span></button>`).join('')}</div>`;
  });
  if (q && !allExercises().some(e => e.name.toLowerCase() === q)) {
    h += `<p class="lab pick-grp">New exercise</p><div class="card flat stack"><p>Add <b>${esc(S.pick.q.trim())}</b>. How do you log it?</p><select id="pick-type">${Object.entries(TYPE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button class="btn primary" data-act="pick-new">Add exercise</button></div>`;
  }
  if (!h) h = '<p class="muted" style="padding:12px 0">Nothing matches.</p>';
  $('#pick-list').innerHTML = h;
}
function picked(exId) {
  const { mode, ctx } = S.pick;
  const ex = exById(exId);
  if (mode === 'add-active') {
    D.active.items.push(makeItem(D.active.person, Object.assign({ ex: exId }, defaultsFor(ex)), D.active.editing ? D.active.start : null));
    if (D.active.editing) D.active.items[D.active.items.length - 1].sets.forEach(s => { s.done = false; });
    save(); closeSheet(); render();
    const last = D.active.items[D.active.items.length - 1];
    const el = document.getElementById('ex-' + last.k); if (el) el.scrollIntoView({ block: 'center' });
  } else if (mode === 'swap') {
    const it = itemOf(ctx); if (!it) return closeSheet();
    const fresh = makeItem(D.active.person, Object.assign({ ex: exId, n: it.sets.length }, ex.type === exById(it.ex).type ? { lo: it.lo, hi: it.hi, rest: it.rest } : defaultsFor(ex)), D.active.editing ? D.active.start : null);
    Object.assign(it, { ex: exId, lo: fresh.lo, hi: fresh.hi, rest: fresh.rest, sets: fresh.sets });
    save(); closeSheet(); render();
    toast(`Swapped for ${ex.name} in this workout. Change the plan in Plan.`);
  } else if (mode === 'add-routine') {
    const r = D.records[ctx]; if (!r) return closeSheet();
    r.items.push(Object.assign({ k: uid(), ex: exId }, defaultsFor(ex)));
    put(r); routineSheet(r.id);
  }
}

/* ---------- more ---------- */
const syncOn = () => !!(D.sync && D.sync.url && D.sync.key);
function syncPill() {
  if (!syncOn()) return '';
  const sy = D.sync;
  if (sy.error) return `<button class="pill warn" data-act="tab" data-tab="more">Not synced</button>`;
  return `<span class="pill">${sy.last ? `Synced ${fmtAgo(sy.last)}` : 'Syncing…'}</span>`;
}
function fmtAgo(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtWhen(t); }
function renderMore() {
  const p = me(), sy = D.sync || {};
  let h = `<div class="hero"><span class="lab">More</span><h1>Settings</h1></div>`;
  h += `<div class="sec-head"><h2>You</h2></div><div class="card flat stack"><label class="field"><span class="lab">Your name</span><input type="text" id="my-name" value="${esc(p.name)}" maxlength="30"></label>
    ${people().length > 1 ? `<button class="link" data-act="switch-me">Not ${esc(p.name)}? Switch who's on this phone</button>` : ''}</div>`;
  h += `<div class="sec-head"><h2>Train together</h2>${syncPill()}</div>`;
  if (syncOn()) {
    const others = people().filter(o => o.id !== D.me);
    h += `<div class="card flat stack">
      <p>${others.length ? `Sharing with ${others.map(o => `<b>${esc(o.name)}</b>`).join(', ')}.` : 'Connected. Send your partner the invite code so they can join.'}</p>
      ${sy.error ? `<p class="note">${esc(syncProblem())}</p>` : ''}
      <div class="btn-row"><button class="btn primary" data-act="invite">Share invite code</button><button class="btn" data-act="sync-now">Sync now</button></div>
      <p class="small muted">The invite code lets someone read and add to your shared log. Only send it to your partner.</p>
      <button class="link" data-act="sync-off" style="color:var(--bad)">Stop sharing on this phone</button></div>`;
  } else {
    h += `<div class="card flat stack"><p>You each log on your own phone. A small script in one Google account keeps a shared copy, so you can see each other's workouts. One of you sets it up, then sends the other an invite code.</p>
      <ul class="steps">
        <li><span>1</span><div><p><b>Copy the setup script.</b> It includes a private key.</p><button class="btn small primary" data-act="copy-script">Copy setup script</button></div></li>
        <li><span>2</span><div><p><b>Paste it into a new project</b> at script.google.com, replacing what's there. On iPhone, open it in Safari and tap <b>aA</b> › <b>Request Desktop Website</b> first.</p></div></li>
        <li><span>3</span><div><p><b>Deploy it.</b> Deploy › New deployment › the gear › Web app. Set Execute as <b>Me</b> and Who has access <b>Anyone</b>, then Deploy. When Google warns the app isn't verified (you made it), tap Advanced › Go to the project › Allow.</p></div></li>
        <li><span>4</span><div><p><b>Paste the Web app URL here.</b></p><input type="url" id="sync-url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec"><button class="btn small primary" data-act="sync-connect">Connect</button></div></li>
      </ul>
      ${S.showScript && S.scriptText ? `<textarea readonly id="script-text">${esc(filledScript())}</textarea>` : ''}
      <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:4px 0">
      <p><b>Your partner already set it up?</b> Paste their invite code.</p>
      <input type="text" id="join-code" placeholder="reps:…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn" data-act="join">Join</button></div>`;
  }
  h += `<div class="sec-head"><h2>Training</h2></div><div class="card flat">
    <div class="toggle-row"><span><b>Weekly goal</b><span class="small muted" style="display:block">Workouts per week</span></span><span class="stepper"><button class="btn small" data-act="goal" data-v="-1" aria-label="Fewer">${I.minus}</button><b class="num">${D.settings.goal || 2}</b><button class="btn small" data-act="goal" data-v="1" aria-label="More">${I.plus}</button></span></div>
    <div class="toggle-row"><span><b>Rest timer sound</b><span class="small muted" style="display:block">Beeps when rest is over. Phones on silent stay quiet.</span></span><button class="switch" role="switch" data-act="sound" aria-checked="${!!D.settings.sound}" aria-label="Rest timer sound"></button></div></div>`;
  h += `<div class="sec-head"><h2>Your data</h2></div><div class="card flat stack"><p class="small muted">Everything is kept on this phone${syncOn() ? ' and in your shared Google sheet' : ''}. Back up now and then and save the file to Files or iCloud Drive.</p>
    <div class="btn-row"><button class="btn" data-act="backup">Back up now</button><label class="btn" style="cursor:pointer">Restore backup<input type="file" id="restore" accept="application/json,.json" hidden></label></div>
    <button class="link" data-act="welcome">See the welcome tour again</button></div>
    <p class="small muted" style="text-align:center;margin-top:20px">Reps ${VERSION}</p>`;
  return h;
}

/* ---------- sync ---------- */
function newKey() { const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 28); }
const filledScript = () => (S.scriptText || '').replace('__REPS_KEY__', D.sync.key);
function loadScript() { return S.scriptText ? Promise.resolve(S.scriptText) : fetch('sync.gs', { cache: 'no-cache' }).then(r => (r.ok ? r.text() : Promise.reject(new Error('script')))).then(t => (S.scriptText = t)); }
async function copyScript() {
  if (!D.sync || !D.sync.key || D.sync.url) D.sync = { url: '', key: (D.sync && !D.sync.url && D.sync.key) || newKey(), since: 0 };
  save();
  try {
    const cb = navigator.clipboard;
    if (S.scriptText && cb && cb.writeText) await cb.writeText(filledScript());
    else if (cb && window.ClipboardItem) await cb.write([new ClipboardItem({ 'text/plain': loadScript().then(() => new Blob([filledScript()], { type: 'text/plain' })) })]);
    else throw new Error('clipboard');
    toast('Script copied. Paste it into a new project on script.google.com.');
  } catch (e) {
    try { await loadScript(); } catch (x) { toast("Couldn't load the script. Check you're online and try again."); return; }
    S.showScript = true; render();
    const ta = $('#script-text'); if (ta) { ta.focus(); ta.select(); }
    toast("Couldn't copy it automatically. Select the script below and copy it.");
  }
}
async function connect() {
  const v = (($('#sync-url') || {}).value || '').trim();
  if (!/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec\b/.test(v)) { toast('Paste the Web app URL. It starts with https://script.google.com/macros/s/ and ends with /exec.', 4500); return; }
  if (!D.sync || !D.sync.key) { toast('Copy the setup script first, so it has your key.'); return; }
  D.sync.url = v.replace(/[?#].*$/, ''); D.sync.since = 0; D.sync.error = '';
  markAllDirty(); save();
  toast('Connecting…');
  const ok = await syncNow(true);
  render();
  toast(ok ? 'Connected. Now share the invite code with your partner.' : syncProblem(), 4500);
  if (!ok) { D.sync.url = ''; save(); render(); }
}
const inviteCode = () => 'reps:' + btoa(JSON.stringify({ u: D.sync.url, k: D.sync.key })).replace(/=+$/, '');
function parseInvite(code) {
  const s = String(code || '').trim().replace(/^reps:/i, '').replace(/\s+/g, '');
  try { const o = JSON.parse(atob(s)); if (o && /^https:\/\/script\.google\.com\//.test(o.u) && o.k) return o; } catch (e) { /* bad code */ }
  return null;
}
async function join() {
  const o = parseInvite(($('#join-code') || {}).value);
  if (!o) { toast("That code doesn't look right. Copy the whole thing, starting with reps:", 4000); return; }
  D.sync = { url: o.u, key: o.k, since: 0 };
  markAllDirty(); save();
  toast('Joining…');
  const ok = await syncNow(true);
  if (!ok) { const msg = syncProblem(); D.sync = null; save(); render(); toast(msg, 4500); return; }
  if (!me()) { S.startMode = people().length ? 'pick' : 'new'; render(); toast(people().length ? 'Joined. Now pick yourself.' : 'Joined. Enter your name to start.'); return; }
  render(); toast('Joined. You can now see each other\'s workouts.');
}
function markAllDirty() { Object.values(D.records).forEach(r => { D.dirty[r.id] = r.updated || 1; }); }
function syncProblem() {
  const e = D.sync && D.sync.error;
  return e === 'key' ? "The Google script doesn't have this key. Copy the setup script again, paste it over the old one and deploy a new version."
    : e === 'net' ? "Couldn't reach the Google script. Check you're online, and that the deployment lets Anyone access it."
      : e === 'bad' ? 'The Google script answered in a way Reps didn\'t expect. Make sure it\'s the Reps setup script.' : '';
}
let syncTimer = null;
function queueSync() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 1500); }
const shareable = r => !(r.kind === 'body' && r.person === D.me && !D.settings.shareBody);
async function syncNow(manual) {
  if (!syncOn() || S.syncBusy) return false;
  if (!manual && navigator.onLine === false) return false;
  S.syncBusy = true;
  const sy = D.sync;
  const push = Object.keys(D.dirty).map(id => D.records[id]).filter(r => r && shareable(r)).concat(S.extraPush || []);
  const sent = {}; push.forEach(r => { sent[r.id] = r.updated; });
  let ok = false;
  try {
    let j;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 30000);
    try {
      const res = await fetch(sy.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: sy.key, since: sy.since || 0, push }), cache: 'no-store', redirect: 'follow', signal: ctl ? ctl.signal : undefined });
      j = await res.json();
    } catch (e) { throw { code: 'net' }; } finally { clearTimeout(timer); }
    if (!j || j.error === 'key') throw { code: 'key' };
    if (!Array.isArray(j.records) || typeof j.now !== 'number') throw { code: 'bad' };
    const changed = merge(j.records);
    Object.keys(sent).forEach(id => { if (D.dirty[id] === sent[id]) delete D.dirty[id]; });
    S.extraPush = [];
    sy.since = j.now; sy.last = Date.now(); sy.error = '';
    ok = true;
    save();
    if (changed && S.view !== 'workout' && !typing()) render();
    else if (S.view !== 'workout' && !typing()) { const pill = document.querySelector('.sec-head .pill'); if (pill && pill.textContent.startsWith('Sync')) pill.textContent = `Synced ${fmtAgo(sy.last)}`; }
  } catch (e) {
    sy.error = (e && e.code) || 'net'; save();
    if (manual) { /* caller shows the message */ }
  } finally { S.syncBusy = false; }
  return ok;
}
const typing = () => { const a = document.activeElement; return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')); };
function merge(list) {
  let changed = false;
  (list || []).forEach(r => {
    if (!r || typeof r.id !== 'string' || !r.kind) return;
    if (r.kind === 'body' && r.person === D.me && !D.settings.shareBody) return;
    const l = D.records[r.id];
    if (l && (l.updated || 0) >= (r.updated || 0)) return;
    D.records[r.id] = r; changed = true;
  });
  if (changed && D.me && !D.records[D.me]) D.me = null;
  return changed;
}
async function shareInvite() {
  const code = inviteCode();
  const text = `Join me on Reps so we can see each other's workouts.\n\n1. Open ${location.origin + location.pathname} in Safari and add it to your Home Screen.\n2. Open Reps, tap "Join instead" and paste this code:\n\n${code}`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast('Invite copied. Send it to your partner.');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(code); toast('Invite code copied.'); } catch (x) { prompt('Copy this invite code', code); }
  }
}

/* ---------- backup ---------- */
function backup() {
  const data = { app: 'reps', version: 1, exported: new Date().toISOString(), me: D.me, settings: D.settings, records: Object.values(D.records) };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `reps-backup-${dayKey(Date.now())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function restore(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!d || d.app !== 'reps' || !Array.isArray(d.records)) throw new Error('bad');
    let n = 0;
    d.records.forEach(r => { if (r && r.id && r.kind) { const l = D.records[r.id]; if (!l || (l.updated || 0) < (r.updated || 0)) { D.records[r.id] = r; D.dirty[r.id] = r.updated; n++; } } });
    if (!me() && d.me && D.records[d.me]) D.me = d.me;
    save(); queueSync(); render();
    toast(n ? `Restored ${n} item${n > 1 ? 's' : ''}.` : 'Nothing new in that backup.');
  } catch (e) { toast("That file isn't a Reps backup."); }
}

/* ---------- sheets ---------- */
const closeBtn = () => `<button class="icon-btn" data-act="close" aria-label="Close">${I.close}</button>`;
function openSheet(s) {
  S.sheet = s;
  const el = $('#sheet');
  el.innerHTML = '<div class="sheet-grip"></div>' + s.html;
  $('#sheet-wrap').hidden = false;
  bindCharts(el);
}
function closeSheet() {
  const wasRoutine = S.sheet && S.sheet.kind === 'routine';
  S.sheet = null; $('#sheet-wrap').hidden = true; $('#sheet').innerHTML = '';
  if (wasRoutine && S.tab === 'plan' && !S.view) render();
}
function armed(el, fn) {
  if (el.classList.contains('armed')) { fn(); return; }
  const txt = el.innerHTML; el.classList.add('armed'); el.textContent = 'Tap again to confirm';
  setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.innerHTML = txt; } }, 3000);
}

/* ---------- actions ---------- */
const ACT = {
  tab: el => { S.tab = el.dataset.tab; closeSheet(); render(); window.scrollTo(0, 0); },
  'view-p': el => { S.viewP = el.dataset.p; render(); },
  'view-progress': el => { S.viewP = el.dataset.p; S.tab = 'progress'; render(); window.scrollTo(0, 0); },
  'start-mode': el => { S.startMode = el.dataset.m; render(); },
  start: () => {
    const v = (($('#start-name') || {}).value || '').trim();
    if (!v) { toast('Enter your name first.'); const i = $('#start-name'); if (i) i.focus(); return; }
    const p = createPerson(v); D.me = p.id; save(); $('#toast').hidden = true; S.tab = 'today'; render(); window.scrollTo(0, 0);
  },
  'pick-me': el => { D.me = el.dataset.p; save(); $('#toast').hidden = true; S.tab = 'today'; render(); },
  join: () => join(),
  'start-wk': el => startWorkout(el.dataset.r),
  resume: () => { S.view = 'workout'; render(); wake(true); },
  'wk-hide': () => { S.view = null; S.tab = D.active && D.active.editing ? 'history' : 'today'; wake(false); render(); window.scrollTo(0, 0); },
  'wk-finish': () => finishSheet(),
  'wk-save': () => saveWorkout(),
  'wk-discard': el => armed(el, () => { D.active = null; S.rest = null; save(); wake(false); S.view = null; render(); toast('Workout discarded.'); }),
  'wk-cancel-edit': () => { D.active = null; S.rest = null; save(); S.view = null; S.tab = 'history'; render(); },
  tick: el => tick(el),
  apply: el => { const it = itemOf(el.dataset.k); if (!it) return; it.sets.forEach(s => { if (!s.done) s.w = Number(el.dataset.v); }); save(); redrawCard(it.k); },
  'set-add': el => { const it = itemOf(el.dataset.k); const l = it.sets[it.sets.length - 1] || {}; it.sets.push({ w: l.w == null ? null : l.w, r: null, t: null, m: null, done: false }); save(); redrawCard(it.k); },
  'set-remove': el => { const it = itemOf(el.dataset.k); if (it.sets.length > 1) it.sets.pop(); save(); redrawCard(it.k); },
  'ex-menu': el => {
    const k = el.dataset.k, it = itemOf(k), idx = D.active.items.indexOf(it), ex = exById(it.ex);
    openSheet({ kind: 'html', html: `<div class="sheet-head"><h2>${esc(ex.name)}</h2>${closeBtn()}</div><div class="menu">
      <button data-act="pick" data-mode="swap" data-k="${k}">${I.swap} Swap for another exercise</button>
      <button data-act="open-ex" data-ex="${esc(it.ex)}" data-p="${D.active.person}">${I.chart} See progress</button>
      ${idx > 0 ? `<button data-act="ex-move" data-k="${k}" data-d="-1">${I.up} Move up</button>` : ''}
      ${idx < D.active.items.length - 1 ? `<button data-act="ex-move" data-k="${k}" data-d="1">${I.down} Move down</button>` : ''}
      <button class="danger" data-act="ex-del" data-k="${k}">${I.trash} Remove from this workout</button></div>` });
  },
  'ex-move': el => { const a = D.active.items, i = a.findIndex(x => x.k === el.dataset.k), j = i + Number(el.dataset.d); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; a[i].g = a[j].g = null; save(); closeSheet(); render(); },
  'ex-del': el => { D.active.items = D.active.items.filter(x => x.k !== el.dataset.k); save(); closeSheet(); render(); },
  pick: el => pickerSheet(el.dataset.mode, el.dataset.k || el.dataset.r),
  'pick-ex': el => picked(el.dataset.ex),
  'pick-new': () => {
    const name = (S.pick.q || '').trim().slice(0, 40); if (!name) return;
    const type = ($('#pick-type') || {}).value || 'w';
    const rec = put({ id: 'x-' + uid(), kind: 'exercise', person: null, name, type, m: 'Other', eq: '', inc: type === 'a' || type === 'w' ? 2.5 : 1 });
    picked(rec.id);
  },
  'rest-add': el => { if (!S.rest) return; S.rest.end = Math.max(Date.now(), S.rest.end) + Number(el.dataset.v) * 1000; S.rest.total = Math.max(S.rest.total, (S.rest.end - Date.now()) / 1000); S.rest.rang = false; renderRest(); },
  'rest-skip': () => { S.rest = null; renderRest(); },
  'open-wk': el => workoutSheet(el.dataset.w),
  'wk-edit': el => editWorkout(el.dataset.w),
  'wk-delete': el => armed(el, () => { const w = D.records[el.dataset.w]; remove(w); workouts(w.person).filter(o => o.start > w.start).forEach(o => { const p = computePRs(o); if (JSON.stringify(p) !== JSON.stringify(o.prs || [])) { o.prs = p; put(o); } }); closeSheet(); render(); toast('Workout deleted.'); }),
  'open-ex': el => exSheet(el.dataset.ex, el.dataset.p || D.me),
  'ex-metric': el => exSheet(el.dataset.ex, el.dataset.p, el.dataset.m),
  'ex-person': el => exSheet(el.dataset.ex, el.dataset.p, el.dataset.m),
  body: () => bodySheet(),
  'body-save': () => {
    const kg = parseNum(($('#bw-kg') || {}).value), date = ($('#bw-date') || {}).value || dayKey(Date.now());
    if (!kg || kg < 20 || kg > 400) { toast('Enter your weight in kg.'); return; }
    const old = recs('body', D.me).find(b => b.date === date);
    put(Object.assign(old || { id: uid(), kind: 'body', person: D.me }, { date, kg }));
    closeSheet(); render(); toast('Logged.');
  },
  'body-del': el => { remove(D.records[el.dataset.id]); bodySheet(); render(); },
  'share-body': el => {
    D.settings.shareBody = !D.settings.shareBody;
    const mineBody = Object.values(D.records).filter(r => r.kind === 'body' && r.person === D.me);
    if (D.settings.shareBody) mineBody.forEach(r => { D.dirty[r.id] = r.updated; });
    else S.extraPush = (S.extraPush || []).concat(mineBody.map(r => ({ id: r.id, kind: 'body', person: D.me, date: '', kg: 0, deleted: true, updated: Date.now() })));
    el.setAttribute('aria-checked', String(D.settings.shareBody)); save(); queueSync(); render();
  },
  'r-edit': el => routineSheet(el.dataset.r),
  'r-new': () => { const rs = routines(D.me); const r = put({ id: uid(), kind: 'routine', person: D.me, name: `Workout ${String.fromCharCode(65 + rs.length)}`, order: rs.length ? Math.max(...rs.map(x => x.order)) + 1 : 0, created: Date.now(), items: [] }); render(); routineSheet(r.id); },
  'r-delete': el => armed(el, () => { remove(D.records[el.dataset.r]); closeSheet(); render(); toast('Workout removed from your plan.'); }),
  'ri-move': el => { const r = D.records[el.dataset.r], i = Number(el.dataset.i), j = i + Number(el.dataset.d); if (j < 0 || j >= r.items.length) return; [r.items[i], r.items[j]] = [r.items[j], r.items[i]]; put(r); routineSheet(r.id); },
  'ri-del': el => { const r = D.records[el.dataset.r]; r.items.splice(Number(el.dataset.i), 1); put(r); routineSheet(r.id); },
  'ri-link': el => {
    const r = D.records[el.dataset.r], i = Number(el.dataset.i), a = r.items[i], b = r.items[i + 1]; if (!b) return;
    if (a.g && a.g === b.g) { b.g = null; if (!r.items.some((x, j) => j !== i && x.g === a.g)) a.g = null; }
    else { const g = a.g || uid(); a.g = g; b.g = g; }
    put(r); routineSheet(r.id);
  },
  close: () => closeSheet(),
  'switch-me': () => { const ps = people(); openSheet({ kind: 'html', html: `<div class="sheet-head"><h2>Who's on this phone?</h2>${closeBtn()}</div><div class="menu">${ps.map(p => `<button data-act="pick-me-sheet" data-p="${p.id}"><span class="dot ${pcls(p.id)}"></span>${esc(p.name)}${p.id === D.me ? ' (now)' : ''}</button>`).join('')}</div>` }); },
  'pick-me-sheet': el => { if (D.active) { toast('Finish the workout in progress first.'); return; } D.me = el.dataset.p; S.viewP = null; save(); closeSheet(); render(); },
  'copy-script': () => copyScript(),
  'sync-connect': () => connect(),
  'sync-now': async () => { toast('Syncing…'); const ok = await syncNow(true); render(); toast(ok ? 'Up to date.' : syncProblem(), ok ? 2000 : 4500); },
  'sync-off': el => armed(el, () => { D.sync = null; save(); render(); toast('Sharing stopped on this phone. Your data stays here.'); }),
  invite: () => shareInvite(),
  goal: el => { D.settings.goal = Math.max(1, Math.min(7, (D.settings.goal || 2) + Number(el.dataset.v))); save(); render(); },
  sound: el => { D.settings.sound = !D.settings.sound; el.setAttribute('aria-checked', String(D.settings.sound)); save(); if (D.settings.sound) { unlockAudio(); ding(); } },
  backup: () => backup(),
  welcome: () => openSheet({ kind: 'html', html: `<div class="sheet-head"><div><span class="brand">Reps</span><h2>Lifting gets easier when you can see it.</h2></div>${closeBtn()}</div>${painsHtml()}<p class="small muted" style="margin-top:14px">Start a workout from Today. Tick each set as you finish it. Change exercises, sets and rest times in Plan.</p><button class="btn primary wide" data-act="close" style="margin-top:14px">Got it</button>` }),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (e.target.closest('#sheet-wrap') && e.target.id === 'sheet-wrap') return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
$('#sheet-wrap').addEventListener('click', e => { if (e.target.id === 'sheet-wrap') closeSheet(); });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('.set-row .in')) onSetInput(t);
  else if (t.id === 'pick-q') { S.pick.q = t.value; drawPicker(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rf) routineField(t);
  else if (t.id === 'my-name') { const v = t.value.trim(); if (v && me()) { me().name = v.slice(0, 30); put(me()); toast('Name saved.'); } }
  else if (t.id === 'restore' && t.files && t.files[0]) restore(t.files[0]);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t.id === 'start-name') ACT.start();
  else if (t.matches('.set-row .in')) { const row = t.closest('.set-row'), ins = [...row.querySelectorAll('.in')], i = ins.indexOf(t); if (i < ins.length - 1) ins[i + 1].focus(); else t.blur(); }
  else if (t.id === 'join-code') join();
  else if (t.dataset.rf) t.blur();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (S.view === 'workout') { wake(true); renderRest(); }
  syncNow(false);
});
window.addEventListener('online', () => syncNow(false));
setInterval(() => {
  if (S.view === 'workout' && D.active) {
    const c = $('#wk-clock'); if (c && !D.active.editing) c.textContent = mmss((Date.now() - D.active.start) / 1000);
    if (S.rest) renderRest();
  }
}, 500);
setInterval(() => { if (document.visibilityState === 'visible') syncNow(false); }, 90000);

render();
syncNow(false);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
