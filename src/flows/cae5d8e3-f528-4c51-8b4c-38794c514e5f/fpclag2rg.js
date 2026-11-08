const q = String(context.getArg('question') || '').trim();
if (!q) { context.setResult('请先输入你的问题，例如：小卧室怎么布置更显宽敞？'); }
else if (q.length > 600) { context.setResult('问题请控制在 600 字以内，再试一次。'); }
else {
  const choices = context.callActionFlow('51c7f96a-a8c1-4f6b-bd5d-d7f9a7a55e6b', null, {messages:[
    {role:'system',content:'你是 Duit 小家的中文设计客服。用两到三句话给一个具体可执行的房间设计建议。首页的建房可打开房间灵感室，填名字和要求后可生成预览图。好友和订阅尚未开放。不要声称能操作账号、支付或替用户生成图片。'},
    {role:'user',content:q}
  ]});
  const answer = choices && choices[0] && choices[0].message && choices[0].message.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('客服暂时没有返回文字。');
  context.setResult(answer.trim().slice(0,1400));
}