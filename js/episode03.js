(() => {
  "use strict";
  const g = window.GameProgress;
  if (!g) return;
  const $ = id => document.getElementById(id);
  const episodeModal = $("episode-modal");
  const clearModal = $("clear-modal");
  const spotLayer = $("dolphin-spots");
  const splash = $("dolphin-splash");
  const talk = $("dolphin-talk");
  const talkMessage = $("talk-message");
  const retryButton = $("retry-button");
  const cleared = g.getProgress().cleared.includes(3);
  const symbols = "0123456789AB".split("");
  // 真上から見たときに12か所が等間隔になるよう、中心角を30度ずつ配置する。
  // 楕円の横幅・縦幅に合わせてx/yの半径だけを変え、角度は均等に保つ。
  function calculatePositions() {
    const ellipse = $("ocean-ellipse");
    const rect = ellipse.getBoundingClientRect();
    const rx = rect.width * 0.45;
    const ry = rect.height * 0.45;

    return Array.from({ length: 12 }, (_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / 12);
      return {
        x: 50 + (Math.cos(angle) * rx / rect.width) * 100,
        y: 50 + (Math.sin(angle) * ry / rect.height) * 100
      };
    });
  }
  let positions = [];
  let phase = "intro";
  let observed = [];
  let answer = [];
  let selected = [];
  let roundToken = 0;
  let busy = false;

  const activeAnimations = new WeakMap();
  function showModal(modal) {
    modal.hidden = false;
    const panel = modal.querySelector(".object-modal");
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const animations = [
      modal.animate([{opacity:0},{opacity:1}],{duration:240,easing:"ease-out"}),
      panel.animate([{opacity:0,transform:"translateY(12px) scale(.97)"},{opacity:1,transform:"translateY(0) scale(1)"}],{duration:300,easing:"cubic-bezier(.2,.75,.2,1)"})
    ];
    activeAnimations.set(modal,animations);
  }
  async function hideModal(modal) {
    if (modal.hidden) return;
    activeAnimations.get(modal)?.forEach(a => a.cancel());
    const panel = modal.querySelector(".object-modal");
    const animations = [modal.animate([{opacity:1},{opacity:0}],{duration:180}),panel.animate([{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(8px)"}],{duration:180})];
    activeAnimations.set(modal,animations);
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
    modal.hidden = true;
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

  function makeSpots() {
    positions = calculatePositions();
    spotLayer.innerHTML = "";
    symbols.forEach((symbol,index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dolphin-spot";
      button.textContent = "";
      button.setAttribute("aria-label",`${symbol}のエリア`);
      button.style.setProperty("--x",`${positions[index].x}%`);
      button.style.setProperty("--y",`${positions[index].y}%`);
      button.dataset.index = String(index);
      button.addEventListener("click",() => chooseSpot(index));
      spotLayer.appendChild(button);
    });
  }
  function setStatus(step,message) {
    $("status-step").textContent = step;
    $("status-message").textContent = message;
  }
  function updateObservationCount(count) {
    const dots = $("observation-count").children;
    [...dots].forEach((dot,index) => dot.classList.toggle("is-done",index < count));
  }
  function getSpot(index) { return spotLayer.querySelector(`[data-index="${index}"]`); }
  function popAt(index,duration=850) {
    const p = positions[index];
    splash.style.left = `${p.x}%`;
    splash.style.top = `${p.y}%`;
    splash.classList.remove("is-visible", "is-staying");
    // CSSアニメーションを確実に再起動
    void splash.offsetWidth;
    splash.style.animationDuration = `${duration}ms`;
    splash.classList.add("is-visible");
    return wait(duration);
  }
  function makeRound() {
    const combinations = [];
    for(let a=1;a<12;a++) for(let b=a+1;b<12;b++) for(let c=b+1;c<12;c++) {
      const product = a*b*c;
      const digits = toBase12(product).padStart(3,"0").split("");
      if(new Set(digits).size === 3) combinations.push([a,b,c]);
    }
    const chosen = combinations[Math.floor(Math.random()*combinations.length)];
    observed = chosen.map(n => n);
    // 観察時の出現順は積の計算順と無関係にシャッフル
    for(let i=observed.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[observed[i],observed[j]]=[observed[j],observed[i]];}
    const product = chosen.reduce((v,n)=>v*n,1);
    answer = toBase12(product).padStart(3,"0").split("").map(ch=>symbols.indexOf(ch));
    selected = [];
  }
  function toBase12(number) {
    if(number===0) return "0";
    let n=number, out="";
    while(n>0){out=symbols[n%12]+out;n=Math.floor(n/12);}
    return out;
  }
  async function startRound() {
    const token = ++roundToken;
    busy = true;
    phase = "observe";
    makeRound();
    talk.hidden = true;
    retryButton.hidden = true;
    splash.classList.remove("is-visible", "is-staying");
    spotLayer.querySelectorAll("button").forEach(button=>{button.disabled=true;button.classList.remove("is-selected","is-answer");});
    updateObservationCount(0);
    setStatus("OBSERVATION","イルカが3回、順番に現れる。見逃さないように。");
    await wait(650);
    for(let i=0;i<observed.length;i++){
      if(token!==roundToken) return;
      await popAt(observed[i],900);
      updateObservationCount(i+1);
      if(i<2) await wait(520);
      // 3回目も含め、イルカは出現アニメーション後に海へ沈む。
    }
    if(token!==roundToken) return;
    busy=false;
    phase="predict";
    setStatus("PREDICTION","次の3回はどこから出てくる？ 3つ選んでみよう。");
    talk.hidden=false;
    talkMessage.textContent="次の3回はどこから出てくるか、あててみて！";
    spotLayer.querySelectorAll("button").forEach(button=>button.disabled=false);
  }
  function chooseSpot(index) {
    if(phase!=="predict" || busy || selected.includes(index) || selected.length>=3) return;
    selected.push(index);
    getSpot(index).classList.add("is-selected");
    if(selected.length===3) revealAnswer();
  }
  async function revealAnswer() {
    phase="reveal";
    busy=true;
    spotLayer.querySelectorAll("button").forEach(button=>button.disabled=true);
    talk.hidden=true;
    setStatus("ANSWER","イルカが答えを見せてくれる。");
    await wait(500);
    for(let i=0;i<answer.length;i++){
      await popAt(answer[i],920);
      getSpot(answer[i]).classList.add("is-answer");
      // 正解発表の3回目も、イルカはそのまま海へ沈む。
      if(i<2) await wait(480);
    }
    const isCorrect = selected.length===3 && answer.every(index=>selected.includes(index));
    busy=false;
    if(isCorrect){
      phase="clear";
      setStatus("CORRECT","3つとも正解！");
      await wait(450);
      g.clearEpisode(3);
      showModal(clearModal);
    } else {
      phase="retry";
      setStatus("NOT QUITE","答えはこの3か所だった。");
      talk.hidden=false;
      talkMessage.textContent="もう一度チャレンジする？";
      retryButton.textContent="もう一度チャレンジする";
      retryButton.hidden=false;
    }
  }

  $("episode-open").addEventListener("click",()=>showModal(episodeModal));
  $("episode-close").addEventListener("click",async()=>{await hideModal(episodeModal);if(phase==="intro")startRound();});
  $("episode-start").addEventListener("click",async()=>{await hideModal(episodeModal);if(phase==="intro")startRound();});
  episodeModal.addEventListener("click",async event=>{if(event.target===episodeModal){await hideModal(episodeModal);if(phase==="intro")startRound();}});
  retryButton.addEventListener("click",startRound);
  $("clear-next").addEventListener("click",()=>{location.href="../index.html";});

  makeSpots();
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      positions = calculatePositions();
      spotLayer.querySelectorAll(".dolphin-spot").forEach((button, index) => {
        button.style.setProperty("--x", `${positions[index].x}%`);
        button.style.setProperty("--y", `${positions[index].y}%`);
      });
    });
  });
  if(cleared){
    // クリア後も再挑戦・再観察できる。進行状況は維持する。
    setStatus("CLEARED","もう一度、イルカの動きを見てみよう。");
  }
  showModal(episodeModal);
})();
