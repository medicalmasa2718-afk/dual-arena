// --- 2. ダイスロール・タンク (Dice Tank) ---
// 7x7 の盤面で戦う戦術ボードゲーム。
// 毎ターン 2 個のサイコロを振り、1 個ずつ「移動」か「攻撃」に使う。
//   移動: 出目の歩数以内のマスへ（壁・敵は通れない）
//   攻撃: 同じ列/行で、壁に遮られず、出目の射程以内なら 1 ダメージ
// 運は出目だけで、どう使うか（位置取り・壁の利用）は完全に自分次第。

class DiceTankGame {
  constructor(canvas, onGameOver, updateHud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    this.updateHud = updateHud;

    this.running = false;
    this.gridSize = 7;
    this.maxHp = 5;
    this.walls = [[3, 3], [2, 1], [4, 1], [2, 5], [4, 5]];
    this.colors = { 1: '#00e5ff', 2: '#ff3d81' };

    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.resetState();

    this.handleTap = this.handleTap.bind(this);
  }

  resetState() {
    this.turn = 1;
    this.phase = 'ready'; // ready | rolling | act | over
    this.pos = { 1: { x: 0, y: 3 }, 2: { x: 6, y: 3 } };
    this.hp = { 1: this.maxHp, 2: this.maxHp };
    this.dice = null; // [{v, used}]
    this.selected = -1;
    this.moves = null; // Map "x,y" -> dist
    this.target = false;
    this.rollStart = 0;
    this.settleTime = 0;
    this.texts = [];
    this.flashes = [];
    this.shake = 0;
    this.lastBeep = 0;
  }

  start() {
    this.resetState();
    this.updateHud(this.hp[1], this.hp[2]);
    this.resize();
    this.running = true;
    this.canvas.addEventListener('pointerdown', this.handleTap);
    this.loop();
  }

  stop() {
    this.running = false;
    this.canvas.removeEventListener('pointerdown', this.handleTap);
    cancelAnimationFrame(this.animationId);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);

    const W = this.W, H = this.H;
    const top = 58; // 上部のスコアHUDと重ならない余白
    if (W >= H * 1.1) {
      this.boardSize = Math.min(H - top - 10, W * 0.6);
      this.boardX = 10;
      this.boardY = top + (H - top - 10 - this.boardSize) / 2;
      const px = this.boardX + this.boardSize + 16;
      this.panel = { x: px, y: top, w: W - px - 10, h: H - top - 10 };
    } else {
      this.boardSize = Math.min(W - 20, (H - top) * 0.58);
      this.boardX = (W - this.boardSize) / 2;
      this.boardY = top;
      const py = this.boardY + this.boardSize + 10;
      this.panel = { x: 10, y: py, w: W - 20, h: H - py - 10 };
    }
    this.cs = this.boardSize / this.gridSize;

