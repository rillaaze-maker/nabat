/* Nabat — a gentle, self-paced Quran memorization app (web version of the real product).
   No server: everything lives on the device (localStorage). Design (fonts, art, splash, every word of copy)
   comes from design.json; the design panel (/panel/) previews changes live in an iframe of this app. */
(() => {
'use strict';
const Q = window.NABAT_QURAN, F = window.NabatFSRS, ART = window.NABAT_ART || {}, REV = window.NABAT_REVAYAT || [];
const COPY = window.NABAT_COPY || {};
const $app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview');
const FA = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const faName = s => s.replace(/ك/g, 'ک').replace(/ي/g, 'ی');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const now = () => Date.now();
const DAY = F.DAY;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ============================================================ design: fonts, art, splash, copy */
const ROLES = {
  name: ['نام برنامه', 'Haiku Davan', 700, 58], deco: ['آیه‌ی آغاز', 'Hafez', 400, 26], niyyat: ['نیت', 'Hafez', 400, 22],
  ref: ['نشانی آیه', 'Bonyade Koodak', 400, 12], obTitle: ['تیتر معرفی', 'Shoor', 700, 26], obOption: ['گزینه‌های معرفی', 'Hafez', 400, 21],
  obMeta: ['توضیح گزینه‌ها', 'Bonyade Koodak', 400, 13], estimate: ['تخمین سال‌ها', 'Shoor', 700, 22],
  todayTitle: ['تیتر صفحه‌ها', 'Shoor', 700, 26], todaySub: ['خط وضعیت', 'Bonyade Koodak', 400, 15], gardenLabel: ['نام گیاه‌ها', 'Hafez', 400, 15],
  cta: ['دکمه‌ی اصلی', 'Shoor', 700, 19], quote: ['آیه‌ی پایین صفحه', 'Hafez', 400, 22], foot: ['جمله‌ی پایانی', 'Dana', 400, 14],
  hifzTitle: ['نام سوره', 'Hafez', 400, 26], hifzMeta: ['جزئیات', 'Bonyade Koodak', 400, 13], hint: ['راهنما', 'Bonyade Koodak', 400, 14],
  quran: ['متن قرآن', 'Amiri Quran', 400, 30], stepChip: ['مرحله', 'Bonyade Koodak', 400, 12], btn: ['دکمه‌ها', 'Bonyade Koodak', 400, 15],
  grade: ['دکمه‌های ارزیابی', 'Dana', 500, 14], translation: ['ترجمه و روایت', 'Dana', 300, 15], go: ['پیوندها', 'Bonyade Koodak', 400, 13],
  doneTitle: ['تیتر پایان', 'Shoor', 700, 28]
};
const DEFAULT_FONTS = Object.fromEntries(Object.entries(ROLES).map(([k, [, font, weight, size]]) => [k, { font, weight, size }]));
window.NABAT_ROLES = Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v[0]]));
window.NABAT_COPY_DEFAULTS = COPY;
let BASE = { art: 'a2', splash: 'splash.svg', boil: true, fonts: DEFAULT_FONTS, copy: {} };
let design = BASE, previewing = false;
const mergeDesign = (a, b) => ({ ...a, ...(b || {}), fonts: { ...a.fonts, ...((b && b.fonts) || {}) }, copy: { ...(a.copy || {}), ...((b && b.copy) || {}) } });
const T = (k, v = {}) => String(design.copy[k] ?? COPY[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
async function loadDesign() {
  try { const r = await fetch('design.json', { cache: 'no-cache' }); if (r.ok) BASE = mergeDesign(BASE, await r.json()); } catch (e) {}
  design = BASE;
  const local = store.get('nabat-design-v1', null);
  if (local) { design = mergeDesign(BASE, local); previewing = !PREVIEW; }
  settleDesign();
}
function settleDesign() {
  if (!ART[design.art]) design.art = 'a2';
  document.body.classList.toggle('noboil', design.boil === false);
}
/* the panel calls this to apply edits live without reloading */
window.NABAT_setDesign = d => { design = mergeDesign(BASE, d); settleDesign(); render(); };
window.NABAT_go = r => { if (r === 'splash') { route = 'splash'; enter = true; render(); startSplashTimer(); } else go(r); };

function applyFonts(root = $app) {
  root.querySelectorAll('[data-role]').forEach(el => {
    const c = design.fonts[el.dataset.role] || DEFAULT_FONTS[el.dataset.role]; if (!c) return;
    const fam = el.dataset.role === 'quran' ? 'Amiri Quran' : c.font;
    el.style.fontFamily = `'${fam}', 'Bonyade Koodak', Dana, sans-serif`;
    el.style.fontWeight = c.weight; el.style.fontSize = c.size + 'px';
    if (el.dataset.uthmani) el.textContent = fam === 'Amiri Quran' ? el.dataset.uthmani : el.dataset.simple;
  });
}
const usesUthmani = role => ((design.fonts[role] || DEFAULT_FONTS[role]).font === 'Amiri Quran');
const artSet = () => ART[design.art] || ART.a2 || {};
function art(file, cls = '', style = '') {
  const svg = artSet()[file] || (ART.a2 || {})[file] || '';
  return `<div class="art ${cls} ${design.art === 'a1' ? 'filterboil' : ''}" style="${style}">${svg}</div>`;
}
function marker(n, alive, pop, d) {
  return `<span class="mk ${alive ? 'alive' : ''} ${pop ? 'pop' : ''} ${design.art === 'a1' ? 'filterboil' : ''}" style="--d:${d}s">${artSet()['marker.svg'] || ''}<span class="n">${FA(n)}</span></span>`;
}
const arrow = (dir = 'back') => `<span class="arr ${dir}" aria-hidden="true">${artSet()['arrow.svg'] || (ART.a2 || {})['arrow.svg'] || ''}</span>`;
const leaf = () => '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 13 C3 6 8 3 13 3 C13 9 9 13 3 13 Z" fill="#3a7d47" fill-opacity=".18" stroke="#3a7d47" stroke-width="1.2"/><path d="M3.5 12.5 L10 6" stroke="#3a7d47" stroke-width="1"/></svg>';

/* ============================================================ content → units → plants */
const wc = t => t.split(' ').length;
function buildUnits() {
  const U = [];
  for (const s of Q.order) {
    const sur = Q.surahs[s];
    sur.ayat.forEach((a, i) => U.push({ id: `${s}:${a.n}`, plant: String(s), surah: s, name: faName(sur.name), n: a.n,
      ayat: [a], basmala: i === 0 ? sur.basmala : null, whole: sur.ayat.length === 1 }));
  }
  for (const g of (Q.golchin || [])) {
    const parts = branches(g.t), name = `${faName(Q.golchinNames ? Q.golchinNames[g.surah] : g.name)} ${FA(g.ayah)}`;
    parts.forEach((t, k) => U.push({ id: `g${g.id}:${k + 1}`, plant: 'g' + g.id, surah: g.surah, name, n: g.ayah, golchin: true,
      part: k + 1, parts: parts.length, ayat: [{ n: g.ayah, t, fa: g.fa, noMarker: k + 1 < parts.length }], basmala: null, whole: parts.length === 1 }));
  }
  return U;
}
/* a long ayah becomes branches: split at its own pause marks, tiny pieces merged, long pieces halved (~10 words each) */
function branches(t) {
  const words = t.split(' ');
  if (words.length <= 14) return [t];
  const WAQF = /^[\u06D6-\u06DC]$/;
  let segs = [], cur = [];
  for (const w of words) { cur.push(w); if (WAQF.test(w)) { segs.push(cur); cur = []; } }
  if (cur.length) segs.push(cur);
  const len = a => a.filter(w => !WAQF.test(w)).length;
  const merged = [];
  for (const sg of segs) { if (merged.length && (len(sg) < 4 || len(merged[merged.length - 1]) < 4)) merged[merged.length - 1] = merged[merged.length - 1].concat(sg); else merged.push(sg); }
  const out = [];
  for (const sg of merged) {
    const n = Math.ceil(len(sg) / 11);
    if (n <= 1) { out.push(sg); continue; }
    const size = Math.ceil(sg.length / n);
    for (let i = 0; i < sg.length; i += size) out.push(sg.slice(i, i + size));
  }
  return out.map(a => a.join(' '));
}
const UNITS = buildUnits();
const UNIT = Object.fromEntries(UNITS.map(u => [u.id, u]));
const PLANTS = []; { const seen = {}; for (const u of UNITS) { if (!seen[u.plant]) { seen[u.plant] = { key: u.plant, surah: u.surah, name: u.name, units: [] }; PLANTS.push(seen[u.plant]); } seen[u.plant].units.push(u); } }
const PLANT = Object.fromEntries(PLANTS.map(p => [p.key, p]));
const unitWords = u => u.ayat.reduce((a, x) => a + wc(x.t), 0);
const unitLabel = u => u.golchin ? (u.parts > 1 ? `${u.name} · ${T('sow.part', { k: FA(u.part), n: FA(u.parts) })}` : u.name) : T('sow.ayahOf', { name: u.name, n: FA(u.n) });
const audioUrl = (s, a) => `https://everyayah.com/data/Husary_Muallim_128kbps/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
const revFor = (s, a) => REV.filter(r => r.surah === s && r.ayah === a);

/* ============================================================ state (on device only) */
const KEY = PREVIEW ? 'nabat-state-preview' : 'nabat-state-v1';
const fresh = () => ({ v: 2, onboarded: false, obInit: false, perDay: 1, mode: 'gentle', remind: 'fajr', cards: {}, log: [], seen: {}, created: now() });
let S = store.get(KEY, null) || fresh();
S.seen = S.seen || {};
if (S.v !== 2) { S = fresh(); }   // v1 stored multi-ayah units; a fresh start keeps things simple in this prototype
S.perDay = S.perDay || 1; S.mode = S.mode || 'gentle';
const DEEP = () => S.mode === 'deep';
if (PREVIEW && params.has('demo') && !S.demo) S = demoState();
function demoState() {
  const t = now(), d = fresh(); d.onboarded = true; d.obInit = true; d.demo = true;
  for (const u of UNITS.filter(u => u.surah === 1)) d.cards[u.id] = { id: u.id, S: 20, D: 5, last: t - 9 * DAY, planted: t - 40 * DAY, due: F.startOfDay(t) + (u.n > 3 ? 4 * DAY : 0), reps: 4, lapses: 0 };
  for (const u of UNITS.filter(u => u.surah === 114 && u.n <= 2)) d.cards[u.id] = { id: u.id, S: 3, D: 5, last: t - 3 * DAY, planted: t - 6 * DAY, due: F.startOfDay(t), reps: 2, lapses: 0 };
  return d;
}
const save = () => { if (!store.set(KEY, S)) toast(T('toast.saveFailed')); };
const seenOnce = (k, times = 2) => { S.seen[k] = (S.seen[k] || 0) + 1; return S.seen[k] <= times; };
const endOfToday = () => F.startOfDay(now()) + DAY - 1;
const dueUnits = () => UNITS.filter(u => S.cards[u.id] && S.cards[u.id].due <= endOfToday())
  .sort((a, b) => F.currentR(S.cards[a.id], now()) - F.currentR(S.cards[b.id], now()));
const nextUnit = () => {
  if (S.pick && PLANT[S.pick]) { const u = PLANT[S.pick].units.find(x => !S.cards[x.id]); if (u) return u; S.pick = null; }
  return UNITS.find(u => !S.cards[u.id]) || null;
};
const plantedToday = () => S.log.filter(e => e.kind === 'plant' && e.t >= F.startOfDay(now())).length;
/* today = under a minute: water ONE plant (its ≤3 most-forgotten ayat), plant the day's seed(s). Everything else is optional. */
function waterTargets() {
  const due = dueUnits(); const byPlant = {};
  for (const u of due) (byPlant[u.plant] = byPlant[u.plant] || []).push(u);
  return Object.keys(byPlant).map(k => ({ key: k, units: byPlant[k] }))
    .sort((a, b) => F.currentR(S.cards[a.units[0].id], now()) - F.currentR(S.cards[b.units[0].id], now()));
}
function todayPlan() {
  const targets = waterTargets(), nu = nextUnit();
  const seedsLeft = nu ? Math.max(0, S.perDay - plantedToday()) : 0;
  const secs = DEEP() ? targets.reduce((a, t) => a + t.units.length * 12, 0) + seedsLeft * 150
                      : (targets.length ? Math.min(3, targets[0].units.length) * 12 : 0) + seedsLeft * 35;
  return { target: targets[0] || null, moreWater: Math.max(0, targets.length - 1), nu, seedsLeft, secs };
}
function plantInfo(p) {
  const cards = p.units.map(u => S.cards[u.id]).filter(Boolean);
  if (!cards.length) return { started: false, planted: 0, total: p.units.length };
  const stab = cards.reduce((a, c) => a + F.stage(c, now()), 0) / cards.length, prog = cards.length / p.units.length;
  return { started: true, planted: cards.length, total: p.units.length,
           stage: Math.max(1, Math.min(5, Math.round(1 + prog * 2 + (stab - 1) * 0.6))),
           thirsty: cards.some(c => c.due <= endOfToday()), nextDue: Math.min(...cards.map(c => c.due)), complete: cards.length === p.units.length };
}
const daysText = t => { const d = Math.round((F.startOfDay(t) - F.startOfDay(now())) / DAY);
  return d === 0 ? 'امروز' : d === 1 ? 'فردا' : d === -1 ? 'دیروز' : d > 0 ? `${FA(d)} روز دیگر` : `${FA(-d)} روز پیش`; };
/* whole-Quran estimate: 6236 ayat at the chosen seeds per day (review happens alongside, ideally also in salah) */
const quranYears = perDay => Math.max(1, Math.round(6236 / perDay / 365));
const timeText = secs => secs <= 60 ? 'کمتر از یک دقیقه' : `حدود ${FA(Math.round(secs / 60))} دقیقه`;

/* ============================================================ helpers */
let route = 'splash', enter = true;
const W = { queue: [], i: 0, peek: new Set(), revealed: false, drinking: false, anim: null, lastPeek: -1, done: 0, minutes: 0, meaning: false, hint: false };
const SW = { id: null, dstep: 0, trOn: false, ctx: true, practice: 0, round: 0, playing: -1, heard: new Set(), hideTr: false, anim: null, plantedId: null, more: false };
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ࣰۭ-ࣲـ]/g;
const firstLetter = w => { const c = w.replace(MARKS, '')[0] || ''; return c === 'ٱ' ? 'ا' : c; };
const hashed = i => ((i * 2654435761) >>> 0) / 4294967296;
const FRAC = [0.25, 0.5, 0.75, 0.92];
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => { t.classList.add('fadeout'); setTimeout(() => t.remove(), 500); }, 2600);
}
const hijriToday = () => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); } catch (e) { return ''; } };   // Shamsi (Solar Hijri)

function meaningHTML(u, withAbout) {
  const ab = revFor(u.surah, 0);
  const about = withAbout && ab.length ? `<button class="aboutrev press" data-act="rev" data-v="${u.surah}:0" data-role="go">${leaf()} ${esc(T('sow.about', { n: FA(ab.length) }))}</button>` : '';
  const bas = u.basmala ? `<p class="basmala" data-role="quran">${u.basmala}</p>` : '';
  return `<div class="meaning">${about}${bas}${u.ayat.map(a => { const r = revFor(u.surah, a.n);
    return `<div class="mayah"><p class="ar" data-role="quran">${a.t} ${marker(a.n, true, false, 0)}</p>
      <p class="fa" data-role="translation">${a.fa}</p>
      ${r.length ? `<button class="revbtn press" data-act="rev" data-v="${u.surah}:${a.n}" data-role="go">${leaf()} ${esc(T('sow.revCount', { n: FA(r.length) }))}</button>` : ''}</div>`; }).join('')}
    <p class="credit-line">${esc(T('sow.trCredit'))}</p></div>`;
}
function mushafHTML(u, mode, opt) {
  if (mode === 'meaning') return meaningHTML(u, u.ayat[0].n === 1);
  let wi = 0, soakN = 0;
  const body = u.ayat.map((a, ai) => {
    const spans = a.t.split(' ').map(w => {
      const i = wi++; let cls = 'wd', st = '';
      if (mode === 'review') {
        if (!opt.revealed && i > 0 && !opt.peek.has(i)) cls += ' hid';
        else if (opt.peek.has(i) && !opt.revealed) { cls += ' peek'; if (opt.anim === 'peek' && opt.lastPeek === i) cls += ' soak'; }
        if (opt.anim === 'reveal' && i > 0 && !opt.peek.has(i)) { cls += ' soak'; st = `--d:${(soakN++ * 0.06).toFixed(2)}s`; }
      }
      if (mode === 'first') cls += ' hid first';
      if (mode === 'fade') {
        const h = hashed(i + 7), f = FRAC[Math.min(opt.round, 3)], pf = opt.round ? FRAC[Math.min(opt.round - 1, 3)] : 0;
        if (i > 0 && h < f) { cls += ' hid'; if (opt.anim === 'round' && h >= pf) { cls += ' vanish'; st = `--d:${(soakN++ * 0.1).toFixed(2)}s`; } }
      }
      if (mode === 'memory' && i > 0) cls += ' hid';
      if (opt.anim === 'reveal-sow' && i > 0) { cls = 'wd soak'; st = `--d:${(soakN++ * 0.05).toFixed(2)}s`; }
      return `<span class="${cls}" style="${st}" data-w="${i}" data-first="${firstLetter(w)}">${w}</span>`;
    }).join(' ');
    let alive, pop = false, d = 0;
    if (mode === 'review') { alive = opt.revealed; pop = opt.anim === 'reveal'; d = 0.5 + ai * 0.3; }
    else { alive = opt.heard.has(ai) || opt.practice > 0; pop = opt.anim === 'heard' && opt.playing === ai; }
    return `<span class="ay ${opt.playing === ai ? 'cur' : ''}">${spans}${a.noMarker ? '' : ' ' + marker(a.n, alive, pop, d)}</span>`;
  }).join(' ');
  const bas = u.basmala ? `<span class="basmala">${u.basmala}</span>` : '';
  const tr = mode === 'review' && opt.revealed && opt.meaning ? `<div class="tr rise" data-role="translation">${u.ayat.map(a => `<p>${FA(a.n)}. ${a.fa}</p>`).join('')}</div>` : '';
  return `<div class="mushaf wob" data-role="quran">${bas}${body}</div>${tr}`;
}

/* ============================================================ the garden (Today's hero) */
const HILL_Y = f => 62 - 26 * Math.sin(Math.PI * f);            // same curve the hill art is drawn with (viewBox 400x140)
const SLOTS = [0.42, 0.6, 0.26, 0.76, 0.12, 0.88];
const FAR = [0.5, 0.3, 0.7, 0.16, 0.84];             // planting order fans out from the middle of the hill
const TILT = [-2, 2.5, -1.5, 3, -3, 1.5];
const STAGE_SCALE = [0.5, 0.72, 0.84, 0.94, 1.02, 1.1];
function gardenHTML() {
  const Wd = Math.min($app.clientWidth || 380, 440), Hc = 292, Hh = Wd * 140 / 400;
  const groundY = f => Hc - Hh + HILL_Y(f) * Hh / 140;
  let near = 0, far = 0;
  const items = PLANTS.map((p, i) => {
    const isFar = p.key.startsWith('g');
    if (isFar && !plantInfo(p).started) return '';
    const f = isFar ? FAR[far++ % FAR.length] : SLOTS[near++ % SLOTS.length], inf = plantInfo(p);
    const gy = groundY(f) - (isFar ? 92 : 0);
    const scale = (inf.started ? STAGE_SCALE[inf.stage] : 0.42) * (isFar ? 0.56 : 1), w = 74 * scale, h = w * 1.5;
    const top = gy - h * (232 / 300), left = f * Wd - w / 2;
    const cls = `${inf.started ? '' : 'ghost'} ${inf.thirsty ? 'thirsty' : ''} sway ${enter ? 'grow' : ''}`, z = isFar ? 2 : 5;
    return `<button class="gplant" data-act="plant" data-v="${p.key}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${w.toFixed(1)}px;z-index:${z}">
        ${art(`plant-${inf.started ? inf.stage : 0}.svg`, cls, `--gd:${(0.35 + i * 0.2).toFixed(2)}s;--sd:${(-i * 1.3).toFixed(1)}s`)}</button>
      ${inf.started ? `<span class="glabel ${isFar ? 'far' : ''}" data-role="gardenLabel" style="z-index:${z + 1};left:${Math.min(Wd - 36, Math.max(36, f * Wd)).toFixed(1)}px;top:${(gy + 12).toFixed(1)}px;--r:${TILT[i % TILT.length]}deg">${p.name}${inf.thirsty ? `<i class="drop" title="${esc(T('today.thirsty'))}"></i>` : ''}</span>` : ''}`;
  }).join('');
  const hasFar = PLANTS.some(p => p.key.startsWith('g') && plantInfo(p).started);
  // depth: a paper-coloured ground under the near hill hides whatever stands behind it
  const pts = Array.from({ length: 41 }, (_, i) => `${i * 10} ${HILL_Y(i / 40).toFixed(1)}`).join(' L');
  const ground = `<svg class="hillfill" viewBox="0 0 400 140" preserveAspectRatio="none" style="top:${(Hc - Hh).toFixed(1)}px;height:${(Hh + 40).toFixed(1)}px" aria-hidden="true"><path d="M${pts} L400 180 L0 180 Z"/></svg>`;
  return `<div class="garden2" style="height:${Hc + 34}px">${hasFar ? art('hill.svg', 'hill far', `top:${(Hc - Hh - 92).toFixed(1)}px`) : ''}${ground}${art('hill.svg', 'hill near', `top:${(Hc - Hh).toFixed(1)}px`)}${items}</div>`;
}

/* ============================================================ screens */
const SCREENS = {
  splash() {
    const first = !S.onboarded, k = first ? 1 : 0.72;
    const file = artSet()[design.splash] ? design.splash : 'splash.svg';
    const ayah = usesUthmani('deco') ? 'وَلَا حَبَّةٍ فِى ظُلُمَٰتِ ٱلْأَرْضِ' : 'وَلَا حَبَّةٍ فِي ظُلُمَاتِ الْأَرْضِ';
    const words = ayah.split(' ').map((w, i) => `<span class="wind" style="--d:${((2.5 + i * 0.24) * k).toFixed(2)}s">${w}</span>`).join(' ');
    const q = T('splash.qurba').split(' ').map((w, i) => `<span class="wind" style="--d:${((7.1 + i * 0.26) * k).toFixed(2)}s">${esc(w)}</span>`).join(' ');
    return `<div class="splash" data-act="skip">
      <p class="name write" style="--d:${(1.1 * k).toFixed(2)}s" data-role="name">${esc(T('splash.name'))}</p>
      <p class="deco" data-role="deco">${words}</p>
      <p class="ref wind" style="--d:${(3.8 * k).toFixed(2)}s" data-role="ref">${esc(T('splash.ref'))}</p>
      <div class="niyyat"><span class="write" style="--d:${(5.2 * k).toFixed(2)}s" data-role="niyyat">${esc(T('splash.niyyat'))}</span>
        <span class="breath" style="--d:${(6.2 * k).toFixed(2)}s"><i></i><i></i><i></i></span>
        <span class="qurba" data-role="niyyat">${q}</span></div>
      ${art(file, 'splash-art')}</div>`;
  },

  seeds() {
    return obShell(1, `<p class="obtitle" data-role="obTitle">${esc(T('ob.seeds.title'))}</p>
      <div class="optlist">${PLANTS.map(p => { const on = p.units.some(u => S.cards[u.id]); const n = p.units.reduce((a, u) => a + u.ayat.length, 0);
        return `<button class="opt press ${on ? 'on' : ''}" data-act="known" data-v="${p.key}">${art(on ? 'plant-2.svg' : 'plant-0.svg', 'optart')}
          <span class="optbody"><span data-role="obOption">${p.name}</span><span class="muted" data-role="obMeta">${esc(T('ob.seeds.ayat', { n: FA(n) }))}${p.surah === 1 ? ` · ${esc(T('ob.seeds.fatihaNote'))}` : ''}</span></span>
          <span class="check"></span></button>`; }).join('')}</div>`, 'ob:pace', T('ob.continue'));
  },

  pace() {
    return obShell(2, `<p class="obtitle" data-role="obTitle">${esc(T('ob.pace.title'))}</p>
      <div class="optlist">${[1, 2, 3, 5].map(m => `<button class="opt row press ${S.perDay === m ? 'on' : ''}" data-act="pace" data-v="${m}">
          <span data-role="obOption">${esc(T('ob.pace.' + m))}</span><span class="muted" data-role="obMeta">${esc(T('ob.pace.' + m + '.meta'))}</span></button>`).join('')}</div>
      <div class="estimate"><p data-role="estimate">${esc(T('ob.pace.years', { n: FA(quranYears(S.perDay)) }))}</p>
        <p class="muted" data-role="obMeta">${esc(T('ob.pace.caption'))}</p></div>
      <p class="obsub" data-role="obMeta">${esc(T('ob.mode.title'))}</p>
      <div class="optlist tight">${['gentle', 'deep'].map(m => `<button class="opt row press ${S.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}">
          <span data-role="obOption">${esc(T('ob.mode.' + m))}</span><span class="muted" data-role="obMeta">${esc(T('ob.mode.' + m + '.meta'))}</span></button>`).join('')}</div>`, 'ob:remind', T('ob.continue'));
  },

  remind() {
    return obShell(3, `<p class="obtitle" data-role="obTitle">${esc(T('ob.remind.title'))}</p>
      <div class="optlist">${['fajr', 'zuhr', 'night', 'none'].map(k => `<button class="opt row press ${S.remind === k ? 'on' : ''}" data-act="remind" data-v="${k}">
          <span data-role="obOption">${esc(T('ob.remind.' + k))}</span><span class="check"></span></button>`).join('')}</div>
      <p class="muted obnote" data-role="obMeta">${esc(T('ob.remind.note'))}</p>`, 'start', T('ob.start'));
  },

  today() {
    const p = todayPlan(), sd = p.seedsLeft, t = p.target;
    const startDay = F.startOfDay(now());
    const plantedNow = S.log.filter(e => e.kind === 'plant' && e.t >= startDay).map(e => UNIT[e.unit]).filter(Boolean);
    const wateredNow = S.log.some(e => (e.kind === 'review' || e.kind === 'salah') && e.t >= startDay);
    const daysWith = new Set(S.log.map(e => F.startOfDay(e.t))).size;
    let main;
    if (t || sd) {
      const tName = t ? PLANT[t.key].name : '';
      const title = t ? T('today.cta.start') : T('today.cta.sow');
      const sub = t && sd ? T('today.cta.sub.both', { plant: tName, time: timeText(p.secs) })
                : t ? T('today.cta.sub.water', { plant: tName, time: timeText(p.secs) })
                : T('today.cta.sub.sow', { label: unitLabel(p.nu), time: timeText(p.secs) });
      main = `<button class="cta2 wob press" data-act="${t ? 'day' : 'sow'}">${art(t ? 'water.svg' : 'seed.svg', 'ctaicon')}
          <span class="ctat"><span data-role="cta">${esc(title)}</span><span class="ctasub" data-role="todaySub">${esc(sub)}</span></span><span class="ctago">${arrow('go')}</span></button>`;
    } else {
      const last = plantedNow[plantedNow.length - 1];
      const title = last ? T('today.done.title') : wateredNow ? T('today.done.titleWater') : p.nu ? T('today.done.titleRest') : T('today.status.allDone');
      const meta = T('today.done.days', { n: FA(Math.max(1, daysWith)) });
      main = `<div class="donecard wob rise">${art(last ? 'stage-1.svg' : 'plant-3.svg', 'doneart sway')}
          <div class="donetext"><span data-role="cta">${esc(title)}</span>
            ${last ? `<span class="ctasub" data-role="todaySub">${esc(unitLabel(last))}</span>` : ''}
            <span class="ctasub muted" data-role="todaySub">${esc(meta)}</span></div></div>
        <div class="duo rise" style="--d:.25s">
          ${p.nu ? `<button class="pill wob press" data-act="more" data-role="btn">${art('seed.svg', 'pillicon')}${esc(T('today.done.more'))}</button>` : ''}
          </div>
        ${last ? `<button class="textbtn quietlink" data-act="todaymeaning" data-v="${last.plant}" data-role="go">${leaf()} ${esc(T('today.done.meaning'))}</button>` : ''}`;
    }
    return `
      <div class="topbar"><span class="muted" data-role="hifzMeta">${hijriToday()}</span>
        <button class="muted" data-act="go:settings" data-role="hifzMeta">${esc(T('today.settings'))}</button></div>
      ${gardenHTML()}
      <div class="todaymain">${main}</div>
      <div class="foot foot-ayah"><p class="quote" data-role="quote" data-uthmani="أَأَنتُمْ تَزْرَعُونَهُۥٓ أَمْ نَحْنُ ٱلزَّٰرِعُونَ" data-simple="أَأَنْتُمْ تَزْرَعُونَهُ أَمْ نَحْنُ الزَّارِعُونَ"></p>
        <p class="ref" data-role="ref">${esc(T('today.ayah.ref'))}</p></div>`;
  },

  water() {
    const item = W.queue[W.i], p = PLANT[item.key], inf = plantInfo(p);
    const u = { surah: p.surah, name: p.name, ayat: item.units.map(x => x.ayat[0]), basmala: item.units[0].n === 1 ? p.units[0].basmala : null };
    const sug = W.peek.size > 2 ? 1 : W.peek.size ? 2 : 3;
    const cls = W.drinking ? 'standup' : (inf.thirsty && !W.revealed ? 'thirsty' : '');
    const last = Math.max(...item.units.map(x => S.cards[x.id].last));
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">${arrow('back')}${esc(T('water.back'))}</button>
        ${W.queue.length > 1 ? `<span class="muted" data-role="hifzMeta">${esc(T('water.progress', { i: FA(W.i + 1), n: FA(W.queue.length) }))}</span>` : ''}</div>
      <div class="hhead"><div class="art" style="width:54px;flex:none">${art(`plant-${inf.stage || 1}.svg`, `sway ${cls}`)}
          ${W.drinking ? '<div class="drops"><i style="left:30%"></i><i style="left:52%;animation-delay:.25s"></i><i style="left:42%;animation-delay:.5s"></i></div>' : ''}</div>
        <div><p class="tt" data-role="hifzTitle">${p.name}</p><p class="muted" data-role="hifzMeta">${daysText(last)}</p></div></div>
      ${W.hint ? `<p class="hint" data-role="hint">${esc(W.revealed ? T('water.hintGrade') : T('water.hint'))}</p>` : ''}
      ${mushafHTML(u, 'review', W)}
      ${W.revealed ? `<button class="textbtn" data-act="wmeaning" data-role="go">${esc(W.meaning ? T('water.hideMeaning') : T('water.meaning'))}</button>` : ''}
      ${W.revealed ? `<div class="grades ${W.anim === 'reveal' ? 'rise' : ''}" style="--d:1.1s">${[1, 2, 3, 4].map(g => `<button class="wob press ${g === sug ? 'sug' : ''}" data-act="grade" data-v="${g}" data-role="grade">${esc(T('water.g' + g))}</button>`).join('')}</div>`
                   : `<div class="actions"><button class="pill main wob press" data-act="reveal" data-role="btn">${esc(T('water.reveal'))}</button></div>`}
      <p class="foot" data-role="foot">${W.drinking ? esc(T('water.drank')) : W.peek.size ? esc(T('water.peeked', { n: FA(W.peek.size) })) : '&nbsp;'}</p>`;
  },

  watered() {
    return `<div class="center">${art('plant-5.svg', 'grow sway')}
      <p class="rise" style="--d:1.6s" data-role="doneTitle">${esc(T('watered.title'))}</p>
      <p class="muted rise" style="--d:1.9s" data-role="hifzMeta">${esc(T('watered.meta', { n: FA(W.done), m: FA(1) }))}</p>
      <p class="quote rise" style="--d:2.4s" data-role="quote" data-uthmani="تُؤْتِىٓ أُكُلَهَا كُلَّ حِينٍۭ بِإِذْنِ رَبِّهَا" data-simple="تُؤْتِي أُكُلَهَا كُلَّ حِينٍ بِإِذْنِ رَبِّهَا"></p>
      <p class="ref rise" style="--d:2.6s" data-role="ref">${esc(T('watered.ref'))}</p>
      <div class="actions rise" style="--d:3s"><button class="pill wob press" data-act="go:today" data-role="btn">${esc(T('watered.back'))}</button>
        ${todayPlan().seedsLeft ? `<button class="pill green wob press" data-act="sow" data-role="btn">${esc(T('watered.sow'))}</button>` : ''}</div></div>`;
  },

  sow() {
    const u = UNIT[SW.id], a = u.ayat[0], r = revFor(u.surah, u.n), about = u.n === 1 ? revFor(u.surah, 0) : [];
    const sib = PLANT[u.plant].units, idx = sib.indexOf(u);
    const prevU = u.golchin ? sib[idx - 1] : UNIT[`${u.surah}:${u.n - 1}`], nextU = u.golchin ? sib[idx + 1] : UNIT[`${u.surah}:${u.n + 1}`];
    const deep = DEEP(), ds = SW.dstep;
    if (deep) { SW.practice = [0, 0, 0, 1, 2, 3][ds]; }
    const hideTr = deep ? (ds > 0 && !SW.trOn) : SW.hideTr;
    const mode = ['full', 'first', 'fade', 'memory'][SW.practice];
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">${arrow('back')}${esc(T('sow.back'))}</button>
        ${deep ? `<span class="stepdots">${[0, 1, 2, 3, 4, 5].map(i => `<button class="${i === ds ? 'on' : i < ds ? 'done' : ''}" data-act="dstep" data-v="${i}" aria-label="${esc(T('deep.step' + i))}"></button>`).join('')}</span>`
               : `<span class="muted" data-role="hifzMeta">${esc(T('sow.title'))}</span>`}
        <button class="opts muted" data-act="sowopts" data-role="hifzMeta">${esc(T('sow.options'))}</button></div>
      ${deep ? `<p class="hint ${SW.anim === 'step' ? 'rise' : ''}" data-role="hint" style="text-align:center">${esc(T('deep.step' + ds))} · ${esc(T('deep.hint' + ds))}</p>` : ''}
      <div class="seedcard">
        <p class="muted" data-role="hifzMeta">${esc(u.name)}${u.golchin ? '' : ' · ' + esc(T('rev.ayah', { n: FA(u.n) }))}</p>
        ${u.parts > 1 ? `<div class="leaves" aria-label="${esc(T('sow.part', { k: FA(u.part), n: FA(u.parts) }))}">${sib.map((x, j) => `<i class="${S.cards[x.id] ? 'on' : j === idx ? 'now' : ''}"></i>`).join('')}</div>` : ''}
        ${SW.ctx && prevU ? `<p class="ctxayah rise" data-role="quran">${prevU.ayat[0].t}${prevU.ayat[0].noMarker ? '' : ' ' + marker(prevU.n, true, false, 0)}</p>` : ''}
        ${u.basmala ? `<p class="basmala" data-role="quran">${u.basmala}</p>` : ''}
        ${mode === 'full' ? `<p class="seedayah" data-role="quran">${a.t}${a.noMarker ? '' : ' ' + marker(u.n, SW.heard.has(0), SW.anim === 'heard', 0)}</p>`
                          : mushafHTML({ ...u, basmala: null }, mode, SW).replace('class="mushaf wob"', 'class="mushaf seedmushaf"')}
        ${hideTr ? '' : u.golchin && a.fa.length > 140
          ? `<p class="seedfa rise ${SW.faOpen ? '' : 'clamp'}" data-act="faopen" data-role="translation">${a.fa}</p>${SW.faOpen ? '' : `<button class="textbtn muted" data-act="faopen" data-role="go">${esc(T('sow.more'))}</button>`}`
          : `<p class="seedfa rise" data-role="translation">${a.fa}</p>`}
        ${SW.ctx && nextU ? `<p class="ctxayah rise" data-role="quran">${nextU.ayat[0].t}${nextU.ayat[0].noMarker ? '' : ' ' + marker(nextU.n, !!S.cards[nextU.id], false, 0)}</p>` : ''}
        ${about.length || r.length ? `<div class="chips-row">
          ${r.length ? `<button class="revchip press" data-act="rev" data-v="${u.surah}:${u.n}" data-role="go">${leaf()} ${esc(T('sow.revCount', { n: FA(r.length) }))}</button>` : ''}
          ${about.length ? `<button class="revchip press" data-act="rev" data-v="${u.surah}:0" data-role="go">${leaf()} ${esc(T('sow.about', { n: FA(about.length) }))}</button>` : ''}</div>` : ''}
        ${!deep || ds === 1 || ds === 2 ? `<button class="pill wob press listen" data-act="play" data-role="btn">${esc(SW.playing >= 0 ? T('sow.stop') : T('sow.listen'))}</button>` : ''}
        ${!deep && SW.practice ? `<div class="practice rise">${[1, 2, 3].map(k => `<button class="chip press ${SW.practice === k ? 'on' : ''}" data-act="practice" data-v="${k}" data-role="stepChip">${esc(T('sow.p' + k))}</button>`).join('')}
            ${SW.practice === 2 ? `<button class="textbtn" data-act="round" data-role="go">${esc(T('sow.round'))}</button>` : ''}</div>` : ''}
        ${deep && ds === 4 ? `<button class="textbtn" data-act="round" data-role="go">${esc(T('sow.round'))}</button>` : ''}
        ${!deep && SW.practice ? `<button class="textbtn muted" data-act="practice" data-v="0" data-role="go">${esc(T('sow.practiceOff'))}</button>` : ''}
      </div>
      <div class="obfoot">${deep && ds < 5
        ? `<div class="deepnav">${ds ? `<button class="textbtn" data-act="dstep" data-v="${ds - 1}" data-role="go">${esc(T('deep.prev'))}</button>` : '<span></span>'}
            <button class="cta wob press" data-act="dstep" data-v="${ds + 1}" data-role="cta">${esc(ds === 0 ? T('deep.understood') : T('deep.next'))}</button></div>`
        : `<button class="cta wob press" data-act="plant-it" data-role="cta">${esc(T('sow.plant'))}</button>`}</div>`;
  },

  planted() {
    const u = UNIT[SW.plantedId], more = todayPlan().nu;
    if (u.golchin && u.parts > 1 && u.part === u.parts) {
      const full = (Q.golchin || []).find(g => 'g' + g.id === u.plant);
      return `<div class="center" data-act="go:today">
        <div class="plantmoment">${art('stage-0.svg', 'soilin')}${art('stage-3.svg', 'grow sway', '--gd:.55s')}</div>
        <p class="rise" style="--d:2.3s" data-role="doneTitle">${esc(T('planted.whole'))}</p>
        <p class="quote rise" style="--d:2.8s;line-height:2.3" data-role="quran">${full ? full.t : ''}</p>
        <p class="foot rise" style="--d:3.4s;padding:6px 0 0" data-role="foot">${esc(T('planted.wholeFoot', { n: FA(u.parts) }))}</p>
        <div class="actions rise" style="--d:3.8s"><button class="pill wob press" data-act="go:today" data-role="btn">${esc(T('planted.back'))}</button></div></div>`;
    }
    return `<div class="center" data-act="go:today">
      <div class="plantmoment">${art('stage-0.svg', 'soilin')}${art('stage-1.svg', 'grow sway', '--gd:.55s')}</div>
      <p class="rise" style="--d:2.2s" data-role="doneTitle">${esc(T('planted.title'))}</p>
      <p class="muted rise" style="--d:2.4s" data-role="hifzMeta">${esc(T('planted.meta', { name: unitLabel(u) }))}</p>
      <p class="foot rise" style="--d:2.8s;padding:6px 0 0" data-role="foot">${esc(T('planted.foot'))}</p>
      <div class="actions rise" style="--d:3.2s"><button class="pill wob press" data-act="go:today" data-role="btn">${esc(T('planted.back'))}</button>
        ${more ? `<button class="textbtn" data-act="more" data-role="go">${esc(T('planted.more'))}</button>` : ''}</div></div>`;
  },

  settings() {
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">${arrow('back')}${esc(T('water.back'))}</button></div>
      <div class="today"><p data-role="todayTitle">${esc(T('set.title'))}</p></div>
      <div class="section"><h3 data-role="cta">${esc(T('set.pace'))}</h3>
        <div class="optlist tight">${[1, 2, 3, 5].map(m => `<button class="opt row press ${S.perDay === m ? 'on' : ''}" data-act="pace" data-v="${m}">
          <span data-role="obOption">${esc(T('ob.pace.' + m))}</span><span class="muted" data-role="obMeta">${esc(T('ob.pace.' + m + '.meta'))}</span></button>`).join('')}</div>
        <p class="hint" style="padding:10px 0 0" data-role="hint">${esc(T('ob.pace.years', { n: FA(quranYears(S.perDay)) }))}</p></div>
      <div class="section"><h3 data-role="cta">${esc(T('set.mode'))}</h3>
        <div class="optlist tight">${['gentle', 'deep'].map(m => `<button class="opt row press ${S.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}"><span data-role="obOption">${esc(T('ob.mode.' + m))}</span><span class="muted" data-role="obMeta">${esc(T('ob.mode.' + m + '.meta'))}</span></button>`).join('')}</div></div>
      <div class="section"><h3 data-role="cta">${esc(T('set.remind'))}</h3>
        <div class="optlist tight">${['fajr', 'zuhr', 'night', 'none'].map(k => `<button class="opt row press ${S.remind === k ? 'on' : ''}" data-act="remind" data-v="${k}"><span data-role="obOption">${esc(T('ob.remind.' + k))}</span><span class="check"></span></button>`).join('')}</div></div>
      <div class="section"><h3 data-role="cta">${esc(T('set.backup'))}</h3><p class="muted" data-role="hint">${esc(T('set.backupNote'))}</p>
        <div class="actions" style="justify-content:flex-start;padding:10px 0 0"><button class="pill wob press" data-act="export" data-role="btn">${esc(T('set.export'))}</button>
        <label class="pill wob press" data-role="btn">${esc(T('set.import'))}<input type="file" accept="application/json" id="importFile" hidden></label>
        <button class="pill wob press" data-act="reset" data-role="btn" style="border-color:var(--ink2);color:var(--ink2)">${esc(T('set.reset'))}</button></div></div>
      <p class="fine">${esc(T('set.credits'))} · <a href="panel/">پنل طراحی</a><br>${esc(T('set.privacy'))}</p>`;
  }
};
function obShell(step, inner, nextAct, nextLabel) {
  const back = step > 1 ? `<button class="obback" data-act="ob:${['', 'seeds', 'pace'][step - 1]}" aria-label="${esc(T('ob.back'))}">${arrow('back')}</button>` : '<span class="obback"></span>';
  return `<div class="ob"><div class="obbar">${back}<div class="track"><i style="width:${(step / 3 * 100).toFixed(0)}%"></i></div></div>
    <div class="obbody">${inner}</div>
    <div class="obfoot"><button class="cta wob press" data-act="${nextAct}" data-role="cta">${esc(nextLabel)}</button></div></div>`;
}

