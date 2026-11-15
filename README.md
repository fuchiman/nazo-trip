修学旅行の謎解きゲーム

■ 起動方法
1. ZIPを展開する
2. index.htmlをブラウザで開く（VS CodeのLive Server推奨）
3. ★1から順番にエピソードを進める

■ エピソード構成
★1 朝を取り戻せ
★2 飛行機を出発させる
★3 ドルフィンにさわろう
★4 秘密の扉を開けろ
★5 流れ星を見逃した
★6 最後の忘れ物

■ セーブデータ
進行状況・仕掛けの状態は localStorage の schoolTripMystery_progress_v1 に保存されます。
初回クリア記録（ニックネーム・初回クリア日時）は schoolTripMystery_firstClear_v1 に独立して保存され、ゲーム内の「最初から」操作では消去されません。
同じブラウザ・同じ公開URLでプレイを続けてください。

■ 公開方法
静的サイトなのでGitHub Pagesで公開できます。リポジトリのルートに一式を配置し、Settings > Pagesから公開設定してください。


## 文章・デザインの編集場所

- 第1話の搭乗券発見時の説明、第6話の導入文・手紙・クリア画面の文章：`js/story-text.js`
- 全6話共通の見た目：`css/theme.css`
- 各話固有の見た目：`css/episodeXX.css`
- 各話固有の動き・仕掛け：`js/episodeXX.js`

文章だけを変更する場合は、まず `js/story-text.js` を編集してください。
