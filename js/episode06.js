(() => {
  "use strict";

  const game = window.GameProgress;
  if (!game) return;

  const $ = id => document.getElementById(id);
  const story = window.StoryText?.episode06 || {};

  const episodeModal = $("episode-modal");
  const letterModal = $("letter-modal");
  const gateModal = $("gate-modal");
  const clearModal = $("game-clear-modal");
  const airportShell = document.querySelector(".airport-shell");
  const airportScene = $("airport-scene");
  const gateButton = $("gate-button");
  const statusStep = $("airport-status-step");
  const statusMessage = $("airport-status-message");

  let isTransitioning = false;

  // ------------------------------------------------------------
  // 文章の反映
  // 文章そのものは js/story-text.js で編集する。
  // ------------------------------------------------------------
  function applyStoryText() {
    $("episode-intro-text").textContent = story.intro || "搭乗券が見当たらない。";
    $("letter-title").textContent = story.letterTitle || "旅の終わりに";
    $("letter-sign").textContent = story.letterSign || "旅の思い出とともに";

    const paragraphArea = $("letter-paragraphs");
    paragraphArea.replaceChildren();

    (story.letterParagraphs || []).forEach(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      paragraphArea.appendChild(paragraph);
    });

    $("gate-check-title").textContent = story.gateCheckTitle || "搭乗券を確認します";
    $("gate-check-description").textContent =
      story.gateCheckDescription || "搭乗券を確認しました。";
    $("clear-title").textContent = story.clearTitle || "GAME CLEAR!";
    $("clear-subtitle").textContent = story.clearSubtitle || "修学旅行、完結。";
    $("clear-message").textContent = story.clearMessage || "搭乗ゲートを通過した。";
  }

  // ------------------------------------------------------------
  // 共通表示
  // ------------------------------------------------------------
  function show(modal) {
    modal.hidden = false;
  }

  function hide(modal) {
    modal.hidden = true;
  }

  function updateBoardingPassState() {
    const hasPass = game.hasBoardingPass();
    airportScene.classList.toggle("has-pass", hasPass);
    $("gate-caption").textContent = hasPass
      ? "搭乗券を持ってゲートへ。"
      : "搭乗券がないと通過できない。";
  }

  function openLetter() {
    game.setFlag("ep6LetterRead", true);
    statusStep.textContent = "A LETTER";
    statusMessage.textContent = "手紙をもう一度読み返すことができる。";
    show(letterModal);
  }

  // ------------------------------------------------------------
  // 初回クリア記録
  // ------------------------------------------------------------
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "";

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function displayClearRecord(record, needsNickname) {
    const registration = $("first-clear-registration");
    const savedRecord = $("saved-clear-record");
    const nextActions = $("post-clear-actions");

    registration.hidden = !needsNickname;
    savedRecord.hidden = needsNickname;
    nextActions.hidden = needsNickname;

    if (needsNickname) {
      $("clear-nickname").value = "";
      $("nickname-error").textContent = "";
      setTimeout(() => $("clear-nickname").focus(), 100);
      return;
    }

    $("saved-nickname").textContent = record?.nickname || "ニックネーム未登録";
    $("saved-clear-date").textContent =
      `初回クリア：${formatDate(record?.firstClearAt)}`;
  }

  function showGameClear() {
    const existingRecord = game.getFirstClear();
    const record = existingRecord || game.createFirstClear();

    // ニックネーム登録前に離脱した場合は、次回も登録を続けられる。
    const needsNickname = !record.nickname;
    displayClearRecord(record, needsNickname);
    show(clearModal);

    statusStep.textContent = "GAME CLEAR";
    statusMessage.textContent = "搭乗ゲートを通過した。修学旅行はこれでおしまい。";
  }

  // ------------------------------------------------------------
  // ゲート通過演出
  // 空港画面全体をゲート中心に拡大し、クリア画面を出してから元に戻す。
  // ------------------------------------------------------------
  async function passGate() {
    if (isTransitioning || !game.hasBoardingPass()) return;
    isTransitioning = true;
    hide(gateModal);

    statusStep.textContent = "BOARDING";
    statusMessage.textContent = "搭乗券を確認しました。ゲートを通過しています……";

    const shellRect = airportShell.getBoundingClientRect();
    const gateRect = gateButton.getBoundingClientRect();
    const originX = ((gateRect.left + gateRect.width / 2 - shellRect.left) / shellRect.width) * 100;
    const originY = ((gateRect.top + gateRect.height / 2 - shellRect.top) / shellRect.height) * 100;

    airportShell.style.transformOrigin = `${originX}% ${originY}%`;

    const zoomIn = airportShell.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.2)", opacity: 0 }
      ],
      {
        duration: 900,
        easing: "cubic-bezier(.45, 0, .55, 1)",
        fill: "forwards"
      }
    );

    await zoomIn.finished.catch(() => {});

    game.clearEpisode(6);
    showGameClear();

    // ダイアログが表示された状態で、背景だけを元の大きさへ戻す。
    const zoomOut = airportShell.animate(
      [
        { transform: "scale(1.2)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 }
      ],
      {
        duration: 650,
        easing: "cubic-bezier(.2, .7, .25, 1)",
        fill: "forwards"
      }
    );

    await zoomOut.finished.catch(() => {});
    airportShell.style.transform = "";
    airportShell.style.opacity = "";
    airportShell.style.transformOrigin = "";
    isTransitioning = false;
  }

  // ------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------
  $("episode-start").addEventListener("click", () => {
    hide(episodeModal);
    statusStep.textContent = "DEPARTURE LOBBY";
    statusMessage.textContent = "カウンターの上に手紙が置かれている。";
  });

  $("counter-button").addEventListener("click", openLetter);
  $("letter-close").addEventListener("click", () => hide(letterModal));
  $("letter-close-button").addEventListener("click", () => hide(letterModal));
  letterModal.addEventListener("click", event => {
    if (event.target === letterModal) hide(letterModal);
  });

  gateButton.addEventListener("click", () => {
    if (isTransitioning) return;

    if (!game.hasBoardingPass()) {
      statusStep.textContent = "BOARDING PASS REQUIRED";
      statusMessage.textContent =
        "搭乗券が見当たらない。どこかに置き忘れていないだろうか。";
      gateButton.classList.remove("is-locked-pulse");
      void gateButton.offsetWidth;
      gateButton.classList.add("is-locked-pulse");
      return;
    }

    show(gateModal);
  });

  $("gate-pass-button").addEventListener("click", passGate);
  $("gate-cancel-button").addEventListener("click", () => hide(gateModal));
  gateModal.addEventListener("click", event => {
    if (event.target === gateModal) hide(gateModal);
  });

