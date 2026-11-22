/*
 * Chess rules (no screen drawing here, only the rules).
 *
 * Board: 8 x 8 array of characters.
 *   Uppercase = White (K Q R B N P), lowercase = Black (k q r b n p), ' ' = empty.
 *   Row 0 is Black's back rank (top of the screen), row 7 is White's.
 *
 * Rules included: every piece, check, checkmate, stalemate, castling,
 * en passant, promotion, and draws (insufficient material, 50 moves, threefold repetition).
 */
(function (root) {
  'use strict';

  const START = [
    'rnbqkbnr',
    'pppppppp',
    '        ',
    '        ',
    '        ',
    '        ',
    'PPPPPPPP',
    'RNBQKBNR'
  ];

  function isUpper(ch) {
    return ch !== ' ' && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  }

  class Chess {

    constructor() {
      this.reset();
    }

    reset() {
      this.board = START.map(function (row) { return row.split(''); });
      this.whiteTurn = true;

      // Castling: true means "has moved (or the rook was captured)"
      this.wKingMoved = false;
      this.bKingMoved = false;
      this.wRookA = false;
      this.wRookH = false;
      this.bRookA = false;
      this.bRookH = false;

      // En passant target square (the square a pawn just skipped over), -1 if none
      this.epRow = -1;
      this.epCol = -1;

      this.halfmove = 0;          // for the 50-move rule (counts single moves)
      this.counts = new Map();    // for threefold repetition
      this.counts.set(this.key(), 1);

      this.over = false;
      this.state = 'playing';     // playing, check, checkmate, stalemate, insufficient, fifty, repetition
      this.lastMove = null;
    }

    // A copy of just the board and rules flags (used for testing / searching)
    cloneState() {
      const c = Object.create(Chess.prototype);
      c.board = this.copyBoard(this.board);
      c.whiteTurn = this.whiteTurn;
      c.wKingMoved = this.wKingMoved;
      c.bKingMoved = this.bKingMoved;
      c.wRookA = this.wRookA;
      c.wRookH = this.wRookH;
      c.bRookA = this.bRookA;
      c.bRookH = this.bRookH;
      c.epRow = this.epRow;
      c.epCol = this.epCol;
      return c;
    }

    copyBoard(b) {
      return b.map(function (row) { return row.slice(); });
    }

    // ---------- helpers ----------

    isCurrentPlayerPiece(piece) {
      if (piece === ' ') return false;
      return this.whiteTurn ? isUpper(piece) : !isUpper(piece);
    }

    pathClear(b, sr, sc, dr, dc) {
      const rowStep = Math.sign(dr - sr);
      const colStep = Math.sign(dc - sc);
      let r = sr + rowStep;
      let c = sc + colStep;

      while (r !== dr || c !== dc) {
        if (b[r][c] !== ' ') return false;
        r += rowStep;
        c += colStep;
      }
      return true;
    }

    // ---------- movement rules ----------

    // Can the piece make this move, ignoring whether it leaves its own king in check?
    isPseudoLegal(b, sr, sc, dr, dc) {

      if (sr === dr && sc === dc) return false;

      const piece = b[sr][sc];
      const target = b[dr][dc];

      if (piece === ' ') return false;

      const white = isUpper(piece);

      // Cannot capture your own piece
      if (target !== ' ' && isUpper(target) === white) return false;

      const rowDiff = dr - sr;
      const colDiff = dc - sc;
      const ar = Math.abs(rowDiff);
      const ac = Math.abs(colDiff);

      switch (piece.toLowerCase()) {

        case 'p': {
          const direction = white ? -1 : 1;
          const startRow = white ? 6 : 1;

          // One step forward
          if (colDiff === 0 && rowDiff === direction && target === ' ') return true;

          // Two steps forward from the start
          if (colDiff === 0 && sr === startRow && rowDiff === 2 * direction &&
              target === ' ' && b[sr + direction][sc] === ' ') return true;

          // Capture diagonally
          if (ac === 1 && rowDiff === direction && target !== ' ') return true;

          // En passant
          if (ac === 1 && rowDiff === direction && target === ' ' &&
              dr === this.epRow && dc === this.epCol) return true;

          return false;
        }

        case 'r':
          if (sr !== dr && sc !== dc) return false;
          return this.pathClear(b, sr, sc, dr, dc);

        case 'b':
          if (ar !== ac) return false;
          return this.pathClear(b, sr, sc, dr, dc);

        case 'q':
          if (sr !== dr && sc !== dc && ar !== ac) return false;
          return this.pathClear(b, sr, sc, dr, dc);

        case 'n':
          return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);

        case 'k':
          if (ar <= 1 && ac <= 1) return true;
          if (ar === 0 && ac === 2) return this.canCastle(b, white, dc > sc);
          return false;

        default:
          return false;
      }
    }

    canCastle(b, white, kingside) {

      const row = white ? 7 : 0;
      const king = white ? 'K' : 'k';
      const rook = white ? 'R' : 'r';

      const kingMoved = white ? this.wKingMoved : this.bKingMoved;
      const rookMoved = white
        ? (kingside ? this.wRookH : this.wRookA)
        : (kingside ? this.bRookH : this.bRookA);

      if (kingMoved || rookMoved) return false;
      if (b[row][4] !== king) return false;

      const rookCol = kingside ? 7 : 0;
      if (b[row][rookCol] !== rook) return false;

      // Squares between king and rook must be empty
      const from = Math.min(4, rookCol) + 1;
      const to = Math.max(4, rookCol) - 1;
      for (let c = from; c <= to; c++) {
        if (b[row][c] !== ' ') return false;
      }

      // The king may not castle out of, through, or into check
      const step = kingside ? 1 : -1;
      const byWhite = !white;
      if (this.isSquareAttacked(b, row, 4, byWhite) ||
          this.isSquareAttacked(b, row, 4 + step, byWhite) ||
          this.isSquareAttacked(b, row, 4 + 2 * step, byWhite)) {
        return false;
      }

      return true;
    }

    // Put a move on a board (handles en passant and castling). Promotion is separate.
    applyMove(b, sr, sc, dr, dc) {

      const piece = b[sr][sc];

      // En passant capture: a pawn moves diagonally onto an empty square
      if (piece.toLowerCase() === 'p' && sc !== dc && b[dr][dc] === ' ') {
        b[sr][dc] = ' ';
      }

      // Castling: move the rook too
      if (piece.toLowerCase() === 'k' && Math.abs(dc - sc) === 2) {
        if (dc > sc) {
          b[dr][5] = b[dr][7];
          b[dr][7] = ' ';
        } else {
          b[dr][3] = b[dr][0];
          b[dr][0] = ' ';
        }
      }

      b[dr][dc] = piece;
      b[sr][sc] = ' ';
    }

    updateCastlingRights(sr, sc, dr, dc, piece) {

      if (piece === 'K') this.wKingMoved = true;
      if (piece === 'k') this.bKingMoved = true;

      // Any move from or onto a rook's starting square removes that right
      if ((sr === 7 && sc === 0) || (dr === 7 && dc === 0)) this.wRookA = true;
      if ((sr === 7 && sc === 7) || (dr === 7 && dc === 7)) this.wRookH = true;
      if ((sr === 0 && sc === 0) || (dr === 0 && dc === 0)) this.bRookA = true;
      if ((sr === 0 && sc === 7) || (dr === 0 && dc === 7)) this.bRookH = true;
    }

    // ---------- check detection ----------

    isInCheck(b, white) {
      const king = white ? 'K' : 'k';

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (b[r][c] === king) {
            return this.isSquareAttacked(b, r, c, !white);
          }
        }
      }
      return false;
    }

    // Is square (r, c) attacked by any piece of the given colour?
    isSquareAttacked(b, r, c, byWhite) {

      for (let pr = 0; pr < 8; pr++) {
        for (let pc = 0; pc < 8; pc++) {

          const p = b[pr][pc];
          if (p === ' ' || isUpper(p) !== byWhite) continue;

          const rd = r - pr;
          const cd = c - pc;
          const ar = Math.abs(rd);
          const ac = Math.abs(cd);

          switch (p.toLowerCase()) {

            case 'p': {
              const dir = byWhite ? -1 : 1;
              if (rd === dir && ac === 1) return true;
              break;
            }

            case 'n':
              if ((ar === 2 && ac === 1) || (ar === 1 && ac === 2)) return true;
              break;

            case 'k':
              if (ar <= 1 && ac <= 1 && (ar + ac) > 0) return true;
              break;

            case 'r':
              if ((rd === 0 || cd === 0) && (ar + ac) > 0 && this.pathClear(b, pr, pc, r, c)) return true;
              break;

            case 'b':
              if (ar === ac && ar > 0 && this.pathClear(b, pr, pc, r, c)) return true;
              break;

            case 'q':
              if (((rd === 0 || cd === 0) || ar === ac) && (ar + ac) > 0 &&
                  this.pathClear(b, pr, pc, r, c)) return true;
              break;
          }
        }
      }
      return false;
    }

    // ---------- legal moves ----------

    // Fully legal: the piece can make the move AND your king is not left in check.
    isLegalMove(sr, sc, dr, dc) {

      const piece = this.board[sr][sc];

      if (piece === ' ' || !this.isCurrentPlayerPiece(piece)) return false;
      if (!this.isPseudoLegal(this.board, sr, sc, dr, dc)) return false;

      const copy = this.copyBoard(this.board);
      this.applyMove(copy, sr, sc, dr, dc);

      return !this.isInCheck(copy, isUpper(piece));
    }

    // List of [row, col] squares the piece on (r, c) may legally move to
    legalMovesFrom(r, c) {
      const moves = [];
      for (let dr = 0; dr < 8; dr++) {
        for (let dc = 0; dc < 8; dc++) {
          if (this.isLegalMove(r, c, dr, dc)) moves.push([dr, dc]);
        }
      }
      return moves;
    }

    hasAnyLegalMove(white) {

      for (let sr = 0; sr < 8; sr++) {
        for (let sc = 0; sc < 8; sc++) {

          const p = this.board[sr][sc];
          if (p === ' ' || isUpper(p) !== white) continue;

          for (let dr = 0; dr < 8; dr++) {
            for (let dc = 0; dc < 8; dc++) {

              if (!this.isPseudoLegal(this.board, sr, sc, dr, dc)) continue;

              const copy = this.copyBoard(this.board);
              this.applyMove(copy, sr, sc, dr, dc);

              if (!this.isInCheck(copy, white)) return true;
            }
          }
        }
      }
      return false;
    }

    // Is this move a pawn reaching the last row (so the player must choose a piece)?
    isPromotion(sr, sc, dr) {
      const piece = this.board[sr][sc];
      return (piece === 'P' && dr === 0) || (piece === 'p' && dr === 7);
    }

    // ---------- making moves ----------

    // Make a move without checking legality or draw rules (used by move() and by tests)
    makeMove(sr, sc, dr, dc, promo) {

      const piece = this.board[sr][sc];

      this.updateCastlingRights(sr, sc, dr, dc, piece);

      // En passant target for the NEXT move
      let newEpRow = -1;
      let newEpCol = -1;
      if (piece.toLowerCase() === 'p' && Math.abs(dr - sr) === 2) {
        newEpRow = (dr + sr) / 2;
        newEpCol = sc;
      }

      this.applyMove(this.board, sr, sc, dr, dc);

      this.epRow = newEpRow;
      this.epCol = newEpCol;

      // Promotion
      const choice = (promo && 'qrbn'.indexOf(promo.toLowerCase()) >= 0) ? promo.toLowerCase() : 'q';
      if (piece === 'P' && dr === 0) this.board[dr][dc] = choice.toUpperCase();
      if (piece === 'p' && dr === 7) this.board[dr][dc] = choice;

      this.whiteTurn = !this.whiteTurn;
    }

    // A normal move in a game. Returns true if it was made.
    move(sr, sc, dr, dc, promo) {

      if (this.over || !this.isLegalMove(sr, sc, dr, dc)) return false;

      const piece = this.board[sr][sc];
      const isCapture = this.board[dr][dc] !== ' ';
      const isPawn = piece.toLowerCase() === 'p';

      this.makeMove(sr, sc, dr, dc, promo);

      // 50-move rule counter: resets on any pawn move or capture
      this.halfmove = (isPawn || isCapture) ? 0 : this.halfmove + 1;

      // Remember the position for threefold repetition
      const k = this.key();
      this.counts.set(k, (this.counts.get(k) || 0) + 1);

      this.lastMove = [sr, sc, dr, dc];
      this.evaluate();
      return true;
    }

    // After each move: check, checkmate, stalemate, draws
    evaluate() {

      const white = this.whiteTurn;
      const inCheck = this.isInCheck(this.board, white);
      const hasMove = this.hasAnyLegalMove(white);

      if (!hasMove) {
        this.state = inCheck ? 'checkmate' : 'stalemate';
      } else if (this.insufficientMaterial()) {
        this.state = 'insufficient';
      } else if (this.halfmove >= 100) {
        this.state = 'fifty';
      } else if ((this.counts.get(this.key()) || 0) >= 3) {
        this.state = 'repetition';
      } else {
        this.state = inCheck ? 'check' : 'playing';
      }

      this.over = !(this.state === 'playing' || this.state === 'check');
    }

    // Draw when checkmate is impossible:
    //  - King vs King
    //  - King + one Knight vs King
    //  - King + Bishop(s) vs King + Bishop(s), all bishops on the same square colour
    insufficientMaterial() {

      let knights = 0;
      let bishops = 0;
      let bishopColors = 0; // bit 0 = light squares, bit 1 = dark squares

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

          const p = this.board[r][c].toLowerCase();
          if (p === ' ' || p === 'k') continue;

          if (p === 'n') {
            knights++;
          } else if (p === 'b') {
            bishops++;
            bishopColors |= 1 << ((r + c) % 2);
          } else {
            return false; // a pawn, rook or queen can still checkmate
          }
        }
      }

      if (knights === 0 && bishops === 0) return true;
      if (knights === 1 && bishops === 0) return true;
      if (knights === 0 && bishops >= 1 && (bishopColors === 1 || bishopColors === 2)) return true;

      return false;
    }

    // Text that identifies a position for repetition counting:
    // pieces, side to move, castling rights, and en passant (only if really possible).
    key() {

      let s = '';
      for (let r = 0; r < 8; r++) {
        s += this.board[r].join('');
      }

      s += this.whiteTurn ? 'w' : 'b';

      const b = this.board;
      s += (!this.wKingMoved && !this.wRookH && b[7][4] === 'K' && b[7][7] === 'R') ? 'K' : '-';
      s += (!this.wKingMoved && !this.wRookA && b[7][4] === 'K' && b[7][0] === 'R') ? 'Q' : '-';
      s += (!this.bKingMoved && !this.bRookH && b[0][4] === 'k' && b[0][7] === 'r') ? 'k' : '-';
      s += (!this.bKingMoved && !this.bRookA && b[0][4] === 'k' && b[0][0] === 'r') ? 'q' : '-';

      if (this.epRow !== -1) {
        const dir = this.whiteTurn ? -1 : 1;
        const pawn = this.whiteTurn ? 'P' : 'p';
        const pr = this.epRow - dir; // row of the pawn that could capture
        let possible = false;

        for (let d = -1; d <= 1; d += 2) {
          const pc = this.epCol + d;
          if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8 &&
              b[pr][pc] === pawn && this.isLegalMove(pr, pc, this.epRow, this.epCol)) {
            possible = true;
          }
        }

        if (possible) s += this.epRow + '' + this.epCol;
      }

      return s;
    }
  }

  // Works in the browser (window.Chess) and in Node (for testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Chess: Chess };
  } else {
    root.Chess = Chess;
  }

})(typeof window !== 'undefined' ? window : globalThis);
