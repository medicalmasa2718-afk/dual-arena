// --- 2. サイバー・タンク・バトル (Cyber Tank Arena) ---
class TankArenaGame {
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
    this.winningScore = 3;

    this.width = 0;
    this.height = 0;

    // 戦車オブジェクト
    this.tank1 = null;
    this.tank2 = null;

    // 弾丸リスト
    this.bullets = [];

    // 障害物ブロック
    this.obstacles = [];

    // パーティクル＆エフェクト
    this.particles = [];
    this.treadMarks = [];
    this.screenShake = 0;

    // 入力キー状態
    this.keys = {};

    // バーチャルパッド入力（スマホ用）
    this.virtualP1 = { angle: 0, move: false, fire: false };
    this.virtualP2 = { angle: 0, move: false, fire: false };

    // バインド
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.setupMobileControls();
  }

  start() {
    this.p1Score = 0;
    this.p2Score = 0;
    this.updateHud(0, 0);
    this.resize();
    this.generateMap();
    this.initTanks();
    this.bullets = [];
    this.particles = [];
    this.treadMarks = [];
    this.running = true;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // スマホ用コントロール表示
    document.getElementById('mobile-controls').classList.remove('hidden');

    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.getElementById('mobile-controls').classList.add('hidden');
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  generateMap() {
    this.obstacles = [];
    const w = this.width;
    const h = this.height;

    // 外枠マージン
    const pad = 20;

    // 中央や四方にサイバーブロックを配置
    const cx = w / 2;
    const cy = h / 2;
    const blockSize = Math.min(w, h) * 0.12;

    // 中央十字ブロック
    this.obstacles.push({ x: cx - blockSize * 0.5, y: cy - blockSize * 1.5, w: blockSize, h: blockSize * 3 });
    this.obstacles.push({ x: cx - blockSize * 1.5, y: cy - blockSize * 0.5, w: blockSize * 3, h: blockSize });

    // 4隅の遮蔽物
    const cornerW = blockSize * 1.2;
    const cornerH = blockSize * 0.8;
    this.obstacles.push({ x: w * 0.2 - cornerW / 2, y: h * 0.25 - cornerH / 2, w: cornerW, h: cornerH });
    this.obstacles.push({ x: w * 0.8 - cornerW / 2, y: h * 0.25 - cornerH / 2, w: cornerW, h: cornerH });
    this.obstacles.push({ x: w * 0.2 - cornerW / 2, y: h * 0.75 - cornerH / 2, w: cornerW, h: cornerH });
    this.obstacles.push({ x: w * 0.8 - cornerW / 2, y: h * 0.75 - cornerH / 2, w: cornerW, h: cornerH });
  }

  initTanks() {
    const w = this.width;
    const h = this.height;
    const size = Math.max(16, Math.min(26, Math.min(w, h) * 0.04));

    this.tank1 = {
      player: 1,
      x: w * 0.15,
      y: h * 0.5,
      angle: 0, // 右向き
      speed: 3.2,
      turnSpeed: 0.065,
      radius: size,
      color: '#00f0ff',
      cooldown: 0,
      activeBullets: 0,
      respawning: 0
    };

    this.tank2 = {
      player: 2,
      x: w * 0.85,
      y: h * 0.5,
      angle: Math.PI, // 左向き
      speed: 3.2,
      turnSpeed: 0.065,
      radius: size,
      color: '#ff0055',
      cooldown: 0,
      activeBullets: 0,
      respawning: 0
    };
  }

  setupMobileControls() {
    // P1 Stick
    this.setupJoystick('p1-stick', 'p1-stick-nub', (angle, dist) => {
      this.virtualP1.move = dist > 10;
      this.virtualP1.angle = angle;
    }, () => {
      this.virtualP1.move = false;
    });

    // P1 Fire
    const p1Fire = document.getElementById('p1-fire');
    p1Fire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.soundFX.init();
      this.fireBullet(this.tank1);
    });

    // P2 Stick
    this.setupJoystick('p2-stick', 'p2-stick-nub', (angle, dist) => {
      this.virtualP2.move = dist > 10;
      this.virtualP2.angle = angle;
    }, () => {
      this.virtualP2.move = false;
    });

    // P2 Fire
    const p2Fire = document.getElementById('p2-fire');
    p2Fire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.soundFX.init();
      this.fireBullet(this.tank2);
    });
  }

  setupJoystick(baseId, nubId, onMove, onEnd) {
    const base = document.getElementById(baseId);
    const nub = document.getElementById(nubId);
    let touchId = null;

    const handleStart = (e) => {
      e.preventDefault();
      window.soundFX.init();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      updatePos(t);
    };

    const handleMove = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          updatePos(t);
          break;
        }
      }
    };

    const handleEnd = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          touchId = null;
          nub.style.transform = `translate(0px, 0px)`;
          onEnd();
          break;
        }
      }
    };

    const updatePos = (touch) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxDist = rect.width / 2;

      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }

      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      const angle = Math.atan2(dy, dx);
      onMove(angle, dist);
    };

    base.addEventListener('touchstart', handleStart, { passive: false });
    base.addEventListener('touchmove', handleMove, { passive: false });
    base.addEventListener('touchend', handleEnd, { passive: false });
    base.addEventListener('touchcancel', handleEnd, { passive: false });
  }

  handleKeyDown(e) {
    this.keys[e.key] = true;
    window.soundFX.init();

    // P1 射撃 (F または スペース)
    if (e.key === 'f' || e.key === 'F' || e.key === ' ') {
      this.fireBullet(this.tank1);
    }
    // P2 射撃 (Enter または L)
    if (e.key === 'Enter' || e.key === 'l' || e.key === 'L') {
      this.fireBullet(this.tank2);
    }
  }

  handleKeyUp(e) {
    this.keys[e.key] = false;
  }

  fireBullet(tank) {
    if (!this.running || !tank || tank.respawning > 0 || tank.cooldown > 0) return;
    if (tank.activeBullets >= 3) return; // 同時発射数制限

    window.soundFX.playShoot();
    tank.cooldown = 18; // 射撃インターバル
    tank.activeBullets++;

    const bulletSpeed = 7.5;
    const bx = tank.x + Math.cos(tank.angle) * (tank.radius * 1.5);
    const by = tank.y + Math.sin(tank.angle) * (tank.radius * 1.5);

    this.bullets.push({
      owner: tank,
      x: bx,
      y: by,
      vx: Math.cos(tank.angle) * bulletSpeed,
      vy: Math.sin(tank.angle) * bulletSpeed,
      r: 4,
      bounces: 0,
      maxBounces: 2,
      trail: []
    });

    // 砲撃反動エフェクト
    tank.x -= Math.cos(tank.angle) * 3;
    tank.y -= Math.sin(tank.angle) * 3;
  }

  updateTank(tank) {
    if (tank.respawning > 0) {
      tank.respawning--;
      return;
    }
    if (tank.cooldown > 0) tank.cooldown--;

    let moveForward = 0;
    let turn = 0;

    if (tank.player === 1) {
      if (this.keys['w'] || this.keys['W']) moveForward += 1;
      if (this.keys['s'] || this.keys['S']) moveForward -= 0.6;
      if (this.keys['a'] || this.keys['A']) turn -= 1;
      if (this.keys['d'] || this.keys['D']) turn += 1;

      // バーチャルパッド優先
      if (this.virtualP1.move) {
        // 目標角度に向けて滑らかに旋回
        let diff = this.virtualP1.angle - tank.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        tank.angle += Math.sign(diff) * Math.min(Math.abs(diff), tank.turnSpeed * 1.5);
        moveForward = 1;
      }
    } else {
      if (this.keys['ArrowUp']) moveForward += 1;
      if (this.keys['ArrowDown']) moveForward -= 0.6;
      if (this.keys['ArrowLeft']) turn -= 1;
      if (this.keys['ArrowRight']) turn += 1;

      if (this.virtualP2.move) {
        let diff = this.virtualP2.angle - tank.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        tank.angle += Math.sign(diff) * Math.min(Math.abs(diff), tank.turnSpeed * 1.5);
        moveForward = 1;
      }
    }

    tank.angle += turn * tank.turnSpeed;

    if (moveForward !== 0) {
      const nextX = tank.x + Math.cos(tank.angle) * (tank.speed * moveForward);
      const nextY = tank.y + Math.sin(tank.angle) * (tank.speed * moveForward);

      // 壁・障害物判定
      if (!this.checkObstacleCollision(nextX, nextY, tank.radius)) {
        tank.x = nextX;
        tank.y = nextY;

        // 軌跡追加
        if (Math.random() < 0.4) {
          this.treadMarks.push({
            x: tank.x,
            y: tank.y,
            angle: tank.angle,
            alpha: 0.6
          });
          if (this.treadMarks.length > 50) this.treadMarks.shift();
        }
      }
    }
  }

  checkObstacleCollision(x, y, r) {
    const w = this.width;
    const h = this.height;

    // 画面端
    if (x - r < 10 || x + r > w - 10 || y - r < 10 || y + r > h - 10) return true;

    // ブロック判定
    for (const obs of this.obstacles) {
      const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
      const dist = Math.hypot(x - closestX, y - closestY);
      if (dist < r) return true;
    }
    return false;
  }

  update() {
    if (!this.running) return;

    this.updateTank(this.tank1);
    this.updateTank(this.tank2);

    const w = this.width;
    const h = this.height;

    // --- 弾丸更新 ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();

      let bounced = false;

      // 画面外枠バウンド
      if (b.x - b.r < 10) { b.x = 10 + b.r; b.vx *= -1; bounced = true; }
      else if (b.x + b.r > w - 10) { b.x = w - 10 - b.r; b.vx *= -1; bounced = true; }
      if (b.y - b.r < 10) { b.y = 10 + b.r; b.vy *= -1; bounced = true; }
      else if (b.y + b.r > h - 10) { b.y = h - 10 - b.r; b.vy *= -1; bounced = true; }

      // 障害物バウンド
      for (const obs of this.obstacles) {
        if (b.x > obs.x && b.x < obs.x + obs.w && b.y > obs.y && b.y < obs.y + obs.h) {
          // どの面に当たったか判定
          const fromLeft = Math.abs(b.x - obs.x);
          const fromRight = Math.abs(b.x - (obs.x + obs.w));
          const fromTop = Math.abs(b.y - obs.y);
          const fromBottom = Math.abs(b.y - (obs.y + obs.h));
          const minEdge = Math.min(fromLeft, fromRight, fromTop, fromBottom);

          if (minEdge === fromLeft || minEdge === fromRight) {
            b.vx *= -1;
          } else {
            b.vy *= -1;
          }
          bounced = true;
          break;
        }
      }

      if (bounced) {
        b.bounces++;
        window.soundFX.playBounce(1.4);
        this.createSparks(b.x, b.y, '#ffe600', 6);
        if (b.bounces > b.maxBounces) {
          b.owner.activeBullets = Math.max(0, b.owner.activeBullets - 1);
          this.bullets.splice(i, 1);
          continue;
        }
      }

      // 戦車への着弾判定
      if (this.checkBulletHit(b, this.tank1)) {
        this.handleTankDestroyed(this.tank1, 2);
        b.owner.activeBullets = Math.max(0, b.owner.activeBullets - 1);
        this.bullets.splice(i, 1);
        continue;
      }
      if (this.checkBulletHit(b, this.tank2)) {
        this.handleTankDestroyed(this.tank2, 1);
        b.owner.activeBullets = Math.max(0, b.owner.activeBullets - 1);
        this.bullets.splice(i, 1);
        continue;
      }
    }

    // パーティクル
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // トレッドマーク消散
    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      this.treadMarks[i].alpha -= 0.003;
      if (this.treadMarks[i].alpha <= 0) this.treadMarks.splice(i, 1);
    }

    if (this.screenShake > 0) this.screenShake *= 0.88;
  }

  checkBulletHit(b, tank) {
    if (tank.respawning > 0) return false;
    const dist = Math.hypot(b.x - tank.x, b.y - tank.y);
    return dist < tank.radius + b.r;
  }

  handleTankDestroyed(tank, killerPlayer) {
    window.soundFX.playExplode();
    this.screenShake = 18;
    this.createExplosion(tank.x, tank.y, tank.color, 45);

    if (killerPlayer === 1) this.p1Score++;
    else this.p2Score++;

    this.updateHud(this.p1Score, this.p2Score);

    // リスポーン設定
    tank.respawning = 90; // 1.5秒待機
    setTimeout(() => {
      if (!this.running) return;
      if (tank.player === 1) {
        tank.x = this.width * 0.15;
        tank.y = this.height * 0.5;
        tank.angle = 0;
      } else {
        tank.x = this.width * 0.85;
        tank.y = this.height * 0.5;
        tank.angle = Math.PI;
      }
    }, 1500);

    // 勝利判定
    if (this.p1Score >= this.winningScore || this.p2Score >= this.winningScore) {
      const winner = this.p1Score >= this.winningScore ? 'PLAYER 1' : 'PLAYER 2';
      setTimeout(() => {
        this.onGameOver(winner, this.p1Score, this.p2Score);
      }, 800);
      this.stop();
    }
  }

  createSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3 + 2,
        life: 1,
        decay: Math.random() * 0.05 + 0.04
      });
    }
  }

  createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? color : '#ffd200',
        size: Math.random() * 6 + 3,
        life: 1,
        decay: Math.random() * 0.03 + 0.015
      });
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    if (this.screenShake > 0.5) {
      const ox = (Math.random() - 0.5) * this.screenShake;
      const oy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(ox, oy);
    }

    // 背景クリア
    ctx.fillStyle = '#0a0b12';
    ctx.fillRect(0, 0, w, h);

    // グリッド線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 外枠ネオンライン
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // トレッドマーク描画
    this.treadMarks.forEach(tm => {
      ctx.save();
      ctx.translate(tm.x, tm.y);
      ctx.rotate(tm.angle);
      ctx.fillStyle = `rgba(255, 255, 255, ${tm.alpha * 0.15})`;
      ctx.fillRect(-8, -12, 16, 4);
      ctx.fillRect(-8, 8, 16, 4);
      ctx.restore();
    });

    // 障害物描画
    this.obstacles.forEach(obs => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 240, 255, 0.2)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#161a29';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.restore();
    });

    // 弾丸描画
    this.bullets.forEach(b => {
      // 軌跡
      b.trail.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (i / b.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 230, 0, ${(i / b.trail.length) * 0.4})`;
        ctx.fill();
      });

      // 本体
      ctx.save();
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 戦車描画
    this.drawTank(this.tank1);
    this.drawTank(this.tank2);

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

  drawTank(tank) {
    if (!tank || tank.respawning > 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);

    ctx.shadowColor = tank.color;
    ctx.shadowBlur = 15;

    // キャタピラ
    ctx.fillStyle = '#22283a';
    ctx.fillRect(-tank.radius * 1.1, -tank.radius * 0.9, tank.radius * 2.2, tank.radius * 0.4);
    ctx.fillRect(-tank.radius * 1.1, tank.radius * 0.5, tank.radius * 2.2, tank.radius * 0.4);

    // 車体
    ctx.fillStyle = '#181e2e';
    ctx.strokeStyle = tank.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-tank.radius * 0.9, -tank.radius * 0.65, tank.radius * 1.8, tank.radius * 1.3, 4);
    ctx.fill();
    ctx.stroke();

    // 砲身
    ctx.fillStyle = tank.color;
    ctx.fillRect(0, -3, tank.radius * 1.4, 6);

    // 砲塔（中央丸）
    ctx.beginPath();
    ctx.arc(0, 0, tank.radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = tank.color;
    ctx.fill();

    // P1 / P2 インジケータ
    ctx.fillStyle = '#0a0b12';
    ctx.beginPath();
    ctx.arc(0, 0, tank.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }
}

window.TankArenaGame = TankArenaGame;
