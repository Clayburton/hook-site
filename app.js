/* Hook — runs two ways.
   STANDALONE (this document is the scroller): sticky nav, Lenis smooth scroll, native scroll events.
   EMBEDDED (inside clayandkelsy.com's auto-growing iframe, which never scrolls itself): the host
   posts its viewport ({hookHost:"vp", top, vh}) on every scroll; everything that follows the page
   measures against that; the nav is pinned by JS and only shows once the C&K menu bar has
   scrolled away; we post our height and theme color back up so the frame fits and the page
   behind it matches. Everything degrades: no JS → static page; reduced motion → no animation. */
/* Reusable on any C&K page: everything down to the hold-to-catch block (viewport pipe, nav, reveals,
   reading light, theme + nightfall, walkthrough, height posting). Hook-only: hold-to-catch, hero phone,
   rhyme demo. Blocks are marked  ---------- name ----------  in block comments, so you can grep for them. */

const doc = document.documentElement;
const IS_EMBEDDED = window.self !== window.top;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse  = matchMedia("(pointer: coarse)").matches;
const NAV_H = 64;
const THEME_BG = { light: "#F6EFE4", dark: "#15100A" };
const themeMeta = document.querySelector('meta[name="theme-color"]');
let userTouchedTheme = false;
if (IS_EMBEDDED) document.body.classList.add("embedded");

/* ---------- the viewport we measure against ----------
   Embedded: host.top = the frame's top edge in the host viewport (positive while the C&K header
   is above us, negative once we've scrolled past the top), host.vh = the host viewport height.
   An element's position relative to the host viewport is its frame position + host.top. */
const host = { top: 0, vh: 0, top0: null, ready: false, nav: false, vel: 0, t: 0, settle: 0 };   /* nav: the host draws the menu bar itself */
/* Pinned things (the nav, the walkthrough phone) are placed from host messages that arrive a frame or two after the
   host has already scrolled, which reads as jitter. lead() predicts where the host will be by the time we paint,
   from the scroll velocity; when scrolling stops the velocity is zeroed so everything settles exactly. */
const LEAD_MS = 24;
const lead = () => host.vel * LEAD_MS;
const vpH   = () => IS_EMBEDDED ? (host.vh || 800) : innerHeight;
const vpTop = () => IS_EMBEDDED ? Math.max(0, -host.top) : (window.scrollY || 0);
const off   = () => IS_EMBEDDED ? host.top : 0;
const relTop    = el => el.getBoundingClientRect().top + off();
const relBottom = el => el.getBoundingClientRect().bottom + off();
function setVh() { doc.style.setProperty("--vh", vpH() + "px"); }
setVh();

/* ---------- smooth scroll: standalone desktop only (embedded, the host page does it) ---------- */
let lenis = null;
if (!IS_EMBEDDED && !reduced && !coarse && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* ---------- one pipe for everything that follows the page ---------- */
const scrollHandlers = [];
function tick() { for (const h of scrollHandlers) h(); }
if (IS_EMBEDDED) {
  addEventListener("message", e => {
    const d = e.data; if (!d || !d.hookHost) return;
    /* a host with its own fixed menu bar (the newer embed) sends its link clicks down here */
    if (d.hookHost === "go") { const t = d.id && document.querySelector(d.id); if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); return; }
    if (d.hookHost !== "vp" || typeof d.top !== "number") return;
    if (d.nav && !host.nav) { host.nav = true; const n = document.getElementById("nav"); if (n) n.style.display = "none"; }
    const now = performance.now(), dt = now - host.t;
    host.vel = (host.t && dt > 0 && dt < 200) ? (d.top - host.top) / dt : 0; host.t = now;
    clearTimeout(host.settle); host.settle = setTimeout(() => { host.vel = 0; tick(); }, 90);
    host.top = d.top; if (typeof d.vh === "number" && d.vh > 0) host.vh = d.vh;
    if (!host.ready) { host.ready = true; host.top0 = Math.max(0, d.top); fitHero(); }
    setVh(); tick();
  });
} else {
  addEventListener("scroll", tick, { passive: true });
  addEventListener("resize", () => { setVh(); tick(); });
}
/* embedded: the hero fills what's visible under the C&K header when the page opens */
function fitHero() {
  const hero = document.querySelector(".hero");
  if (hero && IS_EMBEDDED) hero.style.minHeight = Math.max(560, host.vh - (host.top0 || 0)) + "px";
}

