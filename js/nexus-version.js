'use strict';
/**
 * nexus-version.js — Customer-visible semver chip (keep in sync with CHANGELOG.md).
 */
(function () {
  window.NexusRelease = window.NexusRelease || {};
  NexusRelease.version = '1.1.6';

  NexusRelease.initUi = function () {
    var el = document.getElementById('nx-version-chip');
    if (el) {
      el.textContent = 'v' + NexusRelease.version;
      el.setAttribute('title', 'NEXUS Engine Pro ' + NexusRelease.version);
    }
  };
})();
