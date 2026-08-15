/* Hook — marketing site engine
   Theme toggle (whole page + screenshots), iframe height/bg messaging,
   fail-open entrance animations, and the three.js "living paper" hero. */

// PLACEHOLDER: set this to the real App Store URL when the listing is live.
const APP_STORE_URL = "#app-store-link";

const doc = document.documentElement;
const IS_EMBEDDED = window.parent !== window;
const NOFX = new URLSearchParams(location.search).has("nofx");

/* declared up top — setTheme runs before the canvas exists */
let paperThemeFn = null;
let paperLerpMs = 450;
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
  broadcastTheme(theme);
  paperTheme(theme);
}

/* always open on light paper; the moon is the invitation to go dark */
setTheme("light", false);

let userTouchedTheme = false;
function toggleTheme() {
  const next = doc.getAttribute("data-theme") === "light" ? "dark" : "light";
  setTheme(next, false);
}
document.getElementById("themeToggle")?.addEventListener("click", () => {
  userTouchedTheme = true;
  toggleTheme();
});

/* ---------- the moon follows you + one-time nightfall on first scroll ---------- */

(() => {
  const headerBtn = document.getElementById("themeToggle");
  if (!headerBtn) return;

  /* a second toggle that escapes the hero's overflow clip; same behavior */
  const float = headerBtn.cloneNode(true);
  float.id = "themeToggleFloat";
  float.classList.add("toggle-float");
  float.addEventListener("click", () => { userTouchedTheme = true; toggleTheme(); });
  document.body.appendChild(float);

  if (!IS_EMBEDDED) doc.classList.add("standalone");

  let active = false;
  const setActive = v => { if (v !== active) { active = v; float.classList.toggle("on", v); } };

  /* nightfall: the page dips to dark the first time you scroll — once,
     slowly, then the sun is yours. Skipped for reduced-motion visitors
     and for anyone who already touched the toggle. Triggered by whichever
     signal arrives first (IO, scroll, or the embed's viewport messages) —
     browsers throttle each of these differently inside iframes. */
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let nightDone = false;
  function nightfall() {
    if (nightDone || NOFX || reducedMotion) return;
    nightDone = true;
    if (userTouchedTheme || doc.getAttribute("data-theme") === "dark") return;
    doc.classList.add("theme-cinema");
    paperLerpMs = 1250;
    setTheme("dark", false);
    setTimeout(() => { doc.classList.remove("theme-cinema"); paperLerpMs = 450; }, 1500);
  }

  if (!IS_EMBEDDED) {
    addEventListener("scroll", () => {
      setActive(scrollY > 160);
      if (scrollY > 300) nightfall();
    }, { passive: true });
  } else {
    /* the newer WP embed posts the frame's viewport position on scroll;
       with an older embed the button simply stays in the header — fail open */
    addEventListener("message", e => {
      const d = e.data;
      if (!d || d.hookHost !== "vp" || typeof d.top !== "number") return;
      const past = -d.top;                    /* px scrolled beyond the frame's top */
      setActive(past > 160);
      if (past > 300) nightfall();
      const maxY = doc.scrollHeight - 120;
      float.style.transform = "translateY(" + Math.min(Math.max(0, past + 16), maxY) + "px)";
    });
  }

  const sentinel = document.querySelector(".problem");
  if (sentinel && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) { io.disconnect(); nightfall(); }
    }, { rootMargin: "0px 0px -25% 0px" });
    io.observe(sentinel);
  }
})();

/* ---------- iframe: post content height to the WP embed ---------- */

