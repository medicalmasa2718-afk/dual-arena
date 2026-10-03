// --- メインコントローラー ---
document.addEventListener('DOMContentLoaded', () => {
  // DOM要素
  const menuScreen = document.getElementById('menu-screen');
  const gameScreen = document.getElementById('game-screen');
  const btnBackMenu = document.getElementById('btn-back-menu');
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const gameCanvas = document.getElementById('game-canvas');
  const reflexContainer = document.getElementById('reflex-container');

  const hudScoreP1 = document.getElementById('hud-score-p1');
  const hudScoreP2 = document.getElementById('hud-score-p2');

  const victoryModal = document.getElementById('victory-modal');
  const victoryWinner = document.getElementById('victory-winner');
  const victoryDetail = document.getElementById('victory-detail');
  const btnRematch = document.getElementById('btn-rematch');
  const btnReturnMenu = document.getElementById('btn-return-menu');

  const guideModal = document.getElementById('guide-modal');
  const btnShowGuide = document.getElementById('btn-show-guide');
  const btnCloseGuide = document.getElementById('btn-close-guide');

  // 現在のゲームインスタンス
  let currentGame = null;
  let currentGameType = null;

  // HUDスコア更新
  const updateHud = (p1, p2) => {
    hudScoreP1.textContent = p1;
    hudScoreP2.textContent = p2;
  };

  // ゲーム終了（勝利モーダル表示）
  const onGameOver = (winner, p1Score, p2Score) => {
    victoryWinner.textContent = `${winner} WINS!`;
    victoryWinner.className = winner.includes('1') ? 'p1-win' : 'p2-win';
    victoryDetail.textContent = `スコア: ${p1Score} - ${p2Score}`;
    victoryModal.classList.remove('hidden');
    window.soundFX.playWin();
  };

  // ゲーム切り替え
  const launchGame = (gameType) => {
    // 既存ゲームの停止
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }

    currentGameType = gameType;
    victoryModal.classList.add('hidden');

    // 画面切り替え
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');
    btnBackMenu.classList.remove('hidden');

    // 初回タップ/クリック時にAudioContext初期化
    window.soundFX.init();

    // ゲーム初期化
    if (gameType === 'hockey') {
      gameCanvas.classList.remove('hidden');
      reflexContainer.classList.add('hidden');
      currentGame = new window.AirHockeyGame(gameCanvas, onGameOver, updateHud);
      currentGame.start();
    } else if (gameType === 'tank') {
      gameCanvas.classList.remove('hidden');
      reflexContainer.classList.add('hidden');
      // Use DiceTankGame (turn‑based dice roll board game)
      currentGame = new window.DiceTankGame(gameCanvas, onGameOver, updateHud);
      currentGame.start();
    } else if (gameType === 'reflex') {
      gameCanvas.classList.add('hidden');
      reflexContainer.classList.remove('hidden');
      // Use GridBattleGame (turn‑based grid board game)
      currentGame = new window.GridBattleGame(reflexContainer, onGameOver, updateHud);
      currentGame.start();
    }
  };

  // メニューへ戻る
  const returnToMenu = () => {
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }
    victoryModal.classList.add('hidden');
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    btnBackMenu.classList.add('hidden');
  };

  // カードクリックイベント
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const type = card.dataset.game;
      launchGame(type);
    });
  });

  // トップバーボタン
  btnBackMenu.addEventListener('click', returnToMenu);

  // サウンド切替
  btnSound.addEventListener('click', () => {
    window.soundFX.init();
    const isMuted = window.soundFX.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  });

  // フルスクリーン切替
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // 勝利モーダルアクション
  btnRematch.addEventListener('click', () => {
    if (currentGameType) {
      launchGame(currentGameType);
    }
  });

  btnReturnMenu.addEventListener('click', returnToMenu);

  const qrModal = document.getElementById('qr-modal');
  const btnMobileConnect = document.getElementById('btn-mobile-connect');
  const btnCloseQr = document.getElementById('btn-close-qr');

  // 操作ガイドモーダル
  btnShowGuide.addEventListener('click', () => {
    guideModal.classList.remove('hidden');
  });

  btnCloseGuide.addEventListener('click', () => {
    guideModal.classList.add('hidden');
  });

  // QRコードモーダル
  if (btnMobileConnect && qrModal) {
    btnMobileConnect.addEventListener('click', () => {
      qrModal.classList.remove('hidden');
    });
  }

  if (btnCloseQr && qrModal) {
    btnCloseQr.addEventListener('click', () => {
      qrModal.classList.add('hidden');
    });
  }

  // リサイズハンドラ
  window.addEventListener('resize', () => {
    if (currentGame && currentGame.resize) {
      currentGame.resize();
    }
  });
});
