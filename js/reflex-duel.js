// --- 3. 早押しリフレックス (Reflex Duel) ---
class ReflexDuelGame {
  constructor(container, onGameOver, updateHud) {
    this.container = container;
    this.onGameOver = onGameOver;
    this.updateHud = updateHud;
    this.running = false;

    // スコア
    this.p1Score = 0;
    this.p2Score = 0;
    this.winningScore = 3;

    // ゲーム状態: 'IDLE', 'WAITING', 'TRIGGERED', 'ROUND_OVER'
    this.state = 'IDLE';
    this.triggerTimer = null;
    this.triggerTime = 0;

    // UI要素
    this.p1Zone = document.getElementById('reflex-p1');
    this.p2Zone = document.getElementById('reflex-p2');
    this.statusEl = document.getElementById('reflex-status');
    this.p1TimeEl = document.getElementById('time-p1');
    this.p2TimeEl = document.getElementById('time-p2');
    this.scoreP1El = document.getElementById('rf-score-p1');
    this.scoreP2El = document.getElementById('rf-score-p2');

    // バインド
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleP1Touch = this.handleP1Touch.bind(this);
    this.handleP2Touch = this.handleP2Touch.bind(this);
  }

  start() {
    this.p1Score = 0;
    this.p2Score = 0;
    this.updateScores();
    this.container.classList.remove('hidden');
    this.running = true;

    // イベント登録
    window.addEventListener('keydown', this.handleKeyDown);
    this.p1Zone.addEventListener('touchstart', this.handleP1Touch, { passive: false });
    this.p1Zone.addEventListener('mousedown', this.handleP1Touch);
    this.p2Zone.addEventListener('touchstart', this.handleP2Touch, { passive: false });
    this.p2Zone.addEventListener('mousedown', this.handleP2Touch);

    this.startRound();
  }

  stop() {
    this.running = false;
    if (this.triggerTimer) clearTimeout(this.triggerTimer);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.p1Zone.removeEventListener('touchstart', this.handleP1Touch);
    this.p1Zone.removeEventListener('mousedown', this.handleP1Touch);
    this.p2Zone.removeEventListener('touchstart', this.handleP2Touch);
    this.p2Zone.removeEventListener('mousedown', this.handleP2Touch);
    this.container.classList.add('hidden');
  }

  updateScores() {
    this.scoreP1El.textContent = this.p1Score;
    this.scoreP2El.textContent = this.p2Score;
    this.updateHud(this.p1Score, this.p2Score);
  }

  startRound() {
    if (!this.running) return;

    this.state = 'WAITING';
    this.statusEl.className = 'reflex-msg ready';
    this.statusEl.textContent = 'READY...';
    this.p1TimeEl.textContent = '';
    this.p2TimeEl.textContent = '';
    this.p1Zone.classList.remove('active-tap');
    this.p2Zone.classList.remove('active-tap');

    window.soundFX.playBeep(440, 0.08);

    // 1.5秒 〜 4.5秒のランダムな待ち時間
    const waitMs = 1500 + Math.random() * 3000;
    this.triggerTimer = setTimeout(() => {
      if (!this.running || this.state !== 'WAITING') return;

      this.state = 'TRIGGERED';
      this.triggerTime = performance.now();
      this.statusEl.className = 'reflex-msg hit';
      this.statusEl.textContent = 'HIT!!';

      window.soundFX.playBeep(880, 0.18);
    }, waitMs);
  }

  handlePlayerAction(player) {
    if (!this.running) return;
    window.soundFX.init();

    // ゾーン発光エフェクト
    const zone = player === 1 ? this.p1Zone : this.p2Zone;
    zone.classList.add('active-tap');
    setTimeout(() => zone.classList.remove('active-tap'), 200);

    // 状態別ハンドリング
    if (this.state === 'WAITING') {
      // フライング（お手つき！）
      clearTimeout(this.triggerTimer);
      this.state = 'ROUND_OVER';
      window.soundFX.playFoul();

      const opponent = player === 1 ? 2 : 1;
      if (opponent === 1) this.p1Score++;
      else this.p2Score++;

      this.statusEl.className = 'reflex-msg foul';
      this.statusEl.textContent = `P${player} お手つき!`;

      if (player === 1) this.p1TimeEl.textContent = 'FOUL!';
      else this.p2TimeEl.textContent = 'FOUL!';

      this.updateScores();
      this.checkWinnerOrNextRound();
    } else if (this.state === 'TRIGGERED') {
      // 正常タップ（先に押した方が勝ち）
      this.state = 'ROUND_OVER';
      const reactionTime = Math.round(performance.now() - this.triggerTime);

      if (player === 1) {
        this.p1Score++;
        this.p1TimeEl.textContent = `${reactionTime} ms!`;
        window.soundFX.playPaddleHit();
      } else {
        this.p2Score++;
        this.p2TimeEl.textContent = `${reactionTime} ms!`;
        window.soundFX.playPaddleHit();
      }

      this.statusEl.className = 'reflex-msg';
      this.statusEl.textContent = `P${player} WIN!`;
      this.updateScores();
      this.checkWinnerOrNextRound();
    }
  }

  checkWinnerOrNextRound() {
    if (this.p1Score >= this.winningScore || this.p2Score >= this.winningScore) {
      const winner = this.p1Score >= this.winningScore ? 'PLAYER 1' : 'PLAYER 2';
      setTimeout(() => {
        window.soundFX.playWin();
        this.onGameOver(winner, this.p1Score, this.p2Score);
      }, 900);
      return;
    }

    // 次のラウンドへカウントダウン
    setTimeout(() => {
      if (this.running) this.startRound();
    }, 1800);
  }

  handleP1Touch(e) {
    if (e.cancelable) e.preventDefault();
    this.handlePlayerAction(1);
  }

  handleP2Touch(e) {
    if (e.cancelable) e.preventDefault();
    this.handlePlayerAction(2);
  }

  handleKeyDown(e) {
    if (e.repeat) return;
    if (e.key === 'w' || e.key === 'W' || e.key === ' ') {
      this.handlePlayerAction(1);
    } else if (e.key === 'ArrowUp' || e.key === 'Enter') {
      this.handlePlayerAction(2);
    }
  }
}

window.ReflexDuelGame = ReflexDuelGame;
