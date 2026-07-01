# MobileGame

A tiny mobile-friendly browser game built with plain HTML, CSS, and JavaScript — no build step required for dependencies.

## Neon Dodge

Tap the left or right side of the screen (or use the on-screen buttons) to dodge falling neon blocks. Your score climbs the longer you survive.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to deploy from the `main` branch and the root folder.
4. Your game will be live at `https://laim-1.github.io/MobileGame/`.

The included `.nojekyll` file keeps GitHub Pages from ignoring assets.

## Files

- `index.html` — game shell and HUD
- `style.css` — mobile-first layout and theme
- `game.js` — canvas gameplay, touch controls, high score
