(()=>{
  'use strict';
  const get=id=>document.getElementById(id);
  const video=get('avVideo'),audio=new Audio(),players={tv:video,radio:audio};
  video.playsInline=true;
  const sources={tv:null,radio:null};
  let kind='tv',role='',remote=null,following=false,calling=false,level=.60,wake=()=>{},generation=0;
  let hint='',blocked=false,lastPeerAt=0;
  const time=t=>{t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
  const title=k=>k==='tv'?'影片':'音乐';
  const enabled=()=>get('avShare').checked;
  const isGuest=()=>role==='guest'&&enabled();
  function refresh(){
    const p=players[kind],src=sources[kind],controlled=isGuest()&&!!remote;
    get('avTV').setAttribute('aria-pressed',String(kind==='tv'));get('avRadio').setAttribute('aria-pressed',String(kind==='radio'));
    get('avAir').textContent=!src?'待机':p.paused?'已暂停':'播放中';
    get('avTitle').textContent=src?.name||'未选择'+title(kind);get('avChoose').textContent='选'+title(kind);
    get('avPlay').disabled=!src||(controlled&&following&&!blocked);get('avPlay').textContent=controlled&&src&&(!following||blocked)?'开始跟播':p.paused?'播放':'暂停';
    get('avSeek').disabled=!src||!Number.isFinite(p.duration)||controlled;
    get('avSeek').max=Number.isFinite(p.duration)?p.duration:1;get('avSeek').value=p.currentTime||0;get('avTime').textContent=time(p.currentTime);
    get('avExpand').hidden=kind!=='tv';get('avExpand').disabled=!src;
    const handoff=role==='owner'&&enabled()?'好友选择同一份文件后，会跟随你的进度。':'';
    let sync='';
    if(isGuest())sync=!remote?'等待房主共享影音。':sources[remote.kind]?.key!==remote.key?'房主选择了《'+remote.name+'》，请选择同一份文件。':!following||blocked?'文件已匹配，点击「开始跟播」。':'正在跟随房主。';
    get('avHint').textContent=[hint||sync||handoff,calling?'通话中，已降低影音音量。':''].filter(Boolean).join(' ');
  }
  function volume(){for(const p of Object.values(players))p.volume=level*(calling ? .32 : 1)}
  function select(k){
    if(!(k in players))return;
    if(k!==kind){players[kind].pause();kind=k;get('avTheater').hidden=true;hint='';blocked=false;following=false;wake()}
    get('avFile').accept=k==='tv'?'video/*,.m4v,.webm,.mp4':'audio/*,.mp3,.wav,.m4a,.ogg';
    if(typeof world!=='undefined')world?.showVideo(kind==='tv'&&video.readyState>=2?video:null);refresh()
  }
  // Sample the file at three offsets so matching does not load whole films into memory.
  async function identify(file){
    const bytes=65536,points=[0,Math.max(0,Math.floor((file.size-bytes)/2)),Math.max(0,file.size-bytes)];
    const chunks=await Promise.all(points.map(i=>file.slice(i,i+bytes).arrayBuffer()));
    const buffer=await new Blob([String(file.size),...chunks]).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('')
  }
  function clear(k){const p=players[k];p.pause();if(k==='tv'&&typeof world!=='undefined')world?.showVideo(null);
    p.removeAttribute('src');p.load();if(sources[k])URL.revokeObjectURL(sources[k].url);sources[k]=null}
  get('avFile').onchange=async e=>{
    const file=e.target.files[0],k=kind,turn=++generation;e.target.value='';if(!file)return;
    try{const key=await identify(file);if(turn!==generation||k!==kind)return;
      clear(k);const src={key,name:file.name.slice(0,140),url:URL.createObjectURL(file)};sources[k]=src;players[k].src=src.url;players[k].load();
      following=false;blocked=false;hint='';refresh();wake()
    }catch{hint='无法读取文件，请重新选择。';refresh()}
  };
  get('avChoose').onclick=()=>window.duitChooseMedia?.(()=>get('avFile').click());
  get('avTV').onclick=()=>select('tv');get('avRadio').onclick=()=>select('radio');
  window.addEventListener('duit-station',e=>{select(e.detail);get('avCard').scrollIntoView({block:'nearest',behavior:'smooth'});get('avChoose').focus({preventScroll:true})});
  function target(){return remote.pos+(remote.playing?Math.min(24,(performance.now()-lastPeerAt)/1000):0)}
  function align(){
    if(!isGuest()||!following||!remote||blocked||sources[kind]?.key!==remote.key||kind!==remote.kind)return;
    const p=players[kind];if(!p.readyState)return;
    const pos=Number.isFinite(p.duration)?Math.min(p.duration,target()):target();if(Math.abs(p.currentTime-pos)>(remote.playing?1.15:.20)){try{p.currentTime=pos}catch{}}
    if(remote.playing&&p.paused&&!p.ended){p.play().catch(()=>{blocked=true;refresh()})}else if(!remote.playing&&!p.paused)p.pause()
  }
  get('avPlay').onclick=async()=>{
    const p=players[kind];if(!sources[kind])return;
    try{
      hint='';if(isGuest()&&remote){if(sources[kind].key!==remote.key||kind!==remote.kind){hint='请先选择房主使用的同一份文件。';refresh();return}
        following=true;blocked=false;if(remote.playing)await p.play();align()
      }else if(p.paused)await p.play();else p.pause()
    }catch{hint='暂时无法播放，请检查文件格式后重试。';blocked=true}refresh()
  };
  get('avSeek').oninput=e=>{const p=players[kind];if(Number.isFinite(p.duration)&&!(isGuest()&&remote))p.currentTime=Number(e.target.value)};
  get('avVolume').oninput=e=>{level=Number(e.target.value)/100;volume()};
  get('avExpand').onclick=()=>{get('avTheater').hidden=false;get('avSmall').focus();get('stage').scrollIntoView({block:'nearest'})};
  get('avSmall').onclick=()=>{get('avTheater').hidden=true;get('avExpand').focus({preventScroll:true})};
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!get('avTheater').hidden)get('avSmall').click()});
  for(const [k,p] of Object.entries(players)){
    p.preload='auto';
    for(const event of ['loadedmetadata','loadeddata','timeupdate','play','pause','seeked','ended','error']){
      p.addEventListener(event,()=>{if(k!==kind||!sources[k])return;
        if(event==='error')hint='这个浏览器无法播放该文件，请改选兼容的'+title(kind)+'。';
        if(event==='loadeddata'&&k==='tv'&&typeof world!=='undefined')world?.showVideo(video);
        if(event==='loadedmetadata')align();
        if(['play','pause','seeked','ended'].includes(event)&&role==='owner'&&enabled())wake();refresh()
      })
    }
  }
  get('avShare').onchange=()=>{following=false;blocked=false;hint='';if(isGuest()&&remote){select(remote.kind);players[kind].pause()}refresh();wake()};
  window.DuitStations={
    enter(mode,notify){generation++;for(const k of Object.keys(players))clear(k);kind='tv';role=mode;wake=notify||(()=>{});remote=null;following=false;blocked=false;hint='';get('avTheater').hidden=true;
      get('avShare').checked=false;get('avShareRow').hidden=!mode;get('avShareLabel').textContent=mode==='guest'?'跟随房主播放':mode==='ai'?'告诉 AI 片名、曲名和进度':'与好友同步播放';select('tv')},
    calling(v){calling=!!v;volume();refresh()},
    wire(){const src=sources[kind],p=players[kind];if(role!=='owner'||!enabled()||!src||p.error)return null;
      return {kind,key:src.key,name:src.name,pos:p.currentTime||0,playing:!p.paused&&!p.ended&&p.readyState>=2}},
    peer(next,age=0){const old=remote;remote=next||null;lastPeerAt=performance.now()-1000*Math.max(0,Math.min(23,age));if(!isGuest())return;
      if(!remote){if(old&&following)players[kind].pause();following=false;refresh();return}
      if(!old||old.key!==remote.key||old.kind!==remote.kind||remote.kind!==kind){players[kind].pause();select(remote.kind);following=false;hint=''}
      align();refresh()},
    context(){const p=players[kind];return role==='ai'&&enabled()&&sources[kind]?{kind,name:sources[kind].name,pos:Math.round(p.currentTime),playing:!p.paused}:null}
  };
  volume();refresh()
})();
