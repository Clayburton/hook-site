# Hook — marketing site

The Hook marketing page for **clayandkelsy.com/hook/**, built from `Hook-Website-Kit`.
Warm editorial — aged paper, ink, one red. Whole-page light/dark toggle that also swaps
the in-frame app screenshots. three.js "living paper" hero (grain, lamp, the chirp ring),
graceful fallback to plain parchment when WebGL is unavailable. All copy is in Clay &
Kelsy's voice; every screenshot is the real app.

## How it ships (same pattern as the other C&K pages)

1. This folder is its own GitHub repo (`Clayburton/hook-site`), served by **GitHub Pages**.
2. The WordPress page embeds it with the full-bleed auto-growing iframe in
   [`wordpress-embed.html`](wordpress-embed.html) — paste that whole file into one
   **Custom HTML block** on a new page at `/hook/`. Nothing else goes on the page.

### Clay's remaining clicks

1. On github.com → `hook-site` repo → Settings → make it **Public**
   (Pages can't serve a private repo on this plan).
2. Settings → Pages → Deploy from branch → `main` / root. Wait ~1 minute.
3. Check `https://clayburton.github.io/hook-site/` loads.
4. WordPress: new page, title "Hook", slug `hook`, one Custom HTML block,
   paste `wordpress-embed.html`, publish.

## Placeholders that only Clay can fill

| What | Where | Note |
|---|---|---|
| **App Store URL** | `app.js`, first line: `APP_STORE_URL` | Every button updates from that one constant. |
| **Free-tier limit** | `index.html`, pricing section | Currently "up to three songs" — marked with an HTML comment. |
| **Subscription name/price** | `index.html`, pricing section | Deliberately "plans & prices in the app" until numbers are final. |
| **"You're set / 74 ms" shot** | `index.html`, calibration section | The designed 74 ms panel is a stand-in; swap for the real success screenshot captured on a physical iPhone. |
| **Privacy policy link** | `index.html`, footer | `#privacy` placeholder. |

## Media slots that light up automatically

The page probes for these files and shows the feature **only when the file exists** —
nothing is faked in the meantime:

- **`assets/hero-demo.mp4`** — a real screen recording playing inside the hero phone
  (muted, looping). Record on iPhone (Settings → Control Center → add Screen Recording),
  capture tap-tempo → count-in → record → loop, AirDrop it over, then:

  ```
  ffmpeg -i capture.mov -an -vf "setpts=PTS/2,scale=664:-2" -r 30 \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 26 \
    -movflags +faststart assets/hero-demo.mp4
  ```

  (`setpts=PTS/2` = 2× speed; use `/1.5` for 1.5×. Trim so the first and last frames
  are the same screen and the loop reads clean. Aim under ~6 MB.)

- **`assets/demo-take.mp3` + `assets/demo-stack.mp3`** — the "Hear it" A/B under the hero
  CTA: the first layer alone, then the full stack, exported from the same real Hook song,
  recorded on Bluetooth earbuds. This is the single strongest proof the page can carry —
  no competitor demonstrates layering in audio at all.

- **Dark variant of the honest-failure screen** — if you capture
  `D5-calibration-honest-failure-dark` (Settings → dark, the "readings didn't agree"
  screen), convert like the others and pair it in `index.html` the same way the other
  two calibration figures pair `s-light`/`s-dark` images. Until then the light shot
  dims slightly in dark mode on purpose.

## Working on it

- Local preview: `python3 -m http.server 8850` in this folder (or the `hook-site`
  entry in `IOS/.claude/launch.json`).
- `?nofx` in the URL disables entrance animations (useful for screenshots).
- Bump the `?v=` query on `styles.css` / `app.js` / changed assets after edits —
  Pages and browsers cache hard.
- No `position: fixed`, no `vh` units — the page lives inside an auto-growing iframe
  and both break there (see `Wordpress-ing/CLAUDE.md` lessons).
