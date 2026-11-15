(() => {
  "use strict";
  const g = window.GameProgress;
  if (!g) return;

  const $ = id => document.getElementById(id);
  const episodeModal = $("episode-modal");
  const shisaModal = $("shisa-modal");
  const clearModal = $("clear-modal");

  const paintingWrap = $("painting-wrap");
  const paintingFrame = $("painting-frame");
  const tapLeft = $("tap-left");
  const tapRight = $("tap-right");
  const secretNiche = $("secret-niche");
  const goldenShisa = $("golden-shisa");

  // 正解の7回シーケンス: 左 → 左 → 右 → 左 → 右 → 右 → 左
  const TARGET_SEQUENCE = ["left", "left", "right", "left", "right", "right", "left"];
  const PAINTING_REMOVED_FLAG = "ep4PaintingRemoved";

  // 状態管理
  const episodeCleared = g.getProgress().cleared.includes(4);
  let paintingRemoved = Boolean(g.getFlag(PAINTING_REMOVED_FLAG)) || episodeCleared;
  // シーサーはページを訪れるたびに元の位置へ戻す。
  // ep4ShisaRemoved は「一度どけた」という謎解き記録としてだけ残す。
  let seahorseVisible = true;
  let inputSequence = [];
  let isTransitioning = false;
  let tiltAnimation = null;

  const activeAnimations = new WeakMap();
  function showModal(modal) {
    modal.hidden = false;
    const panel = modal.querySelector(".object-modal");
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const animations = [
      modal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" }),
      panel.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(.97)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        { duration: 300, easing: "cubic-bezier(.2,.75,.2,1)" }
      )
    ];
    activeAnimations.set(modal, animations);
  }

  async function hideModal(modal) {
    if (modal.hidden) return;
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const panel = modal.querySelector(".object-modal");
    const animations = [
      modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in" }),
      panel.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0, transform: "translateY(8px) scale(.98)" }
        ],
        { duration: 200, easing: "ease-in" }
      )
    ];
    activeAnimations.set(modal, animations);
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
    modal.hidden = true;
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function setStatus(step, message) {
    $("status-step").textContent = step;
    $("status-message").textContent = message;
  }

  function setTapEnabled(enabled) {
    tapLeft.disabled = !enabled;
    tapRight.disabled = !enabled;
  }

  function updateShisaState() {
    goldenShisa.hidden = !seahorseVisible;
    goldenShisa.disabled = !paintingRemoved || !seahorseVisible;
    secretNiche.classList.toggle("is-revealed", paintingRemoved && !seahorseVisible);
  }

  function applyInitialState() {
    if (paintingRemoved) {
      // クリア後や絵画を外した後の再訪時：絵画はすでに外れており、シーサーは元の位置に戻っている
      paintingWrap.hidden = true;
      setTapEnabled(false);
      // 以前どけていても、再訪時はシーサーを再表示する。
      seahorseVisible = true;
      updateShisaState();
      setStatus("SECRET SPACE", "");
    } else {
      paintingWrap.hidden = false;
      setTapEnabled(true);
      seahorseVisible = true;
      updateShisaState();
      setStatus("ROOM WALL", "壁に掛けられた絵画を調べてみよう。");
    }
  }

  function animatePaintingTilt(direction) {
    if (tiltAnimation) {
      tiltAnimation.cancel();
      tiltAnimation = null;
    }
    const angle = direction === "left" ? -4.5 : 4.5;
    const shiftX = direction === "left" ? -4 : 4;
    tiltAnimation = paintingFrame.animate(
      [
        { transform: "rotate(0deg) translateX(0px)" },
        { transform: `rotate(${angle}deg) translateX(${shiftX}px)`, offset: 0.35 },
        { transform: `rotate(${-angle * 0.28}deg) translateX(${-shiftX * 0.25}px)`, offset: 0.72 },
        { transform: "rotate(0deg) translateX(0px)" }
      ],
      {
        duration: 360,
        easing: "cubic-bezier(.22, .8, .3, 1)"
      }
    );
  }

  function handlePaintingTap(side) {
    if (paintingRemoved || isTransitioning) return;

    animatePaintingTilt(side);

    const expected = TARGET_SEQUENCE[inputSequence.length];
    if (side === expected) {
      inputSequence.push(side);
    } else {
      // 途中で間違えた場合はリセット。最初の入力として一致するなら1手目として扱う
      inputSequence = side === TARGET_SEQUENCE[0] ? [side] : [];
    }

    if (inputSequence.length === TARGET_SEQUENCE.length) {
      unlockPainting();
    }
  }

  async function unlockPainting() {
    if (paintingRemoved || isTransitioning) return;
    isTransitioning = true;
    setTapEnabled(false);

    if (tiltAnimation) {
      tiltAnimation.cancel();
      tiltAnimation = null;
    }

    setStatus("UNLOCKED", "カチリと小さな音がして、絵画の留め具が外れた。");

    // 1. 絵画が少し動く（がたっと外れる予兆）
    const rattle = paintingFrame.animate(
      [
        { transform: "rotate(0deg) translateY(0px)" },
        { transform: "rotate(-3deg) translateY(2px)", offset: 0.25 },
        { transform: "rotate(3.5deg) translateY(4px)", offset: 0.55 },
        { transform: "rotate(-1.5deg) translateY(6px)", offset: 0.8 },
        { transform: "rotate(1deg) translateY(8px)" }
      ],
      { duration: 480, easing: "ease-out", fill: "forwards" }
    );
    await rattle.finished.catch(() => {});

    // 2. 壁から外れるように移動し、3. フェードアウトする
    const detach = paintingWrap.animate(
      [
        {
          opacity: 1,
          transform: "translate(-50%, -50%) rotate(1deg) scale(1)"
        },
        {
          opacity: 0.85,
          transform: "translate(-50%, -36%) rotate(4deg) scale(0.98)",
          offset: 0.45
        },
        {
          opacity: 0,
          transform: "translate(-50%, -14%) rotate(7deg) scale(0.94)"
        }
      ],
      { duration: 680, easing: "cubic-bezier(.3, .05, .6, 1)", fill: "forwards" }
    );
    await detach.finished.catch(() => {});

    paintingWrap.hidden = true;
    paintingRemoved = true;
    seahorseVisible = true;
    g.setFlag(PAINTING_REMOVED_FLAG, true);
    updateShisaState();
    setStatus("SECRET SPACE", "絵画の裏から隠し空間が現れた。");

    await wait(320);
    isTransitioning = false;

    // 絵画が外れて金色のシーサーが現れた段階でクリア演出を開始する
    showModal(shisaModal);
  }

  async function removeShisa() {
    if (!paintingRemoved || !seahorseVisible || isTransitioning) return;
    seahorseVisible = false;
    goldenShisa.disabled = true;
    goldenShisa.classList.add("is-removing");
    secretNiche.classList.add("is-revealed");

    await wait(560);
    goldenShisa.hidden = true;
    goldenShisa.classList.remove("is-removing");
    g.setFlag("ep4ShisaRemoved", true);
    setStatus("HIDDEN MARK", "");
  }

  // イベント登録
  tapLeft.addEventListener("click", () => handlePaintingTap("left"));
  tapRight.addEventListener("click", () => handlePaintingTap("right"));
  goldenShisa.addEventListener("click", removeShisa);

  $("episode-open").addEventListener("click", () => showModal(episodeModal));
  $("episode-close").addEventListener("click", () => hideModal(episodeModal));
  $("episode-start").addEventListener("click", () => hideModal(episodeModal));
  episodeModal.addEventListener("click", event => {
    if (event.target === episodeModal) hideModal(episodeModal);
  });

  // 第1段階ダイアログ「閉じる」→ フェードアウト後に第2段階「クリア！次に進む」
  $("shisa-close").addEventListener("click", async () => {
    await hideModal(shisaModal);
    g.clearEpisode(4);
    showModal(clearModal);
  });

  $("clear-next").addEventListener("click", () => {
    location.href = "../index.html";
  });

  // 初期化
  applyInitialState();
  showModal(episodeModal);
})();