$("nickname-save-button").addEventListener("click", async () => {
  const nickname = $("clear-nickname").value.trim();
  const errorMessage = $("nickname-error");
  const saveButton = $("nickname-save-button");

  if (!nickname) {
    errorMessage.textContent = "ニックネームを入力してください。";
    $("clear-nickname").focus();
    return;
  }

  if (nickname.length > 16) {
    errorMessage.textContent = "ニックネームは16文字以内にしてください。";
    $("clear-nickname").focus();
    return;
  }

  saveButton.disabled = true;
  errorMessage.textContent = "記録を保存しています……";

  try {
    // 初回クリア記録を取得
    const record = game.getFirstClear();

    // Firebaseに保存
    await window.FirebaseAPI.saveClearRecord(
      nickname,
      record.firstClearAt
    );

    // Firebaseへの保存成功後、従来どおりローカルにも保存
    const savedRecord = game.saveFirstClearNickname(nickname);

    displayClearRecord(savedRecord, false);

  } catch (error) {
    console.error("[Firebase] 保存エラー:", error);

    errorMessage.textContent =
      "保存に失敗しました。通信環境を確認して、もう一度お試しください。";

  } finally {
    saveButton.disabled = false;
  }
});

  $("clear-nickname").addEventListener("keydown", event => {
    if (event.key === "Enter") $("nickname-save-button").click();
  });

  // ------------------------------------------------------------
  // 初期化
  // ------------------------------------------------------------
  applyStoryText();
  updateBoardingPassState();

  if (game.hasBoardingPass()) {
    statusStep.textContent = "BOARDING PASS READY";
    statusMessage.textContent = "搭乗券が見つかった。あとは搭乗ゲートを通過するだけだ。";
  }

  show(episodeModal);
})();
