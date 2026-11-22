/*
 * Catch Stars - help Boo catch 20 falling stars. Miss 3 and the game is over.
 *
 * Controls: LEFT / RIGHT arrow keys (or A / D), or drag with the mouse / finger.
 * Press ENTER (or tap the screen) to play again.
 */
(function () {
  'use strict';

  const TW = window.TinyWins;

  const WIDTH = 640;
  const HEIGHT = 520;

  const BASKET_WIDTH = 110;
  const BASKET_HEIGHT = 45;
  const BASKET_Y = 405;
  const STAR_SIZE = 25;
  const WIN_SCORE = 20;
  const MAX_MISSES = 3;

  const STEP_MS = 20;      // the game moves in 20 ms steps
  const KEY_SPEED = 8;     // pixels per step while an arrow key is held

  const BACKGROUND = '#efe5ff';
  const DARK_PURPLE = '#55377d';

  let canvas, ctx;
  let frame = null;        // requestAnimationFrame id
  let lastTime = 0;
  let accumulated = 0;

  let booX, booY, starX, starY, score, misses, gameOver, won;
  let leftHeld = false;
  let rightHeld = false;

  // ---------- starting / stopping ----------

  function start(el) {

    el.innerHTML =
      '<p class="howto">Move Boo with the ← → keys, or drag with your mouse or finger. Catch 20 stars!</p>' +
      '<canvas class="cs-canvas" width="' + WIDTH + '" height="' + HEIGHT + '" ' +
      'aria-label="Catch Stars game"></canvas>';

    canvas = el.querySelector('canvas');
    ctx = canvas.getContext('2d');

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerdown', function (e) {
      if (gameOver) {
        restart();
      } else {
        onPointer(e);
      }
    });

    restart();

    lastTime = performance.now();
    accumulated = 0;
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = null;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    leftHeld = false;
    rightHeld = false;
  }

  function restart() {
    booX = 270;
    booY = 280;
    score = 0;
    misses = 0;
    gameOver = false;
    won = false;
    resetStar();
  }

  function resetStar() {
    starX = Math.floor(Math.random() * (WIDTH - STAR_SIZE));
    starY = -STAR_SIZE;
  }

  // ---------- input ----------

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftHeld = true;
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightHeld = true;
      e.preventDefault();
    } else if (e.key === 'Enter' && gameOver) {
      restart();
    }
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftHeld = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightHeld = false;
  }

  function onPointer(e) {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    booX = clamp(Math.round(x - BASKET_WIDTH / 2));
  }

  function clamp(x) {
    return Math.max(0, Math.min(WIDTH - BASKET_WIDTH, x));
  }

  // ---------- game loop ----------

  function loop(now) {

    accumulated += Math.min(now - lastTime, 200);
    lastTime = now;

    while (accumulated >= STEP_MS) {
      step();
      accumulated -= STEP_MS;
    }

    draw();
    frame = requestAnimationFrame(loop);
  }

  function step() {

    if (gameOver) return;

    if (leftHeld) booX = clamp(booX - KEY_SPEED);
    if (rightHeld) booX = clamp(booX + KEY_SPEED);

    // The star falls
    starY += 5;

    // Did it land in the basket?
    if (starY + STAR_SIZE >= BASKET_Y &&
        starX + STAR_SIZE >= booX &&
        starX <= booX + BASKET_WIDTH) {

      score++;

      if (score >= WIN_SCORE) {
        won = true;
        gameOver = true;
        saveScore();
      } else {
        resetStar();
      }

    } else if (starY > HEIGHT) {

      // Missed it
      misses++;

      if (misses >= MAX_MISSES) {
        won = false;
        gameOver = true;
        saveScore();
      } else {
        resetStar();
      }
    }
  }

  let savedInfo = null;   // what the scoreboard said about this round

  function saveScore() {
    savedInfo = TW.scores.record('catchstars', { score: score, won: won });
  }

  // ---------- drawing ----------

  function draw() {

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Decorative stars
    drawSmallStar(80, 120);
    drawSmallStar(530, 110);
    drawSmallStar(160, 220);
    drawSmallStar(570, 260);

    // Title, score and misses
    ctx.fillStyle = DARK_PURPLE;
    ctx.font = 'bold 27px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Catch Stars', 240, 42);

    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Score: ' + score + '/' + WIN_SCORE, 30, 80);
    ctx.fillText('Misses: ' + misses + '/' + MAX_MISSES, 485, 80);

    drawStar(starX, starY);
    drawBoo();
    drawBasket();

    if (gameOver) drawEnding();
  }

  function starPath(x, y, size) {

    const cx = x + size / 2;
    const cy = y + size / 2;

    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI * i / 5 - Math.PI / 2;
      const radius = (i % 2 === 0) ? size / 2 : size / 4.5;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawStar(x, y) {
    starPath(x, y, STAR_SIZE);
    ctx.fillStyle = 'rgb(255,195,55)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(235,155,25)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawSmallStar(x, y) {
    starPath(x, y, 17);
    ctx.fillStyle = 'rgb(255,195,120)';
    ctx.fill();
  }

  function oval(x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  }

  function drawBoo() {

    const x = booX + 10;
    const y = booY;

    // Ghost body
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 65);
    ctx.bezierCurveTo(x + 5, y + 45, x + 15, y + 5, x + 50, y + 5);
    ctx.bezierCurveTo(x + 85, y + 5, x + 95, y + 45, x + 85, y + 65);
    ctx.bezierCurveTo(x + 75, y + 80, x + 65, y + 65, x + 50, y + 72);
    ctx.bezierCurveTo(x + 35, y + 65, x + 25, y + 80, x + 15, y + 65);
    ctx.closePath();

    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgb(220,210,240)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#000';
    oval(x + 30, y + 35, 11, 20); ctx.fill();
    oval(x + 60, y + 35, 11, 20); ctx.fill();

    // Eye highlights
    ctx.fillStyle = '#fff';
    oval(x + 33, y + 38, 4, 5); ctx.fill();
    oval(x + 63, y + 38, 4, 5); ctx.fill();

    // Cheeks
    ctx.fillStyle = 'rgb(255,170,195)';
    oval(x + 13, y + 55, 17, 10); ctx.fill();
    oval(x + 72, y + 55, 17, 10); ctx.fill();

    // Mouth and tongue
    ctx.fillStyle = 'rgb(100,45,75)';
    oval(x + 43, y + 57, 16, 15); ctx.fill();
    ctx.fillStyle = 'rgb(255,120,160)';
    oval(x + 47, y + 65, 9, 7); ctx.fill();

    // Small hands
    ctx.fillStyle = '#fff';
    oval(x - 3, y + 70, 24, 23); ctx.fill();
    oval(x + 79, y + 70, 24, 23); ctx.fill();

    ctx.strokeStyle = 'rgb(220,210,240)';
    ctx.lineWidth = 1;
    oval(x - 3, y + 70, 24, 23); ctx.stroke();
    oval(x + 79, y + 70, 24, 23); ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBasket() {

    const x = booX;

    // Handle (the top half of an oval)
    ctx.strokeStyle = 'rgb(115,75,150)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(x + 28 + 27.5, BASKET_Y - 25 + 22.5, 27.5, 22.5, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();

    // Body
    roundRect(x, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT, 9);
    ctx.fillStyle = 'rgb(175,130,215)';
    ctx.fill();
    ctx.strokeStyle = DARK_PURPLE;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Decoration
    ctx.strokeStyle = 'rgb(210,175,240)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';

    ctx.beginPath();
    ctx.moveTo(x + 10, BASKET_Y + 14);
    ctx.lineTo(x + BASKET_WIDTH - 10, BASKET_Y + 14);
    ctx.moveTo(x + 10, BASKET_Y + 29);
    ctx.lineTo(x + BASKET_WIDTH - 10, BASKET_Y + 29);
    for (let i = 1; i <= 4; i++) {
      ctx.moveTo(x + i * 20, BASKET_Y + 5);
      ctx.lineTo(x + i * 20, BASKET_Y + BASKET_HEIGHT - 5);
    }
    ctx.stroke();
  }

  function drawEnding() {

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(110, 145, 420, 230, 15);
    ctx.fill();

    ctx.fillStyle = DARK_PURPLE;
    ctx.textAlign = 'center';

    ctx.font = 'bold 35px "Segoe UI", Arial, sans-serif';
    ctx.fillText(won ? 'BOO WINS!' : 'GAME OVER!', WIDTH / 2, 205);

    ctx.font = 'bold 23px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Final Score: ' + score + '/' + WIN_SCORE, WIDTH / 2, 255);

    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(won ? 'Boo collected all 20 stars!' : 'Boo missed 3 stars!', WIDTH / 2, 295);
    if (savedInfo && savedInfo.newBest) {
      ctx.fillText('New best score!', WIDTH / 2, 325);
    }
    ctx.fillText('Press ENTER or tap to play again', WIDTH / 2, 335);

    ctx.textAlign = 'left';
  }

  // For automatic testing only
  window.__catchStarsTest = {
    state: function () { return { booX: booX, starX: starX, starY: starY, score: score, misses: misses, gameOver: gameOver, won: won }; },
    set: function (o) { if ('booX' in o) booX = o.booX; if ('starX' in o) starX = o.starX; if ('starY' in o) starY = o.starY; if ('score' in o) score = o.score; if ('misses' in o) misses = o.misses; }
  };

  TW.register('catchstars', { start: start, stop: stop });

})();