if (IS_EMBEDDED) {
  let lastH = 0;
  const postH = () => {
    /* measure the CONTENT's true bottom, not scrollHeight — scrollHeight can never
       shrink below the iframe's viewport, so the frame could grow but never shrink,
       leaving a huge blank tail after any reflow to a shorter layout */
    const foot = document.querySelector("footer");
    let h = foot ? Math.ceil(foot.getBoundingClientRect().bottom + (window.scrollY || 0)) : 0;
    if (!isFinite(h) || h < 600) h = doc.scrollHeight;
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

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* theme fade for the shader; under reduced motion, jump and repaint once */
  let inkFrom = uniforms.uInk.value, inkTo = inkFrom, inkT0 = 0;
  paperThemeFn = theme => {
    inkFrom = uniforms.uInk.value;
    inkTo = theme === "dark" ? 1 : 0;
    inkT0 = performance.now();
    if (reduced) { uniforms.uInk.value = inkTo; renderer.render(scene, cam); }
  };
  let running = true, rafId = 0;
  const t0 = performance.now();

  function frame(now) {
    const t = (now - t0) / 1000;
    uniforms.uTime.value = t;
    if (inkTo !== uniforms.uInk.value) {
      const k = Math.min((now - inkT0) / paperLerpMs, 1);
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

  /* the app's exact skip list (RhymeAnalyzer.skip) — grammatical glue only.
     "to" stays out on purpose: it carries a full vowel and singers land on it. */
  const STOP = new Set(["a", "an", "the", "of", "i", "oh", "and", "but", "or", "nor", "as", "at", "in", "on", "it", "if"]);
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

  /* the vowel alone (plus r/l coloring, like the app's vowelColorant) — the
     key for assonance joins: "me" rides with deep/keep because they share the vowel */
  function vowelKeyOf(r) {
    const m = r.match(/^([aeiouy]+)([^aeiouy]*?)(e?)$/);
    if (!m) return r;
    const col = m[2].startsWith("r") ? "r" : m[2].startsWith("l") ? "l" : "";
    return m[1] + m[3] + col;
  }

  /* mirrors the app's RhymeAnalyzer shape:
     • per paragraph — a blank line starts a new set of rhymes
     • full/slant families need 2+ members and always paint
     • a leftover word JOINS a painted family that shares its vowel
     • leftover-only vowel bands paint at 3+ members, max 3 per paragraph
     • the color counter runs across paragraphs */
  function paint() {
    const text = input.value;
    const frag = document.createDocumentFragment();
    let colorIdx = 0;

    for (const para of text.split(/(\n[ \t]*\n)/)) {
      if (/^\n[ \t]*\n$/.test(para)) { frag.appendChild(document.createTextNode(para)); continue; }
      const tokens = para.split(/([A-Za-z][A-Za-z'’]*)/);

      const words = [];
      tokens.forEach((t, i) => {
        if (i % 2 === 0) return;
        const r = rime(t);
        if (!r) return;
        /* a long word's bare final vowel is a schwa, not the stressed vowel the app
           keys assonance on — velvet/secrets must not band or join by their tails */
        const poly = ((t.toLowerCase().replace(/[^a-z]/g, "").match(/[aeiouy]+/g)) || []).length > 1;
        words.push({ i, key: familyKey(r), vowel: vowelKeyOf(r), weak: poly && /^[aeiou]$/.test(vowelKeyOf(r)) });
      });

      const fam = new Map(), vowelOfKey = new Map(), order = [];
      for (const w of words) {
        if (!fam.has(w.key)) { fam.set(w.key, []); vowelOfKey.set(w.key, w.vowel); order.push(w.key); }
        fam.get(w.key).push(w.i);
      }
      const connected = order.filter(k => fam.get(k).length >= 2);

      const vowelHost = new Map();
      for (const k of connected) {
        const v = vowelOfKey.get(k);
        if (!vowelHost.has(v)) vowelHost.set(v, k);
      }
      const loose = new Map();
      for (const w of words) {
        if (fam.get(w.key).length >= 2) continue;
        if (w.weak) continue;
        const host = vowelHost.get(w.vowel);
        if (host) fam.get(host).push(w.i);
        else {
          if (!loose.has(w.vowel)) loose.set(w.vowel, []);
          loose.get(w.vowel).push(w.i);
        }
      }

      const classOf = new Map();
      for (const k of connected) {
        const cls = "rf" + (colorIdx++ % 5);
        for (const i of fam.get(k)) classOf.set(i, cls);
      }
      const bands = [...loose.values()].filter(idxs => idxs.length >= 3)
        .sort((a, b) => b.length - a.length).slice(0, 3);
      for (const idxs of bands) {
        const cls = "rf" + (colorIdx++ % 5);
        for (const i of idxs) classOf.set(i, cls);
      }

      tokens.forEach((t, i) => {
        if (!t) return;
        const cls = classOf.get(i);
        if (cls) {
          const el = document.createElement("i");
          el.className = cls;
          el.textContent = t;
          frag.appendChild(el);
        } else {
          frag.appendChild(document.createTextNode(t));
        }
      });
    }
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
  const label2 = document.getElementById("driftLabel2");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  btn.addEventListener("click", () => {
    if (root.classList.contains("snapped")) {
      root.classList.remove("snapped");
      btn.lastChild.textContent = "Show me the fix";
      label2.innerHTML = "What Bluetooth recorded &mdash; late";
      status.innerHTML = "Bluetooth holds the sound back &mdash; your overdub records <b>late</b>, behind the beat.";
      return;
    }
    root.classList.add("listening");
    status.textContent = "Listening… three seconds, once.";
    setTimeout(() => {
      root.classList.remove("listening");
      root.classList.add("snapped");
      btn.lastChild.textContent = "Run it again";
      label2.innerHTML = "What Hook keeps &mdash; in time";
      status.innerHTML = "Measured. Now every layer lands <b>where you played it</b> — your headphones, your number, remembered.";
    }, reduced ? 60 : 750);
  });
})();

/* ---------- live chord calculator: tap a word, build a chord, hang it on ----------
   The picker is a chord-symbol keyboard, exactly like the app: each key types its
   token, delete pops the last, Add hangs the built chord over the chosen word.
   Fully guarded — if anything throws, the static lyric line still reads fine. */

(() => {
  try {
    const lab = document.getElementById("chordlab");
    if (!lab) return;

    const LINE = ["Catch", "the", "melody", "before", "the", "coffee", "gets", "cold."];
    const chords = { 0: "C", 5: "Am" };   // pre-hung, so it reads as a chart at a glance
    let target = null;                     // no word selected until you tap one

    const GROUPS = {
      letter: [
        { label: "Root", cols: 7, keys: "A B C D E F G".split(" ").map(t => ({ t, kind: "root", hot: true })) },
        { label: "", cols: 4, keys: [
          { t: "♯", kind: "acc" }, { t: "♭", kind: "acc" },
          { t: "Aa", fn: "case" }, { t: "/", sub: "bass", kind: "sep" } ] },
        { label: "Quality", cols: 4, keys: [
          { t: "m", kind: "q" }, { t: "maj", kind: "q" }, { t: "dim", kind: "q" }, { t: "aug", kind: "q" } ] },
        { label: "", cols: 6, keys: [
          { t: "sus2", kind: "q" }, { t: "sus4", kind: "q" }, { t: "add", kind: "q" },
          { t: "°", kind: "q" }, { t: "ø", kind: "q" }, { t: "+", kind: "q" } ] },
        { label: "Extension", cols: 8, keys: "2 4 5 6 7 9 11 13".split(" ").map(t => ({ t, kind: "ext" })) },
      ],
      roman: [
        { label: "Degree", cols: 7, keys: "I II III IV V VI VII".split(" ").map(t => ({ t, kind: "root", hot: true })) },
        { label: "", cols: 4, keys: [
          { t: "♭", kind: "acc" }, { t: "♯", kind: "acc" },
          { t: "VII", sub: "major", fn: "case" }, { t: "/", sub: "applied", kind: "sep" } ] },
        { label: "Quality", cols: 4, keys: [
          { t: "°", sub: "dim", kind: "q" }, { t: "ø", sub: "half-dim", kind: "q" },
          { t: "+", sub: "aug", kind: "q" }, { t: "7", kind: "ext" } ] },
        { label: "Inversion — figured bass", cols: 6, keys:
          ["6", "6/4", "6/5", "4/3", "4/2", "9"].map(t => ({ t, kind: "inv" })) },
      ],
    };

    let mode = "letter";
    let tokens = [];          // [{t, kind}]
    let lower = false;
    const recents = [];

    const $ = id => document.getElementById(id);
    const lineEl = $("chordline"), chordEl = $("cpChord"), targetEl = $("cpTarget"),
          groupsEl = $("cpGroups"), recentEl = $("cpRecent"), recentLabel = $("cpRecentLabel"),
          addBtn = $("cpAdd"), screenEl = document.querySelector("#chordlab .cp-screen"),
          scrimEl = $("cpScrim"), sheetEl = $("cpSheet"), hintEl = $("cpHint");

    const renderTok = tk => (tk.kind === "root" && lower) ? tk.t.toLowerCase() : tk.t;
    const display = () => tokens.map(renderTok).join("");

    function openSheet(i) {
      target = i;
      tokens = chords[i] ? [{ t: chords[i], kind: "root" }] : [];
      if (hintEl) hintEl.style.visibility = "hidden";
      screenEl.classList.add("open");
      scrimEl.hidden = false;
      sheetEl.setAttribute("aria-hidden", "false");
      drawLine(); drawChord(); drawRecents();
    }
    function closeSheet() {
      screenEl.classList.remove("open");
      scrimEl.hidden = true;
      sheetEl.setAttribute("aria-hidden", "true");
      target = null; drawLine(); drawChord();
    }

    function drawLine() {
      lineEl.replaceChildren();
      LINE.forEach((w, i) => {
        const span = document.createElement("span");
        span.className = "lw" + (i === target ? " on" : "");
        span.dataset.i = i;
        if (chords[i]) {
          const c = document.createElement("span");
          c.className = "lw-chord";
          c.textContent = chords[i];
          span.appendChild(c);
        }
        span.appendChild(document.createTextNode(w));
        span.addEventListener("click", () => openSheet(i));
        lineEl.appendChild(span);
        if (i < LINE.length - 1) lineEl.appendChild(document.createTextNode(" "));
      });
    }

    function drawChord() {
      chordEl.textContent = display();
      targetEl.textContent = (target != null && LINE[target]) ? LINE[target].replace(/\W+$/, "") : "—";
      addBtn.disabled = !display().trim() || target == null;
    }

    function drawRecents() {
      recentEl.replaceChildren();
      recentLabel.hidden = recents.length === 0;
      recents.forEach(c => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "cp-chip"; b.textContent = c;
        b.addEventListener("click", () => { tokens = [{ t: c, kind: "root" }]; drawChord(); });
        recentEl.appendChild(b);
      });
    }

    function drawGroups() {
      groupsEl.replaceChildren();
      for (const g of GROUPS[mode]) {
        const wrap = document.createElement("div");
        wrap.className = "cp-group";
        if (g.label) {
          const l = document.createElement("p");
          l.className = "cp-group-label"; l.textContent = g.label;
          wrap.appendChild(l);
        }
        const row = document.createElement("div");
        row.className = "cp-row";
        row.style.gridTemplateColumns = "repeat(" + g.cols + ", 1fr)";
        for (const k of g.keys) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cp-key" + (k.hot ? " cp-hot" : "");
          const main = document.createElement("span");
          main.className = "k"; main.textContent = k.t;
          btn.appendChild(main);
          if (k.sub) {
            const sub = document.createElement("span");
            sub.className = "ksub"; sub.textContent = k.sub;
            btn.appendChild(sub);
          }
          btn.addEventListener("click", () => press(k));
          row.appendChild(btn);
        }
        wrap.appendChild(row);
        groupsEl.appendChild(wrap);
      }
    }

    function press(k) {
      if (k.fn === "case") { lower = !lower; drawChord(); return; }
      tokens.push({ t: k.t, kind: k.kind || "misc" });
      drawChord();
    }

    function drawAll() { drawLine(); drawChord(); drawRecents(); }

    // foot + clear + add + mode
    lab.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "delete") tokens.pop();
      else if (a === "space") tokens.push({ t: " ", kind: "space" });
      drawChord();
    }));
    $("cpClear").addEventListener("click", () => { tokens = []; drawChord(); });
    $("cpCancel").addEventListener("click", closeSheet);
    scrimEl.addEventListener("click", closeSheet);
    addBtn.addEventListener("click", () => {
      const c = display().trim();
      if (!c || target == null) return;
      chords[target] = c;
      const idx = recents.indexOf(c);
      if (idx > -1) recents.splice(idx, 1);
      recents.unshift(c);
      if (recents.length > 4) recents.length = 4;
      tokens = [];
      closeSheet();
    });
    lab.querySelectorAll(".cp-mode-btn").forEach(b => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      lab.querySelectorAll(".cp-mode-btn").forEach(x => {
        const on = x === b;
        x.classList.toggle("is-on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      tokens = []; lower = false;
      drawGroups(); drawChord();
    }));

    drawGroups(); drawAll();
  } catch (e) { /* static line stays readable */ }
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
