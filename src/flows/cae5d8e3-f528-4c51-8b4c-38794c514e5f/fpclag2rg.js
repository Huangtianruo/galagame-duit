const input=String(context.getArg('question')||'').trim(),tag='DuitSupport/1\n';
let question=input,previous=[];
if(input.startsWith(tag)){
  if(input.length>6500)throw Error('这条消息过长，请精简后重试。');
  let envelope;try{envelope=JSON.parse(input.slice(tag.length))}catch{throw Error('消息格式无效，请重新发送。')}
  question=typeof envelope?.question==='string'?envelope.question.trim():'';
  if(Array.isArray(envelope?.history))previous=envelope.history.slice(-6).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,650)}));
}
if(!question||question.length>600){context.setResult(question?'请把问题控制在 600 字以内。':'请先输入你想咨询的问题。')}
else{
  const facts="两种订阅有什么区别？ 基础版每月 39.90 元，可邀请好友进房并语音通话，受邀人可以免费接听。豪华版每月 59.90 元，包含基础版权益，还能创建自己的 AI、与 AI 通话、共享影音和打台球。两位玩家同桌打台球都需要豪华版。订阅按月手动续费。\n怎样创造自己的 AI？ 登录小屋账号后点击「创造自己的 AI」。豪华版可以填写称呼、性格、共同回忆和聊天摘录，选择音色，预览并保存画像。保存后 AI 会加入你的房间。\n怎么邀请好友进屋通话？ 房主登录后在「同住小屋」点「邀请真人」，把一次性邀请链接发给好友。好友用自己的账号加入，双方都在屋里时，房主点「开启语音通话」，好友点「接听」，并允许浏览器使用麦克风。\n房间和人物怎么制作？ 在房间灵感室填写名称和要求，生成参考图后点「用这张图建 3D 房间」。到空间造型室生成房间后可以漫游。人物形象可在个人中心用自拍和身高制作并保存，再带回房间。\n哪里能看任务、Token 和费用？ 从个人中心打开「Agent 工作记录」，登录后选择任务、展开时间线，即可看到自己有权查看的任务、交接和实际记录的用量。供应方没有返回金额时，费用显示「未提供」。";
  let payment='收款开关状态以订阅页面为准。';
  if(/付|收款|订单|扣款|续费/.test(question)){
    try{const data=context.runGql('SupportPaymentState','query SupportPaymentState{duit_billing_config(limit:1,where:{_eq:{text_operand:{left_operand:{column:slot},right_operand:{literal:"wechat_native"}}}}){enabled wechat_config}}',{},{role:'admin'});
      const c=data.duit_billing_config[0],ready=c?.enabled&&/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(c.wechat_config);payment=ready?'当前已开放微信扫码收款，实际订单结果请在订阅页查询。':'当前微信扫码收款暂未开放。'
    }catch{}
  }
  const system='你是 Duit 小屋的中文 AI 客服。基于下列产品说明回答用户当前的问题，结合之前的对话理解追问。先给答案，再给简短操作步骤，通常不超过 160 字。资料以此说明为准。可以给出具体的房间设计建议。无法确定时说明还需要什么信息。你无法访问用户个人订单、聊天或通话，也不能代为开通、退款或修改账户。不要编造交易结果、人工联系方式或承诺。无需用户提供密码、付款码、验证码或完整私人聊天。\n'+facts+'\n'+payment+'\n电视可选择本地视频，收音机可选择本地音乐。与好友同步需双方在房间中选择同一份文件，由房主勾选共享、好友跟播。切换设备时可以继续通话。';
  const choices=context.callActionFlow('51c7f96a-a8c1-4f6b-bd5d-d7f9a7a55e6b',null,{messages:[{role:'system',content:system},...previous,{role:'user',content:question}]});
  const answer=choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())throw Error('AI 客服暂时未能返回答复，请稍后重试。');
  context.setResult(answer.trim().slice(0,1500))
}
