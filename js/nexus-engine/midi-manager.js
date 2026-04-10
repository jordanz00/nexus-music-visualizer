'use strict';
/**
 * MIDIManager — registration point for Nexus-wide MIDI targets (actual routing lives in js/midi.js).
 */
(function () {
  NX.MIDIManager = {
    /** Extended param names handled in midi.js paramDefs */
    extraParams: ['bloom', 'colorShift', 'bcNext', 'visualMode', 'intensity', 'trailsAmt', 'kaleido', 'glitch', 'postFx', 'nextRandom', 'sceneFamily', 'autoMorphCc', 'explodePulse']
  };
})();
