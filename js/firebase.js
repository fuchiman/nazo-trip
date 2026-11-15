import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ========================================
// Firebase設定
// ========================================

  const firebaseConfig = {
    apiKey: "AIzaSyBY0ZWOA81JbmpqOfEzOdpYUAUzD8zQqw4",
    authDomain: "nazo-trip.firebaseapp.com",
    projectId: "nazo-trip",
    storageBucket: "nazo-trip.firebasestorage.app",
    messagingSenderId: "51762024319",
    appId: "1:51762024319:web:72b1c8e23cdf51d094144a"
  };

// ========================================
// 初期化
// ========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========================================
// 匿名ログイン
// ========================================

let signInPromise = null;

async function ensureSignedIn() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!signInPromise) {
    signInPromise = signInAnonymously(auth)
      .then(result => result.user)
      .catch(error => {
        signInPromise = null;
        throw error;
      });
  }

  return signInPromise;
}

// ========================================
// クリア記録の保存
// ========================================

async function saveClearRecord(nickname, firstClearAt) {
  const name = String(nickname).trim();

  if (!name || name.length > 16) {
    throw new Error("ニックネームは1〜16文字で入力してください。");
  }

  const clearDate = firstClearAt?.toDate
    ? firstClearAt.toDate()
    : new Date(firstClearAt);

  if (Number.isNaN(clearDate.getTime())) {
    throw new Error("クリア日時が正しくありません。");
  }

  const user = await ensureSignedIn();
  const userRef = doc(db, "clearers", user.uid);

  const existing = await getDoc(userRef);

  if (existing.exists()) {
    // 既に記録がある場合はニックネームだけ変更
    await setDoc(userRef, {
      nickname: name
    }, { merge: true });

  } else {
    // 初回登録
    await setDoc(userRef, {
      nickname: name,
      firstClearAt: Timestamp.fromDate(clearDate),
      createdAt: serverTimestamp()
    });
  }

  return user.uid;
}

// ========================================
// クリア者一覧の取得
// ========================================

async function getClearers() {
  const q = query(
    collection(db, "clearers"),
    orderBy("firstClearAt", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(document => {
    const data = document.data();

    return {
      id: document.id,
      nickname: data.nickname,
      firstClearAt: data.firstClearAt?.toDate().toISOString() || null
    };
  });
}

// ========================================
// 公開API
// ========================================

window.FirebaseAPI = {
  ensureSignedIn,
  saveClearRecord,
  getClearers
};

console.log("[Firebase] 初期化完了");