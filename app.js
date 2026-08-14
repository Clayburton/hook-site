/* Hook — marketing site engine
   Theme toggle (whole page + screenshots), iframe height/bg messaging,
   fail-open entrance animations, and the three.js "living paper" hero. */

// PLACEHOLDER: set this to the real App Store URL when the listing is live.
const APP_STORE_URL = "#app-store-link";

const doc = document.documentElement;
const IS_EMBEDDED = window.parent !== window;

/* declared up top — setTheme runs before the canvas exists */
let paperThemeFn = null;
function paperTheme(theme) { paperThemeFn && paperThemeFn(theme); }

/* ---------- App Store links (one constant, every button) ---------- */
document.querySelectorAll(".js-appstore").forEach(a => { a.href = APP_STORE_URL; });

/* ---------- theme ---------- */

const THEME_BG = { light: "#F6EFE4", dark: "#15120F" };
const themeMeta = document.querySelector('meta[name="theme-color"]');

function broadcastTheme(theme) {
  if (themeMeta) themeMeta.setAttribute("content", THEME_BG[theme]);
  if (IS_EMBEDDED) parent.postMessage({ hook: "bg", color: THEME_BG[theme] }, "*");
}

function setTheme(theme, persist) {
  doc.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("aria-label", theme === "light" ? "Switch to dark" : "Switch to light");
  if (persist) { try { localStorage.setItem("hook-theme", theme); } catch (e) {} }
  broadcastTheme(theme);
  paperTheme(theme);
}

let saved = null;
try { saved = localStorage.getItem("hook-theme"); } catch (e) {}
const prefersDark = matchMedia("(prefers-color-scheme: dark)");
setTheme(saved || (prefersDark.matches ? "dark" : "light"), false);
prefersDark.addEventListener?.("change", e => { if (!saved) setTheme(e.matches ? "dark" : "light", false); });

document.getElementById("themeToggle")?.addEventListener("click", () => {
  const next = doc.getAttribute("data-theme") === "light" ? "dark" : "light";
  saved = next;
  setTheme(next, true);
});

/* ---------- iframe: post content height to the WP embed ---------- */

if (IS_EMBEDDED) {
  let lastH = 0;
  const postH = () => {
    const h = doc.scrollHeight;
    if (Math.abs(h - lastH) > 8) { lastH = h; parent.postMessage({ hook: "h", h }, "*"); }
  };
  new ResizeObserver(postH).observe(doc);
  addEventListener("load", postH);
  document.fonts?.ready.then(postH);
  setInterval(postH, 1500); // safety net
  broadcastTheme(doc.getAttribute("data-theme"));
}

/* ---------- entrance animations ----------
   Fail-open by construction: elements are visible by default; .pre is added
   only to elements measurably below the viewport, and removing it is the
   animation. ?nofx skips everything (also used for screenshot QA). */

const NOFX = new URLSearchParams(location.search).has("nofx");
if ("IntersectionObserver" in window && !NOFX && !IS_EMBEDDED
    && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const el = en.target;
        requestAnimationFrame(() => el.classList.remove("pre"));
        io.unobserve(el);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".sec-head, .sec-body, .step, .card, .rhyme-demo, .bignum, .plan, .manifesto").forEach(el => {
    const below = el.getBoundingClientRect().top > innerHeight * 0.92;
    el.classList.add("rev");
    if (below) { el.classList.add("pre"); io.observe(el); }
  });
}

/* ---------- three.js living paper (hero only; degrades to plain CSS) ---------- */

const canvas = document.getElementById("paper");

