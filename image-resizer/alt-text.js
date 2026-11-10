/* Alt text for the AH Image Resizer: a quick draft from the file name, or a description of the picture written by
   Claude. Claude is reached through AH's own alt text server (see server/), which holds the shared Anthropic key and
   only answers people signed in with an approved Google account. */
(function () {
  'use strict';

  var MAX_SIDE = 1024; // the copy sent for describing is shrunk to this; plenty for a one-line description
  var config = window.AH_CONFIG || {};
  var session = { token: '', email: '', expires: 0 };
  var onChange = function () {};
  var gsiLoading = null;

  function configured() {
    return Boolean(config.altServer && config.googleClientId);
  }

  function humanise(text) {
    var words = String(text).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
  }

  /** A draft made only from words: the topic if there is one, otherwise a file name that reads like words. */
  function fromName(fileName, topic) {
    if (topic && topic.trim()) return humanise(topic);
    var base = String(fileName).replace(/\.[a-z0-9]{2,5}$/i, '');
    // Camera and screenshot names (IMG_4821, PXL_2026..., Screenshot 2026-11-09) say nothing about the picture.
    if (/^(img|dsc|dscn|dscf|pxl|mvimg|gopr|photo|image|screenshot|screen shot|untitled|wp)?[\s_\-.]*[\d\s_\-.()]*$/i.test(base)) return '';
    return humanise(base);
  }

  // ---------- Google sign-in ----------

  function readClaims(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (e) {
      return {};
    }
  }

  function signedIn() {
    return Boolean(session.token) && session.expires - 30000 > Date.now();
  }

  function clearSession() {
    session = { token: '', email: session.email, expires: 0 };
  }

  function loadGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (!gsiLoading) {
      gsiLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = function () { resolve(); };
        script.onerror = function () { gsiLoading = null; reject(new Error('Could not load Google sign-in.')); };
        document.head.appendChild(script);
      });
    }
    return gsiLoading;
  }

  /** Draws Google's sign-in button into the element and calls changed() whenever someone signs in or out. */
  function setUpSignIn(buttonElement, changed) {
    onChange = changed || onChange;
    if (!configured()) return Promise.resolve(false);
    return loadGoogle().then(function () {
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        auto_select: true,
        callback: function (reply) {
          var claims = readClaims(reply.credential || '');
          session = { token: reply.credential || '', email: claims.email || '', expires: (claims.exp || 0) * 1000 };
          onChange();
        }
      });
      window.google.accounts.id.renderButton(buttonElement, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
      return true;
    });
  }

  function signOut() {
    if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect();
    session = { token: '', email: '', expires: 0 };
    onChange();
  }

  // ---------- Asking for alt text ----------

  /**
   * Asks the alt text server to describe one image. jpegBase64 is the picture as it will be published (no
   * watermark), shrunk. Throws an Error with a plain-English message; err.stop is true when retrying other
   * images would fail the same way.
   */
  async function describe(opts) {
    function fail(message, stop) {
      var err = new Error(message);
      err.stop = Boolean(stop);
      return err;
    }
    if (!signedIn()) {
      clearSession();
      onChange();
      throw fail('Your sign-in has expired. Sign in with Google again.', true);
    }
    var response;
    try {
      response = await fetch(config.altServer.replace(/\/+$/, '') + '/alt', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ image: opts.jpegBase64, fileName: opts.fileName, topic: opts.topic || '' })
      });
    } catch (e) {
      throw fail('Could not reach the alt text server. Check the internet connection.', true);
    }
    var data = {};
    try { data = await response.json(); } catch (e) { /* handled below */ }
    if (response.ok && data.alt) return String(data.alt);
    if (response.status === 401) {
      clearSession();
      onChange();
      throw fail(data.error || 'Sign in with Google again.', true);
    }
    // 403 (not on the list), 503 (not set up) and a broken server key will not get better by trying the next image.
    var stop = response.status === 403 || response.status === 503 || data.code === 'server_key_problem';
    throw fail(data.error || 'The alt text server returned an error (' + response.status + ').', stop);
  }

  window.AHAlt = {
    MAX_SIDE: MAX_SIDE, configured: configured, fromName: fromName, humanise: humanise,
    setUpSignIn: setUpSignIn, signedIn: signedIn, signOut: signOut, email: function () { return session.email; },
    describe: describe
  };
})();
