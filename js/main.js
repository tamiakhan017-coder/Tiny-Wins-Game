/*
 * Tiny Wins - shared helpers.
 *
 * Every game registers itself like this:
 *     TinyWins.register("name", { start(rootElement) { ... }, stop() { ... } });
 * start() is called when the player opens the game, stop() when they go back to the menu.
 */
(function () {
  'use strict';

  const TW = {
    games: {},

    register(name, game) {
      this.games[name] = game;
    },

    // mm:ss
    formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },

    // A pop-up box. buttons = [{ label, onClick, light }]. Returns a function that closes it.
    modal(options) {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';

      const box = document.createElement('div');
      box.className = 'modal';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');

      if (options.title) {
        const h = document.createElement('h3');
        h.textContent = options.title;
        box.appendChild(h);
      }

      (options.lines || []).forEach(function (text) {
        const p = document.createElement('p');
        p.textContent = text;
        box.appendChild(p);
      });

      if (options.node) {
        box.appendChild(options.node);
      }

      const row = document.createElement('div');
      row.className = 'row';
      box.appendChild(row);

      function close() {
        overlay.remove();
      }

      (options.buttons || [{ label: 'Close' }]).forEach(function (b) {
        const button = document.createElement('button');
        button.className = 'btn' + (b.light ? ' light' : '');
        button.textContent = b.label;
        button.addEventListener('click', function () {
          close();
          if (b.onClick) b.onClick();
        });
        row.appendChild(button);
      });

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const first = row.querySelector('button');
      if (first) first.focus();

      return close;
    },

    // Remove any pop-up boxes that are still open
    closeAllModals() {
      document.querySelectorAll('.overlay').forEach(function (o) { o.remove(); });
    }
  };

  window.TinyWins = TW;
})();
