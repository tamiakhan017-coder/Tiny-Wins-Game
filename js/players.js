/*
 * Players and scores (saved in the browser, on this device only).
 *
 *   TinyWins.players  - make a player, sign in, sign out, delete
 *   TinyWins.scores   - save a game result and read the scoreboard
 *
 * Everything is kept in the browser's localStorage under one key. Nothing is sent anywhere.
 * The password / PIN is stored as a scrambled value (a "hash"), never as plain text.
 * It is a lock for friendly use on a shared device - not real security.
 */
(function () {
  'use strict';

  const TW = window.TinyWins;

  const STORAGE_KEY = 'tinywins.v1';
  const SESSION_KEY = 'tinywins.player';

  let storageOk = true;       // false if the browser refuses to save anything
  let sessionMemory = null;

  // ---------- saving and loading ----------

  function freshData() {
    return { v: 1, players: {}, stats: {} };
  }

  function load() {
    let raw = null;

    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageOk = false;
    }

    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object' && d.players && d.stats) return d;
      } catch (e) { /* damaged data: start fresh */ }
    }
    return freshData();
  }

  let data = load();

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      storageOk = false;
    }
  }

  // Which player is signed in: remembered while this tab stays open
  function getSession() {
    try {
      const v = window.sessionStorage.getItem(SESSION_KEY);
      if (v !== null) return v;
    } catch (e) { /* ignore */ }
    return sessionMemory;
  }

  function setSession(value) {
    sessionMemory = value;
    try {
      if (value === null) window.sessionStorage.removeItem(SESSION_KEY);
      else window.sessionStorage.setItem(SESSION_KEY, value);
    } catch (e) { /* ignore */ }
  }

  // ---------- names and passwords ----------

  function cleanName(name) {
    return String(name || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function keyOf(name) {
    return cleanName(name).toLowerCase();
  }

  // Returns a message if the name is not allowed, or '' if it is fine
  function nameError(name) {

    const n = cleanName(name);

    if (n.length === 0) return 'Please type a name.';
    if (Array.from(n).length > 16) return 'A name can have at most 16 characters.';
    // letters (any language, including Bengali), numbers, spaces, _ - .
    if (!/^[\p{L}\p{M}\p{N} _.\-]+$/u.test(n)) return 'Use only letters, numbers, spaces and _ - . in the name.';
    if (data.players[keyOf(n)]) return 'That name is already used on this device.';
    return '';
  }

  function pinError(pin) {
    const p = String(pin || '');
    if (p.length < 4 || p.length > 12) return 'Use 4 to 12 characters for the password or PIN.';
    if (p.trim() !== p) return 'The password or PIN cannot start or end with a space.';
    return '';
  }

  function toHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return toHex(bytes);
  }

  // A small fallback scrambler for browsers without the Web Crypto tools
  function simpleHash(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function bestAlgorithm() {
    return (window.crypto && window.crypto.subtle && window.crypto.subtle.importKey) ? 'pbkdf2' : 'simple';
  }

  function hashPin(pin, salt, algorithm) {

    if (algorithm === 'pbkdf2') {
      if (!(window.crypto && window.crypto.subtle)) {
        return Promise.reject(new Error('no-crypto'));
      }
      const enc = new TextEncoder();
      return window.crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
        .then(function (material) {
          return window.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode(salt), iterations: 60000, hash: 'SHA-256' },
            material, 256
          );
        })
        .then(function (bits) { return toHex(new Uint8Array(bits)); });
    }

    return Promise.resolve(simpleHash(salt + ':' + pin));
  }

  // ---------- players ----------

  const attempts = {};   // wrong tries per player (kept only while the page is open)

  const players = {

    get storageOk() { return storageOk; },

    // [{ key, name }] sorted by name
    list() {
      return Object.keys(data.players)
        .map(function (k) { return { key: k, name: data.players[k].name }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    },

    nameError: nameError,
    pinError: pinError,
    cleanName: cleanName,

    // The signed-in player: { key, name } or null
    current() {
      const key = getSession();
      if (key && data.players[key]) return { key: key, name: data.players[key].name };
      return null;
    },

    // Make a new player and sign in. Resolves to { ok: true } or { ok: false, error, field }
    create(name, pin, pinAgain) {

      const nErr = nameError(name);
      if (nErr) return Promise.resolve({ ok: false, error: nErr, field: 'name' });

      const pErr = pinError(pin);
      if (pErr) return Promise.resolve({ ok: false, error: pErr, field: 'pin' });

      if (pin !== pinAgain) {
        return Promise.resolve({ ok: false, error: 'The two passwords do not match.', field: 'pin2' });
      }

      const salt = randomSalt();
      const algorithm = bestAlgorithm();

      return hashPin(pin, salt, algorithm).then(function (hash) {

        const display = cleanName(name);
        const key = keyOf(display);

        data.players[key] = {
          name: display,
          created: Date.now(),
          pin: { algo: algorithm, salt: salt, hash: hash }
        };
        data.stats[key] = blankStats();
        save();
        setSession(key);

        return { ok: true };

      }).catch(function () {
        return { ok: false, error: 'This browser could not set up the password. Try another browser.', field: 'pin' };
      });
    },

    // Check the password and sign in. Resolves to { ok: true } or { ok: false, error }
    signIn(key, pin) {

      const player = data.players[key];
      if (!player) return Promise.resolve({ ok: false, error: 'That player was not found.' });

      const a = attempts[key] || { count: 0, until: 0 };
      const now = Date.now();

      if (a.until > now) {
        const wait = Math.ceil((a.until - now) / 1000);
        return Promise.resolve({ ok: false, error: 'Too many tries. Please wait ' + wait + ' seconds.' });
      }

      return hashPin(String(pin || ''), player.pin.salt, player.pin.algo).then(function (hash) {

        if (hash === player.pin.hash) {
          attempts[key] = { count: 0, until: 0 };
          setSession(key);
          return { ok: true };
        }

        a.count++;
        if (a.count >= 5) {
          a.count = 0;
          a.until = Date.now() + 30000;
        }
        attempts[key] = a;
        return { ok: false, error: 'That password is not right. Try again.' };

      }).catch(function () {
        return { ok: false, error: 'This browser cannot check the password here.' };
      });
    },

    signOut() {
      setSession(null);
    },

    // Delete a player and all of their scores
    remove(key) {
      delete data.players[key];
      delete data.stats[key];
      save();
      if (getSession() === key) setSession(null);
    }
  };

  // ---------- scores ----------

  function blankStats() {
    return {
      chess:      { played: 0, wins: 0, draws: 0, losses: 0 },
      catchstars: { plays: 0, wins: 0, best: 0 },
      flowers:    { plays: 0, bestMoves: null, bestTimeMs: null },
      puzzle:     { plays: 0, bestMoves: null, bestTimeMs: null }
    };
  }

  function statsFor(key) {
    const blank = blankStats();
    if (!data.stats[key]) data.stats[key] = blank;
    const s = data.stats[key];
    Object.keys(blank).forEach(function (g) { if (!s[g]) s[g] = blank[g]; });
    return s;
  }

  function better(value, old, lowerIsBetter) {
    if (old === null || old === undefined) return true;
    return lowerIsBetter ? value < old : value > old;
  }

  const scores = {

    // Save a finished game for the signed-in player (or for the given key).
    // Returns facts such as { newBestMoves: true } so the game can congratulate the player.
    record(game, info, key) {

      const who = key || (players.current() && players.current().key);
      if (!who || !data.players[who]) return null;

      const s = statsFor(who)[game];
      const result = {};

      if (game === 'catchstars') {
        s.plays++;
        if (info.won) s.wins++;
        result.newBest = info.score > s.best;
        if (result.newBest) s.best = info.score;
        result.best = s.best;
      }

      if (game === 'flowers' || game === 'puzzle') {
        s.plays++;
        result.newBestMoves = better(info.moves, s.bestMoves, true);
        if (result.newBestMoves) s.bestMoves = info.moves;
        result.newBestTime = better(info.timeMs, s.bestTimeMs, true);
        if (result.newBestTime) s.bestTimeMs = info.timeMs;
        result.bestMoves = s.bestMoves;
        result.bestTimeMs = s.bestTimeMs;
      }

      save();
      return result;
    },

    // Chess has two players. outcome is 'white', 'black' or 'draw'.
    // blackKey may be null (a guest who has no profile).
    recordChess(whiteKey, blackKey, outcome) {

      function add(key, mine) {
        if (!key || !data.players[key]) return;
        const s = statsFor(key).chess;
        s.played++;
        if (outcome === 'draw') s.draws++;
        else if (outcome === mine) s.wins++;
        else s.losses++;
      }

      add(whiteKey, 'white');
      if (blackKey && blackKey !== whiteKey) add(blackKey, 'black');
      save();
    },

    // Rows for the scoreboard, best first. Players who have not played that game are left out.
    table(game) {

      const rows = Object.keys(data.players).map(function (key) {
        return Object.assign({ key: key, name: data.players[key].name }, statsFor(key)[game]);
      });

      function num(v, fallback) { return v === null || v === undefined ? fallback : v; }

      let list;
      if (game === 'chess') {
        list = rows.filter(function (r) { return r.played > 0; }).sort(function (a, b) {
          return (b.wins - a.wins) || (b.draws - a.draws) || (a.played - b.played) || a.name.localeCompare(b.name);
        });
      } else if (game === 'catchstars') {
        list = rows.filter(function (r) { return r.plays > 0; }).sort(function (a, b) {
          return (b.best - a.best) || (b.wins - a.wins) || a.name.localeCompare(b.name);
        });
      } else {
        list = rows.filter(function (r) { return r.plays > 0; }).sort(function (a, b) {
          return (num(a.bestMoves, 1e9) - num(b.bestMoves, 1e9)) ||
                 (num(a.bestTimeMs, 1e12) - num(b.bestTimeMs, 1e12)) ||
                 a.name.localeCompare(b.name);
        });
      }
      return list;
    },

    // Wipe one player's scores (keeps the player)
    reset(key) {
      if (data.players[key]) {
        data.stats[key] = blankStats();
        save();
      }
    }
  };

  TW.players = players;
  TW.scores = scores;

})();