/* ---------- in-page links glide (scrollIntoView reaches the host page when embedded) ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href"); if (!id || id.length < 2) return;
  const t = document.querySelector(id); if (!t) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(t, { offset: -76, duration: 1.15 });
  else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}));

/* embedded under a host menu bar: "Notify me" asks the host to scroll up and swap the frame, so the
   notify page never opens thousands of pixels below the fold */
document.querySelectorAll('a[href="notify.html"]').forEach(a => a.addEventListener("click", e => {
  if (!IS_EMBEDDED || !host.nav) return;
  e.preventDefault(); parent.postMessage({ hook: "go", href: "notify.html" }, "*");
}));

/* ---------- nav: rides along. Standalone it's sticky; embedded it's pinned by hand and only
   appears once the C&K menu bar has scrolled off the top ---------- */
(() => {
  const nav = document.getElementById("nav"); if (!nav) return;
  if (IS_EMBEDDED) {
    nav.classList.add("embedded");
    scrollHandlers.push(() => {
      nav.style.transform = `translate3d(0,${Math.max(0, -(host.top + lead()))}px,0)`;
      nav.classList.toggle("pinned", host.top < -10);
    });
  } else {
    scrollHandlers.push(() => nav.classList.toggle("scrolled", vpTop() > 8));
  }
})();

/* ---------- hero entrance: stagger order for the CSS rise ---------- */
document.querySelectorAll(".rise").forEach((el, i) => el.style.setProperty("--i", i));

/* ---------- reveal on approach — position-driven, so it never lags behind the page ---------- */
(() => {
  const els = [...document.querySelectorAll(".reveal")];
  if (reduced) { els.forEach(el => el.classList.add("in")); return; }
  let pending = els;
  scrollHandlers.push(() => {
    if (!pending.length) return;
    const limit = vpH() * 0.93;
    pending = pending.filter(el => { if (relTop(el) < limit) { el.classList.add("in"); return false; } return true; });
  });
})();

/* ---------- reading light: long-form paragraphs sit faint and the ink settles as they
   enter the reading zone (a band ~16–68% down the viewport), tracking the scroll ---------- */
(() => {
  const els = [...document.querySelectorAll(".rl")];
  if (!els.length) return;
  scrollHandlers.push(() => {
    const vh = vpH(), top = vh * 0.16, bot = vh * 0.68, ramp = vh * 0.24;
    for (const el of els) {
      const c = (relTop(el) + relBottom(el)) / 2;
      let o = 1;
      if (c < top) o = 1 - Math.min(1, (top - c) / ramp);
      else if (c > bot) o = 1 - Math.min(1, (c - bot) / ramp);
      el.style.opacity = (0.28 + 0.72 * o).toFixed(3);
    }
  });
})();

/* ---------- theme + nightfall ---------- */
function setTheme(t, persist) {
  doc.setAttribute("data-theme", t);
  if (themeMeta) themeMeta.setAttribute("content", THEME_BG[t]);
  const lab = document.getElementById("nfLabel");
  if (lab) lab.textContent = t === "dark" ? "Turn off dark mode" : "Turn on dark mode";
  if (persist) userTouchedTheme = true;
  if (IS_EMBEDDED) parent.postMessage({ hook: "bg", color: THEME_BG[t] }, "*");   /* the WP page matches */
}
function cinema(t, persist, ms) {
  doc.classList.add("theme-cinema"); setTheme(t, persist);
  setTimeout(() => doc.classList.remove("theme-cinema"), ms);
}
setTheme("light", false);
document.getElementById("themeToggle")?.addEventListener("click", () => {
  cinema(doc.getAttribute("data-theme") === "dark" ? "light" : "dark", true, 1300);
});
/* the page dips to dark exactly where the copy says 4am */
(() => {
  const problem = document.getElementById("problem"); if (!problem) return;
  let done = false;
  scrollHandlers.push(() => {
    if (done || relTop(problem) >= vpH() * 0.55) return;
    done = true;
    if (userTouchedTheme || doc.getAttribute("data-theme") === "dark") return;
    cinema("dark", false, reduced ? 0 : 1700);
  });
})();