    const p = this.panel;
    const ds = Math.max(36, Math.min(86, p.w * 0.28, p.h * 0.3));
    this.ds = ds;
    const gap = ds * 0.4;
    const dy = p.y + p.h * 0.40;
    this.diceRects = [0, 1].map(i => ({
      x: p.x + p.w / 2 - ds - gap / 2 + i * (ds + gap),
      y: dy,
      w: ds,
      h: ds
    }));
    const bw = Math.min(p.w * 0.7, 240);
    const bh = Math.max(34, Math.min(52, p.h * 0.14));
    this.btn = { x: p.x + (p.w - bw) / 2, y: p.y + p.h - bh - 2, w: bw, h: bh };
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    const now = performance.now();
    if (this.phase === 'rolling') {
      const el = now - this.rollStart;
      if (now - this.lastBeep > 90 && el < 700) {
        this.lastBeep = now;
        this.sfx('playBeep', 300 + Math.random() * 300, 0.04);
      }
      if (el >= 950) {
        this.phase = 'act';
        this.settleTime = now;
        this.sfx('playPowerup');
      }
    }
    this.texts = this.texts.filter(t => now - t.t0 < 1100);
    this.flashes = this.flashes.filter(f => now - f.t0 < 500);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.06);
  }

  sfx(name, ...args) {
    try {
      const s = window.soundFX;
      if (s && typeof s[name] === 'function') s[name](...args);
    } catch (e) { /* 音は無視 */ }
  }

  // ---------- 入力 ----------
  handleTap(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.W / rect.width);
    const y = (e.clientY - rect.top) * (this.H / rect.height);
    const inRect = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

    if (this.phase === 'ready') {
      if (inRect(this.btn) || this.diceRects.some(inRect)) this.rollDice();
      return;
    }
    if (this.phase !== 'act') return;

    if (inRect(this.btn)) {
      this.endTurn();
      return;
    }
    // サイコロ選択
    for (let i = 0; i < 2; i++) {
      if (inRect(this.diceRects[i]) && !this.dice[i].used) {
        this.selectDie(i);
        return;
      }
    }
    // 盤面タップ
    if (this.selected < 0) return;
    const cx = Math.floor((x - this.boardX) / this.cs);
    const cy = Math.floor((y - this.boardY) / this.cs);
    if (cx < 0 || cy < 0 || cx >= this.gridSize || cy >= this.gridSize) return;
    const opp = this.turn === 1 ? 2 : 1;
    const op = this.pos[opp];
    if (cx === op.x && cy === op.y) {
      if (this.target) this.doAttack();
    } else if (this.moves && this.moves.has(cx + ',' + cy)) {
      this.doMove(cx, cy);
    }
  }

  rollDice() {
    this.dice = [
      { v: Math.floor(Math.random() * 6) + 1, used: false },
      { v: Math.floor(Math.random() * 6) + 1, used: false }
    ];
    this.selected = -1;
    this.moves = null;
    this.target = false;
    this.phase = 'rolling';
    this.rollStart = performance.now();
  }

  selectDie(i) {
    this.selected = i;
    const n = this.dice[i].v;
    this.moves = this.calcMoves(n);
    this.target = this.canAttack(n);
    this.sfx('playBeep', 660, 0.05);
  }

  isWall(x, y) {
    return this.walls.some(w => w[0] === x && w[1] === y);
  }

  calcMoves(n) {
    const opp = this.turn === 1 ? 2 : 1;
    const me = this.pos[this.turn];
    const op = this.pos[opp];
    const dist = new Map();
    dist.set(me.x + ',' + me.y, 0);
    const queue = [[me.x, me.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      const d = dist.get(x + ',' + y);
      if (d >= n) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.gridSize || ny >= this.gridSize) return;
        if (this.isWall(nx, ny)) return;
        if (nx === op.x && ny === op.y) return;
        const k = nx + ',' + ny;
        if (dist.has(k)) return;
        dist.set(k, d + 1);
        queue.push([nx, ny]);
      });
    }
    dist.delete(me.x + ',' + me.y);
    return dist;
  }

  canAttack(n) {
    const opp = this.turn === 1 ? 2 : 1;
    const me = this.pos[this.turn];
    const op = this.pos[opp];
    if (me.x !== op.x && me.y !== op.y) return false;
    const d = Math.abs(me.x - op.x) + Math.abs(me.y - op.y);
    if (d > n) return false;
    const sx = Math.sign(op.x - me.x), sy = Math.sign(op.y - me.y);
    let x = me.x + sx, y = me.y + sy;
    while (x !== op.x || y !== op.y) {
      if (this.isWall(x, y)) return false;
      x += sx; y += sy;
    }
    return true;
  }

  // ---------- アクション ----------
  consumeDie() {
    this.dice[this.selected].used = true;
    this.selected = -1;
    this.moves = null;
    this.target = false;
    if (this.dice.every(d => d.used)) {
      setTimeout(() => { if (this.phase === 'act') this.endTurn(); }, 450);
    }
  }

  doMove(x, y) {
    this.pos[this.turn] = { x, y };
    this.sfx('playBounce', 0.8);
    this.consumeDie();
  }

  doAttack() {
    const opp = this.turn === 1 ? 2 : 1;
    this.hp[opp] = Math.max(0, this.hp[opp] - 1);
    this.updateHud(this.hp[1], this.hp[2]);
    const now = performance.now();
    const op = this.pos[opp];
    this.flashes.push({ x: op.x, y: op.y, t0: now });
    this.texts.push({ text: 'HIT! -1', x: this.cellCenter(op.x, op.y).x, y: this.cellCenter(op.x, op.y).y, t0: now, color: '#ff5252' });
    this.shake = 1;
    this.sfx('playExplode');
    if (this.hp[opp] <= 0) {
      this.phase = 'over';
      this.selected = -1;
      this.moves = null;
      this.target = false;
      const winner = this.turn === 1 ? 'PLAYER 1' : 'PLAYER 2';
      setTimeout(() => this.onGameOver(winner, this.hp[1], this.hp[2]), 1000);
      return;
    }
    this.consumeDie();
  }

  endTurn() {
    if (this.phase !== 'act') return;
    this.turn = this.turn === 1 ? 2 : 1;
    this.phase = 'ready';
    this.dice = null;
    this.selected = -1;
    this.moves = null;
    this.target = false;
  }

  // ---------- 描画 ----------
  cellCenter(x, y) {
    return { x: this.boardX + (x + 0.5) * this.cs, y: this.boardY + (y + 0.5) * this.cs };
  }

  render() {
    const ctx = this.ctx;
    const now = performance.now();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 10 * this.shake);
    }
    this.drawBoard(ctx, now);
    ctx.restore();

    this.drawPanel(ctx, now);
    this.drawTexts(ctx, now);
  }

  drawBoard(ctx, now) {
    const cs = this.cs, n = this.gridSize;
    // マス
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#16213e' : '#1b2a4a';
        ctx.fillRect(this.boardX + x * cs, this.boardY + y * cs, cs, cs);
      }
    }
    // 壁
    this.walls.forEach(([x, y]) => {
      const px = this.boardX + x * cs, py = this.boardY + y * cs;
      ctx.fillStyle = '#4a5575';
      ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
      ctx.fillStyle = '#6b7799';
      ctx.fillRect(px + 2, py + 2, cs - 4, (cs - 4) * 0.3);
      ctx.strokeStyle = '#2b3350';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
    });

    // 移動可能マス
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    if (this.moves && this.phase === 'act') {
      const c = this.colors[this.turn];
      this.moves.forEach((d, k) => {
        const [x, y] = k.split(',').map(Number);
        ctx.fillStyle = this.hexAlpha(c, 0.16 + 0.12 * pulse);
        ctx.fillRect(this.boardX + x * cs + 2, this.boardY + y * cs + 2, cs - 4, cs - 4);
        ctx.strokeStyle = this.hexAlpha(c, 0.7);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.boardX + x * cs + 2, this.boardY + y * cs + 2, cs - 4, cs - 4);
      });
    }

    // グリッド線
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX + i * cs, this.boardY);
      ctx.lineTo(this.boardX + i * cs, this.boardY + this.boardSize);
      ctx.moveTo(this.boardX, this.boardY + i * cs);
      ctx.lineTo(this.boardX + this.boardSize, this.boardY + i * cs);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.boardX, this.boardY, this.boardSize, this.boardSize);

    // 戦車
    const opp = this.turn === 1 ? 2 : 1;
    [1, 2].forEach(p => {
      const c = this.cellCenter(this.pos[p].x, this.pos[p].y);
      const o = this.pos[p === 1 ? 2 : 1];
      const ang = Math.atan2(o.y - this.pos[p].y, o.x - this.pos[p].x);
      if (p === this.turn && this.phase !== 'over') {
        ctx.beginPath();
        ctx.arc(c.x, c.y, cs * 0.46, 0, Math.PI * 2);
        ctx.strokeStyle = this.hexAlpha(this.colors[p], 0.5 + 0.4 * pulse);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (this.hp[p] > 0) this.drawTank(ctx, c.x, c.y, cs, this.colors[p], ang);
    });

    // 攻撃可能表示
    if (this.target && this.phase === 'act') {
      const c = this.cellCenter(this.pos[opp].x, this.pos[opp].y);
      ctx.strokeStyle = this.hexAlpha('#ff5252', 0.6 + 0.4 * pulse);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, cs * (0.4 + 0.08 * pulse), 0, Math.PI * 2);
      ctx.moveTo(c.x - cs * 0.5, c.y); ctx.lineTo(c.x + cs * 0.5, c.y);
      ctx.moveTo(c.x, c.y - cs * 0.5); ctx.lineTo(c.x, c.y + cs * 0.5);
      ctx.stroke();
    }

    // ヒットフラッシュ
    this.flashes.forEach(f => {
      const a = 1 - (now - f.t0) / 500;
      ctx.fillStyle = `rgba(255,80,80,${0.6 * a})`;
      ctx.fillRect(this.boardX + f.x * cs, this.boardY + f.y * cs, cs, cs);
    });
  }

  drawTank(ctx, cx, cy, size, color, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const s = size;
    ctx.fillStyle = '#222';
    ctx.fillRect(-0.34 * s, -0.32 * s, 0.68 * s, 0.14 * s);
    ctx.fillRect(-0.34 * s, 0.18 * s, 0.68 * s, 0.14 * s);
    ctx.fillStyle = color;
    ctx.fillRect(-0.3 * s, -0.22 * s, 0.6 * s, 0.44 * s);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-0.3 * s, -0.22 * s, 0.6 * s, 0.44 * s);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, -0.045 * s, 0.46 * s, 0.09 * s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawPanel(ctx, now) {
    const p = this.panel;
    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    this.roundRect(ctx, p.x, p.y, p.w, p.h, 12);
    ctx.fill();

    const col = this.colors[this.turn];
    // ターン表示
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    const hs = Math.max(14, Math.min(24, p.h * 0.08));
    ctx.font = `bold ${hs}px sans-serif`;
    const header = this.phase === 'over' ? 'GAME OVER' : `PLAYER ${this.turn} のターン`;
    ctx.fillText(header, p.x + p.w / 2, p.y + p.h * 0.07);

    // HP
    [1, 2].forEach((pl, i) => {
      const ry = p.y + p.h * (0.17 + i * 0.1);
      const fs = Math.max(11, Math.min(16, p.h * 0.055));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = this.colors[pl];
      ctx.fillText(`P${pl}`, p.x + p.w * 0.1, ry);
      const bw = p.w * 0.12, bh = Math.max(8, p.h * 0.045), gap = 4;
      const total = this.maxHp * bw + (this.maxHp - 1) * gap;
      const bx = Math.min(p.x + p.w * 0.25, p.x + p.w - total - 8);
      for (let h = 0; h < this.maxHp; h++) {
        ctx.fillStyle = h < this.hp[pl] ? this.colors[pl] : 'rgba(255,255,255,0.12)';
        this.roundRect(ctx, bx + h * (bw + gap), ry - bh / 2, bw, bh, 3);
        ctx.fill();
      }
    });

    // サイコロ
    for (let i = 0; i < 2; i++) this.drawDie(ctx, i, now);

    // ヒント
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d8e0ff';
    const hint = this.hintText();
    this.fitText(ctx, hint, p.x + p.w / 2, this.diceRects[0].y + this.ds + (this.btn.y - this.diceRects[0].y - this.ds) / 2 + 2, p.w - 16, Math.max(12, Math.min(16, p.h * 0.055)));

    // ボタン
    if (this.phase === 'ready' || this.phase === 'act') {
      const b = this.btn;
      const isRoll = this.phase === 'ready';
      ctx.fillStyle = isRoll ? col : 'rgba(255,255,255,0.14)';
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.fillStyle = isRoll ? '#0b1020' : '#e8ecff';
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.max(14, Math.min(20, b.h * 0.42))}px sans-serif`;
      ctx.fillText(isRoll ? '🎲 サイコロを振る' : 'ターン終了', b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  }

  hintText() {
    if (this.phase === 'ready') return 'ボタンを押してサイコロを振ろう';
    if (this.phase === 'rolling') return 'ゴロゴロ…';
    if (this.phase === 'over') return '決着！';
    if (this.selected < 0) {
      const left = this.dice.filter(d => !d.used).length;
      return left === 2 ? 'サイコロを1個選ぼう（移動か攻撃に使う）' : '残りのサイコロを選ぶか、ターン終了';
    }
    const v = this.dice[this.selected].v;
    return this.target
      ? `出目${v}: 光るマスへ移動 / 赤い敵を撃て！`
      : `出目${v}: 光るマスへ移動（射程${v}では撃てない）`;
  }

  drawDie(ctx, i, now) {
    const r = this.diceRects[i];
    const ds = this.ds;
    let cx = r.x + ds / 2, cy = r.y + ds / 2;
    let angle = 0, scale = 1, value = null, alpha = 1, used = false, sel = false;

    if (this.phase === 'ready' || !this.dice) {
      alpha = 0.3;
    } else if (this.phase === 'rolling') {
      const el = now - this.rollStart;
      const pr = Math.min(1, el / 950);
      cy += -Math.abs(Math.sin(pr * Math.PI * 3.5)) * (1 - pr) * ds * 0.7;
      cx += Math.sin(pr * 18 + i * 2) * (1 - pr) * ds * 0.25;
      angle = (1 - pr) * (1 - pr) * Math.PI * 6 * (i ? -1 : 1);
      value = pr > 0.8 ? this.dice[i].v : ((Math.floor(el / 70) * (i + 3) + i * 2) % 6) + 1;
    } else {
      value = this.dice[i].v;
      used = this.dice[i].used;
      sel = this.selected === i;
      const pop = Math.max(0, 1 - (now - this.settleTime) / 250);
      scale = 1 + 0.25 * pop;
      if (sel) { scale *= 1.1; cy -= ds * 0.06; }
      if (used) alpha = 0.25;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // 影
    if (this.phase !== 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, ds * 0.55, ds * 0.4, ds * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 本体
    const h = ds / 2;
    ctx.shadowColor = sel ? this.colors[this.turn] : 'transparent';
    ctx.shadowBlur = sel ? 18 : 0;
    ctx.fillStyle = '#f7f7fb';
    this.roundRect(ctx, -h, -h, ds, ds, ds * 0.18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeStyle = sel ? this.colors[this.turn] : '#9aa3c7';
    ctx.stroke();

    if (value === null) {
      ctx.fillStyle = '#9aa3c7';
      ctx.font = `bold ${ds * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 2);
    } else {
      const pips = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
      }[value];
      ctx.fillStyle = value === 1 ? '#e53935' : '#1a1f36';
      const pr = ds * (value === 1 ? 0.14 : 0.085);
      pips.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px * ds * 0.24, py * ds * 0.24, pr, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  drawTexts(ctx, now) {
    this.texts.forEach(t => {
      const a = (now - t.t0) / 1100;
      ctx.globalAlpha = 1 - a * a;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(16, this.cs * 0.42)}px sans-serif`;
      const y = t.y - a * this.cs * 0.9;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillText(t.text, t.x, y);
      ctx.globalAlpha = 1;
    });
  }

  // ---------- 描画ヘルパー ----------
  fitText(ctx, text, x, y, maxW, px) {
    let size = px;
    ctx.font = `bold ${size}px sans-serif`;
    while (ctx.measureText(text).width > maxW && size > 9) {
      size -= 1;
      ctx.font = `bold ${size}px sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  hexAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
}

window.DiceTankGame = DiceTankGame;
