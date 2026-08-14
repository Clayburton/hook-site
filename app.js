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

/* ---------- assets that light up only when Clay drops the real files in ----------
   (probe, never assume — the page must not offer sound it doesn't have) */

async function exists(url) {
  try { const r = await fetch(url, { method: "HEAD" }); return r.ok; }
  catch (e) { return false; }
}

/* hear-it A/B: one real take vs the full stack, exported from Hook */
(async () => {
  const demo = document.getElementById("heroDemo");
  if (!demo) return;
  const pills = [...demo.querySelectorAll(".pill")];
  const oks = await Promise.all(pills.map(p => exists(p.dataset.src)));
  if (!oks.every(Boolean)) return;
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

/* hero screen recording: swaps in over the still when assets/hero-demo.mp4 exists */
(async () => {
  if (!(await exists("assets/hero-demo.mp4"))) return;
  const stack = document.querySelector(".hero-device .shot-stack");
  if (!stack) return;
  const v = document.createElement("video");
  v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.poster = "assets/05-record-with-layer.webp?v=1";
  v.src = "assets/hero-demo.mp4";
  stack.replaceChildren(v);
  const tryPlay = () => v.play().catch(() => {});
  addEventListener("pointerdown", tryPlay, { once: true });
  document.addEventListener("visibilitychange", tryPlay);
  tryPlay();
})();
