// ==UserScript==
// @name         Dalau Shopfloor Controls
// @namespace    dalau
// @version      1.7.0
// @description  Enforce mandatory comment on Stop Job (SPA-safe)
// @match        *://shopfloorlive.dalau.com:*/*
// @match        *://shopfloor.dalau.com:*/*
// @run-at       document-start
// @grant        none
// @downloadURL https://raw.githubusercontent.com/YOURUSERNAME/dalau-shopfloor-scripts/main/dalau_shopfloor_controls.user.js
// @updateURL   https://raw.githubusercontent.com/YOURUSERNAME/dalau-shopfloor-scripts/main/dalau_shopfloor_controls.user.js
// ==/UserScript==

(function () {
  const PATH_OK = p => /\/VmfgShopFloor\/LaborEntry/i.test(p);
  const SEL = '#description';

  let wiredOnce = false;
  let observer, pollId;

  function wire(root = document) {
    if (!PATH_OK(location.pathname)) return false;

    const el = root.querySelector(SEL);
    if (!el) return false;

    // (Temporary visual cue while testing)
    el.style.outline = '2px solid red';

    // native required + message
    el.required = true;
    el.setAttribute('required','');
    el.addEventListener('invalid', () => el.setCustomValidity('Initials/comments required.'));
    el.addEventListener('input', () => el.setCustomValidity(''));

    // guard form submits
    const form = el.closest('form') || root.querySelector('form');
    if (form && !form.dataset.dalauGuard) {
      form.dataset.dalauGuard = '1';
      form.addEventListener('submit', e => {
        if (!el.value.trim()) {
          e.preventDefault(); e.stopImmediatePropagation();
          el.reportValidity(); el.focus();
        }
      }, true);
    }

    // guard SPA button clicks too
    root.querySelectorAll('button,[role="button"]').forEach(btn => {
      if (btn.dataset.dalauGuard) return;
      const lbl = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      if (/(stop|complete|save|submit|clock out|end)/.test(lbl)) {
        btn.dataset.dalauGuard = '1';
        btn.addEventListener('click', e => {
          if (!el.value.trim()) {
            e.preventDefault(); e.stopImmediatePropagation();
            el.reportValidity(); el.focus();
          }
        }, true);
      }
    });

    wiredOnce = true;
    return true;
  }

  function startWatching() {
    stopWatching();

    // Try immediately & keep trying (covers slow renders)
    const tryWire = () => wire(document);
    // quick burst poll for first 10s
    let tries = 0;
    pollId = setInterval(() => {
      if (tryWire() || ++tries > 40) clearInterval(pollId);
    }, 250);

    // MutationObserver as a backup for DOM insertions
    observer = new MutationObserver(() => { if (wire(document)) { /* keep guard */ } });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopWatching() {
    if (observer) { observer.disconnect(); observer = null; }
    if (pollId) { clearInterval(pollId); pollId = null; }
  }

  // Detect SPA route changes (pushState/replaceState/back/forward)
  const _pushState = history.pushState;
  const _replaceState = history.replaceState;
  function onRouteChange() {
    wiredOnce = false;
    startWatching();
  }
  history.pushState = function () { const r = _pushState.apply(this, arguments); onRouteChange(); return r; };
  history.replaceState = function () { const r = _replaceState.apply(this, arguments); onRouteChange(); return r; };
  window.addEventListener('popstate', onRouteChange);

  // Kick off
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWatching);
  } else {
    startWatching();
  }
})();

