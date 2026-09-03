# Pro-Osc v2 — handoff to the Osc Collection chat (2026-09-02)

**Plain summary.** This folder is a second version of clayandkelsy.com/pro-osc, built on the
system that made the Hook page work, in the Osc Collection's own world (paper, ink, Courier
Prime, one accent per synth). It is a preview: nothing here is live. Preview it at
https://clayburton.github.io/hook-site/pro-osc-v2/ . Your job is to apply the same moves to the
other four synth pages and the collection page, then the WordPress embeds.

## What changed, and the lesson behind each move
1. **Above the fold answers the three questions in three seconds** — what it sounds like
   (Hear it first, plays instantly), what it costs ($29 beside the button), will it run (the
   three "facts" pills: free Kontakt Player · macOS & Windows · 83 presets). From the August
   competitor teardown; it was buried before.
2. **The signature: the interface in use.** The hand-drawn interface sits in the hero and
   comes alive while a sound plays: the crystal glows with the level, a cut-off light sweeps
   the filter. Hook's rule: one bold move per page, everything else quiet. heylemon.ai's lesson:
   show the product working, not a picture of it.
3. **Audio is the primary UI.** One `<audio>`, `preload="none"`, streams on tap (iOS needs the
   tap), one sound at a time, level meter through Web Audio. The demosc files send
   `Access-Control-Allow-Origin: *`; keep that, or drop the analyser (the sound still plays).
4. **Reading light** on the objection flip ("It looks playful. Then you hear it."): the ink
   settles as you read. No nightfall and no dark mode here — Clay: that was Hook's, not the
   collection's. The synth pages stay on paper.
5. **The interface stays, the features scroll**: Hook's sticky-phone walkthrough, with a
   highlight frame that moves to the control each feature is about (a frame only — Clay: never dim the
   rest of the interface). Coordinates are `--x/--y/--w/--h`
   percentages on each `.hl` — adjust per synth's interface image.
6. **Proof within a screen of the promise** (UX Peak rule): a real reviewer quote in the
   objection section, the three verified-buyer reviews kept verbatim, the makers line.
7. **Video loads only when asked**: a thumbnail with a play button; YouTube's ~500 KB player
   arrives on click. Speed pass lesson.
8. **One sticky reach for the action**: the nav pill "Buy · $29". No second bottom bar.
9. **Embed-ready**: app.js is Hook's engine, so the WordPress host block works unchanged
   (`../wordpress-embed.html`: change ORIGIN/path, the wordmark, and the link ids). The host
   draws the menu bar (zero-lag) and hides this page's own nav.

## Interface frames (Clay's tab screenshots) — how to do this for the next synth
1. Clay drops screenshots of each interface tab in a folder (any names: "env:cut.png",
   "Stepped sequencer.png" …), all from the same window at the same zoom.
2. Run `python3 tools/tabs.py "<that folder>" assets`. It aligns every frame to the first by matching
   the oscillator block (identical on every tab), crops them to one rectangle, exports 1100-wide
   webp as `assets/tab-<name>.webp`, and prints a landmark row per frame. Never crop by eye.
3. Hero: one `<img data-cycle="n">` per frame inside `.rig` (stacked in one grid cell, so the
   crossfade never moves the picture); app.js cycles them every 3.6 s while the hero is on screen
   and writes the tab name into `#rigTab`. Update the TABS list in app.js to match.
4. Walkthrough: one `<img data-step="n">` per feature inside `.walk-phone` showing that feature's
   own page, plus one `<i class="hl" data-step="n">` frame on the control (percentages of the
   frame, measured from the screenshot). app.js toggles both by `data-step`.
5. The sound-reactive glow and cut-off light in the hero use percentages too (`.rig .glow`,
   `.rig .cut` in styles.css); re-measure them if the crystal or the filter moves on another synth.

## Paper
The page ground is #f0e8d7: one step lighter than demosc's #ece2d0 and warmer than Hook's #F6EFE4,
so the synth pages and Hook read as siblings, not twins (Clay asked; my call). Cards #f7f1e4.

## Copy
Everything is Kelsy's, verbatim from the live page and the demosc page, except these NEW lines
(Kelsy approves before anything ships): the three facts pills; "It looks playful. Then you hear
it." and the sentence after it; the Folia Soundstudio quote (a real receipt from
`C&K Marketing/instruments/proof/osc-2.0-page-kit.md`, review titled "JOKE or a REAL DEAL?");
 "Tap a sound. It streams, nothing to download."; the buy heading "Get Pro-Osc." (was
"Bring Pro-Osc home.", which Clay cut); the preset names
"Preset 1–4" (the demosc page names them "Pro-Osc · live"; give them real names if they have them).

The makers paragraph is Kelsy's own from the Hook page (only the product name changes) — use it as-is on
every synth page; never write a new one.

## Verify before going live
Links are the ones I could confirm: product page `/product/pro-osc/`, shop `/shop/`, Kontakt
Player. Two are guesses: the Osc Collection link (points at `/shopcki/`, the page that shows the collection — never an add-to-cart) and DEM-Osc (`/dem-osc/`).
Standing rule (FACTS): Osc stays on Kontakt/NI as-is; "for Kontakt" stays in the SEO title; no
"standalone" or "leaving NI" angle anywhere.

## To make the next synth page
Copy the three files. Change: `--acc` (chip #40b25f, jx #d85fa6, digi #e08a43, moo #9a6ad0,
dem #16b5a6), the name in the nav/title/hero, the copy blocks, the interface image, the five
features, the audio list, the highlight coordinates, the video id, the reviews. Nothing in
app.js needs to change. The collection page is the same skeleton with five hero cards where
the interface is, each with its own accent, and one shared sound strip.
