const { createRedactor }=require('./redact.cjs');
const { randomUUID }=require('node:crypto');
class Session {
  constructor(config={},limits={}) {
    this.id=randomUUID(); this.redactor=createRedactor(config.redact||[]);
    this.project=config.name||'本地产品';
    this.entries=[]; this.markers=[]; this.nextId=1; this.revision=0; this.bytes=0;
    this.maxEntries=limits.maxEntries||1000; this.maxBytes=limits.maxBytes||2*1024*1024;
    this.dropped=0; this.status='ready'; this.startedAt=null; this.exitCode=null;
    this.lastBySource=new Map();
    this.ports=[];
    this.totalEntries=0;this.firstAt=null;this.historyAvailable=false;
  }
  add(source,text,at=Date.now()) {
    text=String(text).replace(/\x1b\[[0-9;]*[A-Za-z]/g,''); const previous=this.lastBySource.get(source);
    this.firstAt=this.firstAt===null?at:Math.min(this.firstAt,at);
    let saved;
    // Selection intersects whole stack messages, keeping continuation lines.
    if(previous&&this.entries.includes(previous)&&at-previous.endedAt<2000&&
      /^(?:\s+|Caused by:)/.test(text)&&previous.text.length+text.length<65536) {
      previous.text+='\n'+text; previous.endedAt=at; this.bytes+=Buffer.byteLength(text)+1;
      saved=previous;
    } else {
      const entry={id:this.nextId++,at,endedAt:at,source,text};
      this.entries.push(entry); this.lastBySource.set(source,entry); this.bytes+=Buffer.byteLength(text);
      this.totalEntries++;saved=entry;
    }
    this.archive?.write?.(saved);
    while(this.entries.length>this.maxEntries||this.bytes>this.maxBytes) {
      this.bytes-=Buffer.byteLength(this.entries.shift().text);if(!this.historyAvailable)this.dropped++;
    }
    this.revision++;
  }
  mark() {
    const marker={id:randomUUID(),at:Date.now()}; this.markers.push(marker);
    if(this.markers.length>100) this.markers.shift(); this.revision++; return marker;
  }
  snapshot() {
    return {id:this.id,project:this.project,status:this.status,startedAt:this.startedAt,exitCode:this.exitCode,
      revision:this.revision,dropped:this.dropped,earliestAt:this.firstAt,
      totalEntries:this.totalEntries,historyAvailable:this.historyAvailable,redaction:'copy-only',
      mode:this.mode||'process',sourceId:this.sourceId||null,productStatus:this.productStatus||null,
      timeBasis:this.timeBasis||'receipt',ports:this.ports,markers:this.markers,entries:this.entries};
  }
  preview({from,to,note='',secrets=[]}) {
    if(!Number.isFinite(from)||!Number.isFinite(to)||from>to) throw new Error('请选择有效的起止时间。');
    const entries=this.archive?this.archive.range(from,to):this.entries.filter(e=>e.at<=to&&e.endedAt>=from), extra=createRedactor(secrets,'CUSTOM');
    const iso=v=>new Date(v).toISOString();
    const head=['产品测试问题日志','项目：'+this.project,
      '时间范围（UTC）：'+iso(from)+' 至 '+iso(to),
      this.timeBasis==='explicit-iso-or-read'?'时间依据：日志中的带时区 ISO 时间（如有）；其他行使用读取时间。':
      '时间依据：终端输出到达采集器的时间；不是程序原始事件时间。',
      (this.mode==='capture'?'产品状态：'+(statusLabel(this.productStatus)||'未知'):'日志状态：'+statusLabel(this.status))+(this.exitCode!==null?'，退出码 '+this.exitCode:''),
      '问题描述：'+(note||'请结合以下日志排查我测试时遇到的问题。'),
      ...(this.dropped?['提示：缓存已有 '+this.dropped+' 条旧日志被淘汰，本次范围可能不完整。']:[]),
      '已应用本地规则脱敏。请在发送前检查业务敏感内容。',''];
    const lines=entries.map(e=>'['+iso(e.at)+'] ['+e.source+'] '+e.text);
    if(!entries.length) lines.push('所选时间范围内没有终端输出。');
    extra.learn(entries.map(e=>e.text).join('\n'));
    return {count:entries.length,text:extra.selection([...head,...lines].join('\n'))};
  }
}
function statusLabel(value) {return ({running:'运行中',starting:'启动中',stopped:'已结束',failed:'已退出',watching:'读取中',paused:'已暂停',ready:'等待产品',waiting:'等待来源恢复'})[value]||value;}
module.exports={Session};
