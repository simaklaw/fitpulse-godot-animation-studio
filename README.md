# FitPulse Godot Animation Studio

Separate workspace for the FitPulse exercise-animation pipeline and its remote MCP endpoint. The Android application remains in `simaklaw/forma`.

## Current status

This repository starts with a minimal Godot project and a GitHub-backed MCP server. The MCP tools can inspect this repository, create animation-task issues, and request a headless Godot import check. They do **not** yet generate production exercise animations, control a live Godot editor, perform visual/biomechanical QA, or build the Android APK.

## Cloudflare Worker

The intended existing Worker URL is `https://godot-mcp.simaklaw-vl.workers.dev`. Deploying requires repository secrets described in `docs/deployment.md`. Never commit tokens or paste them into issues.

## Repository layout

- `src/index.ts` — Streamable HTTP MCP endpoint.
- `godot-studio/` — minimal Godot project scaffold.
- `.github/workflows/` — type-check, Godot validation, and Worker deployment.
- `docs/deployment.md` — secret setup and deployment steps.

## Next milestone

Make CI green, configure least-privilege GitHub and Cloudflare secrets, deploy to the existing Worker, then test `/health`, MCP initialization, and `tools/list` before connecting Grok.


## Pull-up motion prototype

A runnable first-pass 2D pull-up cycle is now available in `scenes/pull_up_preview.tscn` with animation logic in `scripts/pull_up_preview.gd`. Open this repository branch in Godot 4.x and run the main scene. Controls: **Space** pause/resume, **R** restart, **Left/Right** step, **1/2/3** adjust cycle speed.

This is a visible animated prototype rather than a set of reference stills, but it is not the final premium deliverable. It currently uses one stylized male presentation and procedural 2D drawing; a distinct female version, transparent-background export, expert biomechanics review, and Godot/device verification remain outstanding. See `animation-pipeline/PULL_UP_MOTION_BRIEF.md` and the project README/status notes before treating it as production-ready.
