/* Songwriting by Clay and Kelsy — page behavior.
   Astra's redesign (sw- components) wired into the live clayandkelsy.com host.

   Two modes:
   · STANDALONE (opened directly): the sw-nav sticks, anchors scroll this window.
   · EMBEDDED (inside the WordPress auto-growing iframe, which never scrolls itself):
     the host draws the pinned product bar and scrolls the outer page. This script
     reports height and theme to the host and takes section/notify commands from it.

   Host contract — page→host: {hook:"h",h} {hook:"bg",color} {hook:"go",href};
   host→page: {hookHost:"vp",top,vh,nav:true} {hookHost:"go",id}.

   Blocks below are marked with NAME banners in comments so you can grep for them. */
(() => {
'use strict';
const root = document.querySelector('.sw-site'); if (!root) return;
const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* HOST BRIDGE ---------------------------------------------------------------- */
const IS_EMBEDDED = window.self !== window.top;
const THEME_BG = { light: '#f5efe3', dark: '#211f1c' };
const host = { top: 0, vh: 800, nav: false, ready: false };
if (IS_EMBEDDED) document.body.classList.add('embedded');

const vpH = () => IS_EMBEDDED ? (host.vh || 800) : window.innerHeight;
/* element top in the visible viewport, in both modes (embedded: the iframe never
   scrolls, so a rect top is the document-absolute offset; add the frame's own top) */
const relTop = el => { const t = el.getBoundingClientRect().top; return IS_EMBEDDED ? host.top + t : t; };

const scrollHandlers = [];
const tick = () => { for (const h of scrollHandlers) h(); };

let lastH = 0;
function postHeight() {
  if (!IS_EMBEDDED) return;
  const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
  if (h > 0 && Math.abs(h - lastH) > 4) { lastH = h; parent.postMessage({ hook: 'h', h }, '*'); }
}
function postBg() {
  if (!IS_EMBEDDED) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  parent.postMessage({ hook: 'bg', color: THEME_BG[dark ? 'dark' : 'light'] }, '*');
}
/* Release: name the host bar's button and its link. The host keeps "Notify me" until
   this arrives, and takes only an App Store or clayandkelsy.com link, as text. */
/* Apple's official badge everywhere. Apple's own service draws "Pre-order" until the release
   date in the link and "Download" after it; the words read aloud switch at the same moment. */
const RELEASED = Date.now() >= 1792738800000;
const BADGE_ALT = RELEASED ? 'Download on the App Store' : 'Pre-order on the App Store';
$$('.sw-badge img').forEach(i => { i.alt = BADGE_ALT; });
const CTA = { label: 'App Store', alt: BADGE_ALT, href: 'https://apps.apple.com/app/apple-store/id6817031276?pt=129169856&ct=site&mt=8',
  badge: 'https://toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&releaseDate=1792738800' };
let ctaSent = false;
function postCta() { if (!IS_EMBEDDED) return; parent.postMessage({ hook: 'cta', label: CTA.label, href: CTA.href, badge: CTA.badge, alt: CTA.alt }, '*'); ctaSent = true; }
postCta();
/* Scroll to a section. Standalone the iframe scrolls itself. Embedded, the frame
   never scrolls and scrollIntoView does not reach the host, so the page hands the
   host the target's Y and the host scrolls the outer window. */
function scrollToTarget(t) {
  if (!t) return;
  if (IS_EMBEDDED) {
    const y = t.getBoundingClientRect().top + (window.scrollY || 0);
    parent.postMessage({ hook: 'scrollto', y }, '*');
  } else {
    t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
}

if (IS_EMBEDDED) {
  addEventListener('message', e => {
    const d = e.data; if (!d || !d.hookHost) return;
    if (d.hookHost === 'go') {                       /* host menu / brand click */
      scrollToTarget(d.id && document.querySelector(d.id));
      return;
    }
    if (d.hookHost === 'theme') { toggleTheme(); return; }   /* host bar theme button; page stays the source of truth */
    if (d.hookHost !== 'vp' || typeof d.top !== 'number') return;
    if (d.nav) host.nav = true;
    host.top = d.top;
    if (typeof d.vh === 'number' && d.vh > 0) host.vh = d.vh;
    host.ready = true;
    if (!ctaSent) postCta();
    tick();
  });
} else {
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', () => { tick(); }, { passive: true });
}

/* in-page anchors: glide, and reach the host page when embedded (scrollIntoView
   inside the frame scrolls the outer window). Notify is handled separately below. */
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (!id || id.length < 2) return;
  const t = document.querySelector(id); if (!t) return;
  e.preventDefault();
  scrollToTarget(t);
}));

