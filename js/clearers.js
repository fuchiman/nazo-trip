
(() => {
  "use strict";

  const listElement = document.getElementById("clearers-list");
  const countElement = document.getElementById("clearers-count");

  function showMessage(message) {
    listElement.replaceChildren();

    const p = document.createElement("p");
    p.className = "message";
    p.textContent = message;

    listElement.appendChild(p);
  }

  function formatDate(value) {
    if (!value) return "日時不明";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "日時不明";
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createClearerItem(record, index) {
    const item = document.createElement("div");
    item.className = "clearer";

    const rank = document.createElement("span");
    rank.className = "rank" + (index < 3 ? " top" : "");
    rank.textContent = `${index + 1}`;

    const nickname = document.createElement("span");
    nickname.className = "nickname";
    nickname.textContent = record.nickname || "名無し";

    const date = document.createElement("span");
    date.className = "date";
    date.textContent = formatDate(record.firstClearAt);

    item.append(rank, nickname, date);

    return item;
  }

  async function loadClearers() {
    try {
      if (!window.FirebaseAPI) {
        throw new Error("FirebaseAPIが読み込まれていません。");
      }

      const clearers = await window.FirebaseAPI.getClearers();

      if (!Array.isArray(clearers)) {
        throw new Error("取得したデータの形式が正しくありません。");
      }

      if (clearers.length === 0) {
        showMessage("まだクリアした人はいません。");
        countElement.textContent = "クリア者 0人";
        return;
      }

      // 念のためクリア日時の古い順に並べる
      clearers.sort((a, b) => {
        return new Date(a.firstClearAt) - new Date(b.firstClearAt);
      });

      listElement.replaceChildren();

      clearers.forEach((record, index) => {
        listElement.appendChild(
          createClearerItem(record, index)
        );
      });

      countElement.textContent = `クリア者 ${clearers.length}人`;

    } catch (error) {
      console.error("[Clearers] 読み込みエラー:", error);

      showMessage(
        "クリア者一覧を読み込めませんでした。時間をおいて再度アクセスしてください。"
      );

      countElement.textContent = "";
    }
  }

  loadClearers();
})();
