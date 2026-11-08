// Native record page adapter. Ownership checks and writes live in the shared journal.
const journalId = '407961b2-7a48-88c3-47d7-12d9548ba45b';
const workerId = '7228f2df-ddcb-0d58-39eb-effdc8afcbbe';
const account = String(context.getArg('account_id') || '');
if (!/^[1-9]\d*$/.test(account)) throw Error('请先登录 Duit 账号。');
const op = String(context.getArg('action') || 'list');
const id = String(context.getArg('task_id') || '');
const filter = String(context.getArg('task_status') || '').trim();
const key = String(context.getArg('request_key') || '');
const note = String(context.getArg('decision') || '').trim();
const attempt = context.getArg('expected_attempt');
const out = {ok:true};
function journal(args) {
  const raw = context.callActionFlow(journalId, null, {question:JSON.stringify(args)});
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
function stringify(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function viewTask(t) {
  if (!t) return null;
  return {task_id:t.id,created_at:t.created_at,request_text:t.request_text,task_status:t.task_status,
    attempt_count:t.attempt_count,requirement_summary:t.requirement_summary,
    requirements_json_text:stringify(t.requirements_json),review_json_text:stringify(t.review_json),
    delivery_advice:t.delivery_advice,last_failure:t.last_failure,events:[]};
}
function viewEvent(e) {
  const v={event_id:e.id};
  for (const k of ['created_at','stage_key','stage_name','stage_status','agent_role','summary','decision','reason','handoff','result_link','failure_code','failure_message','attempt_number','human_decision','model_name','input_tokens','output_tokens','total_tokens','cost_amount','cost_currency','cost_source','duration_ms']) {
    v[k]=e[k] == null ? null : e[k];
  }
  v.result_text=stringify(e.result_json);
  v.usage_display=e.total_tokens == null ? 'Token 用量未提供' : 'Token 用量：'+e.total_tokens;
  v.cost_display=e.cost_amount == null || !e.cost_currency ? '费用未提供' : '费用：'+e.cost_amount+' '+e.cost_currency;
  return v;
}
function list() {
  const r=journal({op:'list',status:filter});out.tasks=r.tasks.map(viewTask);
  return r.more ? '已显示最近 30 项，可在完整工作台继续翻页。' : out.tasks.length ? '已更新我的任务。' : '当前没有符合条件的任务。';
}
function detail(taskId) {
  const r=journal({op:'detail',id:taskId});
  out.task=viewTask(r.task);out.task.events=r.events.map(viewEvent);
  let more=r.more;
  while (more && out.task.events.length<800) {
    const last=out.task.events[out.task.events.length-1];
    const next=journal({op:'detail',id:taskId,after:String(last.event_id)});
    if (!next.events.length) break;
    out.task.events.push(...next.events.map(viewEvent));more=next.more;
  }
  if(more) throw Error('此项记录超过 800 条事件，请在完整工作台分页查看。');
  out.task_id=out.task.task_id;out.task_status=out.task.task_status;
}
function csvCell(value) {
  const s=String(value == null ? '' : value);
  const safe=/^[\s]*[=+@-]/.test(s) ? "'"+s : s;
  return '"'+safe.replace(/"/g,'""')+'"';
}
if (op==='list') {
  out.message=list();
  if (id && out.tasks.some(t => String(t.task_id) === id)) detail(id);
} else if (op==='detail'||op==='export') {
  detail(id);out.message='已更新所选任务和时间线。';
  if (op==='export') {
    if(context.getArg('export_format')==='csv'){
      const columns=['event_id','created_at','stage_name','stage_status','summary','decision','reason'];
      const rows=out.task.events.map(e=>columns.map(k=>csvCell(e[k])).join(','));
      out.csv_content=[columns.join(','),...rows].join('\r\n');
    }else{out.json_content=JSON.stringify(out.task,null,2)}
    out.message='所选任务的导出文本已就绪。';
  }
} else if (['submit','return','confirm','retry'].includes(op)) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw Error('提交编号尚未准备好，请刷新页面。');
  const args=op==='submit' ? {op,key,text:String(context.getArg('request_text')||'').trim()} :
    {op,id,key,note,attempt};
  const r=journal(args);
  if (op!=='confirm') context.createActionFlowTask(workerId,null,{question:JSON.stringify({op:'run',id:String(r.task.id)})});
  detail(String(r.task.id));list();out.message=op==='confirm'?'已记录确认。':'已提交，可刷新查看处理进度。';
} else { throw Error('不支持的运行记录操作。'); }
context.setResult(out);