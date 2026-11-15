
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ========================================
// Firebase設定
// Firebase Consoleのアプリ設定からコピーする
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
// クリア記録を保存
// ========================================

async function saveClearRecord(nickname) {
  const name = String(nickname).trim();

  if (!name || name.length > 16) {
    throw new Error("ニックネームは1〜16文字で入力してください。");
  }

  const user = await ensureSignedIn();
  const userRef = doc(db, "clearers", user.uid);

  // 既存記録があるか確認
  const existing = await getDoc(userRef);

  const data = {
    nickname: name,
    clearedAt: serverTimestamp()
  };

  if (!existing.exists()) {
    data.createdAt = serverTimestamp();
  }

  // UIDをドキュメントIDにする
  await setDoc(userRef, data, { merge: true });

  return user.uid;
}

// ========================================
// クリア者一覧を取得
// ========================================

async function getClearers() {
  const q = query(
    collection(db, "clearers"),
    orderBy("clearedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  }));
}

// ========================================
// 他のJavaScriptから使えるようにする
// ========================================

window.FirebaseAPI = {
  ensureSignedIn,
  saveClearRecord,
  getClearers
};

console.log("[Firebase] 初期化完了");
