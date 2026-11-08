function createDuitPhone(h){
  let seq=0,phase='idle',local=null,pc=null,mic=null,dc=null,stopCapture=null,aiBusy=false,utter=0,muted=false,audio=null;
  let peer=null,lastEnd='',ringAt=0,keypair=null,publicKey='',aes=null,peerKey='',relayAudio=null,playAt=0,chunks=[],packetSeq=0,lastPacket=0,buffer=[],bufferLen=0,relayStarted=false,feed=Promise.resolve(),speakerStop=null;
  const live=()=>!['idle','incoming'].includes(phase);
  const set=(next,text)=>{phase=next;h.render({phase,text,muted,ai:h.kind()==='ai'});};
  function newID(){return crypto.randomUUID()}
  async function prepareKey(){if(keypair)return;keypair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);publicKey=DuitMedia.b64(new Uint8Array(await crypto.subtle.exportKey('raw',keypair.publicKey)))}
  async function relayKey(pub){if(aes&&peerKey===pub)return aes;if(!pub)throw Error('等待对方的加密通话连接');await prepareKey();const pk=await crypto.subtle.importKey('raw',DuitMedia.bytes(pub),{name:'ECDH',namedCurve:'P-256'},false,[]);aes=await crypto.subtle.deriveKey({name:'ECDH',public:pk},keypair.privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);peerKey=pub;return aes}
  const aad=(index,side)=>new TextEncoder().encode([h.roomId(),local?.id,side,index].join('|'));
  function encodeMu(x){const s=x<0?128:0;let v=Math.min(32635,Math.round(Math.abs(x)*32767))+132,p=7;for(let mask=16384;!(v&mask)&&p>0;p--,mask>>=1){}return ~(s|(p<<4)|((v>>(p+3))&15))&255}
  function decodeMu(x){x=(~x)&255;let v=(((x&15)<<3)+132)<<((x>>4)&7);return ((x&128)?132-v:v-132)/32768}
  async function sendPacket(samples,epoch){if(seq!==epoch||!local||!aes||muted)return;const n=++packetSeq,iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(n,h.role())},aes,Uint8Array.from(samples,encodeMu));if(seq!==epoch)return;
    chunks.push({n,iv:DuitMedia.b64(iv),c:DuitMedia.b64(new Uint8Array(ciphertext))});chunks=chunks.sort((a,b)=>a.n-b.n).slice(-2);h.wake()}
  async function beginRelay(epoch){
    if(relayStarted||epoch!==seq||!mic||!peer?.pub)return;relayStarted=true;
    try{await relayKey(peer.pub);if(epoch!==seq)return;local.relay=true;h.remoteAudio.muted=true;relayAudio=new AudioContext();await relayAudio.resume();
      const stop=await DuitMedia.capture(mic,(frame,rate)=>{if(seq!==epoch||muted)return;const arr=DuitMedia.resample(frame,rate,8000);buffer.push(arr);bufferLen+=arr.length;
        if(bufferLen>=6000){const samples=DuitMedia.merge(buffer);buffer=[];bufferLen=0;sendPacket(samples,epoch).catch(e=>h.note(e.message))}});
      if(epoch!==seq){stop();return}stopCapture=stop;set('relay','真人通话中 · 加密语音中继');h.wake()
    }catch(e){if(epoch===seq){relayStarted=false;h.note('语音中继未建立：'+e.message)}}
  }
  function receivePackets(list){const epoch=seq;for(const p of list||[]){if(p.n<=lastPacket)continue;lastPacket=p.n;
    feed=feed.then(async()=>{if(epoch!==seq||!relayAudio||!aes)return;const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:DuitMedia.bytes(p.iv),additionalData:aad(p.n,h.role()==='owner'?'guest':'owner')},aes,DuitMedia.bytes(p.c));
      if(epoch!==seq||!relayAudio)return;const ar=Float32Array.from(new Uint8Array(decoded),decodeMu),ab=relayAudio.createBuffer(1,ar.length,8000);ab.copyToChannel(ar,0);const src=relayAudio.createBufferSource();src.buffer=ab;src.connect(relayAudio.destination);
      if(playAt<relayAudio.currentTime||playAt-relayAudio.currentTime>2.2)playAt=relayAudio.currentTime+.08;src.start(playAt);playAt+=ab.duration;h.speaking(true);clearTimeout(speakerStop);speakerStop=setTimeout(()=>h.speaking(false),800)}).catch(()=>{})}}
  function stopAudio(){if(audio){audio.pause();audio.src='';audio=null}h.speaking(false)}
  async function end(notify=true,text='通话已结束'){
    const id=local?.id||peer?.call?.id;seq++;utter++;aiBusy=false;stopAudio();stopCapture?.();stopCapture=null;pc?.close();pc=null;dc=null;
    mic?.getTracks().forEach(t=>t.stop());mic=null;h.remoteAudio.srcObject=null;h.remoteAudio.muted=false;
    if(relayAudio){relayAudio.close().catch(()=>{});relayAudio=null}relayStarted=false;chunks=[];lastPacket=packetSeq=playAt=bufferLen=0;buffer=[];aes=null;peerKey='';clearTimeout(speakerStop);muted=false;
    if(id){lastEnd=id;local=notify?{id,stage:'end'}:null}else local=null;set('idle',text);if(notify)h.wake()
  }
  function wire(){const ready=local&&(local.stage==='end'||local.sdp||local.relay);return {pub:publicKey,call:ready?{...local,packets:local.relay?chunks:[]}:null}}
  async function play(encoded,version,turn){const url=URL.createObjectURL(new Blob([DuitMedia.bytes(encoded)],{type:'audio/mpeg'}));try{if(version!==seq||turn!==utter)return;audio=new Audio(url);h.speaking(true);set('ai','AI 正在用角色音色说话');await new Promise((ok,no)=>{audio.onended=ok;audio.onpause=ok;audio.onerror=()=>no(Error('音频无法播放'));audio.play().catch(no)})}finally{URL.revokeObjectURL(url);if(turn===utter)stopAudio()}}
  async function aiTurn(input,epoch){if(aiBusy||muted||seq!==epoch)return;const turn=++utter;aiBusy=true;
    try{set('ai','正在识别你说的话…');const a=await h.api('asr',{audio:input});if(!a.text||seq!==epoch||turn!==utter)return;
      set('ai','AI 正在回应…');const out=await h.reply(a.text,()=>seq===epoch&&turn===utter);if(!out||seq!==epoch||turn!==utter)return;
      const voice=await h.voice(out);if(seq===epoch&&turn===utter)await play(voice.audio,epoch,turn)
    }catch(e){if(epoch===seq&&turn===utter)h.note(e.message)}finally{if(epoch===seq&&turn===utter){aiBusy=false;set('ai',muted?'麦克风已静音':'AI 通话中 · 正在听')}}}
  async function startAI(){h.checkVoice();const epoch=++seq;set('starting','正在打开麦克风…');try{const stream=await DuitMedia.microphone();if(seq!==epoch){stream.getTracks().forEach(t=>t.stop());return}mic=stream;
    const stop=await DuitMedia.capture(mic,DuitMedia.vad(a=>aiTurn(a,epoch),()=>seq===epoch&&!aiBusy&&!muted));if(seq!==epoch){stop();return}stopCapture=stop;set('ai','AI 通话中 · 正在听，说完稍停即发送。')
    }catch(e){if(seq===epoch)await end(false,'无法开始语音：'+e.message)}}
  function setupRTC(epoch){
    if(!window.RTCPeerConnection)return null;const c=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]});pc=c;mic.getTracks().forEach(t=>c.addTrack(t,mic));
    c.ontrack=e=>{if(seq!==epoch)return;h.remoteAudio.srcObject=e.streams[0]||new MediaStream([e.track]);h.remoteAudio.play().catch(()=>h.note('点击房间继续播放对方的声音。'))};
    c.ondatachannel=e=>{dc=e.channel;bindChannel(dc)};c.onconnectionstatechange=()=>{if(seq!==epoch||local?.relay)return;if(c.connectionState==='connected'){set('connected','真人通话中 · 直接语音连接')}else if(c.connectionState==='failed'&&local&&peer?.call?.id===local.id){beginRelay(epoch)}};
    return c
  }
  function bindChannel(channel){channel.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='pose')h.peerPose(m.pose)}catch{}}}
  async function gather(c,desc){await c.setLocalDescription(desc);if(c.iceGatheringState!=='complete')await new Promise(ok=>{const done=()=>{if(c.iceGatheringState==='complete'){clearTimeout(t);c.removeEventListener('icegatheringstatechange',done);ok()}};const t=setTimeout(()=>{c.removeEventListener('icegatheringstatechange',done);ok()},2500);c.addEventListener('icegatheringstatechange',done)});return c.localDescription.sdp}
  async function human(accept){
    if(!peer||accept&&!peer.call?.id)throw Error('对方尚未在房间中。');
    const epoch=++seq,id=accept?peer.call.id:newID();local={id,stage:accept?'answer':'offer',sdp:'',relay:false};set('starting',accept?'正在接听…':'正在打开麦克风…');
    try{const s=await DuitMedia.microphone();if(seq!==epoch){s.getTracks().forEach(t=>t.stop());return}mic=s;await prepareKey();if(seq!==epoch)return;
      const c=setupRTC(epoch);
      try{if(c&&(!accept||peer.call.sdp)){if(accept)await c.setRemoteDescription({type:'offer',sdp:peer.call.sdp});else{dc=c.createDataChannel('room');bindChannel(dc)}
        const sdp=await gather(c,accept?await c.createAnswer():await c.createOffer());if(seq!==epoch)return;local.sdp=sdp}else local.relay=true}catch{if(seq!==epoch)return;local.relay=true}
      if(c?.connectionState==='connected')set('connected','真人通话中 · 直接语音连接');else set(accept?'connecting':'outgoing',accept?'正在连接对方…':'正在呼叫，等待对方接听…');ringAt=Date.now();h.wake();
      if(accept&&(peer.call.relay||local.relay))await beginRelay(epoch)
    }catch(e){if(seq===epoch)await end(true,'无法开启通话：'+e.message)}}
  async function observe(next){
    peer=next;const c=next?.call;if(!next){if(live()||phase==='incoming')await end(false,'对方已离开房间。');return}
    if(c?.stage==='end'&&((c.id===local?.id)||(phase==='incoming'&&c.id!==lastEnd))){await end(false,'对方已结束通话。');return}
    if(c?.stage==='offer'&&c.id!==lastEnd&&(!local||local.stage==='end'||(phase==='outgoing'&&h.role()==='guest'&&local.id!==c.id))){
      if(phase==='outgoing')await end(false,'');local={id:c.id,stage:''};ringAt=Date.now();set('incoming','对方呼叫你 · 可接听或拒绝');return}
    if((phase==='outgoing'||phase==='connecting')&&local&&c?.id===local.id&&c.stage==='answer'&&local.stage==='offer'){
      if(pc&&!pc.remoteDescription&&c.sdp){try{await pc.setRemoteDescription({type:'answer',sdp:c.sdp})}catch{local.relay=true}}
      if(phase==='outgoing'){ringAt=Date.now();set('connecting','正在建立双人语音连接…')}
    }
    if(local&&c?.id===local.id&&mic&&['connecting','connected','relay'].includes(phase)){
      if(c.relay||local.relay||(phase==='connecting'&&Date.now()-ringAt>10000))await beginRelay(seq);
      if(relayStarted&&aes)receivePackets(c.packets)}
    if(['incoming','outgoing'].includes(phase)&&Date.now()-ringAt>50000)await end(true,'本次呼叫无人接听。');
    if(phase==='incoming'&&(!c||c.id!==local?.id))await end(false,'对方已取消呼叫。')
  }
  return {prepareKey,wire,observe,active:()=>phase!=='idle',phase:()=>phase,end,pose(p){if(dc?.readyState==='open')dc.send(JSON.stringify({type:'pose',pose:p}))},
    start:()=>phase==='idle'?(h.kind()==='ai'?startAI():human(false)):undefined,accept:()=>phase==='incoming'?human(true):undefined,
    mute(){muted=!muted;mic?.getAudioTracks().forEach(t=>t.enabled=!muted);set(phase,muted?'麦克风已静音':'麦克风已开启')},
    interrupt(){utter++;aiBusy=false;stopAudio();set('ai','已打断 · 正在听')}}
}
