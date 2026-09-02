/* Hook — v2 preview. Standalone document (it is the scroller), so sticky, fixed and svh
   all behave. Everything degrades: no JS → static page; reduced motion → no animation. */

const doc = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse  = matchMedia("(pointer: coarse)").matches;
const THEME_BG = { light: "#F6EFE4", dark: "#15100A" };
const themeMeta = document.querySelector('meta[name="theme-color"]');
let userTouchedTheme = false;

/* ---------- smooth scroll: inertial on desktop, native on touch ---------- */
let lenis = null;
if (!reduced && !coarse && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* ---------- one scroll pipe for everything that follows the page ---------- */
/* Lenis drives the native scroll position, so the native scroll event is the one source
   of truth in both modes — and it keeps firing even when frames are throttled. */
const scrollHandlers = [];
function tick() { const y = window.scrollY || 0; for (const h of scrollHandlers) h(y); }
addEventListener("scroll", tick, { passive: true });
addEventListener("resize", tick);

/* in-page links glide */
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href"); if (!id || id.length < 2) return;
  const t = document.querySelector(id); if (!t) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(t, { offset: -76, duration: 1.15 });
  else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}));

/* ---------- nav: the menubar rides along; gets a hairline once you've scrolled ---------- */
const nav = document.getElementById("nav");
scrollHandlers.push(y => nav && nav.classList.toggle("scrolled", y > 8));

/* ---------- mobile: the CTA rides at the bottom once the hero is gone ---------- */
(() => {
  const mob = document.getElementById("mobCta"), hero = document.querySelector(".hero");
  if (!mob || !hero) return;
  let shown = false;
  scrollHandlers.push(() => {
    const past = hero.getBoundingClientRect().bottom < 0;   /* the hero (and its own CTA) is behind you */
    if (past === shown) return;
    shown = past;
    mob.classList.toggle("show", past);
    mob.setAttribute("aria-hidden", String(!past));
    const a = mob.querySelector("a"); if (a) a.tabIndex = past ? 0 : -1;
  });
})();

/* ---------- hero entrance: stagger order for the CSS rise ---------- */
document.querySelectorAll(".rise").forEach((el, i) => el.style.setProperty("--i", i));

/* ---------- reveal on approach — scroll-driven, so it never lags behind the page ---------- */
(() => {
  const els = [...document.querySelectorAll(".reveal")];
  if (reduced) { els.forEach(el => el.classList.add("in")); return; }
  let pending = els;
  function reveal() {
    if (!pending.length) return;
    const limit = innerHeight * 0.93;
    pending = pending.filter(el => {
      if (el.getBoundingClientRect().top < limit) { el.classList.add("in"); return false; }
      return true;
    });
  }
  scrollHandlers.push(reveal);
  reveal();
})();

/* ---------- reading light: long-form paragraphs sit faint and the ink settles as they
   enter the reading zone (a band ~18–70% down the viewport), tracking the scroll. ---------- */
(() => {
  const els = [...document.querySelectorAll(".rl")];
  if (!els.length) return;
  function light() {
    const vh = innerHeight, top = vh * 0.16, bot = vh * 0.68, ramp = vh * 0.24;
    for (const el of els) {
      const r = el.getBoundingClientRect(), c = r.top + r.height / 2;
      let o = 1;
      if (c < top) o = 1 - Math.min(1, (top - c) / ramp);
      else if (c > bot) o = 1 - Math.min(1, (c - bot) / ramp);
      el.style.opacity = (0.28 + 0.72 * o).toFixed(3);
    }
  }
  scrollHandlers.push(light);
  light();
})();

/* ---------- theme + nightfall ---------- */
function setTheme(t, persist) {
  doc.setAttribute("data-theme", t);
  if (themeMeta) themeMeta.setAttribute("content", THEME_BG[t]);
  const lab = document.getElementById("nfLabel");
  if (lab) lab.textContent = t === "dark" ? "Turn off dark mode" : "Turn on dark mode";
  if (persist) userTouchedTheme = true;
}
function cinema(t, persist, ms) {
  doc.classList.add("theme-cinema"); setTheme(t, persist);
  setTimeout(() => doc.classList.remove("theme-cinema"), ms);
}
setTheme("light", false);
document.getElementById("themeToggle")?.addEventListener("click", () => {
  cinema(doc.getAttribute("data-theme") === "dark" ? "light" : "dark", true, 1300);
});
/* the page dips to dark exactly where the copy says 4am — driven by scroll position, so it
   lands on the line every time (observers can lag in throttled tabs) */
