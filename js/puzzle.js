/*
 * Picture sliding puzzle (the classic "8-puzzle").
 *
 * Rules:
 *  - The picture is cut into 9 tiles and the bottom-right tile is removed,
 *    which leaves one empty space.
 *  - You can only slide a tile that touches the empty space (up, down, left, right).
 *  - Put all the tiles back in the right order to finish the picture.
 *
 * The shuffle is made by sliding tiles randomly from the finished picture,
 * so every puzzle can always be solved.
 *
 * The picture is the file  puzzle.png  (next to index.html).
 */
(function () {
  'use strict';

  const TW = window.TinyWins;

  const SIZE = 3;
  const TILES = SIZE * SIZE;
  const MISSING = TILES - 1;     // the tile that is taken out (bottom-right)
  const PICTURE = 'puzzle.png';

  let root, boardEl, statusEl;
  let tileEls = [];              // tileEls[t] is the element for piece number t
  let order = [];                // order[position] = which piece is there
  let moves = 0;
  let solved = false;
  let started = false;
  let startMs = 0;
  let endMs = 0;
  let clock = null;

  // ---------- starting / stopping ----------

  function start(el) {

    root = el;
    root.innerHTML =
      '<p class="howto">Slide a tile into the empty space. Put the picture back together!</p>' +
      '<div class="status" id="pz-status" aria-live="polite"></div>' +
      '<div class="pz-board" id="pz-board"></div>' +
      '<div class="row">' +
      '  <button class="btn" id="pz-shuffle">Shuffle Again</button>' +
      '  <button class="btn" id="pz-peek">Show Picture</button>' +
      '</div>';

    boardEl = root.querySelector('#pz-board');
    statusEl = root.querySelector('#pz-status');

    root.querySelector('#pz-shuffle').addEventListener('click', shuffle);
    root.querySelector('#pz-peek').addEventListener('click', showPicture);

    // Use the picture's real shape for the board (no stretching)
    const img = new Image();
    img.onload = function () {
      boardEl.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
    };
    img.onerror = function () {
      statusEl.textContent = 'Cannot find puzzle.png - put it next to index.html.';
    };
    img.src = PICTURE;

    // Build the 9 tiles
    tileEls = [];
    for (let t = 0; t < TILES; t++) {
      const tile = document.createElement('div');
      tile.className = 'pz-tile';
      tile.style.backgroundPosition = ((t % SIZE) * 100 / (SIZE - 1)) + '% ' + (Math.floor(t / SIZE) * 100 / (SIZE - 1)) + '%';
      tile.addEventListener('click', function () { clickTile(order.indexOf(t)); });
      boardEl.appendChild(tile);
      tileEls.push(tile);
    }

    shuffle();
  }

  function stop() {
    clearInterval(clock);
    clock = null;
  }

  // ---------- rules ----------

  // Start from the finished picture, then slide tiles around at random.
  // (Shuffling by legal moves guarantees the puzzle can be solved.)
  function shuffle() {

    stop();

    do {
      order = [];
      for (let i = 0; i < TILES; i++) order.push(i);

      let empty = TILES - 1;
      let previous = -1;

      for (let step = 0; step < 300; step++) {

        const options = neighboursOf(empty);
        let pick;

        // Don't immediately undo the last slide
        do {
          pick = options[Math.floor(Math.random() * options.length)];
        } while (pick === previous && options.length > 1);

        swap(empty, pick);
        previous = empty;
        empty = pick;
      }
    } while (isSolved()); // never start already finished

    moves = 0;
    solved = false;
    started = false;
    startMs = 0;
    endMs = 0;

    render();
  }

  function neighboursOf(position) {
    const r = Math.floor(position / SIZE);
    const c = position % SIZE;
    const list = [];
    if (r > 0) list.push(position - SIZE);
    if (r < SIZE - 1) list.push(position + SIZE);
    if (c > 0) list.push(position - 1);
    if (c < SIZE - 1) list.push(position + 1);
    return list;
  }

  function swap(a, b) {
    const t = order[a];
    order[a] = order[b];
    order[b] = t;
  }

  function isSolved() {
    for (let i = 0; i < TILES; i++) {
      if (order[i] !== i) return false;
    }
    return true;
  }

  // Can the tile at this position slide into the empty space? (only if they touch)
  function canSlide(position) {
    const empty = order.indexOf(MISSING);
    const dr = Math.abs(Math.floor(position / SIZE) - Math.floor(empty / SIZE));
    const dc = Math.abs((position % SIZE) - (empty % SIZE));
    return dr + dc === 1;
  }

  function clickTile(position) {

    if (solved) return;

    if (!canSlide(position)) {
      statusEl.textContent = 'Only tiles next to the empty space can move!';
      return;
    }

    // The clock starts with the very first slide
    if (!started) {
      started = true;
      startMs = Date.now();
      clock = setInterval(updateStatus, 1000);
    }

    swap(position, order.indexOf(MISSING));
    moves++;

    if (isSolved()) {
      solved = true;
      endMs = Date.now();
      clearInterval(clock);
      clock = null;
      render();

      const best = TW.scores.record('puzzle', { moves: moves, timeMs: elapsed() });
      const extra = [];
      if (best && best.newBestMoves) extra.push('New best for moves!');
      if (best && best.newBestTime) extra.push('New best time!');

      TW.modal({
        title: 'You finished the picture!',
        lines: ['Moves: ' + moves, 'Time: ' + TW.formatTime(elapsed())].concat(extra),
        buttons: [
          { label: 'Play Again', onClick: shuffle },
          { label: 'Close', light: true }
        ]
      });
    } else {
      render();
    }
  }

  function showPicture() {
    const img = document.createElement('img');
    img.src = PICTURE;
    img.alt = 'The finished picture';

    TW.modal({
      title: 'The finished picture',
      node: img,
      buttons: [{ label: 'Close' }]
    });
  }

  // ---------- time and drawing ----------

  function elapsed() {
    if (!started) return 0;
    return (endMs || Date.now()) - startMs;
  }

  function updateStatus() {

    const time = TW.formatTime(elapsed());

    if (solved) {
      statusEl.textContent = 'You did it!  Moves: ' + moves + '   Time: ' + time;
    } else if (moves === 0) {
      statusEl.textContent = 'Slide a tile into the empty space!   Time: ' + time;
    } else {
      statusEl.textContent = 'Moves: ' + moves + '   Time: ' + time;
    }
  }

  function render() {

    for (let position = 0; position < TILES; position++) {

      const t = order[position];
      const el = tileEls[t];

      el.style.left = ((position % SIZE) * 100 / SIZE) + '%';
      el.style.top = (Math.floor(position / SIZE) * 100 / SIZE) + '%';

      // The missing piece stays hidden until the picture is finished
      el.classList.toggle('hidden', t === MISSING && !solved);
    }

    updateStatus();
  }

  // For automatic testing only
  window.__puzzleTest = {
    order: function () { return order.slice(); },
    setOrder: function (o) { order = o.slice(); solved = false; render(); },
    click: function (position) { clickTile(position); },
    state: function () { return { moves: moves, solved: solved, started: started }; },
    isSolved: isSolved,
    shuffle: shuffle
  };

  TW.register('puzzle', { start: start, stop: stop });

})();
