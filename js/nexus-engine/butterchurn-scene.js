'use strict';
/**
 * ButterchurnScene — wraps VisualEngineManager + PresetLibrary (scene contract).
 */
(function () {
  function ButterchurnScene(presetName, blendTime) {
    this.presetName = presetName || null;
    this.blendTime = blendTime == null ? 2 : blendTime;
    this._entered = false;
  }

  ButterchurnScene.prototype.init = function () { return true; };

  ButterchurnScene.prototype.enter = function () {
    this._entered = true;
    if (!NX.VisualEngineManager.ensureAudioForBC()) return;
    if (!NX.VisualEngineManager.initVisualizer()) return;
    if (this.presetName && NX.PresetLibrary.getPreset(this.presetName)) {
      NX.VisualEngineManager.loadPreset(NX.PresetLibrary.getPreset(this.presetName), this.blendTime, this.presetName);
    }
  };

  ButterchurnScene.prototype.update = function (audio, dt) {
    if (!this._entered) return;
    NX.VisualEngineManager.setIntensity(0.65 + (audio.energy || 0) * 0.55);
  };

  ButterchurnScene.prototype.render = function () {
    if (NX.VisualEngineManager.isReady()) NX.VisualEngineManager.render();
  };

  ButterchurnScene.prototype.exit = function () {
    this._entered = false;
  };

  NX.ButterchurnScene = ButterchurnScene;
})();
