# FitPulse Godot Animation Studio

Separate workspace for the FitPulse exercise-animation pipeline and its remote MCP endpoint. The Android application remains in `simaklaw/forma`.

## Current status

This repository starts with a minimal Godot project and a GitHub-backed MCP server. The MCP tools can inspect this repository, create animation-task issues, and request a headless Godot scene-load check. They do **not** yet generate production exercise animations, control a live Godot editor, perform visual/biomechanical QA, or build the Android APK.

## Cloudflare Worker

The intended Worker URL is `https://godot-mcp.simaklaw-vl.workers.dev`; verify ownership and current status in Cloudflare before relying on it. Deploying requires the repository secrets described in `docs/cloudflare-deployment.md`. Never commit tokens or paste them into issues.

## Repository layout

- `src/index.ts` — GitHub-backed MCP HTTP endpoint.
- `godot-studio/` — minimal Godot project scaffold.
- `.github/workflows/` — type-check, Godot scene validation, and guarded manual Worker deployment.
- `docs/cloudflare-deployment.md` — current manual deployment procedure and secret scopes.
- `docs/deployment.md` — initial scaffold notes; follow the current guide above for deployment.

## Next milestone

Review and merge the scaffold PR before the deployment PR. After both have been reviewed and merged, configure least-privilege secrets, manually deploy to Cloudflare, and test `/health`, MCP initialization, and `tools/list` before connecting Grok. Then begin the first real exercise asset and its biomechanical/visual QA.
