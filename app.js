/* Nabat — a gentle, self-paced Quran memorization app (web prototype of the real product).
   No server: everything lives on the device (localStorage). Design (fonts, art set, splash) comes from
   design.json, and the design panel (/panel/) can override it live on the same browser. */
(() => {
'use strict';
const Q = window.NABAT_QURAN, F = window.NabatFSRS, ART = window.NABAT_ART || {}, REV = window.NABAT_REVAYAT || [];
const $app = document.getElementById('app');
const FA = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const faName = s => s.replace(/ك/g, 'ک').replace(/ي/g, 'ی');
const now = () => Date.now();
const DAY = F.DAY;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ============================================================ design */
const DEFAULT_FONTS = {
  name:{font:'Haiku Davan',weight:700,size:58}, deco:{font:'Hafez',weight:400,size:26}, ref:{font:'Bonyade Koodak',weight:400,size:12},
  todayTitle:{font:'Shoor',weight:700,size:26}, todaySub:{font:'Bonyade Koodak',weight:400,size:14},
  cardTitle:{font:'Shoor',weight:700,size:19}, cardSub:{font:'Bonyade Koodak',weight:400,size:13}, go:{font:'Bonyade Koodak',weight:400,size:13},
  quote:{font:'Hafez',weight:400,size:22}, foot:{font:'Dana',weight:400,size:14}, hifzTitle:{font:'Hafez',weight:400,size:26},
  hifzMeta:{font:'Bonyade Koodak',weight:400,size:13}, hint:{font:'Bonyade Koodak',weight:400,size:14},
  quran:{font:'Amiri Quran',weight:400,size:30}, stepChip:{font:'Bonyade Koodak',weight:400,size:12},
  btn:{font:'Bonyade Koodak',weight:400,size:15}, grade:{font:'Dana',weight:500,size:14},
  translation:{font:'Dana',weight:300,size:14}, doneTitle:{font:'Shoor',weight:700,size:28}
};
let design = { art: 'a2', splash: 'splash.svg', boil: true, fonts: DEFAULT_FONTS };
let previewing = false;
const mergeDesign = (base, over) => ({ ...base, ...over, fonts: { ...base.fonts, ...(over && over.fonts || {}) } });
async function loadDesign() {
  try { const r = await fetch('design.json', { cache: 'no-cache' }); if (r.ok) design = mergeDesign(design, await r.json()); } catch (e) {}
  const local = store.get('nabat-design-v1', null);
  if (local) { design = mergeDesign(design, local); previewing = true; }
  if (!ART[design.art]) design.art = 'a2';
  document.body.classList.toggle('noboil', design.boil === false);
}
function applyFonts(root = $app) {
  root.querySelectorAll('[data-role]').forEach(el => {
    const c = design.fonts[el.dataset.role]; if (!c) return;
    const fam = el.dataset.role === 'quran' ? 'Amiri Quran' : c.font;           // Quran text: Uthmani Quran font only
    el.style.fontFamily = `'${fam}', 'Bonyade Koodak', Dana, sans-serif`;
    el.style.fontWeight = c.weight; el.style.fontSize = c.size + 'px';
    if (el.dataset.uthmani) el.textContent = fam === 'Amiri Quran' ? el.dataset.uthmani : el.dataset.simple;
  });
}
const artSet = () => ART[design.art] || ART.a2 || {};
function art(file, cls = '', style = '') {
  const svg = artSet()[file] || (ART.a2 || {})[file] || '';
  return `<div class="art ${cls} ${design.art === 'a1' ? 'filterboil' : ''}" style="${style}">${svg}</div>`;
}
function marker(n, alive, pop, d) {
  return `<span class="mk ${alive ? 'alive' : ''} ${pop ? 'pop' : ''} ${design.art === 'a1' ? 'filterboil' : ''}" style="--d:${d}s">${artSet()['marker.svg'] || ''}<span class="n">${FA(n)}</span></span>`;
}

/* ============================================================ content → units → plants */
const wc = t => t.split(' ').length;
const range = (a, b) => { const r = []; for (let i = a; a > b ? i >= b : i <= b; a > b ? i-- : i++) r.push(i); return r; };
function buildUnits() {
  const U = [];
  const chunk = ay => {
    const total = ay.reduce((a, x) => a + wc(x.t), 0);
    if (total <= 45) return [[0, ay.length - 1]];
    const g = []; let start = 0, w = 0;
    ay.forEach((x, i) => { const n = wc(x.t); if (w > 0 && w + n > 30) { g.push([start, i - 1]); start = i; w = 0; } w += n; });
    g.push([start, ay.length - 1]);
    if (g.length > 1) { const [a, b] = g[g.length - 1]; if (ay.slice(a, b + 1).reduce((s, x) => s + wc(x.t), 0) < 9) { g.pop(); g[g.length - 1][1] = b; } }
    return g;
  };
  for (const s of (Q.order || [1, ...range(114, 78)])) {
    const sur = Q.surahs[s];
    for (const [a, b] of chunk(sur.ayat)) {
      U.push({ id: `${s}:${sur.ayat[a].n}-${sur.ayat[b].n}`, plant: String(s), surah: s, name: faName(sur.name),
               ayat: sur.ayat.slice(a, b + 1), basmala: a === 0 ? sur.basmala : null, whole: a === 0 && b === sur.ayat.length - 1 });
    }
  }
  for (const p of Q.portions) U.push({ id: p.id, plant: p.id, surah: p.surah, name: faName(p.name), ayat: p.ayat, basmala: null, whole: true });
  return U;
}
const UNITS = buildUnits();
const UNIT = Object.fromEntries(UNITS.map(u => [u.id, u]));
const PLANTS = []; { const seen = {}; for (const u of UNITS) { if (!seen[u.plant]) { seen[u.plant] = { key: u.plant, name: u.name, units: [] }; PLANTS.push(seen[u.plant]); } seen[u.plant].units.push(u); } }
const PLANT = Object.fromEntries(PLANTS.map(p => [p.key, p]));
const unitWords = u => u.ayat.reduce((a, x) => a + wc(x.t), 0);
const unitLabel = u => u.whole ? u.name : `${u.name} ${FA(u.ayat[0].n)}–${FA(u.ayat[u.ayat.length - 1].n)}`;
const reviewMin = u => 0.6 + unitWords(u) / 55;
const newMin = u => Math.max(3, unitWords(u) * 0.22);
const audioUrl = (s, a) => `https://everyayah.com/data/Husary_Muallim_128kbps/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
const revFor = (s, a) => REV.filter(r => r.surah === s && r.ayah === a);
const STAGE_WORDS = ['بذر', 'شَطْء · جوانه', 'آزَرَ · محکم‌شده', 'اسْتَغْلَظَ · ستبر', 'اسْتَوَىٰ · ایستاده', 'يُعْجِبُ · شکوفا'];

/* ============================================================ state (on device only) */
const KEY = 'nabat-state-v1';
const fresh = () => ({ v: 1, onboarded: false, intention: '', intentTags: [], minutes: 10, remind: 'fajr', cards: {}, sowing: null, log: [], seen: {}, created: now() });
let S = store.get(KEY, null) || fresh();
S.seen = S.seen || {};
const seenOnce = (k, times = 2) => { S.seen[k] = (S.seen[k] || 0) + 1; return S.seen[k] <= times; };
const save = () => { if (!store.set(KEY, S)) toast('ذخیره نشد؛ حافظه‌ی مرورگر پر یا بسته است.'); };
const endOfToday = () => F.startOfDay(now()) + DAY - 1;
const dueUnits = () => UNITS.filter(u => S.cards[u.id] && S.cards[u.id].due <= endOfToday())
  .sort((a, b) => F.currentR(S.cards[a.id], now()) - F.currentR(S.cards[b.id], now()));
const nextUnit = () => (S.sowing && UNIT[S.sowing.id]) || UNITS.find(u => !S.cards[u.id]) || null;
function todayPlan() {
  const due = dueUnits(); const water = []; let used = 0;
  for (const u of due) { const m = reviewMin(u); if (used + m <= S.minutes || !water.length) { water.push(u); used += m; } }
  const nu = nextUnit();
  const sowFits = !!nu && used + newMin(nu) <= S.minutes * 1.15;
  return { water, waterMin: used, rest: due.length - water.length, nu, sowFits, total: Math.round(used + (sowFits ? newMin(nu) : 0)) };
}
function plantInfo(p) {
  const cards = p.units.map(u => S.cards[u.id]).filter(Boolean);
  const sowingHere = S.sowing && UNIT[S.sowing.id] && UNIT[S.sowing.id].plant === p.key;
  if (!cards.length) return sowingHere ? { stage: 0, thirsty: false, started: true } : { started: false };
  const stage = Math.min(...cards.map(c => F.stage(c, now())));
  const thirsty = cards.some(c => c.due <= endOfToday());
  const nextDue = Math.min(...cards.map(c => c.due));
  const last = Math.max(...cards.map(c => c.last));
  return { started: true, stage, thirsty, nextDue, last, complete: cards.length === p.units.length };
}
const daysText = t => { const d = Math.round((F.startOfDay(t) - F.startOfDay(now())) / DAY);
  return d === 0 ? 'امروز' : d === 1 ? 'فردا' : d === -1 ? 'دیروز' : d > 0 ? `${FA(d)} روز دیگر` : `${FA(-d)} روز پیش`; };

/* pace projection (from the review-first simulation, see design/pace_sim.py) */
const lerp = (tbl, m) => { const ks = Object.keys(tbl).map(Number).sort((a, b) => a - b);
  if (m <= ks[0]) return tbl[ks[0]]; for (let i = 1; i < ks.length; i++) if (m <= ks[i]) { const a = ks[i - 1], b = ks[i]; return tbl[a] + (tbl[b] - tbl[a]) * (m - a) / (b - a); }
  return tbl[ks[ks.length - 1]]; };
function projection(minutes, knownUnits) {
  const juzUnits = UNITS;
  const totalW = juzUnits.reduce((a, u) => a + unitWords(u), 0);
  const leftW = juzUnits.filter(u => !knownUnits.has(u.id)).reduce((a, u) => a + unitWords(u), 0);
  const months = lerp({ 5: 13, 10: 6, 15: 4, 20: 3, 30: 2 }, minutes) * leftW / 2200;   // ~2200 words = Juz 'Amma + Fatiha
  let when;
  try { when = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' }).format(new Date(now() + months * 30.4 * DAY)); }
  catch (e) { when = `${FA(Math.max(1, Math.round(months)))} ماه دیگر`; }
  const whole = minutes >= 20 ? `و اگر ادامه دهی، کل قرآن حدود ${FA(Math.round(lerp({ 20: 15, 30: 6.3 }, minutes)))} سال` :
                               `و اگر ادامه دهی، در بیست سال حدود ${FA(Math.round(lerp({ 5: 8.1, 10: 16.3, 15: 24.4, 20: 30 }, minutes)))} جزء`;
  return { jz: leftW === 0 ? 'همه‌ی این باغ را داری؛ فقط آبش بده.' : `با همین آهنگ، این ${FA(PLANTS.length)} سوره حدود ${when}`, whole };
}

/* ============================================================ rendering helpers */
let route = 'splash', enter = true;
const W = { queue: [], i: 0, peek: new Set(), revealed: false, drinking: false, anim: null, lastPeek: -1, done: 0, minutes: 0, meaning: false, hint: false };
const SW = { step: 0, round: 0, playing: -1, heard: new Set(), showTr: false, anim: null };
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ࣰۭ-ࣲـ]/g;
const firstLetter = w => { const c = w.replace(MARKS, '')[0] || ''; return c === 'ٱ' ? 'ا' : c; };
const hashed = i => ((i * 2654435761) >>> 0) / 4294967296;
const FRAC = [0.25, 0.5, 0.75, 0.92];

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => { t.classList.add('fadeout'); setTimeout(() => t.remove(), 500); }, 2600);
}

const leaf = () => '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 13 C3 6 8 3 13 3 C13 9 9 13 3 13 Z" fill="#3a7d47" fill-opacity=".18" stroke="#3a7d47" stroke-width="1.2"/><path d="M3.5 12.5 L10 6" stroke="#3a7d47" stroke-width="1"/></svg>';
function meaningHTML(u) {
  const ab = revFor(u.surah, 0);
  const about = ab.length && u.ayat[0].n === 1 ? `<button class="aboutrev press" data-act="rev" data-v="${u.surah}:0" data-role="go">${leaf()} درباره‌ی این سوره · ${FA(ab.length)} روایت</button>` : '';
  const bas = u.basmala ? `<p class="basmala" data-role="quran">${u.basmala}</p>` : '';
  return `<div class="meaning">${about}${bas}${u.ayat.map(a => { const r = revFor(u.surah, a.n);
    return `<div class="mayah"><p class="ar" data-role="quran">${a.t} ${marker(a.n, true, false, 0)}</p>
      <p class="fa" data-role="translation">${a.fa}</p>
      ${r.length ? `<button class="revbtn press" data-act="rev" data-v="${u.surah}:${a.n}" data-role="go">${leaf()} ${FA(r.length)} روایت</button>` : ''}</div>`; }).join('')}
    <p class="credit-line">ترجمه: مکارم شیرازی</p></div>`;
}
function mushafHTML(u, mode, opt) {
  if (mode === 'meaning') return meaningHTML(u);
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
    else { alive = opt.heard.has(ai) || opt.step >= 3; pop = opt.anim === 'heard' && opt.playing === ai; }
    return `<span class="ay ${opt.playing === ai ? 'cur' : ''}">${spans} ${marker(a.n, alive, pop, d)}</span>`;
  }).join(' ');
  const bas = u.basmala ? `<span class="basmala">${u.basmala}</span>` : '';
  const tr = mode === 'review' && opt.revealed && opt.meaning ? `<div class="tr rise" data-role="translation">${u.ayat.map(a => `<p>${FA(a.n)}. ${a.fa}</p>`).join('')}</div>` : '';
  return `<div class="mushaf wob" data-role="quran">${bas}${body}</div>${tr}`;
}

/* ============================================================ screens */
const SCREENS = {
  splash() {
    const file = artSet()[design.splash] ? design.splash : 'splash.svg';
    const first = !S.onboarded;
    return `<div class="splash" data-act="skip">
      <p class="name rise" style="--d:${first ? 3.4 : 1.6}s" data-role="name">نبات</p>
      <p class="deco rise" style="--d:${first ? 4.1 : 2.1}s" data-role="deco" data-uthmani="وَلَا حَبَّةٍ فِى ظُلُمَٰتِ ٱلْأَرْضِ" data-simple="وَلَا حَبَّةٍ فِي ظُلُمَاتِ الْأَرْضِ"></p>
      <p class="ref rise" style="--d:${first ? 4.6 : 2.4}s" data-role="ref">الأنعام ۵۹</p>
      ${art(file, 'splash-art')}</div>`;
  },

  ob1() {
    const tags = ['برای نمازم', 'برای دلم', 'برای خانواده‌ام', 'برای آرامش', 'فقط برای خدا'];
    return `<div class="ob"><div class="obdots">${[0, 1, 2, 3].map(i => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="head"><p data-role="todayTitle">نیتت چیست؟</p>
      <p class="muted" data-role="todaySub">این فقط برای خودت است؛ جایی فرستاده نمی‌شود و هر وقت بخواهی عوضش می‌کنی.</p></div>
      <div class="chips">${tags.map(t => `<button class="chip press ${S.intentTags.includes(t) ? 'on' : ''}" data-act="tag" data-v="${t}" data-role="btn">${t}</button>`).join('')}</div>
      <textarea id="intent" placeholder="اگر خواستی، با کلمه‌های خودت بنویس…" data-role="hint">${S.intention || ''}</textarea>
      <div class="nav"><span></span><button class="pill main wob press" data-act="ob:2" data-role="btn">ادامه</button></div></div>`;
  },

  ob2() {
    const known = new Set(Object.keys(S.cards).map(id => UNIT[id] && UNIT[id].plant));
    return `<div class="ob"><div class="obdots">${[0, 1, 2, 3].map(i => `<i class="${i <= 1 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="head"><p data-role="todayTitle">کدام‌ها را از قبل داری؟</p>
      <p class="muted" data-role="todaySub">این‌ها از روز اول در باغت می‌رویند و فقط آب می‌خواهند. اگر هیچ‌کدام، اشکالی ندارد؛ از اول شروع می‌کنیم.</p></div>
      <div class="chips">${PLANTS.map(p => `<button class="chip press ${known.has(p.key) ? 'on' : ''}" data-act="known" data-v="${p.key}" data-role="hifzMeta">${p.name}</button>`).join('')}</div>
      <div class="nav"><button class="back" data-act="ob:1" data-role="hifzMeta">→ قبلی</button><button class="pill main wob press" data-act="ob:3" data-role="btn">ادامه</button></div></div>`;
  },

  ob3() {
    const knownU = new Set(Object.keys(S.cards));
    const pr = projection(S.minutes, knownU);
    return `<div class="ob"><div class="obdots">${[0, 1, 2, 3].map(i => `<i class="${i <= 2 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="head"><p data-role="todayTitle">چقدر وقت، با دلِ خوش؟</p>
      <p class="muted" data-role="todaySub">هر روز همین‌قدر. هر وقت خواستی عوضش کن؛ نه جریمه‌ای در کار است، نه عجله‌ای.</p></div>
      <div class="paces">${[5, 10, 15, 20, 30].map(m => `<button class="pace press ${S.minutes === m ? 'on' : ''}" data-act="pace" data-v="${m}" data-role="btn"><b>${FA(m)}</b>دقیقه</button>`).join('')}</div>
      <div class="proj" data-role="hint">${pr.jz}<br>${pr.whole}<br><span class="muted" style="font-size:12px">«حدود» است، نه موعد. با رفتار واقعی‌ات دوباره حساب می‌شود.</span></div>
      <div class="nav"><button class="back" data-act="ob:2" data-role="hifzMeta">→ قبلی</button><button class="pill main wob press" data-act="ob:4" data-role="btn">ادامه</button></div></div>`;
  },

  ob4() {
    const opts = [['fajr', 'بعد از نماز صبح'], ['zuhr', 'بعد از نماز ظهر'], ['night', 'شب، پیش از خواب'], ['none', 'یادآور نمی‌خواهم']];
    return `<div class="ob"><div class="obdots">${[0, 1, 2, 3].map(i => `<i class="on"></i>`).join('')}</div>
      <div class="head"><p data-role="todayTitle">کی یادت بیاندازیم؟</p>
      <p class="muted" data-role="todaySub">روزی یک بار، آرام. اگر چند روز نیامدی، ساکت می‌مانیم.</p></div>
      <div class="chips">${opts.map(([k, t]) => `<button class="chip press ${S.remind === k ? 'on' : ''}" data-act="remind" data-v="${k}" data-role="btn">${t}</button>`).join('')}</div>
      <p class="hint" data-role="hint" style="font-size:12px">در این نسخه‌ی وب، یادآور فقط ذخیره می‌شود؛ یادآورِ واقعی در نسخه‌ی اندروید فعال می‌شود.</p>
      <div class="nav"><button class="back" data-act="ob:3" data-role="hifzMeta">→ قبلی</button><button class="pill main wob press" data-act="start" data-role="btn">بکاریم</button></div></div>`;
  },

  today() {
    const p = todayPlan();
    const garden = PLANTS.filter(pl => plantInfo(pl).started);
    const show = garden.slice(-5);
    const gardenHTML = show.length ? show.map((pl, i) => { const inf = plantInfo(pl);
        return `<button class="slot" data-act="plant" data-v="${pl.key}">${art(`stage-${inf.stage}.svg`, `${inf.thirsty ? 'thirsty' : ''} sway ${enter ? 'grow' : ''}`, `--gd:${(0.3 + i * 0.22).toFixed(2)}s;--sd:${(-i * 1.4).toFixed(1)}s`)}<span>${pl.name}</span></button>`; }).join('')
      : `<div class="slot">${art('stage-0.svg', `sway ${enter ? 'grow' : ''}`)}<span>اولین بذر</span></div>`;
    const sub = p.water.length ? `${FA(p.water.length)} گیاه تشنه‌اند${p.nu ? (p.sowFits ? '، یک بذر آماده‌ی کاشتن' : '؛ امروز فقط آب') : ''}`
              : p.nu ? (S.sowing ? 'بذرِ نیمه‌کاره منتظر توست' : 'باغ سیراب است؛ یک بذر آماده‌ی کاشتن') : 'باغ سیراب است';
    const sowLabel = p.nu ? unitLabel(p.nu) : '';
    return `
      <div class="top"><span></span><div class="topbtns"><button data-act="go:garden" data-role="hifzMeta">باغ من</button><button data-act="go:settings" data-role="hifzMeta">تنظیمات</button></div></div>
      <div class="today"><p data-role="todayTitle">امروز · حدود ${FA(Math.max(1, p.total))} دقیقه</p><p class="muted" data-role="todaySub">${sub}</p></div>
      <div class="garden">${gardenHTML}</div>
      <div class="cards">
        <button class="card wob press ${p.water.length ? '' : 'quiet'}" data-act="${p.water.length ? 'water' : 'noop'}">${art('water.svg')}
          <span><span class="t" data-role="cardTitle">آب دادن</span><span class="t muted" data-role="cardSub">${p.water.length ? `مرور · ${FA(p.water.length)} گیاه · حدود ${FA(Math.max(1, Math.round(p.waterMin)))} دقیقه` : 'امروز همه سیراب‌اند'}</span></span>
          <span class="go" data-role="go">${p.water.length ? 'شروع' : '✓'}</span></button>
        ${p.nu ? `<button class="card wob press ${p.sowFits || !p.water.length ? '' : 'quiet'}" data-act="sow">${art('seed.svg')}
          <span><span class="t" data-role="cardTitle">کاشتن</span><span class="t muted" data-role="cardSub">${S.sowing ? 'ادامه · ' : 'بذر تازه · '}${sowLabel}</span></span>
          <span class="go" data-role="go">${p.sowFits || !p.water.length ? (p.water.length ? 'بعدش' : 'شروع') : 'با این حال'}</span></button>` : ''}
      </div>
      <div class="foot foot-ayah"><p class="quote" data-role="quote" data-uthmani="أَأَنتُمْ تَزْرَعُونَهُۥٓ أَمْ نَحْنُ ٱلزَّٰرِعُونَ" data-simple="أَأَنْتُمْ تَزْرَعُونَهُ أَمْ نَحْنُ الزَّارِعُونَ"></p><p class="ref" data-role="ref">الواقعة ۶۴</p></div>`;
  },

  water() {
    const u = UNIT[W.queue[W.i]], c = S.cards[u.id], inf = plantInfo(PLANT[u.plant]);
    const sug = W.peek.size > 2 ? 1 : W.peek.size ? 2 : 3;
    const cls = W.drinking ? 'standup' : (inf.thirsty && !W.revealed ? 'thirsty' : '');
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">→ امروز</button>
        <span class="muted" data-role="hifzMeta">آب دادن · ${FA(W.i + 1)} از ${FA(W.queue.length)}</span>
        <span class="dots">${W.queue.map((q, i) => `<span class="dot ${i < W.i || (i === W.i && W.drinking) ? 'on' : ''}"></span>`).join('')}</span></div>
      <div class="hhead"><div class="art" style="width:54px;flex:none">${art(`stage-${Math.max(1, inf.stage || 1)}.svg`, `sway ${cls}`)}
          ${W.drinking ? '<div class="drops"><i style="left:30%"></i><i style="left:52%;animation-delay:.25s"></i><i style="left:42%;animation-delay:.5s"></i></div>' : ''}</div>
        <div><p class="tt" data-role="hifzTitle">${unitLabel(u)}</p><p class="muted" data-role="hifzMeta">${daysText(c.last)}</p></div></div>
      ${W.hint ? `<p class="hint" data-role="hint">${W.revealed ? 'با خودت صادق باش؛ فقط برای زمان‌بندیِ آب است.' : 'از حفظ بخوان، بعد ببین. کلمه را لمس کن تا دیده شود.'}</p>` : ''}
      ${mushafHTML(u, 'review', W)}
      ${W.revealed ? `<button class="textbtn" data-act="wmeaning" data-role="go">${W.meaning ? 'پنهان کردن معنا' : 'معنا'}</button>` : ''}
      ${W.revealed ? `<div class="grades ${W.anim === 'reveal' ? 'rise' : ''}" style="--d:1.1s">${['دوباره', 'سخت بود', 'خوب', 'روان'].map((g, i) => `<button class="wob press ${i + 1 === sug ? 'sug' : ''}" data-act="grade" data-v="${i + 1}" data-role="grade">${g}</button>`).join('')}</div>`
                   : `<div class="actions"><button class="pill main wob press" data-act="reveal" data-role="btn">نشانم بده</button></div>`}
      <p class="foot" data-role="foot">${W.drinking ? 'آب خورد.' : W.peek.size ? `${FA(W.peek.size)} کلمه را نگاه کردی؛ اشکالی ندارد.` : '&nbsp;'}</p>`;
  },

  watered() {
    return `<div class="center">${art('stage-5.svg', 'grow sway')}
      <p class="rise" style="--d:1.6s" data-role="doneTitle">باغ سیراب شد</p>
      <p class="muted rise" style="--d:1.9s" data-role="hifzMeta">${FA(W.done)} گیاه آب خوردند · حدود ${FA(Math.max(1, Math.round(W.minutes)))} دقیقه</p>
      <p class="quote rise" style="--d:2.4s" data-role="quote" data-uthmani="تُؤْتِىٓ أُكُلَهَا كُلَّ حِينٍۭ بِإِذْنِ رَبِّهَا" data-simple="تُؤْتِي أُكُلَهَا كُلَّ حِينٍ بِإِذْنِ رَبِّهَا"></p>
      <p class="ref rise" style="--d:2.6s" data-role="ref">ابراهیم ۲۵</p>
      <div class="actions rise" style="--d:3s"><button class="pill wob press" data-act="go:today" data-role="btn">برگشت به باغ</button>
        ${todayPlan().nu ? '<button class="pill green wob press" data-act="sow" data-role="btn">کاشتنِ بذر</button>' : ''}</div></div>`;
  },

  sow() {
    const u = nextUnit();
    const STEPS = [['معنا', 'اول بفهم، بعد حفظ کن. آرام بخوان؛ برگ کنار آیه یعنی روایتی هست.'],
      ['گوش دادن', 'گوش بده؛ آرام، چند بار.'], ['بلند خواندن', 'همراه قاری، بلند بخوان.'],
      ['حرف اول', 'فقط حرف اول پیداست؛ بقیه را از دلت بخوان.'], ['کم‌رنگ', 'هر دور، کلمه‌های بیشتری پنهان می‌شوند.'], ['از حفظ', 'حالا از حفظ. کلمه‌ی اول سرنخ توست.']];
    const mode = ['meaning', 'full', 'full', 'first', 'fade', 'memory'][SW.step];
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">→ امروز</button>
        <span class="stepdots">${STEPS.map((x, i) => `<button class="${i === SW.step ? 'on' : i < SW.step ? 'done' : ''}" data-act="step" data-v="${i}" aria-label="${x[0]}"></button>`).join('')}</span></div>
      <div class="hhead">${art('seed.svg')}<div><p class="tt" data-role="hifzTitle">${unitLabel(u)}</p>
        <p class="muted" data-role="stepChip">${FA(SW.step + 1)} از ${FA(STEPS.length)} · ${STEPS[SW.step][0]}</p></div></div>
      <p class="hint ${SW.anim === 'step' ? 'rise' : ''}" data-role="hint">${STEPS[SW.step][1]}</p>
      <div class="${SW.anim === 'step' ? 'rise' : ''}" style="--d:.12s;width:100%;display:flex;flex-direction:column;align-items:center">${mushafHTML(u, mode, SW)}
        ${SW.step > 0 && SW.showTr ? `<div class="tr rise" data-role="translation">${u.ayat.map(a => `<p>${FA(a.n)}. ${a.fa}</p>`).join('')}</div>` : ''}</div>
      <div class="actions">
        ${SW.step === 1 || SW.step === 2 ? `<button class="pill main wob press" data-act="play" data-role="btn">${SW.playing >= 0 ? 'توقف' : 'پخش با قاری'}</button>` : ''}
        ${SW.step === 4 ? `<button class="pill main wob press" data-act="round" data-role="btn">یک دور دیگر</button>` : ''}
        ${SW.step === 5 ? `<button class="pill wob press" data-act="reveal-sow" data-role="btn">نشانم بده</button><button class="pill main wob press" data-act="plant-it" data-role="btn">کاشتم</button>` : ''}
        ${SW.step > 0 ? `<button class="textbtn" data-act="tr" data-role="go">${SW.showTr ? 'پنهان کردن معنا' : 'معنا'}</button>` : ''}</div>
      <div class="navbar"><button class="pill wob press" data-act="prev" data-role="btn" ${SW.step ? '' : 'disabled'}>قبلی</button>
        <button class="pill ${SW.step === 0 ? 'main' : ''} wob press" data-act="next" data-role="btn" ${SW.step < 5 ? '' : 'disabled'}>${SW.step === 0 ? 'فهمیدم، بعدی' : 'بعدی'}</button></div>`;
  },

  planted() {
    const u = UNIT[SW.plantedId];
    return `<div class="center">${art('stage-1.svg', 'grow sway')}
      <p class="rise" style="--d:1.8s" data-role="doneTitle">بذر کاشته شد</p>
      <p class="muted rise" style="--d:2.1s" data-role="hifzMeta">${unitLabel(u)} · فردا اولین آب</p>
      <p class="quote rise" style="--d:2.6s" data-role="quote" data-uthmani="أَأَنتُمْ تَزْرَعُونَهُۥٓ أَمْ نَحْنُ ٱلزَّٰرِعُونَ" data-simple="أَأَنْتُمْ تَزْرَعُونَهُ أَمْ نَحْنُ الزَّارِعُونَ"></p>
      <p class="foot rise" style="--d:3s;padding:6px 0 0" data-role="foot">بذرت را کاشتی. رویاندن با اوست.</p>
      <div class="actions rise" style="--d:3.4s"><button class="pill wob press" data-act="go:today" data-role="btn">برگشت به باغ</button></div></div>`;
  },

  garden() {
    const started = PLANTS.filter(p => plantInfo(p).started).length;
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">→ امروز</button><span class="muted" data-role="hifzMeta">${FA(started)} گیاه از ${FA(PLANTS.length)}</span></div>
      <div class="today"><p data-role="todayTitle">باغ من</p><p class="muted" data-role="todaySub">هر گیاه را که در نماز خواندی، یک لمس کن؛ نماز هم آب است.</p></div>
      <div class="list">${PLANTS.map(p => { const inf = plantInfo(p);
        const meta = !inf.started ? 'هنوز کاشته نشده' : inf.stage === 0 ? 'در حال کاشت' : inf.thirsty ? `تشنه · ${STAGE_WORDS[inf.stage]}` : `${STAGE_WORDS[inf.stage]} · آب بعدی ${daysText(inf.nextDue)}`;
        return `<div class="row" ${inf.started ? '' : 'style="opacity:.5"'}>${art(`stage-${inf.started ? inf.stage : 0}.svg`, inf.thirsty ? 'thirsty' : '')}
          <div class="meta"><p data-role="hifzTitle" style="font-size:19px">${p.name}</p><p class="muted" data-role="hifzMeta">${meta}</p></div>
          ${inf.started && inf.stage > 0 ? `<button class="act press" data-act="salah" data-v="${p.key}" data-role="go">در نماز خواندم</button>` : ''}</div>`; }).join('')}</div>`;
  },

  settings() {
    const opts = [['fajr', 'بعد از نماز صبح'], ['zuhr', 'بعد از نماز ظهر'], ['night', 'شب'], ['none', 'بدون یادآور']];
    const pr = projection(S.minutes, new Set(Object.keys(S.cards)));
    return `
      <div class="top"><button class="back" data-act="go:today" data-role="hifzMeta">→ امروز</button></div>
      <div class="today"><p data-role="todayTitle">تنظیمات</p></div>
      <div class="section"><h3 data-role="cardTitle">وقت هر روز</h3>
        <div class="paces" style="padding:0">${[5, 10, 15, 20, 30].map(m => `<button class="pace press ${S.minutes === m ? 'on' : ''}" data-act="pace" data-v="${m}" data-role="btn"><b>${FA(m)}</b>دقیقه</button>`).join('')}</div>
        <p class="hint" style="padding:10px 0 0" data-role="hint">${pr.jz}. ${pr.whole}.</p></div>
      <div class="section"><h3 data-role="cardTitle">یادآور</h3><div class="chips">${opts.map(([k, t]) => `<button class="chip press ${S.remind === k ? 'on' : ''}" data-act="remind" data-v="${k}" data-role="btn">${t}</button>`).join('')}</div></div>
      <div class="section"><h3 data-role="cardTitle">نیت</h3><p class="muted" data-role="hint">${S.intention || S.intentTags.join('، ') || 'ننوشته‌ای'}</p>
        <button class="pill wob press" style="margin-top:10px" data-act="ob:1" data-role="btn">ویرایش</button></div>
      <div class="section"><h3 data-role="cardTitle">پشتیبان</h3><p class="muted" data-role="hint">همه‌چیز فقط روی همین دستگاه است. برای انتقال یا امنیت، فایل پشتیبان بگیر.</p>
        <div class="actions" style="justify-content:flex-start;padding:10px 0 0"><button class="pill wob press" data-act="export" data-role="btn">گرفتن پشتیبان</button>
        <label class="pill wob press" data-role="btn">بازگرداندن<input type="file" accept="application/json" id="importFile" hidden></label>
        <button class="pill wob press" data-act="reset" data-role="btn" style="border-color:var(--ink2);color:var(--ink2)">شروع از نو</button></div></div>
      <p class="fine">متن قرآن: <a href="https://tanzil.net" target="_blank" rel="noopener">Tanzil.net</a> (رسم عثمانی، CC BY 3.0، بدون تغییر) ·
        ترجمه: ناصر مکارم شیرازی (Tanzil) · روایات: از کتاب روایات تفسیری (فایل خودتان) · تلاوت: استاد خلیل حصری (معلم) از <a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah</a> ·
        قلم‌ها: فونت‌ایران (با مجوز وب) و Amiri Quran · <a href="panel/">پنل طراحی</a><br>نسخه‌ی آزمایشی وب؛ داده‌ها روی دستگاه خودت می‌ماند.</p>`;
  }
};

function render() {
  stopAudioIfLeaving();
  const html = SCREENS[route]();
  const banner = previewing && route !== 'splash' ? `<div class="banner">پیش‌نمایش طراحی از پنل<button data-act="clear-preview">برگرداندن طراحی اصلی</button></div>` : '';
  $app.innerHTML = banner + html;
  $app.classList.toggle('enter', enter && !['splash', 'watered', 'planted'].includes(route));
  if (enter) [...$app.children].forEach((c, i) => c.style.setProperty('--i', i));
  applyFonts();
  enter = false; W.anim = null; SW.anim = null;
  if (route === 'ob1') { const ta = document.getElementById('intent'); if (ta) ta.oninput = () => { S.intention = ta.value; save(); }; }
  if (route === 'settings') { const f = document.getElementById('importFile'); if (f) f.onchange = importBackup; }
}
function go(r) {
  if (r === 'water') { const p = todayPlan(); W.queue = p.water.map(u => u.id); W.i = 0; W.peek = new Set(); W.revealed = false; W.drinking = false; W.meaning = false; W.done = 0; W.minutes = 0; if (!W.queue.length) r = 'today'; else { W.hint = seenOnce('waterHint'); save(); } }
  if (r === 'sow') { const u = nextUnit(); if (!u) { toast('همه‌ی بذرهای این نسخه کاشته شده‌اند.'); return; }
    if (!S.sowing || S.sowing.id !== u.id) { S.sowing = { id: u.id, step: 0 }; save(); }
    SW.step = Math.min(S.sowing.step || 0, 5); SW.round = 0; SW.heard = new Set(); SW.playing = -1; SW.showTr = false; }
  route = r; enter = true; window.scrollTo(0, 0); render();
}

/* ============================================================ narration sheet (روایت): a calm dialogue */
let sheet = null;
function openSheet(s, a) {
  const list = revFor(s, a); if (!list.length) return;
  closeSheet(true);
  sheet = document.createElement('div'); sheet.className = 'sheetwrap';
  let i = 0;
  const paint = () => {
    const r = list[i];
    const surah = Q.surahs[s] ? faName(Q.surahs[s].name) : '';
    sheet.innerHTML = `<div class="backdrop" data-close></div>
      <section class="sheet" role="dialog" aria-label="روایت">
        <div class="grab"></div>
        <p class="sref" data-role="hifzMeta">${leaf()} ${surah}${a ? ` · آیه‌ی ${FA(a)}` : ' · درباره‌ی سوره'}</p>
        <div class="dialog rise">${r.turns.map(t => `<div class="turn ${t.k}">${t.who ? `<span class="who" data-role="hifzMeta">${t.who}</span>` : ''}<p data-role="translation">${t.t}</p></div>`).join('')}
          ${r.note ? `<p class="rnote" data-role="hint">${r.note}</p>` : ''}</div>
        <p class="rsrc" data-role="ref">${r.src ? r.src + ' · ' : ''}کتاب روایات، ص ${FA(r.p)}</p>
        <div class="sheetnav">${list.length > 1 ? `<span class="stepdots">${list.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-j="${j}" aria-label="روایت ${j + 1}"></button>`).join('')}</span>` : '<span></span>'}
          <button class="pill wob press" data-close data-role="btn">بستن</button></div>
      </section>`;
    applyFonts(sheet);
  };
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return closeSheet();
    const d = e.target.closest('[data-j]'); if (d) { i = +d.dataset.j; paint(); }
  });
  paint(); document.body.appendChild(sheet); document.body.style.overflow = 'hidden';
}
function closeSheet(instant) {
  if (!sheet) return; const el = sheet; sheet = null; document.body.style.overflow = '';
  if (instant) return el.remove();
  el.classList.add('closing'); setTimeout(() => el.remove(), 350);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ============================================================ audio (reciter, ayah by ayah) */
const audio = new Audio(); audio.preload = 'auto';
let audioRoute = null;
function stopAudio() { audio.pause(); audio.onended = null; SW.playing = -1; }
function stopAudioIfLeaving() { if (audioRoute && route !== audioRoute) { stopAudio(); audioRoute = null; } }
function playFrom(ai) {
  const u = nextUnit();
  if (!u || ai >= u.ayat.length) { SW.playing = -1; render(); return; }
  SW.playing = ai; SW.heard.add(ai); SW.anim = 'heard'; audioRoute = 'sow'; render();
  audio.src = audioUrl(u.surah, u.ayat[ai].n);
  audio.onended = () => playFrom(ai + 1);
  audio.onerror = () => { SW.playing = -1; render(); toast('صدا بارگیری نشد؛ اینترنت را بررسی کن.'); };
  audio.play().catch(() => { SW.playing = -1; render(); });
  if (u.ayat[ai + 1]) { const pre = new Audio(); pre.preload = 'auto'; pre.src = audioUrl(u.surah, u.ayat[ai + 1].n); }
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
    if (!confirm('باغِ فعلی با این پشتیبان جایگزین شود؟')) return;
    delete d.app; S = { ...fresh(), ...d }; save(); toast('پشتیبان بازگردانده شد.'); go('today');
  }).catch(() => toast('این فایل پشتیبانِ نبات نیست.'));
}

$app.addEventListener('click', e => {
  const w = e.target.closest('.wd.hid');
  if (w && route === 'water' && !W.revealed && !W.drinking) { W.peek.add(+w.dataset.w); W.lastPeek = +w.dataset.w; W.anim = 'peek'; render(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, v = a.dataset.v;
  if (act.startsWith('go:')) return go(act.slice(3));
  if (act.startsWith('ob:')) { route = 'ob' + act.slice(3); enter = true; return render(); }
  switch (act) {
    case 'skip': return proceedFromSplash();
    case 'tag': { const i = S.intentTags.indexOf(v); i >= 0 ? S.intentTags.splice(i, 1) : S.intentTags.push(v); save(); return render(); }
    case 'known': {
      const p = PLANT[v]; const has = p.units.some(u => S.cards[u.id]);
      for (const u of p.units) { if (has) delete S.cards[u.id];
        else S.cards[u.id] = { id: u.id, S: 4, D: 5, last: now(), planted: now(), due: F.startOfDay(now()) + DAY, reps: 1, lapses: 0, known: true }; }
      save(); return render();
    }
    case 'pace': S.minutes = +v; save(); return render();
    case 'remind': S.remind = v; save(); return render();
    case 'start': S.onboarded = true; save(); return go('today');
    case 'water': return go('water');
    case 'sow': return go('sow');
    case 'noop': return toast('امروز همه سیراب‌اند. فردا دوباره سر بزن.');
    case 'plant': return go('garden');
    case 'reveal': W.revealed = true; W.anim = 'reveal'; return render();
    case 'wmeaning': W.meaning = !W.meaning; return render();
    case 'rev': { const [sv, av] = v.split(':').map(Number); return openSheet(sv, av); }
    case 'grade': {
      if (W.drinking) return;
      const u = UNIT[W.queue[W.i]]; S.cards[u.id] = F.review(S.cards[u.id], +v, now()); logEvent('review', u.id, +v);
      W.done++; W.minutes += reviewMin(u); save(); W.drinking = true; render();
      setTimeout(() => { W.drinking = false; if (W.i + 1 < W.queue.length) { W.i++; W.peek = new Set(); W.revealed = false; W.meaning = false; route = 'water'; } else route = 'watered'; enter = true; render(); }, 1600);
      return;
    }
    case 'step': stopAudio(); SW.step = +v; SW.round = 0; SW.anim = 'step'; S.sowing.step = SW.step; save(); return render();
    case 'next': if (SW.step < 5) { stopAudio(); SW.step++; SW.round = 0; SW.anim = 'step'; S.sowing.step = SW.step; save(); } return render();
    case 'prev': if (SW.step > 0) { stopAudio(); SW.step--; SW.round = 0; SW.anim = 'step'; S.sowing.step = SW.step; save(); } return render();
    case 'round': SW.round++; SW.anim = 'round'; return render();
    case 'reveal-sow': SW.anim = 'reveal-sow'; return render();
    case 'tr': SW.showTr = !SW.showTr; return render();
    case 'play': if (SW.playing >= 0) { stopAudio(); return render(); } return playFrom(0);
    case 'plant-it': { stopAudio(); const u = nextUnit(); S.cards[u.id] = F.plant(u.id, now()); logEvent('plant', u.id); S.sowing = null; SW.plantedId = u.id; save(); route = 'planted'; enter = true; return render(); }
    case 'salah': { const p = PLANT[v]; let n = 0;
      for (const u of p.units) if (S.cards[u.id] && S.cards[u.id].S) { S.cards[u.id] = F.review(S.cards[u.id], 3, now()); logEvent('salah', u.id, 3); n++; }
      save(); toast(n ? 'ثبت شد؛ نماز هم آب است.' : 'اول باید کاشته شود.'); return render(); }
    case 'export': return exportBackup();
    case 'reset': if (confirm('همه‌ی باغ پاک شود و از نو شروع کنی؟ این کار برگشت ندارد.')) { S = fresh(); save(); route = 'ob1'; enter = true; render(); } return;
    case 'clear-preview': store.del('nabat-design-v1'); location.reload(); return;
  }
});

let splashTimer = null;
function proceedFromSplash() { if (route !== 'splash') return; clearTimeout(splashTimer); route = S.onboarded ? 'today' : 'ob1'; enter = true; render(); }

/* ============================================================ boot */
const turb = document.getElementById('turb'); let seed = 1;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
setInterval(() => { if (!reduce && design.boil !== false && design.art === 'a1' && turb) { seed = seed % 3 + 1; turb.setAttribute('seed', seed); } }, 200);
window.addEventListener('storage', e => { if (e.key === 'nabat-design-v1') location.reload(); });   // panel edits apply live

loadDesign().then(() => {
  render();
  splashTimer = setTimeout(proceedFromSplash, S.onboarded ? 4200 : 6400);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
});
})();
