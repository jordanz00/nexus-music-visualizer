# Clip lane MVP (`#nx-clip-under` / `#nx-clip-over`)

## Supported media (v1)

- **Video:** any codec the browser can decode in `<video>` (MP4/H.264 widely portable; WebM where supported).
- **Image:** raster formats via `<img>` sibling in slot (`ClipLayers.loadFile`).

## Hotkeys (current build)

- Clips are **Show / Composition UI** driven; no global hotkey for slot 0–3 by default. **Future:** `Shift+1..4` under stack, `Alt+1..4` over stack opacity toggle (document when implemented).

## MIDI (mapping contract)

- Cue actions: `{ type: 'clip', op: 'play'|'stop'|'opacity', slot, below, value? }` in `cue-engine.js`.
- **CC suggestions for learn mode:** CC20–27 slot 0–3 under opacity; CC30–37 over (reserve in showfile schema when added).

## Decode failure isolation

- On `video.onerror` / `img.onerror`, slot clears blob URL, sets `opacity` to 0, exposes `NX.ClipLayers.getSlotStatus(below, idx)` with `{ ok, lastError }` so UI can show a toast **without** stopping the WebGL loop.
- Engine `loop()` never awaits clip promises.

## iOS / touch

- `playsinline` + user gesture required to assign `src`; failed play() promises are swallowed (existing pattern).
