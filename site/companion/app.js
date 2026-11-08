(()=>{
  'use strict';
  const $=id=>document.getElementById(id),FLOW='fz_af_38078988_1bf8_7871_71d2_b99e44e31431';
  const apiURL='https://zion-app.functorz.com/zero/X57jbwZOjLw/api/graphql-v2';
  const live=$('cpLive');document.querySelector('.side').prepend(live);
  let user=null,room=null,peer=null,persona=null,voiceRef=null,modelBlob=null,history=[],pendingAuth=null,editScope=null;
  let editorVoice=null,editorModel=null,editorShot=null,editorApproved=false,busyChat=false,changing=false,epoch=0,wakeTimer=0,busyPoll=false,again=false,peerVisible=false,peerSession='',micAccepted=false;
  const session=crypto.randomUUID(),joinHash=new URLSearchParams(location.hash.slice(1)),pendingJoin={id:joinHash.get('house'),key:joinHash.get('invite')};
  try{user=JSON.parse(sessionStorage.getItem('duit.house.auth'))}catch{}
  const fresh=()=>crypto.randomUUID(),belongs=(v,e)=>room?.id===v&&epoch===e;
  const notice=(s,bad=false)=>{const n=$('cpNotice');n.textContent=s;n.dataset.bad=String(bad)};
  const status=(id,s,bad=false)=>{$(id).textContent=s;$(id).dataset.bad=String(bad)};
  const sayError=e=>e?.name==='NotAllowedError'?'麦克风权限未开启，请在浏览器地址栏允许后重试。':String(e?.message||e).slice(0,260);
  const guard=fn=>async e=>{try{await fn(e)}catch(err){const d=document.querySelector('dialog[open]');if(d?.id==='cpEditor')status('cpEditState',sayError(err),true);else if(d?.id==='cpLibrary')status('cpLibraryState',sayError(err),true);else if(!live.hidden)notice(sayError(err),true);else status('cpBannerState',sayError(err),true)}};
  function busy(btn,fn){return guard(async e=>{if(btn.disabled)return;btn.disabled=true;try{await fn(e)}finally{btn.disabled=false}})}
  const modal=(id)=>{if(!$(id).open)$(id).showModal()};
  for(const b of document.querySelectorAll('[data-cp-close]'))b.onclick=()=>b.closest('dialog').close();
  async function gqlReq(query,variables,auth=true,keepalive=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
    try{const r=await fetch(apiURL,{method:'POST',credentials:'omit',keepalive,headers:{'Content-Type':'application/json',...(auth&&user?{Authorization:'Bearer '+user.token}:{})},body:JSON.stringify({query,variables}),signal:controller.signal});if(!r.ok)throw Error('小屋服务暂时没有响应（'+r.status+'）');const j=await r.json();if(j.errors?.length)throw Error(j.errors[0].message||'操作失败');return j.data}
    finally{clearTimeout(timer)}}
  async function call(op,args={},id=room?.id,keepalive=false){if(!user)throw Error('请先登录小屋账号。');const j=await gqlReq('mutation($q:String!){'+FLOW+'(question:$q)}',{q:JSON.stringify({...args,op,id})},true,keepalive);return JSON.parse(j[FLOW])}
  function loginThen(fn){if(user)return fn();pendingAuth=fn;$('cpAuthState').textContent='';modal('cpAuth')}
  const club=setupClub({call,login:loginThen,user:()=>user,house:()=>room,show:modal});
  window.duitChooseMedia=next=>guard(()=>room?.hostPlan==='deluxe'?next():loginThen(async()=>{if(await club.requirePlan('deluxe'))next()}))();
  async function authenticate(register){
    const name=$('cpUser').value.trim(),pass=$('cpPass').value;if(!name||!pass)throw Error('请填写用户名和密码。');
    const j=await gqlReq('mutation($u:String!,$p:String!,$r:Boolean!){authenticateWithUsername(username:$u,password:$p,register:$r){account{id} jwt{token}}}',{u:name,p:pass,r:register},false),a=j.authenticateWithUsername;
    if(!a?.jwt?.token)throw Error('未完成登录。');user={id:String(a.account.id),name,token:a.jwt.token};sessionStorage.setItem('duit.house.auth',JSON.stringify(user));$('cpPass').value='';$('cpAuth').close();
    const next=pendingAuth;pendingAuth=null;if(next)await next()
  }
  let authBusy=false;
  async function authAction(register){if(authBusy)return;authBusy=true;$('cpLogin').disabled=$('cpRegister').disabled=true;
    try{status('cpAuthState',register?'正在注册…':'正在登录…');await authenticate(register)}catch(e){if($('cpAuth').open)status('cpAuthState',sayError(e),true);else status('cpBannerState',sayError(e),true)}finally{authBusy=false;$('cpLogin').disabled=$('cpRegister').disabled=false}}
  $('cpAuthForm').onsubmit=e=>{e.preventDefault();authAction(false)};$('cpRegister').onclick=()=>authAction(true);
  function renderLog(){$('cpLog').replaceChildren();for(const m of history.slice(-50)){const b=document.createElement('div'),label=document.createElement('b');b.className=m.role==='user'?'mine':'';label.textContent=m.role==='user'?'我':(persona?.name||'同伴')+' · AI';b.append(label,document.createTextNode(m.content));$('cpLog').append(b)}$('cpLog').scrollTop=$('cpLog').scrollHeight}
  async function reply(text,isCurrent=()=>true){
    if(busyChat)throw Error('上一句正在回复，请稍候。');if(!room||room.kind!=='ai'||!persona?.name)throw Error('请先保存角色画像。');
    const id=room.id,turn=epoch,uid=user.id,previous=history.slice(),mine={role:'user',content:text};busyChat=true;$('cpChat').querySelector('button').disabled=true;
    history.push(mine);renderLog();notice('AI 正在回应…');
    try{const out=await call('reply',{text,history:previous.slice(-12),media:DuitStations.context()},id);if(!belongs(id,turn)||!isCurrent()){if(belongs(id,turn)){history=previous;renderLog()}return ''}
      history.push({role:'assistant',content:out.text});history=history.slice(-80);renderLog();try{await DuitPrivate.put(uid,id+'.chat',history)}catch{notice('本浏览器未能保存这段对话。',true);return out.text}notice('');return out.text
    }catch(e){if(belongs(id,turn)){history=previous;renderLog()}throw e}finally{if(belongs(id,turn)){busyChat=false;$('cpChat').querySelector('button').disabled=false}}}
  function checkVoice(){if(!persona?.name)throw Error('请先完成角色画像。');if(persona.voice==='clone'&&!voiceRef?.data)throw Error('请在编辑画像里选择已授权的参考录音，或切换到预设音色。')}
  async function voice(text){checkVoice();return call('tts',{text,voice:persona.voice||'冰糖',...(persona.voice==='clone'?{reference:voiceRef.data,authorized:voiceRef.authorized===true}:{})})}
  const phone=createDuitPhone({
    kind:()=>room?.kind,role:()=>room?.role,roomId:()=>room?.id,api:(op,args)=>call(op,args),reply,voice,checkVoice,wake:()=>wake(0),
    note:s=>notice(s,true),speaking:v=>world?.speaking(v),peerPose:p=>world?.peerPose(p),remoteAudio:$('cpRemoteAudio'),
    render({phase,text,muted,ai}){const idle=phase==='idle',incoming=phase==='incoming';DuitStations.calling(!idle&&!incoming);$('cpCallState').textContent=text;$('cpDial').hidden=!idle;
      $('cpAccept').hidden=!incoming;$('cpEnd').hidden=idle;$('cpEnd').textContent=incoming?'拒接':'挂断';$('cpMute').hidden=idle||incoming||phase==='starting';$('cpMute').textContent=muted?'取消静音':'静音';
      $('cpInterrupt').hidden=!ai||phase!=='ai';$('cpDial').disabled=!!room&&room.kind==='human'&&!peer;}
  });
  $('cpDial').onclick=guard(async()=>{if(room?.kind==='ai'&&!micAccepted){notice('AI 通话会将每次说完的语音发送给 MiMo 识别，并按已保存的角色音色回应。');micAccepted=true}await phone.start()});
  $('cpAccept').onclick=guard(()=>phone.accept());$('cpEnd').onclick=guard(()=>phone.end(true));$('cpMute').onclick=()=>phone.mute();$('cpInterrupt').onclick=()=>phone.interrupt();
  $('cpChat').onsubmit=guard(async e=>{e.preventDefault();const text=$('cpMessage').value.trim();if(!text||!room)return;if(phone.active())throw Error('语音通话中，请先挂断再发送文字。');await reply(text);$('cpMessage').value=''});
  function renderPeer(next){peer=next;$('cpPresence').textContent=next?'对方也在这间小屋，可以发起通话。':room?.joined?'等待对方进入小屋…':'把一次性邀请链接交给一位朋友。';
    $('cpDial').disabled=!peer;$('cpDot').style.background=peer?'#698b58':'#b5ad9f';$('cpPartner').textContent=next?.name||'真人同住';
    if(next&&!peerVisible){peerVisible=true;world.setCompanion({color:room.role==='owner'?'#70859c':'#ac755f'}).catch(e=>notice(e.message,true))}
    if(!next&&peerVisible){peerVisible=false;world.setCompanion(null)}if(next?.pose)world.peerPose(next.pose)
  }
  function wake(ms){if(!room||room.kind!=='human')return;clearTimeout(wakeTimer);if(busyPoll){again=true;return}wakeTimer=setTimeout(poll,ms)}
  async function poll(){if(busyPoll||!room||room.kind!=='human')return;busyPoll=true;const id=room.id,turn=epoch;
    try{const state=await call('presence',{wire:{session,name:user.name,pose:world.pose(),media:DuitStations.wire(),...phone.wire()}},id);if(!belongs(id,turn))return;
      room.joined=state.joined;$('cpInvite').hidden=room.role!=='owner'||state.joined;$('cpRevoke').hidden=room.role!=='owner'||!state.joined;
      if(state.joined)$('cpInviteBox').hidden=true;if(peerSession&&state.peer?.session&&peerSession!==state.peer.session&&phone.active())await phone.end(false,'对方重新进入了小屋。');
      peerSession=state.peer?.session||'';renderPeer(state.peer);DuitStations.peer(state.peer?.media,state.mediaAge);await phone.observe(state.peer);phone.pose(world.pose())
    }catch(e){if(belongs(id,turn)){status('cpPresence',sayError(e),true);if(/没有加入|不存在|无访问权限|有效的.*会员/.test(e.message)){await leave(false);status('cpBannerState',e.message)}}}
    finally{busyPoll=false;if(room?.kind==='human'){const delay=again?160:phone.active()?700:peer?1500:3000;again=false;wake(delay)}}}
  async function leave(notify=true){const prev=room;epoch++;room=null;DuitStations.enter('');busyChat=false;clearTimeout(wakeTimer);again=false;peer=null;peerVisible=false;peerSession='';await phone.end(false,'');
    if(notify&&user&&prev?.kind==='human')call('presence',{leave:true,session},prev.id).catch(()=>{});
    if(world){world.setCompanion(null);world.seat('owner')}$('avCard').hidden=false;if($('clubPool').open)$('clubPool').close();persona=voiceRef=modelBlob=null;history=[];live.hidden=true;document.body.classList.remove('in-companion');$('cpInviteBox').hidden=true;$('cpInviteURL').value='';$('cpLog').replaceChildren();$('cpNotice').textContent='';
  }
  async function openRoom(id){await window.duitStudioReady;await leave(true);const turn=epoch,uid=user.id;const data=await call('open',{},id);if(epoch!==turn)return;room=data;persona=data.persona;live.hidden=false;document.body.classList.add('in-companion');$('cpChat').querySelector('button').disabled=false;
    if(data.source&&data.source!==imageId){try{await source(data.source,data.title)}catch{}}
    if(!belongs(id,turn))return;display(data.scene,data.title,false);world.seat(data.role);const ai=data.kind==='ai';DuitStations.enter(ai?'ai':data.role,()=>wake(0));$('cpRole').textContent=(data.role==='owner'?'我是房主':'我是访客')+' · '+(ai?'AI 小屋':'真人小屋');
    $('avCard').hidden=data.hostPlan!=='deluxe';
    const topLink=new URL('./index.html',location.href);topLink.searchParams.set('v','member1');topLink.searchParams.set('openHouse',id);$('cpStandalone').href=topLink.href;$('cpStandalone').hidden=window.top===window;
    $('cpEdit').hidden=!ai;$('cpChat').hidden=!ai;$('cpInvite').hidden=ai||data.role!=='owner'||data.joined;$('cpRevoke').hidden=ai||data.role!=='owner'||!data.joined;$('cpCallState').textContent='';
    $('cpPartner').textContent=ai?(persona?.name||'待创建')+' · AI':'真人同住';$('cpDial').hidden=false;$('cpDial').disabled=ai?!persona:!peer;micAccepted=false;notice('');
    if(ai){[history,voiceRef,modelBlob]=await Promise.all(['chat','voice','model'].map(k=>DuitPrivate.get(uid,id+'.'+k).catch(()=>null)));if(!belongs(id,turn))return;
      history=history||[];renderLog();$('cpPresence').textContent=persona?'AI 已加入，你可以打字或语音通话。':'保存画像后，AI 就会加入这个房间。';
      if(persona)await world.setCompanion({color:persona.color,file:modelBlob}).catch(e=>notice('角色模型未载入：'+e.message,true))
    }else{renderPeer(null);await phone.prepareKey();wake(0)}
  }
  async function create(kind,key){await window.duitStudioReady;if(!world?.layout().items?.length)throw Error('请先载入或生成一个房间模型。');
    return call('create',{kind,key,title:modelName||sourceName||'我的小屋',source:imageId,scene:world.layout()},null)}
  function editor(p=null){editScope={id:p?room?.id:null,key:fresh()};editorVoice=p?voiceRef:null;editorModel=p?modelBlob:null;editorShot=null;editorApproved=!!editorVoice?.authorized;
    for(const [id,k] of [['cpName','name'],['cpSpeaker','speaker'],['cpPersonality','personality'],['cpMemories','memories'],['cpExamples','examples']])$(id).value=p?.[k]||'';
    $('cpColor').value=p?.color||'#708979';$('cpVoice').value=p?.voice||'冰糖';$('cpConsentVoice').checked=editorApproved;$('cpConsent').checked=!!p;$('cpOCR').hidden=true;
    $('cpRefRow').hidden=$('cpVoice').value!=='clone';$('cpRefLabel').textContent=editorVoice?'已选参考录音':'建议 3–10 秒清晰单人语音';
    $('cpModelLabel').textContent=editorModel?'已选 GLB 人物':'默认使用小屋人物造型';$('cpClearModel').hidden=!editorModel;status('cpEditState','');modal('cpEditor')}
  function draft(){return {name:$('cpName').value.trim(),speaker:$('cpSpeaker').value.trim(),personality:$('cpPersonality').value.trim(),memories:$('cpMemories').value.trim(),examples:$('cpExamples').value.trim(),voice:$('cpVoice').value,color:$('cpColor').value}}
  const approved=()=>{if(!$('cpConsent').checked)throw Error('请先确认资料的使用范围。')};
  async function draftRoom(){if(!editScope.id){const r=await create('ai',editScope.key);editScope.id=r.id}return editScope.id}
  function lockEditor(on){for(const x of $('cpEditor').querySelectorAll('input,textarea,select,button'))x.disabled=on;changing=on}
  function editAction(fn){return guard(async()=>{if(changing)return;lockEditor(true);try{await fn()}finally{lockEditor(false)}})}
  $('cpEditor').addEventListener('cancel',e=>{if(changing)e.preventDefault()});
  $('cpVoice').onchange=()=>{$('cpRefRow').hidden=$('cpVoice').value!=='clone'};
  $('cpChatFile').onchange=guard(async()=>{const file=$('cpChatFile').files[0];if(!file)return;const text=await DuitMedia.parseChat(file);$('cpExamples').value=text.slice(0,7000);$('cpChatFile').value='';status('cpEditState',text.length>7000?'已取前 7000 字，请选留代表性对话并标注发言人。':'已读取到上方摘录，可先校正双方发言。')});
  $('cpScreenshot').onchange=guard(async()=>{const f=$('cpScreenshot').files[0];if(!f)return;editorShot=await DuitMedia.photo(f);$('cpScreenshot').value='';$('cpOCR').hidden=false;status('cpEditState','截图已在本机准备好。点击识别才会发送。')});
  $('cpOCR').onclick=editAction(async()=>{approved();status('cpEditState','正在识别截图…');const v=await call('ocr',{image:editorShot,confirmed:true},await draftRoom());$('cpExamples').value=($('cpExamples').value+'\n'+v.text).trim().slice(0,7000);editorShot=null;$('cpOCR').hidden=true;status('cpEditState','截图文字已加入摘录，请校正。')});
  $('cpInfer').onclick=editAction(async()=>{approved();const p=draft();if(!p.examples&&!p.memories&&!p.personality)throw Error('请先添加聊天摘录、性格或共同回忆。');status('cpEditState','MiMo 正在整理说话习惯和共同回忆…');const v=await call('profile',{persona:p},await draftRoom());if(v.personality)$('cpPersonality').value=v.personality;if(v.memories)$('cpMemories').value=v.memories;status('cpEditState','画像已整理，请校正后保存。原始摘录仍在上方。')});
  $('cpRef').onchange=editAction(async()=>{const f=$('cpRef').files[0];if(!f)return;status('cpEditState','正在本机处理录音…');editorVoice={data:await DuitMedia.reference(f),authorized:false};$('cpRef').value='';$('cpConsentVoice').checked=false;$('cpRefLabel').textContent='已选 '+f.name+'（最多使用前 12 秒）';status('cpEditState','录音已就绪，请确认使用授权。')});
  $('cpModel').onchange=guard(async()=>{const f=$('cpModel').files[0];if(!f)return;if(f.size>30*1024*1024||String.fromCharCode(...new Uint8Array(await f.slice(0,4).arrayBuffer()))!=='glTF')throw Error('请选择小于 30 MB 的 GLB 人物模型。');editorModel=f;$('cpModelLabel').textContent=f.name;$('cpClearModel').hidden=false;$('cpModel').value=''});
  $('cpClearModel').onclick=()=>{editorModel=null;$('cpModelLabel').textContent='默认使用小屋人物造型';$('cpClearModel').hidden=true};
  $('cpSave').onclick=editAction(async()=>{approved();const p=draft();if(!p.name||(!p.personality&&!p.examples&&!p.memories))throw Error('请填写角色称呼，以及至少一项人物资料。');
    if(p.voice==='clone'&&(!editorVoice||!$('cpConsentVoice').checked))throw Error('请选择参考录音并确认声音授权。');
    const id=await draftRoom();status('cpEditState','正在保存画像并布置同伴…');const uid=user.id;
    await Promise.all([p.voice==='clone'?DuitPrivate.put(uid,id+'.voice',{...editorVoice,authorized:true}):DuitPrivate.remove(uid,id+'.voice'),editorModel?DuitPrivate.put(uid,id+'.model',editorModel):DuitPrivate.remove(uid,id+'.model')]);
    await call('save',{persona:p,approved:true},id);await openRoom(id);$('cpEditor').close()});
  async function newAI(){if(await club.requirePlan('deluxe'))editor()}
  $('cpEdit').onclick=()=>editor(persona||{});$('cpCreate').onclick=guard(()=>loginThen(newAI));$('cpHuman').onclick=busy($('cpHuman'),()=>loginThen(async()=>{if(!await club.requirePlan('basic'))return;const h=await create('human',fresh());await openRoom(h.id);await invite()}));
  async function invite(){const key=DuitMedia.b64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const proof=await digest(key);await call('invite',{proof});const u=new URL('./index.html',location.href);u.searchParams.set('v','member1');u.hash=new URLSearchParams({house:room.id,invite:key}).toString();$('cpInviteURL').value=u.href;$('cpInviteBox').hidden=false;notice('新邀请只可由另一个账号领取一次。')}
  async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('')}
  $('cpInvite').onclick=busy($('cpInvite'),invite);$('cpCopy').onclick=guard(async()=>{try{await navigator.clipboard.writeText($('cpInviteURL').value);notice('邀请链接已复制。')}catch{$('cpInviteURL').select();notice('请复制已选中的邀请链接。')}});
  $('cpRevoke').onclick=busy($('cpRevoke'),async()=>{if(!confirm('移除当前访客并结束通话？'))return;await phone.end(true);await call('revoke');room.joined=false;renderPeer(null);wake(0)});
  $('cpLeave').onclick=guard(async()=>{await leave();status('cpBannerState','已离开，可以从「我的小屋」回来。')});
  async function library(){modal('cpLibrary');const box=$('cpLibraryList');box.replaceChildren();status('cpLibraryState','正在读取…');const v=await call('list');status('cpLibraryState',v.rooms.length?'':'还没有小屋。可从首页创建 AI 或邀请真人。');
    for(const r of v.rooms){const row=document.createElement('div'),text=document.createElement('div'),name=document.createElement('strong'),label=document.createElement('small'),go=document.createElement('button');row.className='cp-lib-row';name.textContent=r.title;label.textContent=(r.kind==='ai'?'AI 同伴':'真人双人')+' · '+(r.role==='owner'?'我是房主':'我是访客');text.append(name,label);go.className='linebtn';go.textContent='进入';go.onclick=busy(go,async()=>{await openRoom(r.id);$('cpLibrary').close()});row.append(text,go);
      if(r.role==='owner'){const del=document.createElement('button');del.className='textbtn';del.textContent='解散';del.onclick=busy(del,async()=>{if(!confirm('解散此小屋并删除已存画像和本机对应资料？'))return;if(room?.id===r.id)await leave();await call('closeRoom',{},r.id);await Promise.all(['chat','voice','model'].map(k=>DuitPrivate.remove(user.id,r.id+'.'+k)));await library()});row.append(del)}box.append(row)}}
  $('cpRooms').onclick=guard(()=>loginThen(library));$('cpSignout').onclick=guard(async()=>{await leave();user=null;sessionStorage.removeItem('duit.house.auth');$('cpLibrary').close();status('cpBannerState','已退出小屋账号。')});
  window.addEventListener('pagehide',()=>{const r=room;if(r?.kind==='human')call('presence',{leave:true,session},r.id,true).catch(()=>{});phone.end(false).catch(()=>{})});
  const options=new URLSearchParams(location.search);
  async function launch(){if(options.get('membership')==='1')return club.plansOpen();await window.duitStudioReady;if(pendingJoin.id&&pendingJoin.key){return loginThen(async()=>{const r=await call('join',{proof:await digest(pendingJoin.key)},pendingJoin.id);const url=new URL(location.href);url.hash='';window.history.replaceState(null,'',url);await openRoom(r.id)})}
    if(/^\d{1,19}$/.test(options.get('openHouse')||''))return loginThen(()=>openRoom(options.get('openHouse')));
    if(options.get('companion')==='create')return loginThen(newAI)}
  guard(launch)();
})();
