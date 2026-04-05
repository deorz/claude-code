# Claude Code 2.1.88 — Custom Build

![](<img/2026-03-31 14-58-01-combined.gif>)

Rebuilt from source maps with real source preservation for `@ant/*` packages.

## Prerequisites

- Node.js >= 20
- Bun >= 1.1
- npm (for overlay dependency install on first build)

## Build

```bash
# Production (minified)
node scripts/build-cli.mjs

# Development (unminified, faster builds)
node scripts/build-cli.mjs --no-minify

# Custom output path
node scripts/build-cli.mjs --outfile /path/to/output/cli.js
```

Output: `dist/cli.js` (wrapper) + `dist/cli.bundle/` (bundle).

First build runs `npm install` for ~80 overlay packages. Subsequent builds skip this.

## Run

```bash
node dist/cli.js
```

### Model Backend

By default, the bundled CLI now uses an OpenRouter-backed Anthropic-compatible endpoint for model selection and inference.

Common environment variables:

```bash
# Preferred key when using the default OpenRouter-compatible flow
export OPENROUTER_API_KEY="or-..."

# Optional: override the compatible endpoint
export OPENROUTER_ANTHROPIC_BASE_URL="https://openrouter.ai/api"

# Optional: override the default model used by the compatible flow
export OPENROUTER_DEFAULT_MODEL="openai/gpt-5"

# Optional OpenRouter attribution headers
export OPENROUTER_HTTP_REFERER="https://example.com"
export OPENROUTER_X_TITLE="Claude Code Custom Build"
```

Compatibility notes:

- `ANTHROPIC_BASE_URL` still overrides the compatible endpoint when set.
- `ANTHROPIC_API_KEY` is still accepted for compatibility, but `OPENROUTER_API_KEY` is preferred on the default OpenRouter-backed path.
- `ant` staging OAuth keeps using the Anthropic staging endpoint and does not route through OpenRouter.
- `/model` now loads model IDs dynamically from OpenRouter instead of using a static Claude-only list.

### Computer Use (macOS)

Computer use runs in-process automatically when the `CHICAGO_MCP` flag is enabled. The native addons are resolved from `prebuilds/` relative to the bundled package, or via env var overrides:

```bash
# Override native addon paths if the default resolution fails
COMPUTER_USE_SWIFT_NODE_PATH="/path/to/computer-use-swift.node" \
COMPUTER_USE_INPUT_NODE_PATH="/path/to/computer-use-input.node" \
node dist/cli.js
```

## Feature Flags

| Flag | What it does |
|------|-------------|
| `BUILDING_CLAUDE_APPS` | Skill content for building Claude apps |
| `BASH_CLASSIFIER` | Bash command safety classifier |
| `TRANSCRIPT_CLASSIFIER` | Transcript-level auto-mode classifier |
| `CHICAGO_MCP` | Computer use via MCP (screenshot, click, type, etc.) |

Toggle in `enabledBundleFeatures` inside `scripts/build-cli.mjs`. ~90 flags available — search `feature('` in source.

## Native Addons

In `source/native-addons/`:

| File | Purpose |
|------|---------|
| `computer-use-swift.node` | Screen capture, app management (macOS) |
| `computer-use-input.node` | Mouse/keyboard input (macOS) |
| `image-processor.node` | Sharp image processing |
| `audio-capture.node` | Audio capture |

## Clean Rebuild

```bash
rm -f .cache/workspace/.prepared.json
node scripts/build-cli.mjs --no-minify
```

## Structure

```
scripts/build-cli.mjs    — Build script (source map extraction + bun bundling)
source/cli.js.map         — Original source map (4756 modules)
source/native-addons/     — Pre-built .node binaries
source/src/               — Overlay assets (.md skill files)
.cache/workspace/         — Extracted workspace (generated, gitignored)
dist/                     — Build output (generated)
```
