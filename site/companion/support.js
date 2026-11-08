function setupSupport({ask,login,getUser,plans,create,profile,rooms}){
  const $=id=>document.getElementById(id),panel=$('supportDialog'),log=$('supportLog'),input=$('supportInput'),send=$('supportSend');
  const faq=[{"question":"两种订阅有什么区别？","answer":"基础版每月 39.90 元，可邀请好友进房并语音通话，受邀人可以免费接听。豪华版每月 59.90 元，包含基础版权益，还能创建自己的 AI、与 AI 通话、共享影音和打台球。两位玩家同桌打台球都需要豪华版。订阅按月手动续费。","action":"订阅"},{"question":"怎样创造自己的 AI？","answer":"登录小屋账号后点击「创造自己的 AI」。豪华版可以填写称呼、性格、共同回忆和聊天摘录，选择音色，预览并保存画像。保存后 AI 会加入你的房间。","action":"创造自己的 AI"},{"question":"怎么邀请好友进屋通话？","answer":"房主登录后在「同住小屋」点「邀请真人」，把一次性邀请链接发给好友。好友用自己的账号加入，双方都在屋里时，房主点「开启语音通话」，好友点「接听」，并允许浏览器使用麦克风。","action":"返回小屋"},{"question":"房间和人物怎么制作？","answer":"在房间灵感室填写名称和要求，生成参考图后点「用这张图建 3D 房间」。到空间造型室生成房间后可以漫游。人物形象可在个人中心用自拍和身高制作并保存，再带回房间。","action":"个人中心"},{"question":"哪里能看任务、Token 和费用？","answer":"从个人中心打开「Agent 工作记录」，登录后选择任务、展开时间线，即可看到自己有权查看的任务、交接和实际记录的用量。供应方没有返回金额时，费用显示「未提供」。","action":"Agent 工作记录"}],turns=[];let busy=false,epoch=0,owner=getUser()?.id||null;
  const status=t=>{$('supportStatus').textContent=t};
  function resetOnAccountChange(){const next=getUser()?.id||null;if(next!==owner){owner=next;epoch++;turns.length=0;log.replaceChildren();busy=false;send.disabled=false}}
  function entry(label,text,action){const card=document.createElement('article'),name=document.createElement('b'),p=document.createElement('p');if(label==='我')card.className='mine';name.textContent=label;p.textContent=text;card.append(name,p);
    if(action){const b=document.createElement('button');b.type='button';b.textContent=action;b.onclick=()=>{panel.close();if(action==='订阅')plans();else if(action==='创造自己的 AI')create();else if(action==='个人中心')profile();else if(action==='返回小屋')rooms();else if(action==='Agent 工作记录')window.open('./project-records.html','_blank','noopener')};card.append(b)}
    log.append(card);while(log.children.length>54)log.firstChild.remove();log.scrollTop=log.scrollHeight}
  function record(role,content){turns.push({role,content});while(turns.length>6)turns.shift()}
  for(const item of faq){const b=document.createElement('button');b.type='button';b.textContent=item.question;b.onclick=()=>{resetOnAccountChange();if(busy)return;entry('我',item.question);entry('使用说明',item.answer,item.action);record('user',item.question);record('assistant',item.answer);status('')};$('supportFaq').append(b)}
  function open(){resetOnAccountChange();if(!panel.open)panel.showModal();if(!busy)status(getUser()?'可继续追问。':'常见问题可直接查看，登录后可向 AI 提问。')}
  async function respond(question){resetOnAccountChange();if(busy)return;const turn=epoch,uid=getUser()?.id;busy=true;send.disabled=true;input.value='';entry('我',question);status('AI 正在回复…');
    try{const payload='DuitSupport/1\n'+JSON.stringify({question,history:turns.map(x=>({...x,content:x.content.slice(0,650)}))});const answer=await ask(payload);
      if(turn!==epoch||uid!==getUser()?.id)return;entry('AI 客服',answer);record('user',question);record('assistant',answer);status('可继续追问。')
    }catch(e){if(turn===epoch){status(e.message||'暂未收到回复，请重试。');if(!input.value)input.value=question}}
    finally{if(turn===epoch){busy=false;send.disabled=false}}}
  $('supportForm').onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(!q||busy)return;
    if(!getUser()){panel.close();login(async()=>{open();await respond(q)})}else respond(q)};
  $('supportClose').onclick=()=>panel.close();$('supportEntry').onclick=open;return {open};
}
