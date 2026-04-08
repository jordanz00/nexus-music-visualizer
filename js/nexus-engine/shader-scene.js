'use strict';
/**
 * ShaderScene — adapter for existing raymarched NX scenes (index in NX.scenes).
 */
(function () {
  function ShaderScene(sceneIndex) {
    this.index = sceneIndex | 0;
  }

  ShaderScene.prototype.init = function () { return true; };

  ShaderScene.prototype.enter = function () {
    if (typeof NX.goNext === 'function') NX.goNext(this.index);
  };

  ShaderScene.prototype.update = function () { };

  ShaderScene.prototype.render = function () { /* driven by main GL loop */ };

  ShaderScene.prototype.exit = function () { };

  NX.ShaderScene = ShaderScene;
})();
