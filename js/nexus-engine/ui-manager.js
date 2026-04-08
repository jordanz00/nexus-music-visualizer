'use strict';
/**
 * UIManager — thin facade over existing NX.ui + engine toggles (keeps DOM wiring in ui.js minimal).
 */
(function () {
  NX.UIManager = {
    syncControls: function () { if (NX.ui && NX.ui.syncControls) NX.ui.syncControls(); },
    setActiveScene: function (i) { if (NX.ui && NX.ui.setActiveScene) NX.ui.setActiveScene(i); },
    togglePresent: function () { if (NX.ui && NX.ui.togglePresent) NX.ui.togglePresent(); },
    tickHud: function (s) { if (NX.ui && NX.ui.tickHud) NX.ui.tickHud(s); }
  };
})();
