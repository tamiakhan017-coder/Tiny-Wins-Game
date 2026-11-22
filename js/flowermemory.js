/*
 * Flower Memory - flip cards and find the matching pairs of flowers.
 *
 * Controls: mouse clicks (or taps).
 * Goal:     match all 8 pairs (16 cards).
 *
 * Click a card to flip it, then click a second card.
 *   Same flower -> the pair stays face up.
 *   Different   -> both flip back, so try to remember where they were!
 *
 * The flowers are drawn with code (canvas), so no picture files are needed.
 */
(function () {
  'use strict';

  const TW = window.TinyWins;

  const PAIRS = 8;
  const CARD_W = 100;   // card size in drawing units (the canvas scales to the real size)
  const CARD_H = 104;
  const SCALE = 2;      // draw at 2x so cards stay sharp

  let root, gridEl, statsEl;
  let cards = [];       // [{ flower, faceUp, matched, el, front }]
  let first = null;
  let second = null;
  let locked = false;
  let started = false;
  let won = false;
  let moves = 0;
  let pairsFound = 0;
  let startMs = 0;
  let endMs = 0;
  let clock = null;
  let hideTimer = null;
  let winTimer = null;

  // ---------- starting / stopping ----------

  function start(el) {

    root = el;
    root.innerHTML =
      '<p class="howto">Flip cards and find matching pairs of flowers. Controls: mouse clicks. Goal: match all pairs.</p>' +
      '<div class="fm-wrap">' +
      '  <div class="fm-title"><span class="a">MEMORY</span> <span class="b">FLOWERS</span></div>' +
      '  <div class="fm-stats" id="fm-stats"></div>' +
      '  <div class="fm-grid" id="fm-grid"></div>' +
      '  <button class="fm-newgame" id="fm-new">New Game</button>' +
      '</div>';

    gridEl = root.querySelector('#fm-grid');
    statsEl = root.querySelector('#fm-stats');
    root.querySelector('#fm-new').addEventListener('click', deal);

    // 16 cards
    cards = [];
    for (let i = 0; i < PAIRS * 2; i++) {

      const card = { flower: 0, faceUp: false, matched: false };

      card.el = document.createElement('div');
      card.el.className = 'fm-card';
      card.el.setAttribute('role', 'button');
      card.el.setAttribute('aria-label', 'Card ' + (i + 1));
      card.el.innerHTML =
        '<div class="inner">' +
        '  <div class="face back"><canvas width="' + CARD_W * SCALE + '" height="' + CARD_H * SCALE + '"></canvas></div>' +
        '  <div class="face front"><canvas width="' + CARD_W * SCALE + '" height="' + CARD_H * SCALE + '"></canvas></div>' +
        '</div>';
      card.backCanvas = card.el.querySelector('.back canvas');
      card.frontCanvas = card.el.querySelector('.front canvas');

      drawBack(card.backCanvas);

      card.el.addEventListener('click', function () { cardClicked(card); });
      gridEl.appendChild(card.el);
      cards.push(card);
    }

    deal();
  }

  function stop() {
    clearInterval(clock);
    clearTimeout(hideTimer);
    clearTimeout(winTimer);
    clock = null;
  }

  // ---------- game rules ----------

  // Shuffle the flowers and put every card face down (also used for "New Game")
  function deal() {

    stop();

    const flowers = [];
    for (let i = 0; i < PAIRS; i++) {
      flowers.push(i, i);
    }
    // Fisher-Yates shuffle
    for (let i = flowers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = flowers[i]; flowers[i] = flowers[j]; flowers[j] = t;
    }

    cards.forEach(function (card, i) {
      card.flower = flowers[i];
      card.faceUp = false;
      card.matched = false;
      card.el.classList.remove('flipped');
      drawFront(card.frontCanvas, card.flower, false);
    });

    first = null;
    second = null;
    locked = false;
    started = false;
    won = false;
    moves = 0;
    pairsFound = 0;
    startMs = 0;
    endMs = 0;

    updateStats();
  }

  function cardClicked(card) {

    // Ignore clicks while two wrong cards are showing, after winning,
    // or on a card that is already face up
    if (locked || won || card.faceUp || card.matched) return;

    // The clock starts with the very first flip
    if (!started) {
      started = true;
      startMs = Date.now();
      clock = setInterval(updateStats, 1000);
    }

    flip(card, true);

    if (first === null) {
      first = card;
      updateStats();
      return;
    }

    // Second card of a try
    second = card;
    moves++;

    if (first.flower === second.flower) {

      first.matched = true;
      second.matched = true;
      drawFront(first.frontCanvas, first.flower, true);
      drawFront(second.frontCanvas, second.flower, true);
      pairsFound++;

      first = null;
      second = null;

      if (pairsFound === PAIRS) finish();

    } else {
      locked = true;
      hideTimer = setTimeout(hideWrongPair, 900); // flip both back after a short look
    }

    updateStats();
  }

  function flip(card, faceUp) {
    card.faceUp = faceUp;
    card.el.classList.toggle('flipped', faceUp);
  }

  function hideWrongPair() {
    if (first) flip(first, false);
    if (second) flip(second, false);
    first = null;
    second = null;
    locked = false;
  }

  function finish() {
    won = true;
    endMs = Date.now();
    clearInterval(clock);
    clock = null;
    best = TW.scores.record('flowers', { moves: moves, timeMs: elapsed() });
    winTimer = setTimeout(showWin, 700); // wait for the last flip to finish
  }

  let best = null;

  function bestLines(b) {
    const out = [];
    if (b && b.newBestMoves) out.push('New best for moves!');
    if (b && b.newBestTime) out.push('New best time!');
    return out;
  }

  function showWin() {
    TW.modal({
      title: 'You did it!',
      lines: [
        'You found all ' + PAIRS + ' pairs!',
        'Moves: ' + moves,
        'Time: ' + TW.formatTime(elapsed())
      ].concat(bestLines(best)),
      buttons: [
        { label: 'Play Again', onClick: deal },
        { label: 'Close', light: true }
      ]
    });
  }

  // ---------- time and status ----------

  function elapsed() {
    if (!started) return 0;
    return (endMs || Date.now()) - startMs;
  }

  function updateStats() {
    statsEl.textContent =
      'Moves: ' + moves + '     Pairs: ' + pairsFound + '/' + PAIRS + '     Time: ' + TW.formatTime(elapsed());
  }

  // ---------- drawing the cards ----------

  function rgb(r, g, b) {
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Small notebook rings on the left edge of every card
  function drawRings(ctx) {
    for (let i = 0; i < 3; i++) {
      const y = CARD_H * (0.24 + i * 0.26);
      roundRect(ctx, 1, y - 5, 15, 10, 5);
      ctx.fillStyle = rgb(52, 96, 164);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.67)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function prepare(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    return ctx;
  }

  function drawBack(canvas) {

    const ctx = prepare(canvas);
    const w = CARD_W;
    const h = CARD_H;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, rgb(96, 150, 214));
    gradient.addColorStop(1, rgb(70, 118, 190));

    roundRect(ctx, 7, 3, w - 10, h - 6, 14);
    ctx.fillStyle = gradient;
    ctx.fill();

    // dotted line inside the border
    ctx.save();
    ctx.setLineDash([2, 5]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.47)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 13, 9, w - 22, h - 18, 9);
    ctx.stroke();
    ctx.restore();

    // a little white flower
    const cx = w / 2 + 3;
    const cy = h / 2;
    const s = 26;
    for (let i = 0; i < 6; i++) {
      petal(ctx, cx, cy, i * 60, 0.36 * s, 0.32 * s, 0.62 * s, 'rgba(255,255,255,0.9)', null);
    }
    disc(ctx, cx, cy, 0.18 * s, rgb(255, 214, 96));

    roundRect(ctx, 7, 3, w - 10, h - 6, 14);
    ctx.strokeStyle = rgb(60, 105, 153);
    ctx.lineWidth = 3.5;
    ctx.stroke();

    drawRings(ctx);
  }

  function drawFront(canvas, flower, matched) {

    const ctx = prepare(canvas);
    const w = CARD_W;
    const h = CARD_H;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, matched ? rgb(222, 242, 253) : rgb(190, 226, 247));
    gradient.addColorStop(1, matched ? rgb(200, 232, 250) : rgb(160, 207, 240));

    roundRect(ctx, 7, 3, w - 10, h - 6, 14);
    ctx.fillStyle = gradient;
    ctx.fill();

    // thin light line inside the border
    roundRect(ctx, 13, 9, w - 22, h - 18, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.59)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawFlower(ctx, flower, w / 2 + 3, h / 2, Math.min(w, h) * 0.29);

    roundRect(ctx, 7, 3, w - 10, h - 6, 14);
    ctx.strokeStyle = matched ? rgb(255, 196, 58) : rgb(86, 140, 204);
    ctx.lineWidth = matched ? 4.5 : 3.5;
    ctx.stroke();

    drawRings(ctx);
  }

  // ---------- drawing the flowers (s = size of the flower, cx/cy = its middle) ----------

  function drawFlower(ctx, type, cx, cy, s) {

    switch (type) {

      case 0: { // Pink flower with violet inner petals
        for (let i = 0; i < 6; i++) {
          petal(ctx, cx, cy, i * 60, 0.64 * s, 0.50 * s, 0.82 * s, rgb(255, 112, 162), rgb(208, 62, 120));
        }
        for (let i = 0; i < 6; i++) {
          petal(ctx, cx, cy, i * 60 + 30, 0.40 * s, 0.32 * s, 0.56 * s, rgb(150, 108, 214), rgb(106, 70, 170));
        }
        disc(ctx, cx, cy, 0.22 * s, rgb(255, 160, 40));
        disc(ctx, cx, cy, 0.11 * s, rgb(255, 218, 80));
        break;
      }

      case 1: { // Dark blue leaves on a stem
        const navy = rgb(40, 78, 152);
        const navyEdge = rgb(24, 50, 112);
        const vein = rgb(150, 192, 242);
        line(ctx, cx, cy + 1.05 * s, cx, cy - 0.15 * s, 0.09 * s, navyEdge);
        leaf(ctx, cx, cy + 0.80 * s, -52, 0.80 * s, 0.17 * s, navy, navyEdge, vein);
        leaf(ctx, cx, cy + 0.80 * s, 52, 0.80 * s, 0.17 * s, navy, navyEdge, vein);
        leaf(ctx, cx, cy + 0.35 * s, -48, 0.80 * s, 0.17 * s, navy, navyEdge, vein);
        leaf(ctx, cx, cy + 0.35 * s, 48, 0.80 * s, 0.17 * s, navy, navyEdge, vein);
        leaf(ctx, cx, cy - 0.05 * s, 0, 0.95 * s, 0.19 * s, navy, navyEdge, vein);
        break;
      }

      case 2: { // Orange flower
        for (let i = 0; i < 8; i++) {
          petal(ctx, cx, cy, i * 45, 0.62 * s, 0.46 * s, 0.76 * s, rgb(244, 92, 44), rgb(184, 54, 28));
        }
        for (let i = 0; i < 8; i++) {
          petal(ctx, cx, cy, i * 45 + 22.5, 0.42 * s, 0.30 * s, 0.50 * s, rgb(255, 152, 52), rgb(214, 100, 24));
        }
        disc(ctx, cx, cy, 0.27 * s, rgb(226, 112, 28));
        disc(ctx, cx, cy, 0.20 * s, rgb(255, 206, 54));
        break;
      }

      case 3: { // Yellow flower
        for (let i = 0; i < 10; i++) {
          petal(ctx, cx, cy, i * 36, 0.64 * s, 0.34 * s, 0.72 * s, rgb(255, 208, 48), rgb(222, 154, 18));
        }
        for (let i = 0; i < 10; i++) {
          petal(ctx, cx, cy, i * 36 + 18, 0.38 * s, 0.22 * s, 0.40 * s, rgb(255, 160, 40), null);
        }
        disc(ctx, cx, cy, 0.24 * s, rgb(214, 108, 30));
        for (let i = 0; i < 6; i++) {
          const a = i * 60 * Math.PI / 180;
          disc(ctx, cx + Math.cos(a) * 0.11 * s, cy + Math.sin(a) * 0.11 * s, 0.045 * s, rgb(255, 214, 90));
        }
        break;
      }

      case 4: { // Pink sprig with two small flowers
        const teal = rgb(40, 148, 128);
        const tealEdge = rgb(24, 104, 92);
        const light = rgb(176, 232, 218);

        ctx.strokeStyle = teal;
        ctx.lineWidth = 0.08 * s;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(cx, cy + 1.08 * s);
        ctx.quadraticCurveTo(cx + 0.12 * s, cy + 0.25 * s, cx - 0.38 * s, cy - 0.38 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + 0.04 * s, cy + 0.55 * s);
        ctx.quadraticCurveTo(cx + 0.34 * s, cy + 0.42 * s, cx + 0.44 * s, cy - 0.02 * s);
        ctx.stroke();

        leaf(ctx, cx + 0.03 * s, cy + 0.85 * s, -55, 0.62 * s, 0.14 * s, teal, tealEdge, light);
        leaf(ctx, cx + 0.06 * s, cy + 0.62 * s, 58, 0.62 * s, 0.14 * s, teal, tealEdge, light);

        smallFlower(ctx, cx - 0.38 * s, cy - 0.42 * s, 0.62 * s, 10);
        smallFlower(ctx, cx + 0.46 * s, cy - 0.06 * s, 0.50 * s, 40);
        break;
      }

      case 5: { // Light blue leaf with white veins
        const fill = rgb(112, 186, 238);
        const edge = rgb(58, 128, 200);
        const baseY = cy + 1.0 * s;
        line(ctx, cx, baseY + 0.18 * s, cx, baseY, 0.08 * s, edge);
        pointedPetal(ctx, cx, baseY, 0, 1.95 * s, 0.56 * s, fill, edge);

        const white = 'rgba(255,255,255,0.9)';
        line(ctx, cx, baseY, cx, baseY - 1.62 * s, 0.06 * s, white);
        for (let i = 1; i <= 4; i++) {
          const t = i * 0.17;
          const y = baseY - t * 1.9 * s;
          const reach = 0.34 * s * (1 - t * 0.9);
          line(ctx, cx, y, cx - reach, y - 0.24 * s, 0.045 * s, white);
          line(ctx, cx, y, cx + reach, y - 0.24 * s, 0.045 * s, white);
        }
        break;
      }

      case 6: { // Orange-yellow flower with pointed petals
        for (let i = 0; i < 12; i++) {
          pointedPetal(ctx, cx, cy, i * 30, 1.0 * s, 0.17 * s, rgb(255, 146, 28), rgb(208, 96, 10));
        }
        for (let i = 0; i < 12; i++) {
          pointedPetal(ctx, cx, cy, i * 30 + 15, 0.70 * s, 0.15 * s, rgb(255, 208, 52), rgb(228, 160, 20));
        }
        disc(ctx, cx, cy, 0.26 * s, rgb(186, 92, 24));
        disc(ctx, cx, cy, 0.18 * s, rgb(255, 190, 60));
        break;
      }

      case 7: { // Blue-violet flower
        for (let i = 0; i < 5; i++) {
          petal(ctx, cx, cy, i * 72, 0.56 * s, 0.66 * s, 0.74 * s, rgb(124, 138, 232), rgb(78, 90, 190));
        }
        for (let i = 0; i < 5; i++) {
          const a = i * 72 * Math.PI / 180;
          line(ctx,
               cx + Math.sin(a) * 0.26 * s, cy - Math.cos(a) * 0.26 * s,
               cx + Math.sin(a) * 0.62 * s, cy - Math.cos(a) * 0.62 * s,
               0.03 * s, rgb(200, 208, 250));
        }
        disc(ctx, cx, cy, 0.27 * s, '#fff');
        disc(ctx, cx, cy, 0.17 * s, rgb(255, 214, 96));
        break;
      }
    }
  }

  // A small five-petal pink flower (used in the sprig)
  function smallFlower(ctx, x, y, r, rotation) {
    for (let i = 0; i < 5; i++) {
      petal(ctx, x, y, rotation + i * 72, 0.50 * r, 0.62 * r, 0.76 * r, rgb(255, 118, 168), rgb(208, 62, 120));
    }
    disc(ctx, x, y, 0.24 * r, rgb(255, 214, 80));
  }

  // A leaf with a lighter line down the middle
  function leaf(ctx, px, py, angleDeg, len, wid, fill, edge, vein) {
    pointedPetal(ctx, px, py, angleDeg, len, wid, fill, edge);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleDeg * Math.PI / 180);
    line(ctx, 0, 0, 0, -len * 0.80, 1.3, vein);
    ctx.restore();
  }

  // A round petal. (px,py) is the middle of the flower, the petal sits 'dist' away
  // from it, and angleDeg turns it around the middle (0 = pointing up).
  function petal(ctx, px, py, angleDeg, dist, pw, ph, fill, edge) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleDeg * Math.PI / 180);

    ctx.beginPath();
    ctx.ellipse(0, -dist, pw / 2, ph / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // A pointed petal / leaf that starts at (px,py) and points up before turning
  function pointedPetal(ctx, px, py, angleDeg, len, wid, fill, edge) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleDeg * Math.PI / 180);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid * 1.6, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(-wid * 1.6, -len * 0.55, 0, 0);
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function line(ctx, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // For automatic testing only
  window.__flowersTest = {
    cards: function () { return cards.map(function (c) { return { flower: c.flower, faceUp: c.faceUp, matched: c.matched }; }); },
    click: function (i) { cards[i].el.click(); },
    state: function () { return { moves: moves, pairsFound: pairsFound, locked: locked, won: won }; },
    showAll: function () { cards.forEach(function (c, i) { c.flower = i % 8; drawFront(c.frontCanvas, c.flower, false); flip(c, true); }); }
  };

  TW.register('flowers', { start: start, stop: stop });

})();