/* ---------- walkthrough: the phone stays, the steps scroll, the screen follows ---------- */
(() => {
  const walk = document.querySelector(".walk"), phone = document.getElementById("walkPhone");
  const imgs = phone ? [...phone.querySelectorAll("img")] : [];
  const steps = [...document.querySelectorAll(".walk-step")];
  if (!steps.length || !phone) return;
  const desktop = () => matchMedia("(min-width: 900px)").matches;
  if (IS_EMBEDDED) phone.classList.add("embedded");
  let cur = -1;
  scrollHandlers.push(() => {
    if (!desktop()) return;
    const h = vpH(); let idx = 0;
    steps.forEach((s, i) => { if (relTop(s) < h * 0.55) idx = i; });
    if (idx !== cur) {
      cur = idx; const key = String(idx);
      imgs.forEach(im => im.classList.toggle("on", im.dataset.step === key));
      steps.forEach((s, i) => s.classList.toggle("active", i === idx));
    }
    /* embedded: sticky by hand — the frame never scrolls, so CSS sticky never engages */
    if (IS_EMBEDDED && walk) {
      const want = NAV_H + h * 0.05 - (relTop(walk) + lead());
      const y = Math.max(0, Math.min(want, walk.getBoundingClientRect().height - phone.getBoundingClientRect().height));
      phone.style.transform = `translate3d(0,${Math.round(y)}px,0)`;
    }
  });
})();

/* ---------- hero phone: the app in use. Cycles real screens; a real recording at
   assets/hook-demo.mp4 takes the slot over if it exists ---------- */
(() => {
  const phone = document.getElementById("heroPhone"); if (!phone) return;
  const vid = document.getElementById("heroVideo");
  const imgs = [...phone.querySelectorAll("img[data-cycle]")];
  const cap = document.getElementById("heroCap");
  const CAPS = ["Words & chords", "Set the feel", "Counted in", "Stack your layers"];
  let i = 0, timer = null;
  const visible = () => relBottom(phone) > 0 && relTop(phone) < vpH();
  const show = n => { i = n; imgs.forEach(im => im.classList.toggle("on", +im.dataset.cycle === n)); if (cap) cap.textContent = CAPS[n]; };
  if (vid) fetch("assets/hook-demo.mp4", { method: "HEAD" }).then(r => {
    if (!r.ok) return;
    vid.addEventListener("loadeddata", () => {
      vid.hidden = false; phone.classList.add("has-video");
      if (timer) { clearInterval(timer); timer = null; }
      vid.play().catch(() => {});
      if (cap) cap.textContent = "Hook, in use";
    });
    vid.src = "assets/hook-demo.mp4";
  }).catch(() => {});
  if (!reduced) timer = setInterval(() => { if (visible() && !phone.classList.contains("has-video")) show((i + 1) % CAPS.length); }, 3600);
})();

/* ---------- THE SIGNATURE: hold to catch ----------
   Press and hold the record button: it counts you in (a click per beat, the ring fills a bar).
   Let go: the take is caught and it loops. Hold again: a new layer rings the button in the
   app's colors and adds a voice, so five layers build a chord. Sound is Web Audio,
   synthesized, mutable; visuals work without it. ---------- */
