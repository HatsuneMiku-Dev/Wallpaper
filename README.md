# Wallpaper Scene Browser Preview

This repository includes a lightweight browser preview that reads `output/scene.json` and validates loading of assets from `output/materials`, `output/shaders`, and `output/particles`.

## Local Preview

Because the preview loads JSON and shader files via `fetch`, it must run from a local web server.

```bash
cd /workspace/Wallpaper
python -m http.server 8000
```

Then open `http://localhost:8000/index.html` in your browser.

## Cloudflare Pages Deployment

This preview is static and does not require a build step, so it can be deployed directly to Cloudflare Pages.

1. Create a new Pages project and point it at this repository.
2. Use an empty build command.
3. Set the output directory to the repository root (`/`).
4. Deploy and open `https://<your-domain>/index.html`.

## What the Preview Does

- Parses `output/scene.json` and renders each image-backed object as a placeholder rectangle on a 2D canvas.
- Loads every material, shader, and particle file listed in `asset-manifest.json` to confirm browser access.
- Reports counts of loaded resources in the sidebar.