/* Notify: embedded under the host menu, ask the host to scroll up and swap the
   frame to the signup page, so it never opens thousands of pixels below the fold.
   Standalone, the link opens the real notify page normally. */
$$('a[href*="notify.html"]').forEach(a => a.addEventListener('click', e => {
  if (!IS_EMBEDDED) return;
  e.preventDefault();
  parent.postMessage({ hook: 'go', href: 'notify.html' }, '*');
}));

/* HERO SCREEN SELECTOR + THEME ----------------------------------------------- */
/* The hero phone is the app tour, in the order you use it: start a recording,
   stack layers, write the lyrics, set the chords, perform. Screens are warmed
   quietly after load (current theme only) and the other theme's set is warmed
   when the theme flips, so a tap never paints a blank screen. */
const V = '?v=20261013b';
let screen = 'lyrics';
const screens = {
  record:  ['record-light.webp', 'record-dark.webp', 'The real New Recording screen: Velvet Night set to 76 BPM in 6/8, four bars, ready to record'],
  layers:  ['13-stack-layers.webp', 'D6-stack-vocals-dark.webp', 'The real app showing five layers, two made with the helpers and three recorded, each with its own waveform and controls'],
  helper:  ['helper-light.webp', 'helper-dark.webp', 'The real Chord Helper: G, Em, C and D in G major on Tine Piano, with rhythms to choose from and a Vary button'],
  lyrics:  ['recording-lyrics-light.webp', 'recording-lyrics-dark.webp', 'The real lyric editor with chords above words and rhymes colored by sound'],
  chords:  ['chords-light.webp', 'chords-dark.webp', 'The real chord picker: G over the first word, Falling, with a Letter or Roman switch, the Chord Helper chords, and the root, quality and extension keys'],
  perform: ['perform-light.webp', 'perform-dark.webp', 'The real Perform screen with large lyrics and chords for hands-free singing']
};
const heroScreen = $('#sw-hero-screen');
const isDark = () => document.documentElement.dataset.theme === 'dark';
const warmed = new Set();
function warmFile(f) {
  if (warmed.has(f)) return;
  warmed.add(f);
  const im = new Image(); im.decoding = 'async'; im.src = 'assets/' + f + V;
  if (im.decode) im.decode().catch(() => {});
}
function warmTheme() { const i = isDark() ? 1 : 0; Object.values(screens).forEach(s => warmFile(s[i])); }
function setScreen() {
  const s = screens[screen];
  heroScreen.src = 'assets/' + s[isDark() ? 1 : 0] + V;
  heroScreen.alt = s[2];
}
$$('[data-screen]').forEach(b => b.addEventListener('click', () => {
  screen = b.dataset.screen;
  $$('[data-screen]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  setScreen();
}));
function toggleTheme() {
  const dark = !isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('.sw-theme').setAttribute('aria-pressed', String(dark));
  $('.sw-theme').setAttribute('aria-label', dark ? 'Turn on light mode' : 'Turn on dark mode');
  $('#sw-night-switch').innerHTML = (dark ? 'Bring back the daylight' : 'Turn the lights down') + ' <span aria-hidden="true">↗</span>';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#211f1c' : '#f5efe3';
  setScreen();
  warmTheme();
  postBg();
  postHeight();
}
$('.sw-theme').addEventListener('click', toggleTheme);
$('#sw-night-switch').addEventListener('click', toggleTheme);

/* PRICING -------------------------------------------------------------------- */
const plans = {
  year:  ['$29.99', 'a year',  'About $2.50 a month, billed annually.'],
  month: ['$7.99',  'a month', 'Billed monthly. Cancel anytime.'],
  life:  ['$79.99', 'once',    'One payment. No subscription.']
};
$$('[data-billing]').forEach(b => b.addEventListener('click', () => {
  const plan = plans[b.dataset.billing] || plans.year;
  $$('[data-billing]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#sw-price').textContent = plan[0];
  $('#sw-period').textContent = plan[1];
  $('#sw-price-detail').textContent = plan[2];
  /* "Cancel anytime" belongs to the two subscriptions, never to Lifetime */
  const cancel = $('#sw-cancel');
  if (cancel) cancel.hidden = b.dataset.billing === 'life';
  postHeight();
}));

/* REAL RHYME ENGINE ---------------------------------------------------------- */
/* The app's actual phonetic engine (assets/rhyme-engine.js) with the same English
   and Spanish dictionaries. The opening verse arrives already coloured: the
   engine's own result for it is baked in below, so most visitors never download
   the 2 MB dictionary. It loads the moment someone touches the paper or picks a
   language, and from then on every keystroke is coloured live. */
(() => {
  const input = $('#sw-rhyme-input'), mirror = $('#sw-rhyme-mirror');
  const legend = $('.sw-rhyme-legend'), a11y = $('#sw-rhyme-accessible'), statusEl = $('#sw-rhyme-status');
  const title = $('#sw-song-title'), paper = input && input.closest('.sw-lyric-paper');
  if (!input || !mirror) return;

  const DEFAULTS = {
    en: input.value,
    es: 'Cae la noche sobre el mar\nTengo una canción por terminar\nGuardo tu voz en mi canción\nComo una luz en el corazón'
  };
  /* engine.analyze(DEFAULTS.en) with the real engine and English dictionary, 2026-09-28 */
  const BAKED_EN = [{start:27,end:32,group:0},{start:39,end:50,group:0},{start:59,end:65,group:0},{start:71,end:73,group:1},{start:92,end:96,group:1},{start:124,end:128,group:1}];
  const bakedOk = DEFAULTS.en.slice(27, 32) === 'night' && DEFAULTS.en.slice(124, 128) === 'keep';
  let engine = null, lang = 'en', booting = null, timer;
  const loaded = {};
  const ready = () => engine && engine.englishReady() && (lang === 'en' || engine.spanishReady());

  function paint(text, spans) {
    const frag = document.createDocumentFragment();
    const groups = new Map();
    let pos = 0;
    for (const s of spans) {
      if (s.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, s.start)));
      const el = document.createElement('i');
      el.className = 'sw-rg' + (s.group % 12);
      const word = text.slice(s.start, s.end);
      el.textContent = word;
      frag.appendChild(el);
      pos = s.end;
      if (!groups.has(s.group)) groups.set(s.group, []);
      const lw = word.toLowerCase();
      if (!groups.get(s.group).includes(lw)) groups.get(s.group).push(lw);
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    if (text.endsWith('\n') || text === '') frag.appendChild(document.createTextNode('​'));
    mirror.replaceChildren(frag);
    mirror.scrollTop = input.scrollTop;
    if (legend) {
      legend.replaceChildren();
      [...groups].filter(([, w]) => w.length > 1).slice(0, 3).forEach(([group, words]) => {
        const span = document.createElement('span'), dot = document.createElement('i');
        dot.style.background = 'currentColor';
        span.className = 'sw-rg' + (group % 12);
        span.append(dot, document.createTextNode(words.slice(0, 3).join(' / ')));
        legend.append(span);
      });
    }
    if (a11y) {
      const fams = [...groups.values()].filter(w => w.length > 1);
      a11y.textContent = fams.length ? 'Rhyme families: ' + fams.map(w => w.join(', ')).join('; ') : 'No repeated rhyme families yet.';
    }
  }
  function render() {
    const text = input.value;
    if (ready()) return paint(text, engine.analyze(text));
    if (lang === 'en' && bakedOk && text === DEFAULTS.en) return paint(text, BAKED_EN);
    mirror.textContent = text + (text.endsWith('\n') || text === '' ? '​' : '');
    mirror.scrollTop = input.scrollTop;
  }

  input.addEventListener('input', () => { boot(); clearTimeout(timer); timer = setTimeout(render, 90); });
  input.addEventListener('scroll', () => { mirror.scrollTop = input.scrollTop; });

  function loadDict(which) {
    if (loaded[which]) return loaded[which];
    const url = (which === 'es' ? 'assets/rhyme-dict-es.txt' : 'assets/rhyme-dict.txt') + '?v=1';
    loaded[which] = fetch(url).then(r => r.text()).then(txt => {
      const table = engine.parseDict(txt, which);
      if (which === 'es') engine.setSpanish(table); else engine.setEnglish(table);
      render();
    }).catch(() => { loaded[which] = null; });
    return loaded[which];
  }
  function boot() {
    if (!booting) {
      if (paper) paper.classList.add('sw-rhyme-warming');
      booting = import('./assets/rhyme-engine.js?v=1')
        .then(mod => { engine = mod; return loadDict('en'); })
        .catch(() => { if (statusEl) statusEl.textContent = 'The rhyme preview could not load. You can still write here.'; })
        .finally(() => { if (paper) paper.classList.remove('sw-rhyme-warming'); });
    }
    return booting;
  }
  /* the Spanish dictionary only loads for someone who picks ES */
  function ensureLang() {
    return boot().then(() => {
      if (lang === 'es' && engine && !engine.spanishReady()) {
        if (paper) paper.classList.add('sw-rhyme-warming');
        return loadDict('es').finally(() => { if (paper) paper.classList.remove('sw-rhyme-warming'); });
      }
    }).then(render);
  }
  input.addEventListener('focus', boot, { once: true });
  input.addEventListener('pointerdown', boot, { once: true });

  $$('[data-lang]').forEach(b => b.addEventListener('click', () => {
    const next = b.dataset.lang;
    if (next === lang) return;
    lang = next;
    $$('[data-lang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    input.value = DEFAULTS[lang] || input.value;
    input.lang = lang;
    if (title) title.textContent = lang === 'en' ? 'Velvet Night' : 'Una canción por terminar';
    render();
    ensureLang();
    input.focus();
  }));
  render();
})();

/* PLAYABLE MIXER: four real stems from a song idea Clay recorded in Songwriting (Oct 14),
   8 bars of 4/4 at 93 BPM. Each file is exactly one loop, with its effect tail folded
   back onto its start, so the loop has no seam. Loaded on the first play (about 1 MB);
   never records or asks for a microphone. */
const STEMS = ['mixer-1-wurli.m4a', 'mixer-2-bass.m4a', 'mixer-3-kick.m4a', 'mixer-4-vocals.m4a'];
const STEM_V = '?v=20261014e';
const BPM = 93, BEATS_PER_BAR = 4, LOOP_SEC = 910452 / 44100;
/* AAC carries 2112 frames of encoder delay. Browsers that read the file's own trim
   info decode exactly one loop; one that does not keeps the delay, so skip it. */
const AAC_DELAY = 2112 / 44100;
/* the real waveform of each stem, 176 points (0 to 100), drawn to fit each row */
const PEAKS = [
  [34,34,68,56,42,38,33,28,80,69,49,42,31,37,45,35,40,29,25,40,36,27,33,28,41,33,28,42,32,35,70,48,35,51,51,72,74,69,90,57,55,74,73,68,60,49,59,63,51,51,37,33,62,61,57,53,26,47,51,51,58,31,24,59,61,60,39,34,47,50,45,49,27,20,74,71,69,81,69,87,89,61,77,74,67,94,70,51,69,71,74,82,36,39,33,29,38,31,28,31,22,41,41,24,29,24,19,49,40,28,38,30,45,38,34,63,54,54,88,57,76,70,71,78,72,62,75,68,67,81,82,65,70,59,65,71,53,57,39,36,43,44,48,38,27,33,32,33,39,25,22,32,25,42,35,28,70,69,55,57,50,54,89,80,85,78,72,99,100,69,80,69,65,97,86,70],
  [86,61,43,60,64,52,44,33,23,35,44,46,39,22,25,28,29,25,19,12,14,18,19,17,11,11,13,14,14,10,7,8,36,63,57,46,40,48,40,41,27,23,23,24,85,89,76,51,56,72,71,65,44,40,45,57,53,50,32,37,37,39,36,26,18,22,25,27,26,19,15,20,19,18,15,9,31,83,98,93,59,45,61,63,65,55,37,10,70,100,94,66,44,59,63,58,51,43,27,44,58,56,50,19,29,32,31,27,23,16,16,22,23,20,14,12,15,17,15,12,48,50,42,59,57,35,35,38,37,28,21,55,79,79,84,88,61,47,59,66,64,55,48,34,46,61,61,51,33,29,32,35,32,28,14,20,27,28,24,17,14,17,17,17,20,59,59,78,97,98,67,56,69,63,73,80],
  [86,21,14,9,4,97,26,17,11,6,7,99,21,14,9,4,98,26,17,11,6,3,98,21,14,9,4,98,26,17,11,6,3,99,21,14,9,4,98,26,17,11,6,3,99,21,14,9,4,98,26,16,11,6,3,100,21,14,9,4,99,26,17,11,6,3,100,21,14,9,4,98,26,17,11,6,3,100,21,14,9,4,99,26,17,11,6,4,100,21,14,9,4,98,26,17,11,6,3,100,21,14,9,4,97,26,17,11,6,3,99,21,14,9,4,99,26,17,11,6,3,100,21,14,9,4,98,26,17,11,6,3,100,21,14,9,4,98,26,17,11,6,3,100,21,14,9,4,98,26,17,11,6,3,100,21,14,9,4,98,26,17,11,6,5,99,21,14,9,4,98,26,17,11,6,3],
  [24,27,29,28,29,31,30,29,36,34,32,66,58,58,59,58,42,47,45,45,45,44,44,38,32,23,21,17,19,18,20,19,41,51,59,64,69,58,50,56,54,59,59,49,36,44,35,31,28,27,28,30,25,24,26,95,59,52,53,44,36,40,41,38,36,25,33,21,27,31,24,96,100,70,61,50,45,37,71,69,54,60,50,50,46,46,65,51,43,22,25,26,31,33,32,32,32,33,70,77,76,64,57,73,40,67,85,54,36,52,43,32,32,26,31,33,24,23,25,30,68,87,58,57,61,47,61,54,43,47,67,51,47,25,22,22,43,50,46,29,36,38,40,77,78,81,70,75,86,74,81,98,71,73,70,67,58,54,51,56,42,47,46,57,71,83,93,79,65,93,52,61,79,75,54,30]
];
function drawWaves() {
  $$('[data-wave]').forEach(w => {
    const p = PEAKS[Number(w.dataset.wave)]; if (!p) return;
    const n = Math.max(12, Math.min(88, Math.floor((w.clientWidth || 360) / 5)));
    if (w.childElementCount === n) return;
    w.textContent = '';
    for (let i = 0; i !== n; i++) {
      const a = Math.floor(i * p.length / n), b = Math.max(a + 1, Math.floor((i + 1) * p.length / n));
      const v = Math.max(...p.slice(a, b));
      const bar = document.createElement('i');
      bar.style.setProperty('--bar', `${4 + v * 0.32}px`);
      w.append(bar);
    }
  });
}
drawWaves();
let waveTimer = 0;
addEventListener('resize', () => { clearTimeout(waveTimer); waveTimer = setTimeout(drawWaves, 150); });

let ctx, master, gains, buffers = null, loading = null, playing = false, sources = [], t0 = 0, beatTimer = 0, lastBeat = -1;
const activeTrk = [true, true, true, true], trackNames = ['Wurli', 'Bass', 'Kick', 'Vocals'];
const mixer = $('#sw-mixer'), play = $('#sw-play'), statusA = $('#sw-audio-status');
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw Error('Audio is unavailable in this browser');
  ctx = new AC(); master = ctx.createGain(); master.gain.value = Number($('#sw-volume').value) / 100; master.connect(ctx.destination);
  gains = activeTrk.map(on => { const g = ctx.createGain(); g.gain.value = on ? 1 : 0; g.connect(master); return g; });
}
function loadStems() {
  if (!loading) {
    loading = Promise.all(STEMS.map(f => fetch('assets/mixer/' + f + STEM_V)
      .then(r => { if (!r.ok) throw Error(f); return r.arrayBuffer(); })
      .then(data => new Promise((ok, bad) => ctx.decodeAudioData(data, ok, bad)))))
      .then(b => { buffers = b; return b; })
      .catch(e => { loading = null; throw e; });
  }
  return loading;
}
function tickBeat() {
  const t = ctx.currentTime - t0; if (0 > t) return;
  const beat = Math.floor((t % LOOP_SEC) / (60 / BPM)) % BEATS_PER_BAR;
  if (beat === lastBeat) return;
  lastBeat = beat;
  $$('.sw-beats i').forEach((el, i) => el.classList.toggle('active', i === beat));
}
function startLoop() {
  const when = ctx.currentTime + 0.08;
  sources = buffers.map((b, i) => {
    const s = ctx.createBufferSource(), off = (b.duration - LOOP_SEC) > 0.03 ? AAC_DELAY : 0;
    s.buffer = b; s.loop = true; s.loopStart = off; s.loopEnd = off + LOOP_SEC;
    s.connect(gains[i]); s.start(when, off);
    return s;
  });
  t0 = when; lastBeat = -1;
  beatTimer = setInterval(tickBeat, 25);
}
function stopAudio() {
  playing = false; clearInterval(beatTimer);
  for (const s of sources) { try { s.stop(); } catch {} s.disconnect(); } sources = [];
  if (mixer) mixer.dataset.playing = 'false';
  if (play) { play.setAttribute('aria-pressed', 'false'); play.setAttribute('aria-label', 'Play demo loop'); play.innerHTML = '<span aria-hidden="true">▶</span>'; }
  $$('.sw-beats i').forEach(i => i.classList.remove('active'));
  if (statusA) statusA.textContent = 'Press play. Tap a layer to make it yours.';
}
if (play) {
  let starting = false;
  /* start fetching the moment someone reaches for play, so the first press is quick */
  const warm = () => { try { if (!ctx) initAudio(); loadStems().catch(() => {}); } catch {} };
  play.addEventListener('pointerenter', warm, { once: true });
  play.addEventListener('touchstart', warm, { once: true, passive: true });
  play.addEventListener('focus', warm, { once: true });
  play.addEventListener('click', async () => {
    if (playing) { stopAudio(); return; }
    if (starting) return; starting = true;
    try {
      if (!ctx) initAudio(); await ctx.resume();
      if (!buffers) { statusA.textContent = 'Loading the song…'; await loadStems(); }
      playing = true; startLoop();
      mixer.dataset.playing = 'true'; mixer.style.setProperty('--loop-time', `${LOOP_SEC}s`);
      play.setAttribute('aria-pressed', 'true'); play.setAttribute('aria-label', 'Pause demo loop'); play.innerHTML = '<span aria-hidden="true">Ⅱ</span>';
      statusA.textContent = 'Looping. Tap any layer to bring it in or out.';
    } catch (e) { playing = false; statusA.textContent = 'Sound couldn’t start. Try another browser or press play again.'; }
    finally { starting = false; }
  });
}
$$('[data-track]').forEach(b => b.addEventListener('click', () => {
  const i = Number(b.dataset.track); activeTrk[i] = !activeTrk[i];
  b.setAttribute('aria-pressed', String(activeTrk[i]));
  b.setAttribute('aria-label', `${trackNames[i]} layer, ${activeTrk[i] ? 'on; click to mute' : 'muted; click to enable'}`);
  b.querySelector('.sw-track-state').textContent = activeTrk[i] ? 'On' : 'Off';
  if (ctx) gains[i].gain.setTargetAtTime(activeTrk[i] ? 1 : 0, ctx.currentTime, .025);
}));
const volEl = $('#sw-volume');
if (volEl) volEl.addEventListener('input', e => { if (ctx) master.gain.setTargetAtTime(Number(e.target.value) / 100, ctx.currentTime, .03); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stopAudio(); });
window.addEventListener('pagehide', stopAudio);

