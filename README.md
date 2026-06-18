# Mini Golf

A simple mini golf game built with [Babylon.js](https://www.babylonjs.com/). It's a static site — no build step, no dependencies to install — so it runs anywhere, including GitHub Pages.

## Play

- **Aim:** click & drag from the ball, pulling *back* in the slingshot direction.
- **Power:** the further you drag, the harder the putt.
- **Release** to putt. Sink the ball in the cup in as few strokes as possible.
- Drag elsewhere on the screen (away from the ball) to orbit the camera.

There are 3 holes. Your score per hole is shown against par.

## Run locally

Just open `index.html` in a browser. Or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose the `main` branch and `/ (root)` folder, then save.
5. Your game will be live at `https://<username>.github.io/<repo>/`.

The `.nojekyll` file is included so GitHub Pages serves the files as-is.

## Files

- `index.html` — page + HUD overlay
- `style.css` — UI styling
- `game.js` — Babylon.js scene, course data, physics, and input
