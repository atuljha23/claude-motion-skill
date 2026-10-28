# Formats, platforms and safe zones

| Shape | Size | Where | Notes |
|---|---|---|---|
| 9:16 | 1080×1920 | Reels, TikTok, Shorts, Stories, X vertical | Default for phone-first launches |
| 4:5 | 1080×1350 | Facebook and Instagram feed, LinkedIn feed | Biggest footprint in a feed |
| 1:1 | 1080×1080 | Feeds, LinkedIn, ads | |
| 16:9 | 1920×1080 | YouTube, X, websites, Product Hunt, keynotes | Device sits beside the caption |

`new_film.mjs --format` takes these or `WxH`. One timeline can serve several shapes if the scenes position from `W`, `H` and `WIDE`
(the template does); render each shape as its own folder or add a `?format` switch.

## Safe zones (approximate; platforms change their UI)
- **9:16**: keep key text out of the top ~220 px (account name, close), the bottom ~420 px (caption, music, buttons) and the right
  ~140 px (like/comment/share rail). Text centred in a 1080×1280 band from y≈240 to y≈1500 is safe everywhere.
- **4:5 and 1:1**: keep text ≥ 60 px from edges; Facebook overlays controls on the bottom ~140 px.
- **16:9**: YouTube shows controls and progress in the bottom ~120 px on hover.

## Length
- Reels/TikTok/Shorts launch films: 20–45 s (most people decide in 2 s, so frame 0 is the poster and the hook).
- Feeds: 15–45 s; LinkedIn tolerates longer, X autoplays muted.
- **Muted autoplay** is the norm: every claim must read without sound.

## App Store and Google Play
- App Store **app previews** are a different thing: 15–30 s, captured mostly from the app itself, at fixed device sizes
  (e.g. 886×1920 for 6.9" iPhone), 30 fps max. These launch films are for social and the web, not that slot, unless rebuilt to
  Apple's rules.
- Google Play's promo video is a YouTube link (16:9 works best).
- Store **badges**: only the official artwork (Apple's Marketing Tools, Google's badge page), unmodified, with clear space, and only for
  stores where the app is actually live in the audience's region. `new_film.mjs --badges appstore,googleplay` fetches them.

## Encoding
H.264 High, yuv420p, BT.709 TV range, +faststart, AAC 256 kb/s 48 kHz, -14 LUFS. 60 fps with motion blur for the final; 30 fps
drafts. Files land around 15–25 MB for 40 s at 1080×1920, fine for every platform's upload.