/* SPEED PASS: a light first paint, and nothing pops in later.
   · The hero's first screen is preloaded in the head (same URL as the img).
   · The other hero screens in the current theme are fetched once the page is
     idle, or the moment someone reaches for the picker. The other theme's set
     waits for a theme flip. On a phone that keeps about 350 KB out of the load.
   · Every image decodes off the main thread as it arrives. Files are untouched. */
(() => {
  const idle = cb => ('requestIdleCallback' in window) ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500);
  const start = () => idle(warmTheme);
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  const picker = $('.sw-screen-picker');
  if (picker) ['pointerenter', 'touchstart', 'focusin'].forEach(ev => picker.addEventListener(ev, warmTheme, { once: true, passive: true }));
  $$('img').forEach(im => {
    const warm = () => { if (im.decode) im.decode().catch(() => {}); };
    if (im.complete) warm(); else im.addEventListener('load', warm, { once: true });
  });
})();

/* FAQ toggles change page height */
$$('.sw-faq details').forEach(d => d.addEventListener('toggle', postHeight));

/* HEIGHT + THEME to host, on every layout change ----------------------------- */
if (IS_EMBEDDED) {
  try { new ResizeObserver(() => postHeight()).observe(document.documentElement); } catch {}
  addEventListener('load', () => { postBg(); postHeight(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(postHeight);
  $$('img').forEach(im => { if (!im.complete) im.addEventListener('load', postHeight, { once: true }); });
  postBg(); postHeight();
  requestAnimationFrame(postHeight);
}
})();