async function initPaper() {
  if (!canvas) return;
  let THREE;
  try { THREE = await import("three"); }
  catch (e) { canvas.remove(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) { canvas.remove(); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  const cam = new THREE.Camera();
  const uniforms = {
    uTime:   { value: 0 },
    uRes:    { value: new THREE.Vector2(1, 1) },
    uInk:    { value: doc.getAttribute("data-theme") === "dark" ? 1 : 0 },
    uAnchor: { value: new THREE.Vector2(0.72, 0.52) }, // ring origin, uv space
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime, uInk;
      uniform vec2 uRes, uAnchor;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++){ v += a * noise(p); p *= 2.13; a *= 0.5; }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 px = gl_FragCoord.xy;

        vec3 paperL = vec3(0.965, 0.937, 0.894);  /* #F6EFE4 */
        vec3 paperD = vec3(0.082, 0.071, 0.059);  /* #15120F */
        vec3 redL   = vec3(0.910, 0.129, 0.239);  /* #E8213D */
        vec3 redD   = vec3(0.961, 0.196, 0.298);  /* #F5324C */
        vec3 paper  = mix(paperL, paperD, uInk);
        vec3 red    = mix(redL, redD, uInk);

        /* slow-living paper tooth */
        float g1 = fbm(px * 0.012 + uTime * 0.010);
        float g2 = fbm(px * 0.055 - uTime * 0.006);
        float tooth = (g1 * 0.6 + g2 * 0.4) - 0.5;
        paper *= 1.0 + tooth * mix(0.045, 0.085, uInk);

        /* soft lamp from the upper left, barely breathing */
        float lamp = 1.0 - smoothstep(0.0, 1.05, distance(uv * vec2(uRes.x / uRes.y, 1.0), vec2(0.30 * uRes.x / uRes.y, 0.82)));
        float breathe = 0.85 + 0.15 * sin(uTime * 0.14);
        paper += lamp * breathe * mix(0.028, 0.045, uInk) * vec3(1.0, 0.95, 0.86);

        /* quiet vignette */
        paper *= 1.0 - 0.055 * smoothstep(0.55, 1.2, length(uv - 0.5) * 1.7);

        /* the chirp: a ring of sound leaves the device and a fainter one returns */
        vec2 anchor = uAnchor * uRes;
        float rr = distance(px, anchor);
        float span = max(uRes.x, uRes.y) * 0.85;
        float cyc = mod(uTime, 9.0);
        float band = 30.0;
        /* outbound: 0 → 3.2s */
        float rOut = span * smoothstep(0.0, 3.2, cyc);
        float aOut = exp(-pow((rr - rOut) / band, 2.0)) * (1.0 - smoothstep(0.0, 3.2, cyc)) * step(cyc, 3.4);
        /* returning echo: 4.2 → 7.2s */
        float tBack = smoothstep(4.2, 7.2, cyc);
        float rBack = span * (1.0 - tBack);
        float aBack = exp(-pow((rr - rBack) / (band * 1.6), 2.0)) * tBack * (1.0 - tBack) * 1.6 * step(4.0, cyc);
        float ring = (aOut * 0.16 + aBack * 0.10) * mix(1.0, 1.6, uInk);
        paper = mix(paper, red, ring);

        gl_FragColor = vec4(paper, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const hero = canvas.parentElement;
  function size() {
    const w = hero.clientWidth || 1200, h = hero.clientHeight || 700;
    if (w < 2 || h < 2) return;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    const dev = hero.querySelector(".hero-device");
    if (dev && dev.offsetWidth > 0) {
      /* offset math (not getBoundingClientRect) — rects read 0 in hidden panes.
         Accumulate offsets up to the hero zone, not just the nearest positioned box. */
      let ox = 0, oy = 0, el = dev;
      while (el && el !== hero) { ox += el.offsetLeft; oy += el.offsetTop; el = el.offsetParent; }
      const ax = (ox + dev.offsetWidth * 0.5) / Math.max(w, 1);
      const ay = 1.0 - (oy + dev.offsetHeight * 0.42) / Math.max(h, 1);
      uniforms.uAnchor.value.set(Math.min(Math.max(ax, 0.1), 0.9), Math.min(Math.max(ay, 0.1), 0.9));
    }
  }
  new ResizeObserver(size).observe(hero);
  size();

  /* theme fade for the shader */
  let inkFrom = uniforms.uInk.value, inkTo = inkFrom, inkT0 = 0;
  paperThemeFn = theme => {
    inkFrom = uniforms.uInk.value;
    inkTo = theme === "dark" ? 1 : 0;
    inkT0 = performance.now();
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = true, rafId = 0;
  const t0 = performance.now();

  function frame(now) {
    const t = (now - t0) / 1000;
    uniforms.uTime.value = t;
    if (inkTo !== uniforms.uInk.value) {
      const k = Math.min((now - inkT0) / 450, 1);
      uniforms.uInk.value = inkFrom + (inkTo - inkFrom) * k;
    }
    renderer.render(scene, cam);
    if (running && !reduced) rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* pause when the hero is off screen (fail-safe: worst case it keeps painting) */
  if ("IntersectionObserver" in window && !reduced) {
    new IntersectionObserver(([en]) => {
      const want = !!en?.isIntersecting;
      if (want && !running) { running = true; rafId = requestAnimationFrame(frame); }
      else if (!want && running) { running = false; cancelAnimationFrame(rafId); }
    }).observe(canvas);
  }

  /* bfcache restore can kill the GL context inside an iframe — recover, don't stay blank */
  addEventListener("pageshow", e => {
    if (!e.persisted) return;
    try {
      if (renderer.getContext().isContextLost()) location.reload();
      else { size(); renderer.render(scene, cam); }
    } catch (err) { location.reload(); }
  });
}

initPaper();

/* ---------- live rhyme demo ----------
   A transparent textarea over a colored mirror. A small final-sound matcher —
   not the app's engine, just convincing: last vowel sound + what follows,
   silent-e marked long, a short table for English's worst spellings. */

(() => {
  const input = document.getElementById("rhymeInput");
  const mirror = document.getElementById("rhymeMirror");
  if (!input || !mirror) return;

  const STOP = new Set(["the", "a", "an", "and", "in", "on", "at", "to", "or", "but", "as", "with", "for", "from", "by", "is", "was", "its", "it's"]);
  const EXC = {
    night: "ite", bright: "ite", light: "ite", right: "ite", sight: "ite", might: "ite",
    tight: "ite", flight: "ite", tonight: "ite",
    high: "i", sigh: "i", eye: "i", goodbye: "i", bye: "i", i: "i",
    through: "oo", blue: "oo", true: "oo", you: "oo", new: "oo", knew: "oo", do: "oo",
    too: "oo", two: "oo", who: "oo", few: "oo", grew: "oo",
    love: "uv", of: "uv", above: "uv", dove: "uv",
    though: "o", go: "o", know: "o", so: "o", oh: "o", slow: "o", snow: "o", low: "o",
    show: "o", grow: "o", no: "o", flow: "o",
    said: "ed", head: "ed", dead: "ed", bread: "ed", instead: "ed",
    heart: "art", are: "ar", star: "ar", far: "ar", guitar: "ar",
    one: "un", done: "un", sun: "un", run: "un", none: "un", son: "un", young: "ung",
    gone: "on", on: "on", song: "ong", long: "ong", wrong: "ong", along: "ong",
    me: "ee", be: "ee", we: "ee", she: "ee", he: "ee",
    sea: "ee", tea: "ee", plea: "ee", flea: "ee",
    great: "ate", break: "ate", steak: "ate",
    their: "air", theirs: "air",
    they: "ay", hey: "ay", grey: "ay", gray: "ay", weigh: "ay", away: "ay",
    there: "air", where: "air", air: "air", hair: "air", care: "air", share: "air",
    stare: "air", prayer: "air", wear: "air", bear: "air",
    again: "en", friend: "end",
    come: "um", some: "um", from: "um",
    word: "urd", bird: "urd", heard: "urd", hurt: "urt",
    were: "ur", her: "ur", stir: "ur",
  };

  function rime(raw) {
    const w = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (!w || STOP.has(w)) return null;
    if (EXC[w] !== undefined) return EXC[w];
    /* unstressed suffixes read as noise, not rhyme: fall-ing/burn-ing, eve-ry */
    if (/[aeiouy].+ing$/.test(w)) return null;
    if (/[^aeiouy]y$/.test(w) && (w.match(/[aeiouy]+/g) || []).length > 1) return null;
    let s = w, longMark = "";
    if (s.length > 2 && /[^aeiou]e$/.test(s)) { s = s.slice(0, -1); longMark = "e"; }
    const m = s.match(/[aeiouy]+[^aeiouy]*$/);
    let r = (m ? m[0] : s).replace(/y/g, "i") + longMark;
    if (r === "e") r = "ee";
    r = r.replace(/^ea/, "ee");              /* sea/beat/dream spell 'ee' as 'ea' */
    if (r === "ei") r = "ai";                /* obey sounds like day */
    if (r.length < 2 && !"aeiou".includes(r)) return null;
    return r;
  }

  /* slant families: same vowel sound, coda in the same consonant class —
     time/line, deep/beat, sun/come all read as rhymes to a songwriter */
  const CODA_CLASS = { m: "N", n: "N", ng: "N", t: "T", d: "T", p: "T", b: "T", k: "T", g: "T", ck: "T",
    s: "S", z: "S", f: "S", v: "S", th: "S", sh: "S", ch: "C", tch: "C", l: "L", r: "R", "": "" };
  function familyKey(r) {
    const m = r.match(/^([aeiouy]+)([^aeiouy]*?)(e?)$/);
    if (!m) return r;
    const cls = CODA_CLASS[m[2]] !== undefined ? CODA_CLASS[m[2]] : m[2];
    return m[1] + m[3] + cls;
  }

  function paint() {
    const text = input.value;
    const tokens = text.split(/([A-Za-z']+)/);
    /* families: rime -> word indices; color the first five with >= 2 members */
    const fam = new Map();
    tokens.forEach((t, i) => {
      if (i % 2 === 0) return;
      const r = rime(t);
      if (!r) return;
      const k = familyKey(r);
      (fam.get(k) || fam.set(k, []).get(k)).push(i);
    });
    const colored = new Map();
    let next = 0;
    for (const [k, idxs] of fam) {
      if (idxs.length >= 2 && next < 5) colored.set(k, "rf" + next++);
    }
    const frag = document.createDocumentFragment();
    tokens.forEach((t, i) => {
      if (!t) return;
      const r = i % 2 === 1 ? rime(t) : null;
      const cls = r ? colored.get(familyKey(r)) : null;
      if (cls) {
        const el = document.createElement("i");
        el.className = cls;
        el.textContent = t;
        frag.appendChild(el);
      } else {
        frag.appendChild(document.createTextNode(t));
      }
    });
    /* keep a trailing newline's height so the caret never outruns the mirror */
    if (text.endsWith("\n") || text === "") frag.appendChild(document.createTextNode("​"));
    mirror.replaceChildren(frag);
  }

  input.addEventListener("input", paint);
  paint();
})();

/* ---------- drift demo: the overdub sits late; one press snaps it home ---------- */

(() => {
  const root = document.getElementById("drift");
  if (!root) return;
  const SVGNS = "http://www.w3.org/2000/svg";
  const BEATS = [30, 162, 294, 426, 558, 690];
  const HEIGHTS = [16, 34, 52, 34, 16];

  function buildLane(id, withOffsetGroup) {
    const svg = document.getElementById(id);
    BEATS.forEach((x, bi) => {
      const line = document.createElementNS(SVGNS, "line");
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      line.setAttribute("y1", 4); line.setAttribute("y2", 80);
      line.setAttribute("class", "beat" + (bi % 4 === 0 ? " one" : ""));
      svg.appendChild(line);
    });
    const group = document.createElementNS(SVGNS, "g");
    group.setAttribute("class", "pulses");
    BEATS.forEach(x => {
      const pulse = document.createElementNS(SVGNS, "g");
      pulse.setAttribute("class", "pulse");
      HEIGHTS.forEach((h, i) => {
        const r = document.createElementNS(SVGNS, "rect");
        const bx = x + (i - 2) * 9;
        r.setAttribute("x", bx - 3); r.setAttribute("width", 6);
        r.setAttribute("y", 42 - h / 2); r.setAttribute("height", h);
        r.setAttribute("rx", 3);
        pulse.appendChild(r);
      });
      group.appendChild(pulse);
    });
    svg.appendChild(group);
  }
  buildLane("driftLane1");
  buildLane("driftLane2");

  const btn = document.getElementById("driftBtn");
  const status = document.getElementById("driftStatus");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  btn.addEventListener("click", () => {
    if (root.classList.contains("snapped")) {
      root.classList.remove("snapped");
      btn.lastChild.textContent = "Measure my headphones";
      status.innerHTML = "Bluetooth holds the sound back &mdash; your overdub records <b>late</b>, behind the beat.";
      return;
    }
    root.classList.add("listening");
    status.textContent = "Listening… three seconds, once.";
    setTimeout(() => {
      root.classList.remove("listening");
      root.classList.add("snapped");
      btn.lastChild.textContent = "Put the drift back";
      status.innerHTML = "Measured. Now every layer lands <b>where you played it</b> — your headphones, your number, remembered.";
    }, reduced ? 60 : 750);
  });
})();

/* ---------- assets that light up only when Clay drops the real files in ----------
   One manifest that always exists (no 404 noise): set a filename in
   assets/media-manifest.json and the matching feature appears. */

const MEDIA = (async () => {
  try {
    const r = await fetch("assets/media-manifest.json", { cache: "no-cache" });
    return r.ok ? await r.json() : {};
  } catch (e) { return {}; }
})();

/* hear-it A/B: one real take vs the full stack, exported from Hook */
(async () => {
  const demo = document.getElementById("heroDemo");
  if (!demo) return;
  const media = await MEDIA;
  if (!media.take || !media.stack) return;
  const pills = [...demo.querySelectorAll(".pill")];
  pills[0].dataset.src = "assets/" + media.take;
  pills[1].dataset.src = "assets/" + media.stack;
  demo.hidden = false;
  const audio = new Audio();
  audio.preload = "none";
  let current = null;
  audio.addEventListener("ended", () => { pills.forEach(p => p.setAttribute("aria-pressed", "false")); current = null; });
  pills.forEach(p => {
    p.setAttribute("aria-pressed", "false");
    p.addEventListener("click", () => {
      if (current === p) {
        audio.pause(); p.setAttribute("aria-pressed", "false"); current = null; return;
      }
      pills.forEach(q => q.setAttribute("aria-pressed", "false"));
      audio.src = p.dataset.src;
      audio.play().catch(() => {});
      p.setAttribute("aria-pressed", "true");
      current = p;
    });
  });
})();

/* hero screen recording: swaps in over the still when the manifest names one */
(async () => {
  const media = await MEDIA;
  if (!media.video) return;
  const stack = document.querySelector(".hero-device .shot-stack");
  if (!stack) return;
  const v = document.createElement("video");
  v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.poster = "assets/05-record-with-layer.webp?v=1";
  v.src = "assets/" + media.video;
  stack.replaceChildren(v);
  const tryPlay = () => v.play().catch(() => {});
  addEventListener("pointerdown", tryPlay, { once: true });
  document.addEventListener("visibilitychange", tryPlay);
  tryPlay();
})();
