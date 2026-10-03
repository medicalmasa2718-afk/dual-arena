// --- 1. ネオン・エアホッケー (Air Hockey) ---
class AirHockeyGame {
  constructor(canvas, onGameOver, updateHud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    this.updateHud = updateHud;
    this.running = false;
    this.animationId = null;

    // スコア
    this.p1Score = 0;
    this.p2Score = 0;
    this.winningScore = 5;

    // コート設定（isVertical: スマホ等の縦長画面ならtrue）
    this.isVertical = false;
    this.width = 0;
    this.height = 0;

    // パドルとパック
    this.p1 = { x: 0, y: 0, vx: 0, vy: 0, r: 35, baseR: 35, color: '#00f0ff', megaTimer: 0 };
    this.p2 = { x: 0, y: 0, vx: 0, vy: 0, r: 35, baseR: 35, color: '#ff0055', megaTimer: 0 };
    this.pucks = [];

    // 入力キー状態
    this.keys = {};
    // タッチトラッキング { identifier: { playerId, currentX, currentY } }
    this.activeTouches = {};

    // パーティクル＆エフェクト
    this.particles = [];
    this.shockwaves = [];
    this.screenShake = 0;

    // パワーアップ
    this.powerups = [];
    this.powerupTimer = 0;

    // 状態管理
    this.goalCelebration = 0; // ゴール演出タイマー
    this.lastTime = 0;

    // バインド
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
  }

  start() {
    this.p1Score = 0;
    this.p2Score = 0;
    this.updateHud(0, 0);
    this.resize();
    this.resetField();
    this.running = true;

    // イベントリスナー登録
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('mousemove', this.handleMouseMove);

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // 縦長判定（幅より高さが大きい場合は縦型コート：上下対戦）
    this.isVertical = this.height > this.width * 1.1;

    // パドルの基本サイズ調整
    const baseScale = Math.min(this.width, this.height);
    this.p1.baseR = Math.max(26, Math.min(46, baseScale * 0.055));
    this.p2.baseR = this.p1.baseR;
    this.p1.r = this.p1.baseR;
    this.p2.r = this.p2.baseR;
  }

  resetField(scoringPlayer = 0) {
    this.resize();
    const w = this.width;
    const h = this.height;

    if (this.isVertical) {
      // 縦向き：下P1、上P2
      this.p1.x = w / 2;
      this.p1.y = h * 0.8;
      this.p2.x = w / 2;
      this.p2.y = h * 0.2;
    } else {
      // 横向き：左P1、右P2
      this.p1.x = w * 0.2;
      this.p1.y = h / 2;
      this.p2.x = w * 0.8;
      this.p2.y = h / 2;
    }

    this.p1.vx = 0;
    this.p1.vy = 0;
    this.p2.vx = 0;
    this.p2.vy = 0;

    // パック初期化
    const puckR = this.p1.baseR * 0.65;
    let initialVx = 0;
    let initialVy = 0;

    if (this.isVertical) {
      initialVy = scoringPlayer === 1 ? -4 : (scoringPlayer === 2 ? 4 : (Math.random() > 0.5 ? 4 : -4));
      initialVx = (Math.random() - 0.5) * 4;
    } else {
      initialVx = scoringPlayer === 1 ? -4 : (scoringPlayer === 2 ? 4 : (Math.random() > 0.5 ? 4 : -4));
      initialVy = (Math.random() - 0.5) * 4;
    }

    this.pucks = [{
      x: w / 2,
      y: h / 2,
      vx: initialVx,
      vy: initialVy,
      r: puckR,
      speedBoost: 1,
      trail: [],
      isExtra: false
    }];

    this.powerups = [];
    this.powerupTimer = 600; // 10秒後に出現
  }

  // キーボードイベント
  handleKeyDown(e) {
    this.keys[e.key] = true;
  }
  handleKeyUp(e) {
    this.keys[e.key] = false;
  }

