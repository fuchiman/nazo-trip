(() => {
  "use strict";

  const g = window.GameProgress;
  if (!g) return;

  const $ = id => document.getElementById(id);
  const progress = g.getProgress();
  const flags = progress.flags || {};
  const cleared = progress.cleared.includes(2);

  const episodeModal = $("episode-modal");
  const departModal = $("depart-modal");
  const clearModal = $("clear-modal");
  const airportView = document.querySelector(".airport-view");
  const plane = $("main-plane-wrap");

  const isPC = window.matchMedia("(pointer: fine)").matches;

  let introSeen = !!flags.ep2IntroSeen;
  let launchStarted = cleared;

  // スマホ用
  let lastMotion = null;
  let lastShakeAt = 0;
  let shakeScore = 0;
  let sensorActive = false;

  let launchTimer = null;

  // ★7到達後の機体のマーク
  function applyEpisode7Mark() {
    const reachedEpisode7 =
      !!g.getFlag("ep7Entered") ||
      !!g.getProgress().flags?.ep7Entered;

    plane.classList.toggle("has-letter", reachedEpisode7);
  }

  applyEpisode7Mark();

  if (cleared) {
    airportView.classList.add("is-cleared-return");

    $("status-dot").style.background = "#5c9b78";
    $("status-label").textContent = "出発済み";
    $("status-message").textContent = "飛行機は無事に出発した。";
  }

  // モーダル
  const activeAnimations = new WeakMap();

  function showModal(modal) {
    modal.hidden = false;

    const panel = modal.querySelector(".object-modal");

    activeAnimations.get(modal)?.forEach(a => a.cancel());

    const animations = [
      modal.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 260, easing: "ease-out" }
      ),
      panel.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(.97)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        {
          duration: 320,
          easing: "cubic-bezier(.2,.75,.2,1)"
        }
      )
    ];

    activeAnimations.set(modal, animations);
  }

  async function hideModal(modal) {
    if (modal.hidden) return;

    activeAnimations.get(modal)?.forEach(a => a.cancel());

    const panel = modal.querySelector(".object-modal");

    const animations = [
      modal.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 220, easing: "ease-in" }
      ),
      panel.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0, transform: "translateY(8px) scale(.98)" }
        ],
        { duration: 220, easing: "ease-in" }
      )
    ];

    activeAnimations.set(modal, animations);

    await Promise.all(
      animations.map(a => a.finished.catch(() => {}))
    );

    modal.hidden = true;
  }

  function openIntro() {
    showModal(episodeModal);
  }

  async function closeIntro() {
    // iOSではユーザー操作中に許可を求める必要がある
    if (!cleared && !isPC) {
      requestMotionPermission();
    }

    await hideModal(episodeModal);

    if (!introSeen) {
      introSeen = true;
      g.setFlag("ep2IntroSeen", true);
    }

    if (plane.classList.contains("has-letter")) {
      g.setFlag("ep2PlaneLetterSeen", true);
    }
  }

  function setStatus(label, message, color = "#d6a34e") {
    $("status-label").textContent = label;
    $("status-message").textContent = message;
    $("status-dot").style.background = color;
  }

  // ==================================================
  // PC：飛行機をドラッグ
  // ==================================================

  if (isPC && !cleared) {
    let dragging = false;
    let startX = 0;
    let startY = 0;

    plane.style.cursor = "grab";

    plane.addEventListener("pointerdown", event => {
      if (launchStarted || !episodeModal.hidden) return;

      dragging = true;
      startX = event.clientX;
      startY = event.clientY;

      plane.style.cursor = "grabbing";
      plane.setPointerCapture(event.pointerId);
    });

    plane.addEventListener("pointermove", event => {
      if (!dragging || launchStarted) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      // 横方向に一定以上ドラッグしたら離陸
      if (Math.abs(dx) >= 45) {
        dragging = false;
        launchPlane();
        return;
      }

      // ドラッグ中は機体を少し動かす
      plane.style.transform =
        `translate(${dx * 0.35}px, ${dy * 0.15}px)`;
    });

    function stopDragging() {
      if (!dragging) return;

      dragging = false;
      plane.style.cursor = "grab";
      plane.style.transform = "";
    }

    plane.addEventListener("pointerup", stopDragging);
    plane.addEventListener("pointercancel", stopDragging);
    plane.addEventListener("lostpointercapture", stopDragging);
  }

  // ==================================================
  // スマホ：端末を振る
  // ==================================================

  async function requestMotionPermission() {
    if (launchStarted || sensorActive) return;

    const DM = window.DeviceMotionEvent;

    if (!DM) {
      $("motion-help").textContent =
        "この端末では動きを検知できません。";
      return;
    }

    if (typeof DM.requestPermission === "function") {
      try {
        const result = await DM.requestPermission();

        if (result !== "granted") {
          $("motion-help").textContent =
            "センサーの利用が許可されていません。";
          return;
        }
      } catch (error) {
        $("motion-help").textContent =
          "センサーを利用できません。";
        return;
      }
    }

    window.addEventListener("devicemotion", onMotion, {
      passive: true
    });

    sensorActive = true;
    $("motion-help").textContent = "";
  }

  function onMotion(event) {
    if (launchStarted || !sensorActive) return;

    const a = event.acceleration;
    const ag = event.accelerationIncludingGravity;

    const source =
      a && (a.x !== null || a.y !== null || a.z !== null)
        ? a
        : ag;

    if (!source) return;

    const vector = [
      source.x || 0,
      source.y || 0,
      source.z || 0
    ];

    if (lastMotion) {
      const delta = Math.hypot(
        vector[0] - lastMotion[0],
        vector[1] - lastMotion[1],
        vector[2] - lastMotion[2]
      );

      const now = Date.now();

      if (delta > 5.2 && now - lastShakeAt > 220) {
        lastShakeAt = now;

        shakeScore = Math.min(
          8,
          shakeScore + Math.min(2.2, delta / 7)
        );

        updateAccelerationProgress();

      } else if (now - lastShakeAt > 1500) {
        shakeScore = Math.max(0, shakeScore - 0.012);
      }
    }

    lastMotion = vector;
  }

  function updateAccelerationProgress() {
    if (shakeScore >= 7.2) {
      launchPlane();
    } else {
      setStatus(
        "待機中",
        "もう少し勢いが必要らしい。",
        "#d09a45"
      );
    }
  }

  // ==================================================
  // 離陸
  // ==================================================

  function launchPlane() {
    if (launchStarted) return;

    launchStarted = true;

    window.removeEventListener("devicemotion", onMotion);
    sensorActive = false;

    plane.style.cursor = "default";
    plane.style.transform = "";

    setStatus(
      "離陸",
      "飛行機が滑走を始めた！",
      "#5c9b78"
    );

    airportView.classList.add("is-launching");

    launchTimer = setTimeout(() => {
      airportView.classList.add("is-launched");

      setStatus(
        "出発完了",
        "飛行機は空へ飛び立った。",
        "#5c9b78"
      );

      setTimeout(() => {
        showModal(departModal);
      }, 650);

    }, 1850);
  }

  // ==================================================
  // エピソードクリア
  // ==================================================

  async function finishEpisode() {
    await hideModal(departModal);
    g.clearEpisode(2);
    showModal(clearModal);
  }

  // ==================================================
  // イベント登録
  // ==================================================

  $("episode-open").addEventListener("click", openIntro);
  $("episode-close").addEventListener("click", closeIntro);
  $("episode-start").addEventListener("click", closeIntro);

  episodeModal.addEventListener("click", event => {
    if (event.target === episodeModal) {
      closeIntro();
    }
  });

  $("depart-close").addEventListener("click", finishEpisode);

  $("clear-next").addEventListener("click", () => {
    location.href = "../index.html";
  });

  // ==================================================
  // 上空を飛ぶ飛行機
  // ==================================================

  const traffic = $("traffic-plane");

  const flightSequence = [
    "right", "right", "left", "right",
    "left", "left", "right"
  ];

  let flightIndex = 0;
  let trafficTimer = null;

  function flyTrafficPlane() {
    if (!traffic || !airportView) return;

    const direction = flightSequence[flightIndex];
    const viewWidth = airportView.clientWidth;
    const planeWidth =
      traffic.getBoundingClientRect().width || 52;

    const leftEdge = -planeWidth - 8;
    const rightEdge = viewWidth + 8;

    const startX =
      direction === "right" ? leftEdge : rightEdge;

    const endX =
      direction === "right" ? rightEdge : leftEdge;

    const scale =
      direction === "right" ? 1 : -1;

    traffic.style.visibility = "visible";

    traffic.style.transform =
      `translate3d(${startX}px, 0, 0) scaleX(${scale})`;

    const animation = traffic.animate(
      [
        {
          transform:
            `translate3d(${startX}px, 0, 0) scaleX(${scale})`
        },
        {
          transform:
            `translate3d(${endX}px, 0, 0) scaleX(${scale})`
        }
      ],
      {
        duration: 4700,
        easing: "linear",
        fill: "forwards"
      }
    );

    animation.onfinish = () => {
      animation.cancel();

      flightIndex =
        (flightIndex + 1) % flightSequence.length;

      if (flightIndex === 0) {
        traffic.style.visibility = "hidden";

        trafficTimer = setTimeout(() => {
          traffic.style.visibility = "visible";
          flyTrafficPlane();
        }, 2600);

      } else {
        trafficTimer = setTimeout(flyTrafficPlane, 120);
      }
    };
  }

  flyTrafficPlane();

  // ==================================================
  // 初期化
  // ==================================================

  if (!cleared && !introSeen) {
    openIntro();
  }

  if (cleared) {
    $("motion-help").textContent =
      "飛行機は無事に出発した。";
  }

})();