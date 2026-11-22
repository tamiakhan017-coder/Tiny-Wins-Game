/*
 * Sign-in screen, the player bar on the menu, and the scoreboard screen.
 */
(function () {
  'use strict';

  const TW = window.TinyWins;
  const P = TW.players;

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }

  function field(label, input) {
    const l = el('label', {}, label);
    l.appendChild(input);
    return l;
  }

  function goIn() {
    TW.show();
  }

  // ---------- sign-in screen ----------

  let mode = null;   // 'signin' or 'new'

  function renderLogin() {

    const root = document.getElementById('login-root');
    root.innerHTML = '';

    const people = P.list();
    if (mode === null) mode = people.length ? 'signin' : 'new';
    if (mode === 'signin' && !people.length) mode = 'new';

    const box = el('form', { 'class': 'login-box', autocomplete: 'off' });
    const error = el('p', { 'class': 'form-error', 'aria-live': 'polite' });

    if (mode === 'signin') {

      const select = el('select', { id: 'lg-player' });
      people.forEach(function (p) { select.appendChild(el('option', { value: p.key }, p.name)); });
      const pin = el('input', { id: 'lg-pin', type: 'password', autocomplete: 'off', placeholder: 'Password or PIN' });

      box.appendChild(field('Player', select));
      box.appendChild(field('Password or PIN', pin));
      box.appendChild(error);
      box.appendChild(el('button', { 'class': 'btn', type: 'submit' }, 'Play'));

      const other = el('button', { 'class': 'linkish', type: 'button' }, 'I am new - make a player');
      other.addEventListener('click', function () { mode = 'new'; renderLogin(); });
      box.appendChild(other);

      box.addEventListener('submit', function (e) {
        e.preventDefault();
        P.signIn(select.value, pin.value).then(function (r) {
          if (r.ok) goIn(); else { error.textContent = r.error; pin.value = ''; pin.focus(); }
        });
      });

    } else {

      const name = el('input', { id: 'lg-name', type: 'text', maxlength: '16', placeholder: 'Your name' });
      const pin = el('input', { id: 'lg-pin', type: 'password', autocomplete: 'new-password', placeholder: '4 to 12 characters' });
      const pin2 = el('input', { id: 'lg-pin2', type: 'password', autocomplete: 'new-password', placeholder: 'Type it again' });
      const inputs = { name: name, pin: pin, pin2: pin2 };

      box.appendChild(field('Name', name));
      box.appendChild(field('Password or PIN', pin));
      box.appendChild(field('Password or PIN again', pin2));
      box.appendChild(error);
      box.appendChild(el('button', { 'class': 'btn', type: 'submit' }, 'Start playing'));
      box.appendChild(el('p', { 'class': 'form-note' },
        'Your scores are saved on this device only. The password is a simple lock, so do not reuse a real one.'));

      if (people.length) {
        const back = el('button', { 'class': 'linkish', type: 'button' }, 'I already have a player');
        back.addEventListener('click', function () { mode = 'signin'; renderLogin(); });
        box.appendChild(back);
      }

      box.addEventListener('submit', function (e) {
        e.preventDefault();
        P.create(name.value, pin.value, pin2.value).then(function (r) {
          if (r.ok) goIn();
          else { error.textContent = r.error; (inputs[r.field] || name).focus(); }
        });
      });
    }

    if (!P.storageOk) {
      box.appendChild(el('p', { 'class': 'form-note' }, 'Your browser is not letting this page save scores (private mode?).'));
    }

    root.appendChild(box);
  }

  // ---------- player bar on the menu ----------

  function renderBar() {
    const bar = document.getElementById('player-bar');
    const me = P.current();
    bar.innerHTML = '';
    if (!me) return;
    bar.appendChild(el('span', {}, 'Playing as ' + me.name));
    const out = el('button', { type: 'button', id: 'signout' }, 'Switch player');
    out.addEventListener('click', function () { P.signOut(); mode = null; TW.show(); });
    bar.appendChild(out);
  }

  // ---------- scoreboard ----------

  const TABS = [
    ['chess', 'Chess', ['Wins', 'Draws', 'Losses'], function (r) { return [r.wins, r.draws, r.losses]; }],
    ['catchstars', 'Catch Stars', ['Best', 'Wins'], function (r) { return [r.best + '/20', r.wins]; }],
    ['flowers', 'Flower Memory', ['Fewest moves', 'Best time'], function (r) { return [r.bestMoves, TW.formatTime(r.bestTimeMs)]; }],
    ['puzzle', 'Puzzle', ['Fewest moves', 'Best time'], function (r) { return [r.bestMoves, TW.formatTime(r.bestTimeMs)]; }]
  ];
  let tab = 'chess';

  function renderScores(root) {

    root.innerHTML = '';
    const me = P.current();

    const tabs = el('div', { 'class': 'sb-tabs' });
    TABS.forEach(function (t) {
      const b = el('button', { type: 'button', 'data-tab': t[0], 'class': t[0] === tab ? 'on' : '' }, t[1]);
      b.addEventListener('click', function () { tab = t[0]; renderScores(root); });
      tabs.appendChild(b);
    });
    root.appendChild(tabs);

    const def = TABS.filter(function (t) { return t[0] === tab; })[0];
    const rows = TW.scores.table(tab);

    if (!rows.length) {
      root.appendChild(el('p', { 'class': 'sb-empty' }, 'No scores yet - be the first!'));
      return;
    }

    const table = el('table', { 'class': 'sb-table' });
    const head = el('tr');
    ['#', 'Player'].concat(def[2]).forEach(function (h) { head.appendChild(el('th', {}, h)); });
    table.appendChild(head);

    rows.forEach(function (r, i) {
      const tr = el('tr', me && me.key === r.key ? { 'class': 'me' } : {});
      [String(i + 1), r.name].concat(def[3](r).map(String)).forEach(function (c) { tr.appendChild(el('td', {}, c)); });
      table.appendChild(tr);
    });
    root.appendChild(table);
  }

  TW.register('scores', { start: renderScores, stop: function () {} });
  TW.login = { render: renderLogin, renderBar: renderBar };
})();