(() => {
  const problem = document.getElementById("problem");
  if (!problem) return;
  let done = false;
  function check() {
    if (done) return;
    const r = problem.getBoundingClientRect();
    if (r.top < innerHeight * 0.55) {
      done = true;
      if (userTouchedTheme || doc.getAttribute("data-theme") === "dark") return;
      cinema("dark", false, reduced ? 0 : 1700);
    }
  }
  scrollHandlers.push(check);
  check();
})();

/* ---------- walkthrough: the phone stays, the steps scroll, the screen follows ---------- */
(() => {
  const imgs = [...document.querySelectorAll("#walkPhone img")];
  const steps = [...document.querySelectorAll(".walk-step")];
  if (!imgs.length || !steps.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const s = e.target.dataset.step;
    imgs.forEach(im => im.classList.toggle("on", im.dataset.step === s));
    steps.forEach(st => st.classList.toggle("active", st === e.target));
  }), { threshold: 0.55 });
  steps.forEach(s => io.observe(s));
})();

/* ---------- hero phone: the app in use. Cycles real screens; a real recording at
   ../assets/hook-demo.mp4 takes the slot over if it exists. ---------- */
(() => {
  const phone = document.getElementById("heroPhone"); if (!phone) return;
  const vid = document.getElementById("heroVideo");
  const imgs = [...phone.querySelectorAll("img[data-cycle]")];
  const cap = document.getElementById("heroCap");
  const CAPS = ["Words & chords", "Set the feel", "Counted in", "Stack your layers"];
  let i = 0, timer = null, visible = true;
  const show = n => { i = n; imgs.forEach(im => im.classList.toggle("on", +im.dataset.cycle === n)); if (cap) cap.textContent = CAPS[n]; };
  /* only wire the video if the file is actually there (a fetch HEAD keeps the console clean) */
  if (vid) fetch("../assets/hook-demo.mp4", { method: "HEAD" }).then(r => {
    if (!r.ok) return;
    vid.addEventListener("loadeddata", () => {
      vid.hidden = false; phone.classList.add("has-video");
      if (timer) { clearInterval(timer); timer = null; }
      vid.play().catch(() => {});
      if (cap) cap.textContent = "Hook, in use";
    });
    vid.src = "../assets/hook-demo.mp4";
  }).catch(() => {});
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); }, { threshold: 0.2 }).observe(phone);
  if (!reduced) timer = setInterval(() => { if (visible && !phone.classList.contains("has-video")) show((i + 1) % CAPS.length); }, 3600);
})();

/* ---------- THE SIGNATURE: hold to catch ----------
   Press and hold the record button: it counts you in (a click per beat, the ring fills a bar).
   Let go: the take is caught and it loops. Hold again: a new layer rings the button in the
   app's colors and adds a voice, so five layers build a chord. Sound is Web Audio,
   synthesized, mutable; visuals work without it. ---------- */
