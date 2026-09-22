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
let screen = 'lyrics';
const screens = {
  layers: ['13-stack-layers.webp', 'D6-stack-vocals-dark.webp', 'The real app showing four recorded layers with individual waveforms and controls'],
  lyrics: ['recording-lyrics-light.webp', 'recording-lyrics-dark.webp', 'The real lyric editor with chords above words and rhymes colored by sound'],
  perform: ['perform-light.webp', 'perform-dark.webp', 'The real Perform screen with large lyrics and chords for hands-free singing']
};
const heroScreen = $('#sw-hero-screen');
function setScreen() {
  const s = screens[screen], dark = document.documentElement.dataset.theme === 'dark';
  heroScreen.src = 'assets/' + s[dark ? 1 : 0];
  heroScreen.alt = s[2];
}
$$('[data-screen]').forEach(b => b.addEventListener('click', () => {
  screen = b.dataset.screen;
  $$('[data-screen]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  setScreen();
}));
function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('.sw-theme').setAttribute('aria-pressed', String(dark));
  $('.sw-theme').setAttribute('aria-label', dark ? 'Turn on light mode' : 'Turn on dark mode');
  $('#sw-night-switch').innerHTML = (dark ? 'Bring back the daylight' : 'Turn the lights down') + ' <span aria-hidden="true">↗</span>';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#211f1c' : '#f5efe3';
  setScreen();
  postBg();
  postHeight();
}
$('.sw-theme').addEventListener('click', toggleTheme);
$('#sw-night-switch').addEventListener('click', toggleTheme);

/* PRICING -------------------------------------------------------------------- */
$$('[data-billing]').forEach(b => b.addEventListener('click', () => {
  const year = b.dataset.billing === 'year';
  $$('[data-billing]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#sw-price').textContent = year ? '$29.99' : '$7.99';
  $('#sw-period').textContent = year ? 'a year' : 'a month';
  $('#sw-price-detail').textContent = year ? 'About $2.50 a month, billed annually.' : 'Billed monthly. Cancel anytime.';
  postHeight();
}));

/* REAL RHYME ENGINE ---------------------------------------------------------- */
/* The app's actual phonetic engine (assets/rhyme-engine.js) + the same English /
   Spanish dictionaries the live page has always used, loaded lazily so the hero
   stays fast. Not the preview's 5.8 MB embedded copy. */
(() => {
  const input = $('#sw-rhyme-input'), mirror = $('#sw-rhyme-mirror');
  const legend = $('.sw-rhyme-legend'), a11y = $('#sw-rhyme-accessible'), statusEl = $('#sw-rhyme-status');
  const title = $('#sw-song-title'), paper = input && input.closest('.sw-lyric-paper');
  if (!input || !mirror) return;

  const DEFAULTS = {
    en: input.value,
    es: 'Cae la noche sobre el mar\nTengo una canción por terminar\nGuardo tu voz en mi canción\nComo una luz en el corazón'
  };
  let engine = null, lang = 'en', booted = false, timer;
  const loaded = {};
  const ready = () => engine && engine.englishReady() && (lang === 'en' || engine.spanishReady());

  function render() {
    const text = input.value;
    if (!ready()) {
      mirror.textContent = text + (text.endsWith('\n') || text === '' ? '​' : '');
      mirror.scrollTop = input.scrollTop;
      return;
    }
    const spans = engine.analyze(text);
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

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 90); });
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
    if (booted) return; booted = true;
    if (paper) paper.classList.add('sw-rhyme-warming');
    import('./assets/rhyme-engine.js?v=1')
      .then(mod => { engine = mod; return loadDict('en'); })
      .then(() => { if (paper) paper.classList.remove('sw-rhyme-warming'); })
      .catch(() => {
        if (paper) paper.classList.remove('sw-rhyme-warming');
        if (statusEl) statusEl.textContent = 'The rhyme preview could not load. You can still write here.';
      });
  }
  /* lazy: boot as the lyric box nears the viewport, or the moment it's touched */
  scrollHandlers.push(() => { if (!booted && relTop(input) < vpH() + 900) boot(); });
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
    if (!booted) { boot(); }
    else if (lang === 'es' && engine && !engine.spanishReady()) {
      if (paper) paper.classList.add('sw-rhyme-warming');
      loadDict('es').then(() => { if (paper) paper.classList.remove('sw-rhyme-warming'); });
    } else render();
    input.focus();
  }));
  render();
})();

/* PLAYABLE MIXER — synthesized illustrative arrangement, never records or asks
   for a microphone. */
