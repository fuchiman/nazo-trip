(()=>{
  const g=window.GameProgress;
  if(!g)return;
  const $=id=>document.getElementById(id);
  const boardingPassDescription = $('boarding-pass-description');
  if (boardingPassDescription && window.StoryText?.episode01) {
    boardingPassDescription.textContent = window.StoryText.episode01.boardingPassDescription;
  }
  const saved=g.getProgress(),flags=saved.flags||{};
  // 24時間制で保持する。文字盤は12時間ごとに一周する。
  let minutes=Number.isFinite(flags.ep1ClockMinutes)?flags.ep1ClockMinutes:420;
  // 前日の18:00（-360分）から当日の24:00（1440分）まで操作可能。
  minutes=Math.max(-360,Math.min(1440,minutes));
  let introSeen=!!flags.ep1IntroSeen;
  let successShown=!!flags.ep1SuccessShown;
  let cleared=saved.cleared.includes(1);
  let bedStage=Number(flags.ep1BedStage||0);
  // 時計の確認回数は、このページを開いている間だけ数える。
  // ページを閉じる／再読み込みすると0回に戻る。
  let clockOpenCount=0;
  let clockControlsUnlocked=false;
  const clockModal=$('clock-modal'),successModal=$('success-modal'),clearModal=$('clear-modal'),bedModal=$('bed-modal'),boardingModal=$('boarding-pass-modal');
  const NS='http://www.w3.org/2000/svg';
  // 初期状態では必ず矢印を隠す。3回目の拡大時だけopenClock内で表示する。
  $('clock-arrows').hidden=true;
  $('clock-arrows').style.display='none';

  function buildFace(svg){
    if(svg.dataset.built==='1')return;
    const ticks=svg.querySelector('.ticks'),nums=svg.querySelector('.numbers');
    for(let i=0;i<60;i++){
      const a=i*Math.PI/30-Math.PI/2,r=i%5===0?82:89;
      const line=document.createElementNS(NS,'line');
      line.setAttribute('x1',120+Math.cos(a)*r);line.setAttribute('y1',120+Math.sin(a)*r);
      line.setAttribute('x2',120+Math.cos(a)*96);line.setAttribute('y2',120+Math.sin(a)*96);
      line.setAttribute('class','clock-tick'+(i%5===0?' major':''));ticks.append(line);
    }
    ['0','1','2','3','4','5','6','7','8','9','A','B'].forEach((v,i)=>{
      const a=i*Math.PI/6-Math.PI/2,t=document.createElementNS(NS,'text');
      t.setAttribute('x',120+Math.cos(a)*68);t.setAttribute('y',120+Math.sin(a)*68);
      t.setAttribute('class','clock-numeral'+(i>=10?' small':''));t.textContent=v;nums.append(t);
    });
    svg.dataset.built='1';
  }

  // 角度は360度を超えても連続値として保持する。
  // JSの % は負数で負の余りを返すため、通常の剰余に正規化してから
  // 最短回転を計算する（A→0など、文字盤の境界での逆回転を防ぐ）。
  function positiveMod(value,mod){return ((value%mod)+mod)%mod;}
  function shortestDelta(from,to){
    return positiveMod(to-from+180,360)-180;
  }
  function setHand(svg,kind,target){
    const key=kind+'Angle',hand=svg.querySelector('.'+kind+'-hand');
    const normalizedTarget=positiveMod(target,360);
    if(svg.dataset[key]===undefined){
      hand.getAnimations().forEach(a=>a.cancel());
      hand.style.transition='none';
      hand.style.transform=`rotate(${normalizedTarget}deg)`;
      svg.dataset[key]=String(normalizedTarget);
      return;
    }

    // 進行中アニメーションの表示角度を読み、360度をまたぐ連続角度に戻す。
    const previous=Number(svg.dataset[key]);
    let visual=previous;
    const computed=getComputedStyle(hand).transform;
    if(computed&&computed!=='none'){
      const matrix=new DOMMatrixReadOnly(computed);
      const normalizedVisual=positiveMod(Math.atan2(matrix.b,matrix.a)*180/Math.PI,360);
      visual=normalizedVisual+360*Math.round((previous-normalizedVisual)/360);
    }
    const next=visual+shortestDelta(positiveMod(visual,360),normalizedTarget);
    hand.getAnimations().forEach(a=>a.cancel());
    hand.style.transition='none';
    hand.style.transform=`rotate(${visual}deg)`;
    const animation=hand.animate(
      [{transform:`rotate(${visual}deg)`},{transform:`rotate(${next}deg)`}],
      {duration:850,easing:'cubic-bezier(.2,.7,.15,1)',fill:'forwards'}
    );
    svg.dataset[key]=String(next);
    animation.onfinish=()=>{
      hand.style.transform=`rotate(${next}deg)`;
      animation.cancel();
    };
  }
  function updateFace(svg){
    buildFace(svg);
    const withinTwelve=((minutes%720)+720)%720;
    setHand(svg,'minute',(((minutes%60)+60)%60)*6);
    setHand(svg,'hour',withinTwelve*.5);
  }

  function sceneForTime(){
    // 日の出 6:33、日の入り 16:56。夕方には日没後の薄暮も含める。
    const dayMinutes=((minutes%1440)+1440)%1440;
    if(dayMinutes>=393&&dayMinutes<660)return 'morning'; // 6:33–10:59
    if(dayMinutes>=660&&dayMinutes<960)return 'day';     // 11:00–15:59
    if(dayMinutes>=960&&dayMinutes<1110)return 'evening';// 16:00–18:29
    return 'night';                                     // 18:30–翌6:32
  }
  function update(){
    document.querySelectorAll('.clock-face').forEach(updateFace);
    const dayMinutes=((minutes%1440)+1440)%1440;
    const hour=Math.floor(dayMinutes/60),minute=dayMinutes%60;
    $('status-time').textContent=`${hour}:${String(minute).padStart(2,'0')}`;
    const scene=$('window-scene');
    scene.classList.remove('scene-morning','scene-day','scene-evening','scene-night','before-dawn');
    scene.classList.add('scene-'+sceneForTime());
  }
  const modalAnimations=new WeakMap();
  function showModal(modal){
    modal.hidden=false;
    const panel=modal.querySelector('.object-modal');
    modalAnimations.get(modal)?.forEach(a=>a.cancel());
    const animations=[modal.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out'}),
      panel.animate([{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:320,easing:'cubic-bezier(.2,.75,.2,1)'})];
    modalAnimations.set(modal,animations);
  }
  async function hideModal(modal){
    if(modal.hidden)return;
    modalAnimations.get(modal)?.forEach(a=>a.cancel());
    const panel=modal.querySelector('.object-modal');
    const animations=[modal.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-in'}),
      panel.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(8px) scale(.98)'}],{duration:220,easing:'ease-in'})];
    modalAnimations.set(modal,animations);
    await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
    modal.hidden=true;
  }
  function openIntro(){showModal($('episode-modal'));}
  async function closeIntro(){
    await hideModal($('episode-modal'));introSeen=true;g.setFlag('ep1IntroSeen',true);
  }
  function openClock(){
    clockOpenCount++;
    clockControlsUnlocked=clockOpenCount>=3;
    const arrows=$('clock-arrows');
    arrows.hidden=!clockControlsUnlocked;
    arrows.style.display=clockControlsUnlocked?'flex':'none';
    showModal(clockModal);update();
  }
  async function closeClock(){
    await hideModal(clockModal);
    if(!cleared&&minutes>0&&minutes<=330&&!successShown){
      successShown=true;g.setFlag('ep1SuccessShown',true);
      $('status-message').textContent='窓の外の様子が変わった……';
      // 景色が変化したことを認識できる間を置いてからメッセージを出す。
      await new Promise(resolve=>setTimeout(resolve,1100));
      showModal(successModal);
    }
  }
  function shift(delta){
    const next=Math.max(-360,Math.min(1440,minutes+delta));
    if(next===minutes)return;
    minutes=next;g.setFlag('ep1ClockMinutes',minutes);
    g.setFlag('ep1ClockRewound',minutes<420);
    update();
  }
  async function finish(){
    await hideModal(successModal);g.clearEpisode(1);
    g.setFlag('ep1ReachedBeforeSunrise',true);g.setFlag('ep1ClearedBeforeSunrise',true);
    cleared=true;showModal(clearModal);
  }
  function bedTap(){
    if(!g.getFlag('ep7Entered'))return;
    bedStage=Math.min(3,bedStage+1);g.setFlag('ep1BedStage',bedStage);
    const blankets=document.querySelectorAll('.bed-object .blanket');
    blankets.forEach((el,i)=>{
      if(bedStage===1)el.style.transform=`rotate(${[2,-3,5][i]}deg)`;
      if(bedStage===2){el.style.transform='rotate(0deg)';el.style.left=`${[5,8,42][i]}%`;}
    });
    if(bedStage===3){
      showModal(bedModal);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        $('topdown-bed').classList.add('show-letter');
        $('topdown-blanket').classList.add('stage-two');
      }));
      g.setFlag('ep1BedLetterFound',true);
    }
  }


  const goldBox = $('gold-box');
  function hasFoundAllHiddenClues() {
    return !!g.getFlag('ep6LetterRead')
      && !!g.getFlag('ep1BedLetterFound')
      && !!g.getFlag('ep2PlaneLetterSeen')
      && !!g.getFlag('ep4ShisaRemoved')
      && !!g.getFlag('ep5KoObserved');
  }
  function updateGoldBox() {
    if (!goldBox) return;
    const found = g.hasBoardingPass();
    goldBox.classList.toggle('is-opened', found);
    goldBox.setAttribute('aria-label', found ? '開いた黄色い箱' : '机の上の黄色い箱');
  }
  function findBoardingPass() {
    // 4つの隠し要素をすべて実際に確認するまでは、押しても反応しない。
    if (g.hasBoardingPass() || !hasFoundAllHiddenClues()) return;
    g.setFlag('boardingPassFound', true);
    updateGoldBox();
    g.refreshBoardingPassIndicator();
    showModal(boardingModal);
  }

  $('episode-open').addEventListener('click',openIntro);
  $('episode-close').addEventListener('click',closeIntro);
  $('episode-start').addEventListener('click',closeIntro);
  $('clock-object').addEventListener('click',openClock);
  $('clock-close').addEventListener('click',closeClock);
  clockModal.addEventListener('click',e=>{if(e.target===clockModal)closeClock();});
  $('time-back').addEventListener('click',()=>shift(-10));
  $('time-forward').addEventListener('click',()=>shift(10));
  $('success-close').addEventListener('click',finish);
  $('clear-next').addEventListener('click',()=>location.href='../index.html');
  $('bed-object').addEventListener('click',bedTap);
  goldBox?.addEventListener('click',findBoardingPass);
  $('boarding-pass-close')?.addEventListener('click',()=>hideModal(boardingModal));
  $('boarding-pass-close-button')?.addEventListener('click',()=>hideModal(boardingModal));
  boardingModal?.addEventListener('click',e=>{if(e.target===boardingModal)hideModal(boardingModal);});
  $('bed-close').addEventListener('click',()=>hideModal(bedModal));
  bedModal.addEventListener('click',e=>{if(e.target===bedModal)hideModal(bedModal);});

  update();
  updateGoldBox();
  if(!introSeen)openIntro();
  if(g.getFlag('ep7Entered')&&bedStage>0){
    document.querySelectorAll('.bed-object .blanket').forEach((el,i)=>{
      el.style.transform='rotate(0deg)';if(bedStage>=2)el.style.left=`${[5,8,42][i]}%`;
    });
    if(bedStage>=3){$('topdown-bed').classList.add('show-letter');$('topdown-blanket').classList.add('stage-two');}
  }
})();
