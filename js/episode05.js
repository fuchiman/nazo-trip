(() => {
  "use strict";
  const g = window.GameProgress;
  if (!g) return;

  const $ = id => document.getElementById(id);
  const episodeModal = $("episode-modal");
  const successModal = $("success-modal");
  const clearModal = $("clear-modal");

  const skyStage = $("sky-stage");
  const skySunContainer = $("sky-sun-container");
  const koStars = $("ko-stars");
  const shootingStar = $("shooting-star");
  const statusStep = $("sky-status-step");
  const statusMessage = $("sky-status-message");

  // 第1話の時計の時刻データを取得する
  function getClockMinutes() {
    const flagMinutes = g.getFlag("ep1ClockMinutes");
    if (Number.isFinite(flagMinutes)) {
      return flagMinutes;
    }
    return 20 * 60 + 20; // デフォルト 20:20 (1220分)
  }

  const activeAnimations = new WeakMap();
  function showModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    const panel = modal.querySelector(".object-modal");
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const animations = [
      modal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" }),
      panel.animate(
        [{ opacity: 0, transform: "translateY(12px) scale(.97)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 300, easing: "cubic-bezier(.2,.75,.2,1)" }
      )
    ];
    activeAnimations.set(modal, animations);
  }

  async function hideModal(modal) {
    if (!modal || modal.hidden) return;
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const panel = modal.querySelector(".object-modal");
    const animations = [
      modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }),
      panel.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(8px)" }], { duration: 180 })
    ];
    activeAnimations.set(modal, animations);
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
    modal.hidden = true;
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 第5話への初回到達時だけ、共有時計を20:20にする。
  // 以後の再訪ではプレイヤーが操作した時刻を維持する。
  if (!g.getFlag("ep5ClockInitialized")) {
    g.setFlag("ep1ClockMinutes", 20 * 60 + 20);
    g.setFlag("ep5ClockInitialized", true);
  }

  const returnedAfterLeaving = !!g.getFlag("ep5LeftAfterVisit");
  let shootingStarScheduled = false;

  function evaluateSky() {
    const currentProgress = g.getProgress();
    const cleared = currentProgress.cleared.includes(5);
    const currentEp7 = !!g.getFlag("ep7Entered") || currentProgress.cleared.includes(7);

    const rawMinutes = getClockMinutes();
    const dayMinutes = ((rawMinutes % 1440) + 1440) % 1440;
    // 夜の判定：20:00 (1200分) ～ 翌04:00 (240分)（両端を含む）
    const isNightTime = (dayMinutes >= 1200 || dayMinutes <= 240);

    if (currentEp7) {
      // --- 第7話に進んだ後 ---
      if (isNightTime) {
        skyStage.classList.remove("is-day");
        skySunContainer.hidden = true;
        koStars.hidden = false; // 「コ」の字の星空を表示
        statusStep.textContent = "NIGHT SKY";
        statusMessage.textContent = "夜空に星が輝いている。";
      } else {
        skyStage.classList.add("is-day");
        skySunContainer.hidden = false;
        koStars.hidden = true;
        statusStep.textContent = "DAYTIME";
        statusMessage.textContent = "明るい昼の景色が広がっている。";
      }
      return;
    }

    // --- 第7話に進む前 ---
    skyStage.classList.remove("is-day");
    skySunContainer.hidden = true;
    koStars.hidden = true;

    // 流れ星の発生条件：
    // 1. 第7話未到達
    // 2. 第5話を一度離れてから再訪問 (returnedAfterLeaving === true)
    // 3. 時刻が正確に 20:10 (1210分)
    if (!cleared && returnedAfterLeaving && dayMinutes === 1210 && !shootingStarScheduled) {
      shootingStarScheduled = true;
      statusStep.textContent = "NIGHT SKY";
      statusMessage.textContent = "静かな夜空が広がっている……。";
      scheduleShootingStar();
    } else {
      statusStep.textContent = "OBSERVATION";
      statusMessage.textContent = "星空が広がっている。さっき流れ星が流れたらしい。";
    }
  }

  async function scheduleShootingStar() {
    while (!episodeModal.hidden) {
      await wait(150);
    }
    await wait(1800);
    statusStep.textContent = "SHOOTING STAR";
    statusMessage.textContent = "あ！流れ星が流れた……！";
    shootingStar.hidden = false;
    shootingStar.classList.remove("animate");
    void shootingStar.offsetWidth;
    shootingStar.classList.add("animate");

    await wait(1250);
    if (!g.getProgress().cleared.includes(5)) {
      showModal(successModal);
    }
  }

  async function closeEpisodeIntro() {
    await hideModal(episodeModal);
    // 星座が実際に表示された状態で導入を閉じたときだけ「コ」を観測済みにする。
    if (g.getFlag("ep7Entered") && !koStars.hidden) {
      g.setFlag("ep5KoObserved", true);
    }
  }
  $("episode-open")?.addEventListener("click", () => showModal(episodeModal));
  $("episode-close")?.addEventListener("click", closeEpisodeIntro);
  $("episode-start")?.addEventListener("click", closeEpisodeIntro);
  episodeModal?.addEventListener("click", event => {
    if (event.target === episodeModal) closeEpisodeIntro();
  });

  $("success-close")?.addEventListener("click", async () => {
    await hideModal(successModal);
    g.clearEpisode(5);
    showModal(clearModal);
  });

  $("clear-next")?.addEventListener("click", () => {
    location.href = "../index.html";
  });

  g.setFlag("ep5VisitedOnce", true);
  window.addEventListener("pagehide", () => {
    g.setFlag("ep5LeftAfterVisit", true);
  });

  evaluateSky();
  showModal(episodeModal); // 訪問のたびに毎回必ず説明ダイアログを表示
})();