$$('[data-wave]').forEach(w => {
  const k = Number(w.dataset.wave);
  for (let i = 0; i < 88; i++) {
    const bar = document.createElement('i');
    bar.style.setProperty('--bar', `${5 + Math.abs(Math.sin(i * (.54 + k * .08)) * Math.cos(i * .31 + k)) * 31}px`);
    w.append(bar);
  }
});
let ctx, master, gains, noiseBuffer, playing = false, timer2, step = 0, nextTime = 0, bpm = 84, beatTimeouts = [], nodes = new Set();
const activeTrk = [true, true, true, true], trackNames = ['Keys', 'Bass', 'Melody', 'Percussion'];
const mixer = $('#sw-mixer'), play = $('#sw-play'), statusA = $('#sw-audio-status');
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw Error('Audio is unavailable in this browser');
  ctx = new AC(); master = ctx.createGain(); master.gain.value = Number($('#sw-volume').value) / 100; master.connect(ctx.destination);
  gains = activeTrk.map(on => { const g = ctx.createGain(); g.gain.value = on ? 1 : 0; g.connect(master); return g; });
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * .12, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}
function tone(midi, time, duration, volume, layer, type = 'sine') {
  const osc = ctx.createOscillator(), env = ctx.createGain(); osc.type = type;
  osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(volume, time + .014); env.gain.exponentialRampToValueAtTime(.0001, time + duration);
  osc.connect(env); env.connect(gains[layer]); osc.start(time); osc.stop(time + duration + .03);
  nodes.add(osc); osc.onended = () => { nodes.delete(osc); osc.disconnect(); env.disconnect(); };
}
function percussion(time, kick) {
  if (kick) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.setValueAtTime(90, time); osc.frequency.exponentialRampToValueAtTime(42, time + .14);
    g.gain.setValueAtTime(.24, time); g.gain.exponentialRampToValueAtTime(.0001, time + .24);
    osc.connect(g); g.connect(gains[3]); osc.start(time); osc.stop(time + .25);
    nodes.add(osc); osc.onended = () => { nodes.delete(osc); osc.disconnect(); g.disconnect(); };
  } else {
    const n = ctx.createBufferSource(), g = ctx.createGain(), filter = ctx.createBiquadFilter();
    n.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = 6200;
    g.gain.setValueAtTime(.045, time); g.gain.exponentialRampToValueAtTime(.0001, time + .08);
    n.connect(filter); filter.connect(g); g.connect(gains[3]); n.start(time);
    nodes.add(n); n.onended = () => { nodes.delete(n); n.disconnect(); filter.disconnect(); g.disconnect(); };
  }
}
const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]];
const melody = [76, null, 79, null, 74, null, 72, null, 76, null, 72, null, 71, null, 69, null, 72, null, 76, null, 79, null, 76, null, 74, null, 71, null, 67, null, 71, null];
function schedule() {
  while (playing && nextTime < ctx.currentTime + .13) {
    const s = step % 32, beat = 60 / bpm, chord = chords[Math.floor(s / 8)];
    if (s % 8 === 0) { chord.forEach((note, i) => tone(note, nextTime + i * .018, beat * 3.9, .045, 0, 'triangle')); }
    if (s % 4 === 0) tone(chord[0] - 12, nextTime, beat * 1.85, .19, 1);
    if (melody[s] !== null) tone(melody[s], nextTime, beat * .85, .065, 2);
    percussion(nextTime, s % 4 === 0);
    if (s % 2 === 0) {
      const n = (s / 2) % 4;
      const id = setTimeout(() => { if (playing) $$('.sw-beats i').forEach((el, i) => el.classList.toggle('active', i === n)); beatTimeouts = beatTimeouts.filter(x => x !== id); }, Math.max(0, (nextTime - ctx.currentTime) * 1000));
      beatTimeouts.push(id);
    }
    nextTime += beat / 2; step++;
  }
}
function stopAudio() {
  playing = false; clearInterval(timer2); beatTimeouts.forEach(clearTimeout); beatTimeouts = [];
  for (const n of nodes) { try { n.stop(); } catch {} } nodes.clear();
  if (mixer) mixer.dataset.playing = 'false';
  if (play) { play.setAttribute('aria-pressed', 'false'); play.setAttribute('aria-label', 'Play demo loop'); play.innerHTML = '<span aria-hidden="true">▶</span>'; }
  $$('.sw-beats i').forEach(i => i.classList.remove('active'));
  if (statusA) statusA.textContent = 'Press play. Tap a layer to make it yours.';
}
if (play) {
  let starting = false;
  play.addEventListener('click', async () => {
    if (playing) { stopAudio(); return; }
    if (starting) return; starting = true;
    try {
      if (!ctx) initAudio(); await ctx.resume();
      playing = true; step = 0; nextTime = ctx.currentTime + .06;
      mixer.dataset.playing = 'true'; mixer.style.setProperty('--loop-time', `${60 / bpm * 16}s`);
      play.setAttribute('aria-pressed', 'true'); play.setAttribute('aria-label', 'Pause demo loop'); play.innerHTML = '<span aria-hidden="true">Ⅱ</span>';
      statusA.textContent = 'Looping. Tap any layer to bring it in or out.';
      schedule(); timer2 = setInterval(schedule, 25);
    } catch (e) { statusA.textContent = 'Sound couldn’t start. Try another browser or press play again.'; }
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
const tempoEl = $('#sw-tempo');
if (tempoEl) tempoEl.addEventListener('input', e => { bpm = Number(e.target.value); $('#sw-bpm').textContent = `${bpm} BPM`; if (mixer) mixer.style.setProperty('--loop-time', `${60 / bpm * 16}s`); });
const volEl = $('#sw-volume');
if (volEl) volEl.addEventListener('input', e => { if (ctx) master.gain.setTargetAtTime(Number(e.target.value) / 100, ctx.currentTime, .03); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stopAudio(); });
window.addEventListener('pagehide', stopAudio);

/* SPEED PASS — nothing pops in. Every screenshot the hero can show (three screens,
   both themes) is fetched and decoded up front, and every image on the page is
   decoded off-thread as it arrives, so a scroll, a screen switch or a theme flip
   never paints a blank. Lossless: the files themselves are untouched. */
(() => {
  const warm = im => { if (im.decode) im.decode().catch(() => {}); };
  const start = () => {
    Object.values(screens).forEach(([light, dark]) => [light, dark].forEach(f => {
      const im = new Image(); im.src = 'assets/' + f; warm(im);
    }));
    $$('img').forEach(im => { if (im.complete) warm(im); else im.addEventListener('load', () => warm(im), { once: true }); });
  };
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
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
