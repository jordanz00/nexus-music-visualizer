# Privacy and data handling — NEXUS Engine Pro

NEXUS is a **static client-side** web application. There is **no** first-party telemetry, analytics beacon, or cloud “phone home” in the stock build.

## Microphone and audio

- Audio may be processed **locally** for visualization (FFT, RMS, Butterchurn audio tap).
- Audio does **not** leave the device except when **you** use OS-level routing (e.g. OBS, virtual cables) or browser features you explicitly enable.

## localStorage

Used for operator convenience only, for example:

- Session seed persistence (`nx_session_seed` and related keys).
- User presets, MIDI maps, Pro unlock flag on this device.
- Onboarding completion (`nx_onboard_done_v1`).

Values are not transmitted by NEXUS itself. Clearing site data removes them.

## URL parameters

Documented query flags include `?seed=`, `?demo=`, `?obs=1`, `?soak=1`, `?director=1`. Unknown or unsafe values should be ignored (see `js/nexus-bootstrap-query.js` and `js/demo-director.js`). Do not paste untrusted URLs into support channels without reviewing parameters.

## Recording (WebM export)

- Recording captures **pixels and audio** you route into the recorder (canvas / composite).
- Downloads stay **local** unless you upload them elsewhere.

## Third-party hosting (e.g. GitHub Pages)

The hosting provider may log HTTP requests (URLs, IPs) per their policy. That is outside this application’s JavaScript.