(() => {
  const btn = document.getElementById("recBtn"); if (!btn) return;
  const hook = document.getElementById("hookSpin");
  const ringsG = document.getElementById("layerRings");
  const beats = [...document.querySelectorAll("#beats circle, #beats i")];
  const tTime = document.getElementById("tapeTime"), tTake = document.getElementById("tapeTake"), tDot = document.getElementById("tapeDot");
  const hint = document.getElementById("catchHint");
  const muteBtn = document.getElementById("muteBtn"), clearBtn = document.getElementById("clearBtn");

  /* the hook orbits the dot while we're rolling — one turn every 1.7s, clockwise, linear — and
     eases back to rest in .25s when we stop, exactly as HookRecordMark does in the app */
  const TURN = 1.7;
  let angle = 0, settleRaf = 0;
  const setHook = a => { angle = a; if (hook) hook.style.transform = `rotate(${a}deg)`; };
  const cancelSettle = () => { if (settleRaf) { cancelAnimationFrame(settleRaf); settleRaf = 0; } };
  function settle() {
    cancelSettle();
    if (!hook || reduced) { setHook(0); return; }
    const from = angle, to = (from % 360) > 180 ? 360 : 0, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 250), e = 1 - Math.pow(1 - p, 3);
      setHook(from + (to - from) * e);
      if (p < 1) settleRaf = requestAnimationFrame(step); else { settleRaf = 0; setHook(0); }
    };
    settleRaf = requestAnimationFrame(step);
  }
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
    o2.type = "sine";     o2.frequency.value = NOTES[n] * 2.004;
    f.type = "lowpass";   f.frequency.value = 880 + n * 220; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.55);
    lfo.type = "sine"; lfo.frequency.value = 1 / BAR; lg.gain.value = 0.07;
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
      const el = t - holdStart, b = Math.floor(el / BEAT);
      if (!reduced) setHook(((el / TURN) * 360) % 360);
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
    if (hook) hook.classList.remove("boot");
    cancelSettle(); setHook(0);
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
    settle();
    beats.forEach(c => c.classList.remove("hit"));
    if (len < 0.35) { hint.textContent = "Hold it a little longer — give it a bar."; if (!layers.length) tTime.textContent = "00:00.0"; return; }
    catchLayer(len);
  }
  function catchLayer(len) {
    const n = layers.length; if (n >= MAX) return;
    if (!n) loopStart = performance.now() / 1000;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "160"); c.setAttribute("cy", "160"); c.setAttribute("r", String(150 + n * 9));
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
  /* the app's launch moment: the hook spins up as the page opens, then rests */
  if (hook && !reduced) { hook.classList.add("boot"); setTimeout(() => hook.classList.remove("boot"), 3450); }
})();

/* ---------- live rhyme demo — the app's REAL rhyme engine ---------- */
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
    const url = (which === "es" ? "assets/rhyme-dict-es.txt" : "assets/rhyme-dict.txt") + "?v=1";
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
    import("./assets/rhyme-engine.js?v=1")
      .then(mod => { engine = mod; return loadDict("en"); })
      .then(() => demo.classList.remove("rhyme-warming"))   /* Spanish loads on the Español tap (950 KB; most visitors never need it) */
      .catch(() => demo.classList.remove("rhyme-warming"));
  }
  /* boot when the box is within ~900px of the viewport, or the moment it's touched */
  scrollHandlers.push(() => { if (!booted && relTop(demo) < vpH() + 900) boot(); });
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

/* ---------- embedded: tell the host how tall we are, whenever that changes ---------- */
if (IS_EMBEDDED) {
  const foot = document.querySelector("footer.foot") || document.querySelector("body > footer");   /* the PAGE footer — blockquotes and cards may have their own <footer> */
  let lastH = 0;
  const postHeight = () => {
    const h = Math.ceil(Math.max(foot ? foot.getBoundingClientRect().bottom + (window.scrollY || 0) : 0, document.body.scrollHeight));
    if (h > 0 && Math.abs(h - lastH) > 4) { lastH = h; parent.postMessage({ hook: "h", h }, "*"); }
  };
  addEventListener("load", postHeight);
  if ("ResizeObserver" in window) new ResizeObserver(postHeight).observe(document.body);
  postHeight(); setTimeout(postHeight, 700); setTimeout(postHeight, 2500);
}

/* first paint: everything that follows the page, computed once */
tick();
