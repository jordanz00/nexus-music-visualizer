'use strict';
/**
 * nexus-pro-engines.js — Branded Pro engines (facades over NX.S, PRO, FilmLUT, MultiscreenRTC).
 * Each engine is a small namespace for operators / scripting; heavy math stays in audio + shaders.
 */
(function () {
  function S() {
    return NX.S;
  }

  window.NX = window.NX || {};

  NX.Genome = {
    /** @returns {{centroid01:number, flatness:number}} */
    chromaSummary: function () {
      var st = S();
      if (!st) return { centroid01: 0, flatness: 0 };
      return { centroid01: st.proPR || 0, flatness: st.proChromaFlatness || 0 };
    }
  };

  NX.SurpriseEngine = {
    /** @returns {number} 0–1 salience proxy (spectral flux + transient). */
    salience: function () {
      var st = S();
      if (!st) return 0;
      return Math.min(1, (st.sFlux || 0) * 0.55 + (st.sTransient || 0) * 0.45);
    }
  };

  NX.FilmLUTPipeline = {
    /** @returns {{mix:number,dim:number}} */
    state: function () {
      var st = S();
      if (!st) return { mix: 0, dim: 0 };
      return { mix: st.filmLutMix || 0, dim: st.filmLutDim || (NX.FilmLUT && NX.FilmLUT.getDim ? NX.FilmLUT.getDim() : 0) };
    },
    setMix: function (m) {
      var st = S();
      if (st) st.filmLutMix = Math.max(0, Math.min(1, +m || 0));
    }
  };

  NX.EmotionalArc = {
    /** @returns {number} 0–1 macro narrative phase (wall + BPM shaped). */
    phase: function () {
      var st = S();
      return st && typeof st.narrativePhase01 === 'number' ? st.narrativePhase01 : 0.5;
    }
  };

  NX.Hyper4D = {
    /** @returns {number} drive for 4D projection scenes (DNA + time). */
    sliceDrive: function () {
      var st = S();
      if (!st) return 0;
      return ((st.dnaX || 0) * 0.31 + (st.dnaY || 0) * 0.29 + (st.GT || 0) * 0.01) % 1;
    }
  };

  NX.VolumetricEngine = {
    /** @returns {number} */
    godRayDrive: function () {
      var st = S();
      if (!st) return 0;
      return Math.min(1, (st.sVol || 0) * 0.4 + (st.sHigh || 0) * 0.35 + (st.beatVisual || 0) * 0.25);
    }
  };

  NX.NavierField = {
    /** @returns {number} curl-noise proxy from mids + flux */
    vorticityProxy: function () {
      var st = S();
      if (!st) return 0;
      return Math.min(1, (st.sMid || 0) * 0.5 + (st.sFlux || 0) * 0.5);
    }
  };

  NX.TrackFingerprint = {
    /** @returns {string} */
    shortId: function () {
      var st = S();
      return st && st.proFingerprintShort ? String(st.proFingerprintShort) : '';
    }
  };

  NX.NarrativeEngine = {
    phase: function () {
      return NX.EmotionalArc.phase();
    }
  };

  NX.ConsciousnessIFS = {
    /** @returns {number} chaotic drive 0–1 */
    attractorDrive: function () {
      var st = S();
      if (!st) return 0;
      return Math.min(1, (st.proPA || 0) * 0.55 + (st.sTransient || 0) * 0.45);
    }
  };

  /**
   * Snapshot for HUD / automation.
   * @returns {object}
   */
  NX.snapshotProEngines = function () {
    return {
      genome: NX.Genome.chromaSummary(),
      surprise: NX.SurpriseEngine.salience(),
      filmLUT: NX.FilmLUTPipeline.state(),
      emotionalArc: NX.EmotionalArc.phase(),
      hyper4D: NX.Hyper4D.sliceDrive(),
      volumetric: NX.VolumetricEngine.godRayDrive(),
      navier: NX.NavierField.vorticityProxy(),
      fingerprint: NX.TrackFingerprint.shortId(),
      narrative: NX.NarrativeEngine.phase(),
      consciousness: NX.ConsciousnessIFS.attractorDrive()
    };
  };
})();