function render() {
  stopAudioIfLeaving();
  const banner = previewing && route !== 'splash' ? `<div class="banner">${esc(T('preview.banner'))}<button data-act="clear-preview">${esc(T('preview.clear'))}</button></div>` : '';
  $app.innerHTML = banner + SCREENS[route]();
  $app.classList.toggle('enter', enter && !['splash', 'watered', 'planted'].includes(route));
  if (enter) [...$app.children].forEach((c, i) => c.style.setProperty('--i', i));
  applyFonts();
  enter = false; W.anim = null; SW.anim = null;
  if (route === 'settings') { const f = document.getElementById('importFile'); if (f) f.onchange = importBackup; }
  try { window.parent !== window && window.parent.postMessage({ nabat: 'route', route }, location.origin); } catch (e) {}
}
function go(r) {
  closeSheet(true);
  if (r === 'water') {
    const targets = waterTargets(), t = targets[0];
    if (!t) r = 'today';
    else { const pick = t.units.slice().sort((a, b) => F.currentR(S.cards[a.id], now()) - F.currentR(S.cards[b.id], now())).slice(0, 3).sort((a, b) => a.n - b.n);
      W.queue = DEEP() ? targets.map(x => ({ key: x.key, units: x.units.slice().sort((a, b) => a.n - b.n) })) : [{ key: t.key, units: pick }]; W.i = 0; W.peek = new Set(); W.revealed = false; W.meaning = false; W.drinking = false; W.done = 0; W.hint = seenOnce('waterHint'); save(); }
  }
  if (r === 'sow') { const u = nextUnit(); if (!u) { toast(T('toast.allPlanted')); return; }
    if (SW.id !== u.id) { SW.id = u.id; SW.faOpen = false; SW.dstep = 0; SW.trOn = false; SW.practice = 0; SW.round = 0; SW.heard = new Set(); SW.hideTr = false; } SW.playing = -1; }
  if (['seeds', 'pace', 'remind'].includes(r) && !S.obInit) { const fat = PLANT['1']; if (fat) for (const u of fat.units) S.cards[u.id] = knownCard(u.id); S.obInit = true; save(); }
  route = r; enter = true; window.scrollTo(0, 0); render();
}
const knownCard = id => ({ id, S: 4, D: 5, last: now(), planted: now(), due: F.startOfDay(now()) + DAY, reps: 1, lapses: 0, known: true });

