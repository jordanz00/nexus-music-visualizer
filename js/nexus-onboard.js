'use strict';
/**
 * nexus-onboard.js — First-run wizard (localStorage nx_onboard_done_v1).
 * Safe DOM: textContent + createElement only.
 */
(function () {
  var KEY = 'nx_onboard_done_v1';
  var steps = [
    { h: 'Welcome to NEXUS Pro', p: 'This is a browser VJ stack: WebGL scenes plus Aurora Field (Butterchurn). Use Launch to unlock audio, then drive scenes from the pads or keyboard.' },
    { h: 'Audio', p: 'Press M or open Perform → MIC / IN to pick an input. Aurora and shaders react to the live FFT — silence stays visually calm.' },
    { h: 'Mix stack', p: 'Open the Mix tab for Aurora intensity, morph conductor, and genre-style macros. Hybrid mode blends WebGL with the spectrum layer.' },
    { h: 'Present & record', p: 'P hides chrome for OBS. REC supports composite profiles (1080p / stream / 4K) from the System tab. Optional MIDI: map from the MAP overlay.' }
  ];

  function isDone() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setDone() {
    try {
      localStorage.setItem(KEY, '1');
    } catch (e2) { /* ignore */ }
  }

  function clearDone() {
    try {
      localStorage.removeItem(KEY);
    } catch (e3) { /* ignore */ }
  }

  function buildOverlay() {
    var root = document.createElement('div');
    root.id = 'nx-onboard-root';
    root.className = 'nx-onboard-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'nx-onboard-title');

    var card = document.createElement('div');
    card.className = 'nx-onboard-card';

    var title = document.createElement('h2');
    title.id = 'nx-onboard-title';
    title.className = 'nx-onboard-title';

    var body = document.createElement('p');
    body.className = 'nx-onboard-body';

    var nav = document.createElement('div');
    nav.className = 'nx-onboard-nav';

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'sm-btn';
    back.textContent = 'Back';

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'sm-btn nx-onboard-primary';
    next.textContent = 'Next';

    var skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'sm-btn nx-onboard-skip';
    skip.textContent = 'Skip';

    nav.appendChild(back);
    nav.appendChild(skip);
    nav.appendChild(next);

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(nav);
    root.appendChild(card);
    document.body.appendChild(root);

    var idx = 0;
    function render() {
      var st = steps[idx];
      title.textContent = st.h;
      body.textContent = st.p;
      back.style.display = idx === 0 ? 'none' : '';
      next.textContent = idx === steps.length - 1 ? 'Done' : 'Next';
    }

    function close() {
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    back.addEventListener('click', function () {
      if (idx > 0) { idx--; render(); }
    });
    next.addEventListener('click', function () {
      if (idx < steps.length - 1) { idx++; render(); }
      else {
        setDone();
        close();
      }
    });
    skip.addEventListener('click', function () {
      setDone();
      close();
    });

    render();
  }

  function maybeOffer() {
    if (isDone()) return;
    buildOverlay();
  }

  function resetTour() {
    clearDone();
  }

  NX.Onboard = { maybeOffer: maybeOffer, resetTour: resetTour, isDone: isDone };
})();
