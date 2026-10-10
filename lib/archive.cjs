const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {storeDir,validId}=require('./store.cjs');
function archiveFile(root,id){if(!validId(id))throw Error('日志标识无效。');return path.join(root,id+'.sqlite');}
function createArchive(root,session){
  storeDir(root);const file=archiveFile(root,session.id);
  const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);
  const db=new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;CREATE TABLE logs(id INTEGER PRIMARY KEY,at REAL,endedAt REAL,source TEXT,text TEXT);CREATE INDEX log_time ON logs(at,endedAt);');
  const put=db.prepare('INSERT INTO logs VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET endedAt=excluded.endedAt,text=excluded.text');
  let transaction=false,closed=false;
  const archive=access(db);
  for(const name of ['window','range']) {
    const query=archive[name];
    archive[name]=(...args)=>{if(!closed)return query(...args);const reader=readArchive(root,session.id);try{return reader[name](...args);}finally{reader.close();}};
  }
  archive.write=entry=>{if(closed)throw Error('日志保存已关闭。');if(!transaction){db.exec('BEGIN');transaction=true;}put.run(entry.id,entry.at,entry.endedAt,entry.source,entry.text);};
  archive.flush=()=>{if(transaction){db.exec('COMMIT');transaction=false;}};
  archive.close=()=>{if(closed)return;archive.flush();db.close();closed=true;};
  session.archive=archive;session.historyAvailable=true;
  for(const entry of session.entries)archive.write(entry);
  return archive;
}
function readArchive(root,id){
  const file=archiveFile(root,id);const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||(process.getuid&&stat.uid!==process.getuid()))throw Error('日志历史文件不可读取。');
  const db=new DatabaseSync(file,{readOnly:true});const archive=access(db);archive.close=()=>db.close();return archive;
}
function access(db){
  function criteria(options={}){
    const before=Number(options.before)||Number.MAX_SAFE_INTEGER;
    const from=Number.isFinite(Number(options.from))?Number(options.from):-Number.MAX_VALUE;
    const to=Number.isFinite(Number(options.to))?Number(options.to):Number.MAX_VALUE;
    const search=typeof options.search==='string'?options.search:'';
    return {where:'id < ? AND at <= ? AND endedAt >= ? AND instr(lower(text),lower(?))>0',args:[before,to,from,search]};
  }
  return {
    window(options={}){
      const c=criteria(options),limit=Math.min(2000,Math.max(1,Number(options.limit)||1000));
      const entries=db.prepare('SELECT * FROM logs WHERE '+c.where+' ORDER BY id DESC LIMIT ?').all(...c.args,limit).reverse();
      const first=entries[0]?.id;
      const older=first?db.prepare('SELECT 1 FROM logs WHERE '+c.where+' LIMIT 1').get(first,...c.args.slice(1)):null;
      return {entries,hasOlder:Boolean(older),before:first||null};
    },
    range(from,to){
      const size=db.prepare('SELECT coalesce(sum(length(CAST(text AS BLOB))),0) AS bytes FROM logs WHERE at <= ? AND endedAt >= ?').get(to,from).bytes;
      if(size>48*1024*1024)throw Error('这段日志较大，请缩小这次复制的时间范围；完整记录仍然保留。');
      return db.prepare('SELECT * FROM logs WHERE at <= ? AND endedAt >= ? ORDER BY id').all(to,from);
    }
  };
}
module.exports={createArchive,readArchive};