/* ============================================================ sheets: a plant, meaning, narrations */
let sheet = null;
function openSheet(html, onClick) {
  closeSheet(true);
  sheet = document.createElement('div'); sheet.className = 'sheetwrap';
  sheet.innerHTML = `<div class="backdrop" data-close></div><section class="sheet" role="dialog"><div class="grab"></div><div class="sheetbody">${html}</div></section>`;
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) return closeSheet(); onClick && onClick(e); });
  applyFonts(sheet); document.body.appendChild(sheet); document.body.style.overflow = 'hidden';
}
function closeSheet(instant) {
  if (!sheet) return; const el = sheet; sheet = null; document.body.style.overflow = '';
  if (instant) return el.remove();
  el.classList.add('closing'); setTimeout(() => el.remove(), 350);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
function openSowOptions() {
  const deep = DEEP();
  const meaningOn = deep ? SW.trOn || SW.dstep === 0 : !SW.hideTr;
  const row = (act, label, on) => `<button class="opt row press ${on ? 'on' : ''}" data-o="${act}"><span data-role="obOption">${esc(label)}</span>${on === null ? '' : '<span class="check"></span>'}</button>`;
  openSheet(`<p class="sref" data-role="hifzTitle">${esc(T('sow.options'))}</p>
    <div class="optlist tight" style="margin-top:12px">
      ${row('meaning', T('opt.meaning'), meaningOn)}
      ${row('context', T('opt.context'), SW.ctx)}
      ${deep ? '' : row('practice', T('opt.practice'), SW.practice > 0)}
      ${row('pick', T('opt.pick'), null)}</div>`, e => {
      const b = e.target.closest('[data-o]'); if (!b) return;
      const o = b.dataset.o;
      if (o === 'pick') return openPicker();
      if (o === 'meaning') { if (deep && SW.dstep > 0) SW.trOn = !SW.trOn; else SW.hideTr = !SW.hideTr; }
      if (o === 'context') SW.ctx = !SW.ctx;
      if (o === 'practice') { SW.practice = SW.practice ? 0 : 1; SW.anim = 'step'; }
      closeSheet(); render();
    });
}
function openPicker() {
  const row = p => { const next = p.units.find(x => !S.cards[x.id]); const done = !next;
    const parts = p.units.length > 1 && p.key.startsWith('g') ? ' · ' + T('pick.parts', { n: FA(p.units.length) }) : '';
    return `<button class="opt row press ${S.pick === p.key ? 'on' : ''}" ${done ? 'disabled style="opacity:.45"' : `data-pick="${p.key}"`}>
      <span data-role="obOption">${p.name}</span><span class="muted" data-role="obMeta">${done ? esc(T('pick.done')) : esc(unitLabel(next).replace(p.name, '').replace(/^ · /, '')) + esc(parts)}</span></button>`; };
  const sur = PLANTS.filter(p => !p.key.startsWith('g')), gol = PLANTS.filter(p => p.key.startsWith('g'));
  openSheet(`<p class="sref" data-role="hifzTitle">${esc(T('pick.title'))}</p>
    <p class="obsub" data-role="obMeta">${esc(T('pick.surahs'))}</p><div class="optlist tight">${sur.map(row).join('')}</div>
    ${gol.length ? `<p class="obsub" data-role="obMeta">${esc(T('pick.golchin'))}</p><div class="optlist tight">${gol.map(row).join('')}</div>` : ''}`, e => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      S.pick = b.dataset.pick; save(); closeSheet(); SW.id = null; go('sow');
    });
}
function openPlant(key) {
  const p = PLANT[key], inf = plantInfo(p);
  const state = !inf.started ? T('plant.notYet') : inf.sowing ? T('plant.sowing') : inf.thirsty ? T('plant.thirsty') : T('plant.next', { when: daysText(inf.nextDue) });
  openSheet(`<div class="psheet">${art(`plant-${inf.started ? inf.stage : 0}.svg`, `sway ${inf.started ? '' : 'ghost'}`)}
      <p data-role="hifzTitle">${p.name}</p>
      <p class="muted" data-role="hifzMeta">${inf.started ? esc(T('stage.' + inf.stage)) + ' · ' : ''}${esc(state)}</p>
      <div class="actions">${inf.started && inf.stage > 0 ? `<button class="pill main wob press" data-a="salah" data-role="btn">${esc(T('plant.salah'))}</button>` : ''}
        <button class="pill wob press" data-a="meaning" data-role="btn">${esc(T('plant.meaning'))}</button></div>
      <button class="textbtn" data-close data-role="go">${esc(T('plant.close'))}</button></div>`, e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'salah') {
      for (const u of p.units) if (S.cards[u.id] && S.cards[u.id].S) { S.cards[u.id] = F.review(S.cards[u.id], 3, now()); logEvent('salah', u.id, 3); }
      save(); buzz(10); closeSheet(); toast(T('plant.salahDone')); render();
    }
    if (a.dataset.a === 'meaning') openMeaning(p);
  });
}
function openMeaning(p) {
  const whole = { surah: p.surah, ayat: p.units.flatMap(u => u.ayat), basmala: p.units[0].basmala };
  openSheet(`<p class="sref" data-role="hifzTitle">${p.name}</p>${meaningHTML(whole, true)}`, e => {
    const r = e.target.closest('[data-act=rev]'); if (r) { const [s, a] = r.dataset.v.split(':').map(Number); openRev(s, a); }
  });
}
function openRev(s, a) {
  const list = revFor(s, a); if (!list.length) return;
  let i = 0;
  const html = () => { const r = list[i]; const surah = Q.surahs[s] ? faName(Q.surahs[s].name) : '';
    return `<p class="sref" data-role="hifzMeta">${leaf()} ${surah} · ${esc(a ? T('rev.ayah', { n: FA(a) }) : T('rev.surah'))}</p>
      <div class="dialog rise">${r.turns.map(t => `<div class="turn ${t.k}">${t.who ? `<span class="who" data-role="hifzMeta">${esc(t.who)}</span>` : ''}<p data-role="translation">${esc(t.t)}</p></div>`).join('')}
        ${r.note ? `<p class="rnote" data-role="hint">${esc(r.note)}</p>` : ''}</div>
      <p class="rsrc" data-role="ref">${r.src ? esc(r.src) + ' · ' : ''}${esc(T('rev.book', { n: FA(r.p) }))}</p>
      <div class="sheetnav">${list.length > 1 ? `<span class="stepdots">${list.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-j="${j}"></button>`).join('')}</span>` : '<span></span>'}
        <button class="pill wob press" data-close data-role="btn">${esc(T('rev.close'))}</button></div>`; };
  openSheet(html(), e => { const d = e.target.closest('[data-j]'); if (d) { i = +d.dataset.j; sheet.querySelector('.sheetbody').innerHTML = html(); applyFonts(sheet); } });
}

/* ============================================================ audio (reciter, ayah by ayah) */
const audio = new Audio(); audio.preload = 'auto';
let audioRoute = null;
function stopAudio() { audio.pause(); audio.onended = null; SW.playing = -1; }
function stopAudioIfLeaving() { if (audioRoute && route !== audioRoute) { stopAudio(); audioRoute = null; } }
function playFrom(ai) {
  const u = UNIT[SW.id];
  if (!u || ai >= 1) { SW.playing = -1; render(); return; }
  SW.playing = 0; SW.heard.add(0); SW.anim = 'heard'; audioRoute = 'sow'; render();
  audio.src = audioUrl(u.surah, u.n);
  audio.onended = () => { SW.playing = -1; render(); };
  audio.onerror = () => { SW.playing = -1; render(); toast(T('sow.noAudio')); };
  audio.play().catch(() => { SW.playing = -1; render(); });
}

/* ============================================================ actions */
function logEvent(kind, unit, g) { S.log.push({ t: now(), kind, unit, g }); if (S.log.length > 4000) S.log = S.log.slice(-4000); }
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'nabat', ...S }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `nabat-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t);
    if (d.app !== 'nabat' || d.v !== 1 || typeof d.cards !== 'object') throw new Error('bad');
    if (!confirm(T('set.importConfirm'))) return;
    delete d.app; S = { ...fresh(), ...d }; save(); toast(T('set.imported')); go('today');
  }).catch(() => toast(T('set.badFile')));
}

