# Scene authoring (WebGL1)

## Contract

- Register with `NX.registerScene({ n, rx, c, fs, tags? })` per existing scene files.  
- Fragment must use shared uniforms from `NX.HEAD` (`T`, `B`, `M`, `H`, `FL`, `BT`, `MX`, etc.).  

## Performance tiers

- **Mobile-safe:** fewer raymarch steps, avoid dependent-loop explosions; test on iOS with instant scene changes.  
- **Desktop:** higher step counts acceptable with perf lock / adaptive quality.  

## QA

Run the app; confirm `NX.compileScenes()` succeeds for all scenes. Fix compile errors before shipping new scenes.