(() => {
  const btn = document.getElementById("recBtn"); if (!btn) return;
  const ring = document.getElementById("ringFill");
  const ringsG = document.getElementById("layerRings");
  const beats = [...document.querySelectorAll("#beats circle")];
  const tTime = document.getElementById("tapeTime"), tTake = document.getElementById("tapeTake"), tDot = document.getElementById("tapeDot");
  const hint = document.getElementById("catchHint");
  const muteBtn = document.getElementById("muteBtn"), clearBtn = document.getElementById("clearBtn");

  const C = 2 * Math.PI * 72;
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C;
  const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4, MAX = 5;
  const COLORS = ["#B86A4A", "#D9A24C", "#7E9B67", "#A9668E", "#7B94A6"];   /* the app's layer colors */
  const NOTES  = [130.81, 196.00, 329.63, 493.88, 587.33];                 /* C3 G3 E4 B4 D5 — a Cmaj9 that fills in as you stack */
  const IDLE = "Hold to catch. Let go and it loops. Hold again to stack a layer.";

  let ctx = null, master = null, soundOn = true;
  let holding = false, holdStart = 0, lastBeat = -1, loopStart = 0, layers = [], raf = 0;

  function audio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = soundOn ? 0.5 : 0; master.connect(ctx.destination);
    return ctx;
  }
  function click(accent) {
    if (!ctx || !soundOn) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.45 : 0.28, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
  }
  function voice(n) {
    if (!ctx) return null;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter();
    const g = ctx.createGain(), p = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "triangle"; o.frequency.value = NOTES[n];
    o2.type = "sine";     o2.frequency.value = NOTES[n] * 2.004;             /* a whisper of octave shimmer */
    f.type = "lowpass";   f.frequency.value = 880 + n * 220; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.55);
    lfo.type = "sine"; lfo.frequency.value = 1 / BAR; lg.gain.value = 0.07;   /* breathes once a bar, like a loop */
    p.gain.value = 0.9; lfo.connect(lg).connect(p.gain);
    o.connect(f); o2.connect(f); f.connect(g).connect(p).connect(master);
    o.start(t); o2.start(t); lfo.start(t);
    return { stop() {
      const t2 = ctx.currentTime;
      g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t2);
      g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.45);
      o.stop(t2 + 0.5); o2.stop(t2 + 0.5); lfo.stop(t2 + 0.5);
    } };
  }
  const fmt = s => { const m = Math.floor(s / 60), r = s % 60; return String(m).padStart(2, "0") + ":" + r.toFixed(1).padStart(4, "0"); };

  function frame() {
    const t = performance.now() / 1000;
    if (holding) {
      const el = t - holdStart, prog = (el % BAR) / BAR, b = Math.floor(el / BEAT);
      ring.style.strokeDashoffset = reduced ? 0 : C * (1 - prog);
      if (b !== lastBeat) { lastBeat = b; const bi = b % 4; beats.forEach((c, i) => c.classList.toggle("hit", i === bi)); click(bi === 0); }
      tTime.textContent = fmt(el);
    } else if (layers.length) {
      const b = Math.floor((t - loopStart) / BEAT) % 4;
      if (b !== lastBeat) { lastBeat = b; beats.forEach((c, i) => c.classList.toggle("hit", i === b)); }
    }
    raf = (holding || layers.length) ? requestAnimationFrame(frame) : 0;
  }
  function startHold() {
    if (holding || layers.length >= MAX) return;
    audio();
    holding = true; holdStart = performance.now() / 1000; lastBeat = -1;
    btn.setAttribute("aria-pressed", "true"); btn.classList.add("holding"); tDot.classList.add("live");
    hint.textContent = "Counting you in… let go when you've got it.";
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function endHold() {
    if (!holding) return;
    holding = false;
    const len = performance.now() / 1000 - holdStart;
    btn.setAttribute("aria-pressed", "false"); btn.classList.remove("holding"); tDot.classList.remove("live");
    ring.style.strokeDashoffset = C; beats.forEach(c => c.classList.remove("hit"));
    if (len < 0.35) { hint.textContent = "Hold it a little longer — give it a bar."; if (!layers.length) tTime.textContent = "00:00.0"; return; }
    catchLayer(len);
  }
  function catchLayer(len) {
    const n = layers.length; if (n >= MAX) return;
    if (!n) loopStart = performance.now() / 1000;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "160"); c.setAttribute("cy", "160"); c.setAttribute("r", String(92 + n * 14));
    c.setAttribute("class", "layer"); c.style.stroke = COLORS[n]; c.style.setProperty("--d", BAR + "s");
    ringsG.appendChild(c);
    layers.push({ el: c, v: voice(n) });
    tTake.textContent = "TAKE " + (n + 1) + (n ? "  ·  " + (n + 1) + " layers" : "");
    tTime.textContent = fmt(len);
    clearBtn.hidden = false;
    hint.textContent = (n + 1 >= MAX) ? "Five layers deep. That's a song — go export it."
                     : (n === 0 ? "Looping. Hold again to stack a layer." : "Stacked. Hold again for another.");
    btn.classList.toggle("full", n + 1 >= MAX);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function clearAll() {
    layers.forEach(l => { l.v && l.v.stop(); l.el.remove(); }); layers = [];
    tTake.textContent = "no takes yet"; tTime.textContent = "00:00.0"; clearBtn.hidden = true;
    btn.classList.remove("full"); beats.forEach(c => c.classList.remove("hit")); hint.textContent = IDLE;
  }

  btn.addEventListener("pointerdown", e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) {} startHold(); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => btn.addEventListener(ev, endHold));
  btn.addEventListener("contextmenu", e => e.preventDefault());
  btn.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startHold(); } });
  btn.addEventListener("keyup",   e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); endHold(); } });
  muteBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    muteBtn.setAttribute("aria-pressed", String(soundOn)); muteBtn.textContent = soundOn ? "Sound on" : "Sound off";
    if (master && ctx) master.gain.setTargetAtTime(soundOn ? 0.5 : 0, ctx.currentTime, 0.05);
  });
  clearBtn.addEventListener("click", clearAll);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else if (layers.length) ctx.resume().catch(() => {});
  });
})();

