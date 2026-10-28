# Showing the product truthfully

## Get the real thing on screen
In order of strength:
1. **Rebuild screens in code from the product's source**: colour tokens (CSS variables, Tailwind config, `Theme.swift`, `colors.xml`),
   font choices, UI strings (i18n files, Swift views, string resources), icons. Rebuilt screens stay razor sharp at any zoom, animate
   element by element on the beat, and can show states that are hard to capture. Most of the strongest films are built this way.
2. **Drive the live product** in the renderer: serve the app locally and add a film hook (`?film` flag that freezes its own clocks and
   exposes a camera/time API on `window`) so `seek(t)` can control it. Best for canvas/WebGL apps (a game, a map, a 3D world) and huge UIs.
3. **Screenshots or screen recordings** (`feature.image` in the template): quickest; fine for a first draft. Use device-resolution
   captures; a screen recording can be stepped frame by frame with a `<video>` whose `currentTime` is set in `seek` (await `seeked`).

Read the repo before writing copy: the README, store listing text, pricing, feature flags, i18n files. If there is no repo, ask for
screenshots, the store listing or the website.

## Devices
- iPhone: 390×844 pt screen, Dynamic Island, iOS-style status bar, floating tab bar. Android: ~400×868, punch-hole camera, Material
  navigation. Showing both platforms side by side reads as "now on iPhone and Android".
- Browser window for web apps, terminal window for CLIs, a laptop or tablet frame for desktop software.
- Don't use Apple or Google product photography or trademarked hardware renders; the CSS devices are generic.

## Mascots and characters
Use the product's own character (as a transparent WebP sequence or SVG). If a character only exists on one platform yet, the film can
still show it, but say so in BEATMAP.md and to the user so they post at the right time.

## Honesty rules (from real launches)
- Only claims that are true **today**: features that are live, prices that apply, platforms where it's actually available. A paid
  feature is never shown as free; "free" says what is free ("Lesson 0 and the first two units").
- Real numbers only from a dated source (a stats endpoint, the store, analytics) with the source noted in BEATMAP.md; on screen when
  it's a public figure. Example data on screens is marked "Example data" when it could be mistaken for real.
- UI labels word for word from the product. Any line in a language the user doesn't speak gets a native-speaker review first.
- No fake reviews, testimonials, ratings, press logos or user counts. No impersonating other brands.
- Store badges only for stores where the listing is live in the target region; otherwise hold the post and say why.
- Credit the music and any third-party assets in BEATMAP.md.
