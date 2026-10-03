// --- 3. ターン制グリッドバトル (Grid Battle) ---
// Simple turn‑based board game where players place pieces on an 8×8 grid.
// When a player surrounds an opponent's piece horizontally or vertically, the opponent's piece is captured and the player gains a point.
// First to reach 3 points wins.

class GridBattleGame {
  constructor(container, onGameOver, updateHud) {
    this.container = container;
    this.onGameOver = onGameOver;
    this.updateHud = updateHud;
    this.running = false;
    this.gridSize = 8;
    this.cellSize = 0;
    this.board = [];
    this.turn = 1; // 1 = player1, 2 = player2
    this.p1Score = 0;
    this.p2Score = 0;
    this.winningScore = 3;
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.handleClick = this.handleClick.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  start() {
    this.resetBoard();
    this.updateHud(this.p1Score, this.p2Score);
    this.resize();
    this.running = true;
    this.canvas.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.handleResize);
    this.render();
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  resetBoard() {
    this.board = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0)); // 0 empty, 1 P1, 2 P2
    this.turn = 1;
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    this.canvas.width = size;
    this.canvas.height = size;
    this.cellSize = size / this.gridSize;
  }

  handleResize() {
    if (!this.running) return;
    this.resize();
    this.render();
  }

  handleClick(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (this.board[row][col] !== 0) return; // occupied
    this.board[row][col] = this.turn;
    this.checkCaptures(row, col);
    this.switchTurn();
    this.render();
    this.checkWin();
  }

  // Simple capture rule: if after placing, any orthogonal neighbor of opponent is surrounded on both sides by the current player, capture it.
  checkCaptures(row, col) {
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
    const opponent = this.turn === 1 ? 2 : 1;
    for (const [dx, dy] of dirs) {
      const r1 = row + dy;
      const c1 = col + dx;
      const r2 = row + dy * 2;
      const c2 = col + dx * 2;
      if (r1 >= 0 && r1 < this.gridSize && c1 >= 0 && c1 < this.gridSize &&
          r2 >= 0 && r2 < this.gridSize && c2 >= 0 && c2 < this.gridSize) {
        if (this.board[r1][c1] === opponent && this.board[r2][c2] === this.turn) {
          // capture opponent piece
          this.board[r1][c1] = 0;
          if (this.turn === 1) this.p1Score++; else this.p2Score++;
          this.updateHud(this.p1Score, this.p2Score);
        }
      }
    }
  }

  switchTurn() {
    this.turn = this.turn === 1 ? 2 : 1;
  }

  checkWin() {
    if (this.p1Score >= this.winningScore || this.p2Score >= this.winningScore) {
      const winner = this.p1Score >= this.winningScore ? 'PLAYER 1' : 'PLAYER 2';
      this.onGameOver(winner, this.p1Score, this.p2Score);
      this.stop();
    }
  }

  render() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // draw grid
    ctx.strokeStyle = '#666';
    for (let i = 0; i <= this.gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, cs * this.gridSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(cs * this.gridSize, i * cs);
      ctx.stroke();
    }
    // draw pieces
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const val = this.board[r][c];
        if (val === 0) continue;
        ctx.fillStyle = val === 1 ? '#00f0ff' : '#ff0055';
        ctx.beginPath();
        ctx.arc(c * cs + cs / 2, r * cs + cs / 2, cs * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // turn indicator
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Turn: P${this.turn}`, 10, 20);
  }
}

window.GridBattleGame = GridBattleGame;
