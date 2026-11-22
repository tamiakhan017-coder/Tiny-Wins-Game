/*
 * Tiny Wins - the menu: opens and closes the games.
 * (Loaded last, after every game has registered itself.)
 */
(function () {
  'use strict';

  const TW = window.TinyWins;
  const screens = document.querySelectorAll('.screen');
  let current = null; // name of the game that is open, or null for the menu

  function show(name) {

    // Close the game that was open
    if (current && TW.games[current]) {
      TW.games[current].stop();
    }
    TW.closeAllModals();

    const signedIn = !!TW.players.current();
    const valid = signedIn && name && TW.games[name];
    current = valid ? name : null;

    screens.forEach(function (screen) {
      screen.classList.toggle('active', screen.id === (signedIn ? (current || 'menu') : 'login'));
    });

    if (!signedIn) TW.login.render();
    else if (!current) TW.login.renderBar();

    // Open the new game
    if (current) {
      const root = document.getElementById(current + '-root');
      root.innerHTML = '';
      TW.games[current].start(root);
    }

    window.scrollTo(0, 0);
  }

  // Menu buttons and "back" buttons change the address (#chess, #puzzle ...)
  // so the browser's back button works too.
  document.querySelectorAll('[data-game]').forEach(function (button) {
    button.addEventListener('click', function () {
      location.hash = button.dataset.game;
    });
  });

  document.querySelectorAll('[data-back]').forEach(function (button) {
    button.addEventListener('click', function () {
      location.hash = '';
      // Clearing the hash can leave the address as "#" - make sure the menu opens
      show(null);
    });
  });

  window.addEventListener('hashchange', function () {
    show(location.hash.replace('#', ''));
  });

  TW.show = function () { show(location.hash.replace('#', '')); };

  show(location.hash.replace('#', ''));
})();