  // タッチイベント
  getCanvasCoords(touch) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left),
      y: (touch.clientY - rect.top)
    };
  }

  handleTouchStart(e) {
    e.preventDefault();
    window.soundFX.init();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const pos = this.getCanvasCoords(t);
      let player = null;

      if (this.isVertical) {
        if (pos.y > this.height / 2) player = 'p1';
        else player = 'p2';
      } else {
        if (pos.x < this.width / 2) player = 'p1';
        else player = 'p2';
      }

      this.activeTouches[t.identifier] = {
        player,
        x: pos.x,
        y: pos.y
      };
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if (this.activeTouches[t.identifier]) {
        const pos = this.getCanvasCoords(t);
        this.activeTouches[t.identifier].x = pos.x;
        this.activeTouches[t.identifier].y = pos.y;
      }
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      delete this.activeTouches[touches[i].identifier];
    }
  }

  handleMouseMove(e) {
    // マウス操作（PC用）：P1側の領域にあればP1を追従
    if (Object.keys(this.activeTouches).length > 0) return; // タッチ優先
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let inP1Zone = false;
    if (this.isVertical) {
      if (my > this.height / 2) inP1Zone = true;
    } else {
      if (mx < this.width / 2) inP1Zone = true;
    }

    if (inP1Zone && (e.buttons & 1)) { // 左クリックドラッグ中
      this.mouseControl = { x: mx, y: my };
    } else {
      this.mouseControl = null;
    }
  }

  // 更新処理
  update() {
    if (this.goalCelebration > 0) {
      this.goalCelebration--;
      if (this.goalCelebration === 0) {
        this.resetField();
      }
      return;
    }

    const w = this.width;
    const h = this.height;

    // --- 1. パドルの移動更新 ---
    const speed = 8.5;

    // P1キーボード操作
    let p1TargetVx = 0;
    let p1TargetVy = 0;
    if (this.keys['w'] || this.keys['W']) p1TargetVy -= speed;
    if (this.keys['s'] || this.keys['S']) p1TargetVy += speed;
    if (this.keys['a'] || this.keys['A']) p1TargetVx -= speed;
    if (this.keys['d'] || this.keys['D']) p1TargetVx += speed;

    // P2キーボード操作
    let p2TargetVx = 0;
    let p2TargetVy = 0;
    if (this.keys['ArrowUp']) p2TargetVy -= speed;
    if (this.keys['ArrowDown']) p2TargetVy += speed;
    if (this.keys['ArrowLeft']) p2TargetVx -= speed;
    if (this.keys['ArrowRight']) p2TargetVx += speed;

    // タッチ＆マウス入力の反映
    let p1Touch = null;
    let p2Touch = null;
    for (const id in this.activeTouches) {
      const t = this.activeTouches[id];
      if (t.player === 'p1') p1Touch = t;
      if (t.player === 'p2') p2Touch = t;
    }

    if (p1Touch) {
      const dx = p1Touch.x - this.p1.x;
      const dy = p1Touch.y - this.p1.y;
      this.p1.vx = dx * 0.45;
      this.p1.vy = dy * 0.45;
    } else if (this.mouseControl) {
      const dx = this.mouseControl.x - this.p1.x;
      const dy = this.mouseControl.y - this.p1.y;
      this.p1.vx = dx * 0.45;
      this.p1.vy = dy * 0.45;
    } else {
      this.p1.vx += (p1TargetVx - this.p1.vx) * 0.3;
      this.p1.vy += (p1TargetVy - this.p1.vy) * 0.3;
    }

    if (p2Touch) {
      const dx = p2Touch.x - this.p2.x;
      const dy = p2Touch.y - this.p2.y;
      this.p2.vx = dx * 0.45;
      this.p2.vy = dy * 0.45;
    } else {
      this.p2.vx += (p2TargetVx - this.p2.vx) * 0.3;
      this.p2.vy += (p2TargetVy - this.p2.vy) * 0.3;
    }

    this.p1.x += this.p1.vx;
    this.p1.y += this.p1.vy;
    this.p2.x += this.p2.vx;
    this.p2.y += this.p2.vy;

    // パドルのエリア制限（自陣のみ移動可能）
    if (this.isVertical) {
      // P1: 下半分
      this.p1.x = Math.max(this.p1.r, Math.min(w - this.p1.r, this.p1.x));
      this.p1.y = Math.max(h / 2 + this.p1.r, Math.min(h - this.p1.r, this.p1.y));
      // P2: 上半分
      this.p2.x = Math.max(this.p2.r, Math.min(w - this.p2.r, this.p2.x));
      this.p2.y = Math.max(this.p2.r, Math.min(h / 2 - this.p2.r, this.p2.y));
    } else {
      // P1: 左半分
      this.p1.x = Math.max(this.p1.r, Math.min(w / 2 - this.p1.r, this.p1.x));
      this.p1.y = Math.max(this.p1.r, Math.min(h - this.p1.r, this.p1.y));
      // P2: 右半分
      this.p2.x = Math.max(w / 2 + this.p2.r, Math.min(w - this.p2.r, this.p2.x));
      this.p2.y = Math.max(this.p2.r, Math.min(h - this.p2.r, this.p2.y));
    }

    // パワーアップタイマー更新
    if (this.p1.megaTimer > 0) {
      this.p1.megaTimer--;
      if (this.p1.megaTimer === 0) this.p1.r = this.p1.baseR;
    }
    if (this.p2.megaTimer > 0) {
      this.p2.megaTimer--;
      if (this.p2.megaTimer === 0) this.p2.r = this.p2.baseR;
    }

    // パワーアップアイテム出現管理
    this.powerupTimer--;
    if (this.powerupTimer <= 0 && this.powerups.length === 0) {
      this.spawnPowerup();
      this.powerupTimer = 900; // 15秒間隔
    }

    // --- 2. パックの挙動更新 ---
    const goalSize = (this.isVertical ? w : h) * 0.42;
    const goalMin = ((this.isVertical ? w : h) - goalSize) / 2;
    const goalMax = goalMin + goalSize;

    for (let pIdx = this.pucks.length - 1; pIdx >= 0; pIdx--) {
      const puck = this.pucks[pIdx];

      // 摩擦
      puck.vx *= 0.993;
      puck.vy *= 0.993;

      // 最高速度制限
      const maxSpd = 24 * (puck.speedBoost || 1);
      const spd = Math.hypot(puck.vx, puck.vy);
      if (spd > maxSpd) {
        puck.vx = (puck.vx / spd) * maxSpd;
        puck.vy = (puck.vy / spd) * maxSpd;
      }

      puck.x += puck.vx;
      puck.y += puck.vy;

      // トレイル記録
      puck.trail.push({ x: puck.x, y: puck.y, alpha: 1 });
      if (puck.trail.length > 8) puck.trail.shift();

      // パドル衝突判定
      this.checkPaddleCollision(puck, this.p1, 1);
      this.checkPaddleCollision(puck, this.p2, 2);

      // アイテムとの当たり判定
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const item = this.powerups[i];
        const dist = Math.hypot(puck.x - item.x, puck.y - item.y);
        if (dist < puck.r + item.r) {
          this.applyPowerup(item, puck);
          this.powerups.splice(i, 1);
        }
      }

      // 壁＆ゴール判定
      if (this.isVertical) {
        // 左右の壁
        if (puck.x - puck.r < 0) {
          puck.x = puck.r;
          puck.vx = -puck.vx * 0.95;
          window.soundFX.playBounce(1.1);
          this.createSpark(puck.x, puck.y, '#fff', 5);
        } else if (puck.x + puck.r > w) {
          puck.x = w - puck.r;
          puck.vx = -puck.vx * 0.95;
          window.soundFX.playBounce(1.1);
          this.createSpark(puck.x, puck.y, '#fff', 5);
        }

        // 上下の壁＆ゴール
        // 上（P2ゴール）
        if (puck.y - puck.r < 0) {
          if (puck.x >= goalMin && puck.x <= goalMax) {
            // P1のゴール得点！
            this.handleGoal(1, puck.x, puck.y);
            return;
          } else {
            puck.y = puck.r;
            puck.vy = -puck.vy * 0.95;
            window.soundFX.playBounce(0.9);
            this.createSpark(puck.x, puck.y, '#fff', 5);
          }
        }
        // 下（P1ゴール）
        if (puck.y + puck.r > h) {
          if (puck.x >= goalMin && puck.x <= goalMax) {
            // P2のゴール得点！
            this.handleGoal(2, puck.x, puck.y);
            return;
          } else {
            puck.y = h - puck.r;
            puck.vy = -puck.vy * 0.95;
            window.soundFX.playBounce(0.9);
            this.createSpark(puck.x, puck.y, '#fff', 5);
          }
        }
      } else {
        // 横向き
        // 上下の壁
        if (puck.y - puck.r < 0) {
          puck.y = puck.r;
          puck.vy = -puck.vy * 0.95;
          window.soundFX.playBounce(1.1);
          this.createSpark(puck.x, puck.y, '#fff', 5);
        } else if (puck.y + puck.r > h) {
          puck.y = h - puck.r;
          puck.vy = -puck.vy * 0.95;
          window.soundFX.playBounce(1.1);
          this.createSpark(puck.x, puck.y, '#fff', 5);
        }

        // 左右の壁＆ゴール
        // 左（P1ゴール）
        if (puck.x - puck.r < 0) {
          if (puck.y >= goalMin && puck.y <= goalMax) {
            // P2のゴール得点！
            this.handleGoal(2, puck.x, puck.y);
            return;
          } else {
            puck.x = puck.r;
            puck.vx = -puck.vx * 0.95;
            window.soundFX.playBounce(0.9);
            this.createSpark(puck.x, puck.y, '#fff', 5);
          }
        }
        // 右（P2ゴール）
        if (puck.x + puck.r > w) {
          if (puck.y >= goalMin && puck.y <= goalMax) {
            // P1のゴール得点！
            this.handleGoal(1, puck.x, puck.y);
            return;
          } else {
            puck.x = w - puck.r;
            puck.vx = -puck.vx * 0.95;
            window.soundFX.playBounce(0.9);
            this.createSpark(puck.x, puck.y, '#fff', 5);
          }
        }
      }
    }

    // パーティクル更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 衝撃波
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += s.speed;
      s.alpha -= 0.03;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    if (this.screenShake > 0) this.screenShake *= 0.88;
  }

  // パドルとパックの衝突判定
  checkPaddleCollision(puck, paddle, playerNum) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);

    if (dist < puck.r + paddle.r && dist > 0.001) {
      // 法線ベクトル
      const nx = dx / dist;
      const ny = dy / dist;

      // めり込み解消
      const overlap = (puck.r + paddle.r) - dist;
      puck.x += nx * overlap;
      puck.y += ny * overlap;

      // 相対速度
      const rvx = puck.vx - paddle.vx;
      const rvy = puck.vy - paddle.vy;
      const normalVel = rvx * nx + rvy * ny;

      // 接近している場合のみ反発
      if (normalVel < 0) {
        const restitution = 1.08; // 爽快な反発
        const impulse = -(1 + restitution) * normalVel;
        puck.vx += nx * impulse + paddle.vx * 0.55;
        puck.vy += ny * impulse + paddle.vy * 0.55;

        window.soundFX.playPaddleHit();
        this.screenShake = 6;
        this.createSpark(puck.x, puck.y, paddle.color, 12);

        // 最後に打ったプレイヤーを記録
        puck.lastHitter = playerNum;
      }
    }
  }

  // ゴール処理
  handleGoal(scorer, gx, gy) {
    if (scorer === 1) this.p1Score++;
    else this.p2Score++;

    this.updateHud(this.p1Score, this.p2Score);
    window.soundFX.playGoal();
    this.screenShake = 16;
    this.createExplosion(gx, gy, scorer === 1 ? '#00f0ff' : '#ff0055', 40);
    this.shockwaves.push({ x: gx, y: gy, r: 20, speed: 12, alpha: 1, color: scorer === 1 ? '#00f0ff' : '#ff0055' });

    // 勝敗チェック
    if (this.p1Score >= this.winningScore || this.p2Score >= this.winningScore) {
      const winner = this.p1Score >= this.winningScore ? 'PLAYER 1' : 'PLAYER 2';
      setTimeout(() => {
        this.onGameOver(winner, this.p1Score, this.p2Score);
      }, 700);
      this.stop();
      return;
    }

    this.goalCelebration = 70; // 約1秒停止して再開
  }

  // パワーアップ生成
  spawnPowerup() {
    const w = this.width;
    const h = this.height;
    const types = ['speed', 'mega', 'multi'];
    const type = types[Math.floor(Math.random() * types.length)];

    let px = w / 2;
    let py = h / 2;
    if (this.isVertical) {
      px = w * 0.25 + Math.random() * w * 0.5;
      py = h * 0.4 + Math.random() * h * 0.2;
    } else {
      px = w * 0.4 + Math.random() * w * 0.2;
      py = h * 0.25 + Math.random() * h * 0.5;
    }

    this.powerups.push({
      type,
      x: px,
      y: py,
      r: 22,
      pulse: 0
    });
  }

  // パワーアップ効果適用
  applyPowerup(item, puck) {
    window.soundFX.playPowerup();
    const hitter = puck.lastHitter || (puck.vy > 0 ? 2 : 1);
    const targetPaddle = hitter === 1 ? this.p1 : this.p2;

    if (item.type === 'speed') {
      puck.speedBoost = 1.6;
      puck.vx *= 1.5;
      puck.vy *= 1.5;
    } else if (item.type === 'mega') {
      targetPaddle.r = targetPaddle.baseR * 1.5;
      targetPaddle.megaTimer = 600; // 10秒間
    } else if (item.type === 'multi') {
      if (this.pucks.length < 3) {
        this.pucks.push({
          x: item.x,
          y: item.y,
          vx: -puck.vx * 0.9,
          vy: -puck.vy * 0.9,
          r: puck.r,
          speedBoost: 1,
          trail: [],
          isExtra: true
        });
      }
    }
    this.createExplosion(item.x, item.y, '#ffd200', 25);
  }

  // パーティクル＆エフェクト
  createSpark(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3 + 2,
        life: 1,
        decay: Math.random() * 0.04 + 0.03
      });
    }
  }

  createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 5 + 3,
        life: 1,
        decay: Math.random() * 0.03 + 0.015
      });
    }
  }

  // 描画処理
  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // 画面揺れ
    if (this.screenShake > 0.5) {
      const ox = (Math.random() - 0.5) * this.screenShake;
      const oy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(ox, oy);
    }

    // 背景クリア
    ctx.fillStyle = '#080911';
    ctx.fillRect(0, 0, w, h);

    // --- コートライン描画 ---
    ctx.lineWidth = 3;
    const goalSize = (this.isVertical ? w : h) * 0.42;
    const goalMin = ((this.isVertical ? w : h) - goalSize) / 2;
    const goalMax = goalMin + goalSize;

    if (this.isVertical) {
      // センターライン
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // センターサークル
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      // P2側（上）ゴール
      ctx.strokeStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 12;
      ctx.strokeRect(goalMin, 0, goalSize, 14);

      // P1側（下）ゴール
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.strokeRect(goalMin, h - 14, goalSize, 14);
    } else {
      // 横向き
      // センターライン
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();

      // センターサークル
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      // P1側（左）ゴール
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.strokeRect(0, goalMin, 14, goalSize);

      // P2側（右）ゴール
      ctx.strokeStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 12;
      ctx.strokeRect(w - 14, goalMin, 14, goalSize);
    }

    ctx.shadowBlur = 0; // リセット

    // パワーアップアイテム描画
    this.powerups.forEach(item => {
      item.pulse = (item.pulse || 0) + 0.05;
      const pulseScale = Math.sin(item.pulse) * 4;

      ctx.save();
      ctx.shadowColor = '#ffd200';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r + pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd200';
      ctx.fill();

      // アイコン表示
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = item.type === 'speed' ? '⚡' : (item.type === 'mega' ? '🛡️' : '⚽');
      ctx.fillText(icon, item.x, item.y);
      ctx.restore();
    });

    // パックの軌跡と本体
    this.pucks.forEach(puck => {
      // 軌跡
      puck.trail.forEach((t, i) => {
        const ratio = i / puck.trail.length;
        ctx.beginPath();
        ctx.arc(t.x, t.y, puck.r * (0.4 + ratio * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = puck.speedBoost > 1 
          ? `rgba(255, 230, 0, ${ratio * 0.4})` 
          : `rgba(255, 255, 255, ${ratio * 0.25})`;
        ctx.fill();
      });

      // パック本体
      ctx.save();
      ctx.shadowColor = puck.speedBoost > 1 ? '#ffe600' : '#ffffff';
      ctx.shadowBlur = puck.speedBoost > 1 ? 25 : 12;

      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 内円
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = puck.speedBoost > 1 ? '#ffe600' : '#1a2035';
      ctx.fill();
      ctx.restore();
    });

    // パドル描画
    this.drawPaddle(this.p1, '#00f0ff', 'P1');
    this.drawPaddle(this.p2, '#ff0055', 'P2');

    // 衝撃波
    this.shockwaves.forEach(s => {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // パーティクル描画
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  drawPaddle(paddle, color, label) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;

    // 外枠リング
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r, 0, Math.PI * 2);
    ctx.stroke();

    // 内側の塗り
    ctx.fillStyle = 'rgba(15, 20, 35, 0.85)';
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r, 0, Math.PI * 2);
    ctx.fill();

    // 中央ノブ
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // ラベル
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, paddle.x, paddle.y);

    ctx.restore();
  }

  loop(timestamp) {
    if (!this.running) return;
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }
}

window.AirHockeyGame = AirHockeyGame;
