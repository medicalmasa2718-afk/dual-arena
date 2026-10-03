// --- 2. ダイスロール・タンクゲーム (Dice Tank) ---
// Turn‑based board game where each player rolls a die to move their tank.
// The first to reach or pass the opponent's start column wins.

class DiceTankGame {
  constructor(canvas, onGameOver, updateHud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    this.updateHud = updateHud;

    this.running = false;
    this.turn = 1; // 1 or 2
    this.gridSize = 10; // 10x10 cells
    this.cellSize = 0; // calculated on resize
    this.p1Pos = { x: 0, y: 5 };
    this.p2Pos = { x: 9, y: 5 };
    this.p1Score = 0;
    this.p2Score = 0;
    this.winningScore = 3;
    this.diceResult = null;
    this.message = '';
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start() {
    this.p1Score = this.p2Score = 0;
    this.updateHud(0, 0);
    this.resize();
    this.running = true;
    window.addEventListener('keydown', this.handleKeyDown);
    this.loop();
  }

  stop() {
    this.running = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    cancelAnimationFrame(this.animationId);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.cellSize = Math.min(this.canvas.width, this.canvas.height) / this.gridSize;
  }

  loop() {
    if (!this.running) return;
    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  // Player 1 uses Enter, Player 2 uses Space to roll.
  handleKeyDown(e) {
    if (!this.running) return;
    if (this.turn === 1 && e.key === 'Enter') {
      this.takeTurn(1);
    } else if (this.turn === 2 && (e.key === ' ' || e.key === 'Spacebar')) {
      this.takeTurn(2);
    }
  }

  takeTurn(player) {
    const roll = Math.floor(Math.random() * 6) + 1; // 1‑6
    this.diceResult = roll;
    this.message = `P${player} が ${roll} を出した`;
    if (player === 1) {
      this.p1Pos.x = Math.min(this.gridSize - 1, this.p1Pos.x + roll);
      if (this.p1Pos.x >= this.p2Pos.x) {
        this.endRound(1);
        return;
      }
    } else {
      this.p2Pos.x = Math.max(0, this.p2Pos.x - roll);
      if (this.p2Pos.x <= this.p1Pos.x) {
        this.endRound(2);
        return;
      }
    }
    // Switch turn
    this.turn = player === 1 ? 2 : 1;
  }

  endRound(winner) {
    if (winner === 1) this.p1Score++; else this.p2Score++;
    this.updateHud(this.p1Score, this.p2Score);
    this.message = `P${winner} がゴール！`;
    if (this.p1Score >= this.winningScore || this.p2Score >= this.winningScore) {
      const finalWinner = this.p1Score >= this.winningScore ? 'PLAYER 1' : 'PLAYER 2';
      setTimeout(() => this.onGameOver(finalWinner, this.p1Score, this.p2Score), 800);
      this.stop();
    } else {
      // Reset positions after short pause
      setTimeout(() => {
        this.p1Pos = { x: 0, y: 5 };
        this.p2Pos = { x: 9, y: 5 };
        this.turn = 1;
        this.message = '次のラウンド開始 – P1 が先手です';
        this.diceResult = null;
      }, 1000);
    }
  }

  render() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // draw grid
    ctx.strokeStyle = '#444';
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

    // draw tanks
    const drawTank = (pos, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(pos.x * cs + cs * 0.1, pos.y * cs + cs * 0.1, cs * 0.8, cs * 0.8);
    };
    drawTank(this.p1Pos, '#00f0ff');
    drawTank(this.p2Pos, '#ff0055');

    // UI text
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Turn: P${this.turn}`, 10, 20);
    if (this.diceResult !== null) {
      ctx.fillText(`Dice: ${this.diceResult}`, 10, 40);
    }
    ctx.fillText(this.message, 10, 60);
  }
}

window.DiceTankGame = DiceTankGame;