/* ---------- live rhyme demo — the app's REAL rhyme engine (ported from the live page) ---------- */
(() => {
  const demo = document.getElementById("rhymeDemo");
  const input = document.getElementById("rhymeInput");
  const mirror = document.getElementById("rhymeMirror");
  if (!demo || !input || !mirror) return;

  const DEFAULTS = { en: input.value, es: (demo.getAttribute("data-es") || "").replace(/\\n/g, "\n") };
  let engine = null, lang = "en";
  const loaded = {};
  const ready = () => engine && engine.englishReady() && (lang === "en" || engine.spanishReady());

  function render() {
    const text = input.value;
    if (!ready()) {
      mirror.textContent = text;
      if (text.endsWith("\n") || text === "") mirror.appendChild(document.createTextNode("​"));
      return;
    }
    const spans = engine.analyze(text);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const s of spans) {
      if (s.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, s.start)));
      const el = document.createElement("i");
      el.className = "rg" + (s.group % 12);
      el.textContent = text.slice(s.start, s.end);
      frag.appendChild(el);
      pos = s.end;
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    if (text.endsWith("\n") || text === "") frag.appendChild(document.createTextNode("​"));
    mirror.replaceChildren(frag);
  }
  input.addEventListener("input", render);
  input.addEventListener("scroll", () => { mirror.scrollTop = input.scrollTop; });

  function loadDict(which) {
    if (loaded[which]) return loaded[which];
    const url = (which === "es" ? "../assets/rhyme-dict-es.txt" : "../assets/rhyme-dict.txt") + "?v=1";
    loaded[which] = fetch(url).then(r => r.text()).then(txt => {
      const table = engine.parseDict(txt, which);
      if (which === "es") engine.setSpanish(table); else engine.setEnglish(table);
      render();
    }).catch(() => { loaded[which] = null; });
    return loaded[which];
  }
  let booted = false;
  function boot() {
    if (booted) return; booted = true;
    demo.classList.add("rhyme-warming");
    import("../assets/rhyme-engine.js?v=1")
      .then(mod => { engine = mod; return loadDict("en"); })
      .then(() => {
        demo.classList.remove("rhyme-warming");
        const idle = window.requestIdleCallback || (f => setTimeout(f, 1500));
        idle(() => { if (engine) loadDict("es"); });
      })
      .catch(() => demo.classList.remove("rhyme-warming"));
  }
  /* boot when the demo is within ~900px of the viewport — checked on scroll (never lags),
     and immediately on any interaction with the box */
  const near = () => { if (!booted && demo.getBoundingClientRect().top < innerHeight + 900) boot(); };
  scrollHandlers.push(near);
  near();
  input.addEventListener("focus", boot, { once: true });

  const btns = [...demo.querySelectorAll(".rhyme-lang button")];
  btns.forEach(b => b.addEventListener("click", () => {
    const next = b.getAttribute("data-lang");
    if (next === lang) return;
    lang = next;
    btns.forEach(x => x.setAttribute("aria-pressed", x.getAttribute("data-lang") === lang ? "true" : "false"));
    input.value = DEFAULTS[lang] || input.value;
    input.setAttribute("lang", lang);
    if (lang === "es" && engine && !engine.spanishReady()) {
      demo.classList.add("rhyme-warming");
      loadDict("es").then(() => demo.classList.remove("rhyme-warming"));
    } else render();
    input.focus();
  }));
  render();
})();

/* kick everything that follows the page once, so first paint is right */
tick();