$app.addEventListener('click', e => {
  const w = e.target.closest('.wd.hid');
  if (w && route === 'water' && !W.revealed && !W.drinking) { W.peek.add(+w.dataset.w); W.lastPeek = +w.dataset.w; W.anim = 'peek'; render(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, v = a.dataset.v;
  if (act.startsWith('go:')) return go(act.slice(3));
  if (act.startsWith('ob:')) return go(act.slice(3));
  switch (act) {
    case 'skip': return proceedFromSplash();
    case 'known': {
      const p = PLANT[v]; const has = p.units.some(u => S.cards[u.id]);
      for (const u of p.units) { if (has) delete S.cards[u.id]; else S.cards[u.id] = knownCard(u.id); }
      buzz(6); save(); return render();
    }
    case 'pace': S.perDay = +v; buzz(6); save(); return render();
    case 'remind': S.remind = v; buzz(6); save(); return render();
    case 'start': S.onboarded = true; save(); return go('today');
    case 'water': return go('water');
    case 'day': W.chain = true; return go('water');
    case 'more': return go('sow');
    case 'pick': return openPicker();
    case 'sowopts': return openSowOptions();
    case 'todaymeaning': return openMeaning(PLANT[v]);
    case 'sow': return go('sow');
    case 'plant': return openPlant(v);
    case 'reveal': W.revealed = true; W.anim = 'reveal'; return render();
    case 'wmeaning': W.meaning = !W.meaning; return render();
    case 'rev': { const [sv, av] = v.split(':').map(Number); return openRev(sv, av); }
    case 'grade': {
      if (W.drinking) return;
      const item = W.queue[W.i];
      for (const u of item.units) { S.cards[u.id] = F.review(S.cards[u.id], +v, now()); logEvent('review', u.id, +v); }
      W.done++; save(); buzz(12); W.drinking = true; render();
      setTimeout(() => { W.drinking = false;
        if (W.i + 1 < W.queue.length) { W.i++; W.peek = new Set(); W.revealed = false; W.meaning = false; enter = true; return render(); }
        if (W.chain && todayPlan().seedsLeft) { W.chain = false; toast(T('water.toSeed')); return go('sow'); }   // the day flows on: water → seed
        W.chain = false; route = 'watered'; enter = true; render(); }, 1500);
      return;
    }
    case 'practice': SW.practice = +v; SW.round = 0; SW.anim = 'step'; return render();
    case 'round': SW.round++; SW.anim = 'round'; return render();
    case 'tr': if (DEEP() && SW.dstep > 0) SW.trOn = !SW.trOn; else SW.hideTr = !SW.hideTr; return render();
    case 'ctx': SW.ctx = !SW.ctx; return render();
    case 'faopen': SW.faOpen = !SW.faOpen; return render();
    case 'dstep': stopAudio(); SW.dstep = Math.max(0, Math.min(5, +v)); SW.round = 0; SW.trOn = false; SW.anim = 'step'; return render();
    case 'mode': S.mode = v; buzz(6); save(); return render();
    case 'play': if (SW.playing >= 0) { stopAudio(); return render(); } return playFrom(0);
    case 'plant-it': { stopAudio(); const u = UNIT[SW.id]; S.cards[u.id] = F.plant(u.id, now()); logEvent('plant', u.id); SW.plantedId = u.id; SW.id = null;
      save(); buzz(14); route = 'planted'; enter = true; render(); clearTimeout(plantTimer); plantTimer = setTimeout(() => { if (route === 'planted') go('today'); }, 6500); return; }
    case 'export': return exportBackup();
    case 'reset': if (confirm(T('set.resetConfirm'))) { S = fresh(); save(); route = 'splash'; enter = true; render(); startSplashTimer(); } return;
    case 'clear-preview': store.del('nabat-design-v1'); location.reload(); return;
  }
});

let splashTimer = null, plantTimer = null;
function startSplashTimer() { clearTimeout(splashTimer); splashTimer = setTimeout(proceedFromSplash, S.onboarded ? 7600 : 10200); }
function proceedFromSplash() { if (route !== 'splash') return; clearTimeout(splashTimer); go(S.onboarded ? 'today' : 'seeds'); }

/* ============================================================ boot */
const turb = document.getElementById('turb'); let seed = 1;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
setInterval(() => { if (!reduce && design.boil !== false && design.art === 'a1' && turb) { seed = seed % 3 + 1; turb.setAttribute('seed', seed); } }, 200);
if (!PREVIEW) window.addEventListener('storage', e => { if (e.key === 'nabat-design-v1') location.reload(); });
let rz = null; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (route === 'today') render(); }, 200); });

loadDesign().then(() => {
  const start = params.get('screen');
  if (start && SCREENS[start] && start !== 'splash') { if (!S.onboarded && !['seeds', 'pace', 'remind'].includes(start)) { S.onboarded = true; } go(start); }
  else { render(); startSplashTimer(); }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !PREVIEW) navigator.serviceWorker.register('sw.js').catch(() => {});
});
})();
