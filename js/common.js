(() => {
  "use strict";

  const STORAGE_KEY = "schoolTripMystery_progress_v1";
  const FIRST_CLEAR_KEY = "schoolTripMystery_firstClear_v1";
  const EPISODES = [
    { id: 1, title: "朝を取り戻せ" },
    { id: 2, title: "飛行機を出発させる" },
    { id: 3, title: "ドルフィンにさわろう" },
    { id: 4, title: "秘密の扉を開けろ" },
    { id: 5, title: "流れ星を見逃した" },
    { id: 6, title: "最後の忘れ物" }
  ];

  function freshProgress() {
    return { highestUnlocked: 1, cleared: [], visited: [], flags: {}, clearTimestamp: null };
  }
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshProgress();
      const parsed = JSON.parse(raw);
      // 旧第7話は新第6話へ移行。旧第6話（未実装の収納パズル）は引き継がない。
      const mapOld = n => n === 7 ? 6 : n;
      const cleared = Array.isArray(parsed.cleared)
        ? [...new Set(parsed.cleared.filter(Number.isInteger).filter(n => n === 7 || (n >= 1 && n <= 6)).map(mapOld))]
        : [];
      const visited = Array.isArray(parsed.visited)
        ? [...new Set(parsed.visited.filter(Number.isInteger).filter(n => n === 7 || (n >= 1 && n <= 6)).map(mapOld))]
        : [];
      const oldHighest = Number(parsed.highestUnlocked) || 1;
      const highestUnlocked = oldHighest >= 7 ? 6 : Math.min(6, Math.max(1, oldHighest >= 6 ? 6 : oldHighest));
      const flags = parsed.flags && typeof parsed.flags === "object" ? { ...parsed.flags } : {};
      if (flags.ep7Entered || cleared.includes(6)) {
        flags.ep6Entered = true;
        flags.ep7Entered = true;
      }
      return { ...freshProgress(), ...parsed, highestUnlocked, cleared, visited, flags };
    } catch (error) {
      console.warn("セーブデータを読み込めませんでした。初期状態に戻します。", error);
      return freshProgress();
    }
  }

  let progress = loadProgress();
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch (error) { alert("進行状況を保存できませんでした。ブラウザの設定を確認してください。"); console.error(error); }
  }
  function episodePath(id) {
    const folder = String(id).padStart(2, "0");
    return document.body.dataset.episode ? `../${folder}/index.html` : `${folder}/index.html`;
  }
  function isUnlocked(id) { return id <= progress.highestUnlocked || progress.cleared.includes(id); }
  function markVisited(id) {
    if (!progress.visited.includes(id)) { progress.visited.push(id); saveProgress(); }
  }
  function clearEpisode(id) {
    if (!Number.isInteger(id) || id < 1 || id > 6) return;
    if (!progress.cleared.includes(id)) progress.cleared.push(id);
    progress.highestUnlocked = Math.max(progress.highestUnlocked, Math.min(6, id + 1));
    saveProgress();
  }
  function setFlag(name, value = true) { progress.flags[name] = value; saveProgress(); }
  function getFlag(name) { return progress.flags[name]; }
  function getNextPlayable() {
    for (let id = 1; id <= 6; id++) if (!progress.cleared.includes(id)) return id;
    return 6;
  }
  function getFirstClear() {
    try {
      const value = JSON.parse(localStorage.getItem(FIRST_CLEAR_KEY) || "null");
      return value && value.cleared === true ? value : null;
    } catch { return null; }
  }
  function createFirstClear() {
    const existing = getFirstClear();
    if (existing) return existing;

    const record = {
      cleared: true,
      nickname: "",
      firstClearAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(FIRST_CLEAR_KEY, JSON.stringify(record));
    } catch (error) {
      console.error("初回クリア記録を保存できませんでした。", error);
    }
    return record;
  }
  function saveFirstClearNickname(nickname) {
    const existing = getFirstClear();
    if (!existing) return null;
    if (existing.nickname) return existing;
    const updated = { ...existing, nickname: String(nickname).trim().slice(0, 20) };
    try { localStorage.setItem(FIRST_CLEAR_KEY, JSON.stringify(updated)); } catch (error) { console.error(error); }
    return updated;
  }
  function hasBoardingPass() { return !!progress.flags.boardingPassFound; }

  function renderTopPage() {
    const list = document.querySelector("#episode-list");
    if (!list) return;
    list.innerHTML = "";
    EPISODES.forEach(episode => {
      const unlocked = isUnlocked(episode.id), cleared = progress.cleared.includes(episode.id);
      const li = document.createElement("li");
      li.className = `episode-item${cleared ? " is-cleared" : ""}${unlocked ? "" : " is-locked"}`;
      const number = document.createElement("span"); number.className = "episode-number"; number.textContent = `★${episode.id}`;
      const name = document.createElement("span"); name.className = "episode-name"; name.textContent = episode.title;
      const status = document.createElement("span"); status.className = "episode-status"; status.textContent = cleared ? "CLEAR" : unlocked ? "プレイ可能" : "LOCKED";
      li.append(number, name, status);
      if (unlocked) {
        li.classList.add("episode-link"); li.tabIndex = 0; li.setAttribute("role", "link");
        li.addEventListener("click", () => location.href = episodePath(episode.id));
        li.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); location.href = episodePath(episode.id); } });
      }
      list.appendChild(li);
    });
    const summary = document.querySelector("#progress-summary");
    if (summary) summary.textContent = `${progress.cleared.length} / 6 エピソード クリア`;
    const continueButton = document.querySelector("#continue-button");
    if (continueButton) {
      continueButton.textContent = progress.cleared.includes(6) ? "もう一度見る" : "つづきから";
      continueButton.addEventListener("click", () => location.href = episodePath(getNextPlayable()));
    }
    const restartButton = document.querySelector("#restart-button");
    if (restartButton) restartButton.addEventListener("click", () => {
      if (!confirm("進行状況をすべて消して、最初から始めますか？\n※初回クリア記録は消えません。")) return;
      progress = freshProgress(); saveProgress(); location.href = episodePath(1);
    });
  }

  function addBoardingPassIndicator() {
    const existing = document.querySelector(".boarding-pass-indicator");
    if (!hasBoardingPass()) { existing?.remove(); return; }
    if (existing) return;
    const page = Number(document.body.dataset.episode);
    const sceneSelectors = {
      1: ".bedroom", 2: ".airport-view", 3: "#ocean-stage",
      4: "#room-stage", 5: "#sky-stage", 6: "#airport-scene"
    };
    const scene = document.querySelector(sceneSelectors[page] || "main");
    if (!scene) return;
    const indicator = document.createElement("div");
    indicator.className = "boarding-pass-indicator";
    indicator.innerHTML = '<span aria-hidden="true">✈</span><span>搭乗券</span>';
    indicator.setAttribute("aria-label", "搭乗券を所持しています");
    scene.appendChild(indicator);
  }
  function initializeEpisodePage() {
    const page = document.body.dataset.episode;
    if (!page) return;
    const id = Number(page);
    if (!Number.isInteger(id) || id < 1 || id > 6) { location.replace("../index.html"); return; }
    if (!isUnlocked(id)) { location.replace(episodePath(getNextPlayable())); return; }
    markVisited(id);
    if (id === 6) {
      setFlag("ep6Entered", true);
      // 旧バージョンの到達フラグも残し、第1・2・5話の既存演出と互換性を保つ。
      setFlag("ep7Entered", true);
      // 第6話を開くたび、共有時計を朝8時に戻す。
      setFlag("ep1ClockMinutes", 8 * 60);
    }
    const title = EPISODES[id - 1].title;
    const titleElement = document.querySelector("[data-episode-title]");
    if (titleElement) titleElement.textContent = title;
    const label = document.querySelector("[data-episode-number]");
    if (label) label.textContent = `EPISODE ★${id} ⓘ`;
    addBoardingPassIndicator();
    const testClear = document.querySelector("#temporary-clear");
    if (testClear) testClear.addEventListener("click", () => {
      clearEpisode(id); alert(`★${id}をクリアしたことにしました。`); location.href = "../index.html";
    });
  }

  window.GameProgress = {
    getProgress: () => structuredClone(progress), isUnlocked, markVisited, clearEpisode, setFlag, getFlag,
    getNextPlayable, episodePath, hasBoardingPass, getFirstClear, createFirstClear, saveFirstClearNickname,
    refreshBoardingPassIndicator: addBoardingPassIndicator, FIRST_CLEAR_KEY
  };
  // 各話の「EPISODE」ボタンは共通処理でも開く。
  // 個別スクリプトの演出が動かない場合でも、ボタンが反応しない状態を防ぐ。
  document.addEventListener("click", event => {
    const trigger = event.target.closest("#episode-open");
    if (!trigger) return;

    const modal = document.querySelector("#episode-modal");
    if (modal) modal.hidden = false;
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    renderTopPage();
    initializeEpisodePage();
  });
})();
