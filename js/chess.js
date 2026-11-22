/*
 * Chess screen: draws the board and handles clicks.
 * (The rules live in chess-engine.js.)
 */
(function () {
  'use strict';

  const TW = window.TinyWins;

  // The filled chess symbols are used for both colours; CSS colours them white or black.
  // The extra ︎ makes sure the pawn shows as a plain symbol, not an emoji.
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const TEXT_STYLE = '︎';

  let root, boardEl, statusEl, timerEl, blackSel;
  let game;
  let selected = null;       // [row, col] of the clicked piece
  let message = '';          // short message shown instead of the normal status
  let clock = null;          // setInterval id
  let started = false;
  let startMs = 0;
  let endMs = 0;

  function isWhitePiece(ch) {
    return ch !== ' ' && ch === ch.toUpperCase();
  }

  function side() {
    return game.whiteTurn ? 'White' : 'Black';
  }

  // ---------- starting / stopping ----------

  function start(el) {

    root = el;
    root.innerHTML =
      '<p class="howto">Click a piece, then click where it should go. White starts.</p>' +
      '<div class="row" style="margin:0 0 10px"><label class="status" style="margin:0;font-weight:400">White: <b id="ch-white"></b> &nbsp; Black: ' +
      '<select id="ch-black"></select></label></div>' +
      '<div class="status" id="ch-status" aria-live="polite"></div>' +
      '<div class="board-wrap"><div class="board" id="ch-board"></div></div>' +
      '<div class="row">' +
      '  <span class="status" id="ch-timer" style="margin:0">Time: 00:00</span>' +
      '  <button class="btn" id="ch-new">New Game</button>' +
      '</div>';

    boardEl = root.querySelector('#ch-board');
    statusEl = root.querySelector('#ch-status');
    timerEl = root.querySelector('#ch-timer');

    root.querySelector('#ch-new').addEventListener('click', newGame);

    // Black can be a guest or another player on this device (so their win is saved too)
    const me = TW.players.current();
    root.querySelector('#ch-white').textContent = me ? me.name : 'Guest';
    blackSel = root.querySelector('#ch-black');
    blackSel.innerHTML = '<option value="">Guest</option>';
    TW.players.list().forEach(function (p) {
      if (me && p.key === me.key) return;
      const o = document.createElement('option');
      o.value = p.key;
      o.textContent = p.name;
      blackSel.appendChild(o);
    });
    // Changing who plays Black starts a fresh game (so the result goes to the right person)
    blackSel.addEventListener('change', newGame);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.r = r;
        sq.dataset.c = c;
        sq.addEventListener('click', function () { onSquare(r, c); });
        boardEl.appendChild(sq);
      }
    }

    newGame();
  }

  function stop() {
    clearInterval(clock);
    clock = null;
  }

  function newGame() {
    stop();
    game = new window.Chess();
    selected = null;
    message = '';
    started = false;
    startMs = 0;
    endMs = 0;
    render();
  }

  // ---------- clock ----------

  function elapsed() {
    if (!started) return 0;
    return (endMs || Date.now()) - startMs;
  }

  function updateTimer() {
    timerEl.textContent = 'Time: ' + TW.formatTime(elapsed());
  }

  // ---------- clicking ----------

  function onSquare(r, c) {

    if (game.over) return;

    const piece = game.board[r][c];
    const mine = piece !== ' ' && isWhitePiece(piece) === game.whiteTurn;

    // Nothing selected yet: pick one of your own pieces
    if (!selected) {
      if (piece === ' ') return;

      if (!mine) {
        message = "It's " + side() + "'s turn!";
        render();
        return;
      }

      selected = [r, c];
      message = side() + ': choose a destination';
      render();
      return;
    }

    // Click the same piece again: put it down
    if (selected[0] === r && selected[1] === c) {
      selected = null;
      message = '';
      render();
      return;
    }

    // Click another of your own pieces: select that one instead
    if (mine) {
      selected = [r, c];
      message = side() + ': choose a destination';
      render();
      return;
    }

    // Try the move
    const sr = selected[0];
    const sc = selected[1];

    if (game.isLegalMove(sr, sc, r, c)) {

      if (game.isPromotion(sr, sc, r)) {
        askPromotion(game.whiteTurn, function (choice) {
          finishMove(sr, sc, r, c, choice);
        });
      } else {
        finishMove(sr, sc, r, c);
      }

    } else {
      selected = null;
      message = game.isInCheck(game.board, game.whiteTurn)
        ? 'Illegal move! ' + side() + ' is in check.'
        : 'Illegal move! Try another square.';
      render();
    }
  }

  function finishMove(sr, sc, dr, dc, promo) {

    game.move(sr, sc, dr, dc, promo);
    selected = null;
    message = '';

    // The clock starts with the very first move
    if (!started) {
      started = true;
      startMs = Date.now();
      clock = setInterval(updateTimer, 1000);
    }

    if (game.over) {
      const me = TW.players.current();
      const outcome = game.state === 'checkmate' ? (game.whiteTurn ? 'black' : 'white') : 'draw';
      TW.scores.recordChess(me && me.key, blackSel.value || null, outcome);
      endMs = Date.now();
      clearInterval(clock);
      clock = null;
    }

    render();
  }

  function askPromotion(white, done) {

    const names = [['q', 'Queen'], ['r', 'Rook'], ['b', 'Bishop'], ['n', 'Knight']];

    TW.modal({
      title: 'Promote pawn to:',
      buttons: names.map(function (n) {
        return {
          label: GLYPH[n[0]] + TEXT_STYLE + ' ' + n[1],
          light: true,
          onClick: function () { done(n[0]); }
        };
      })
    });
  }

  // ---------- drawing ----------

  function statusText() {

    const winner = game.whiteTurn ? 'Black' : 'White';
    let text;

    switch (game.state) {
      case 'check':       text = side() + ' is in CHECK!'; break;
      case 'checkmate':   text = 'Checkmate! ' + winner + ' wins!'; break;
      case 'stalemate':   text = 'Stalemate! The game is a draw.'; break;
      case 'insufficient': text = 'Draw: insufficient material.'; break;
      case 'fifty':       text = 'Draw: 50-move rule.'; break;
      case 'repetition':  text = 'Draw: threefold repetition.'; break;
      default:            text = side() + "'s turn";
    }

    if (game.over) {
      text += ' Game time: ' + TW.formatTime(elapsed());
    }
    return text;
  }

  function render() {

    // Where the selected piece may go
    const targets = new Set();
    if (selected) {
      game.legalMovesFrom(selected[0], selected[1]).forEach(function (m) {
        targets.add(m[0] * 8 + m[1]);
      });
    }

    // Which king is in check
    let checkSquare = -1;
    if (game.state === 'check' || game.state === 'checkmate') {
      const king = game.whiteTurn ? 'K' : 'k';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (game.board[r][c] === king) checkSquare = r * 8 + c;
        }
      }
    }

    const last = game.lastMove;

    Array.prototype.forEach.call(boardEl.children, function (sq) {

      const r = +sq.dataset.r;
      const c = +sq.dataset.c;
      const i = r * 8 + c;
      const piece = game.board[r][c];

      let cls = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (last && ((last[0] === r && last[1] === c) || (last[2] === r && last[3] === c))) cls += ' last';
      if (selected && selected[0] === r && selected[1] === c) cls += ' sel';
      if (targets.has(i)) cls += (piece !== ' ' || isEnPassant(r, c)) ? ' dest cap' : ' dest';
      if (i === checkSquare) cls += ' check';
      sq.className = cls;

      if (piece === ' ') {
        sq.textContent = '';
      } else {
        const color = isWhitePiece(piece) ? 'w' : 'b';
        sq.innerHTML = '<span class="piece ' + color + '">' + GLYPH[piece.toLowerCase()] + TEXT_STYLE + '</span>';
      }

      sq.setAttribute('aria-label', piece === ' ' ? 'empty' : piece);
    });

    statusEl.textContent = message || statusText();
    updateTimer();
  }

  // Is moving the selected pawn to (r, c) an en passant capture?
  function isEnPassant(r, c) {
    if (!selected) return false;
    const p = game.board[selected[0]][selected[1]];
    return p.toLowerCase() === 'p' && selected[1] !== c && game.board[r][c] === ' ';
  }

  // For automatic testing only
  window.__chessTest = {
    load: function (rows, whiteTurn) {
      game.board = rows.map(function (s) { return s.split(''); });
      game.whiteTurn = whiteTurn;
      game.wKingMoved = game.bKingMoved = game.wRookA = game.wRookH = game.bRookA = game.bRookH = true;
      game.epRow = -1;
      game.epCol = -1;
      game.counts.clear();
      selected = null;
      message = '';
      game.evaluate();
      render();
    },
    state: function () { return { state: game.state, over: game.over, whiteTurn: game.whiteTurn }; }
  };

  TW.register('chess', { start: start, stop: stop });

})();
