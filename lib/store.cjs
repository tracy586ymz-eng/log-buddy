const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { Session } = require('./session.cjs');
const defaultStore = () => process.platform==='darwin'
  ? path.join(os.homedir(),'Library','Application Support','Log Buddy','records')
  : process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Log Buddy','records')
  : path.join(process.env.XDG_STATE_HOME||path.join(os.homedir(),'.local','state'),'log-buddy','records');
const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
function storeDir(root = defaultStore()) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat=fs.lstatSync(root);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(process.getuid&&stat.uid!==process.getuid()))
    throw new Error('日志目录不是当前用户拥有的普通目录，请使用另一个 --store 位置。');
  if(process.platform!=='win32')fs.chmodSync(root,0o700);
  if(root===defaultStore())migrateLegacy(root);
  return root;
}
function migrateLegacy(root) {
  const marker=path.join(root,'.migrated-v0.3');if(fs.existsSync(marker))return;
  const old=path.join(os.tmpdir(),'log-buddy-'+(process.getuid?.()??'local'));
  try {
    const dir=fs.lstatSync(old);
    if(dir.isDirectory()&&!dir.isSymbolicLink()&&(!process.getuid||dir.uid===process.getuid()))
      for(const name of fs.readdirSync(old).filter(n=>/^[a-f0-9-]{36}\.(?:meta|session)\.json$/.test(n))) {
        const input=path.join(old,name),output=path.join(root,name),stat=fs.lstatSync(input);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32*1024*1024||(process.getuid&&stat.uid!==process.getuid())||fs.existsSync(output))continue;
        try{fs.copyFileSync(input,output,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code==='EEXIST')continue;throw error;}
        if(process.platform!=='win32')fs.chmodSync(output,0o600);
        if(name.endsWith('.meta.json')) {
          const value=JSON.parse(fs.readFileSync(output,'utf8'));
          atomicWrite(output,{...value,status:'stopped',collectorPid:null,migratedFromV03:true});
        }
      }
  }catch(error){if(error.code!=='ENOENT')throw error;}
  try{fs.writeFileSync(marker,'Copied legacy snapshots; original files preserved.\n',{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
}
function atomicWrite(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
}
function saveSession(root, session) {
  storeDir(root);
  if (!validId(session.id)) throw new Error('日志记录标识无效。');
  session.archive?.flush?.();
  const snapshot = { ...session.snapshot(), format: 'log-buddy-session-v1' };
  atomicWrite(path.join(root, session.id + '.session.json'), snapshot);
  atomicWrite(path.join(root, session.id + '.meta.json'), {
    id: session.id, name: session.project, status: session.status,
    startedAt: session.startedAt, updatedAt: Date.now(), exitCode: session.exitCode,
    collectorPid: process.pid, ports: session.ports || []
  });
}
function listSources(root = defaultStore()) {
  if (!fs.existsSync(root)) return [];
  const files = fs.readdirSync(root).filter(name => /^[a-f0-9-]{36}\.meta\.json$/.test(name));
  const results = [];
  for (const name of files.slice(-200)) {
    try {
      const file = path.join(root, name);
      if (fs.statSync(file).size > 8192) continue;
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (validId(value.id) && name === value.id + '.meta.json' && typeof value.name === 'string' &&
          Number.isFinite(value.updatedAt)) results.push(value);
    } catch {}
  }
  return results.sort((a,b) => b.updatedAt - a.updatedAt).slice(0,30);
}
function readSession(root, id) {
  if (!validId(id)) throw new Error('请选择列表中的产品日志。');
  const file = path.join(root, id + '.session.json');
  if (fs.statSync(file).size > 32 * 1024 * 1024) throw new Error('日志记录过大，无法读取。');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.format !== 'log-buddy-session-v1' || data.id !== id || !Array.isArray(data.entries) ||
      data.entries.length > 15000) throw new Error('日志记录格式不正确。');
  return data;
}
function observeCapture(root, id, onUpdate) {
  if(!validId(id))throw new Error('请选择列表中的产品日志。');
  let stopped = false, busy = false, lastRevision = -1;
  const session = new Session();
  session.mode = 'capture';
  session.sourceId = id;
  session.timeBasis = 'receipt';
  function refresh() {
    if (stopped || busy) return;
    busy = true;
    try {
      const data = readSession(root, id);
      if (data.revision === lastRevision && session.status!=='failed') return;
      lastRevision = data.revision;
      session.project = String(data.project || '本地产品');
      session.startedAt = data.startedAt;
      session.productStatus = data.mode === 'file' ? null : data.status;
      session.timeBasis = data.timeBasis || 'receipt';
      session.exitCode = data.exitCode;
      session.status = 'watching';
      session.dropped = Number(data.dropped) || 0;
      session.totalEntries=Number(data.totalEntries)||data.entries.length;
      session.firstAt=data.earliestAt;session.historyAvailable=Boolean(data.historyAvailable);
      if(data.historyAvailable&&!session.archive)session.archive=require('./archive.cjs').readArchive(root,id);
      session.entries = data.entries.filter(e => Number.isFinite(e.at) && Number.isFinite(e.endedAt) &&
        typeof e.text === 'string' && e.text.length <= 65536 && ['stdout','stderr','system','file'].includes(e.source))
        .map(e => ({ ...e }));
      session.revision++;
      onUpdate?.(session);
    } catch {
      if(session.status!=='failed') {
        session.status = 'failed';
        session.add('system', '日志来源暂时无法读取。原产品不会被停止，请刷新或选择另一份日志。');
      }
    } finally { busy = false; }
  }
  refresh();
  if (session.status === 'failed') throw new Error('这份日志暂时不可读取，请刷新列表。');
  const timer = setInterval(refresh, 200);
  function stop() { stopped = true; clearInterval(timer); session.archive?.close?.();session.archive=null;session.status = 'paused'; session.revision++; }
  return { session, stop };
}
module.exports = { defaultStore, saveSession, listSources, readSession, observeCapture, storeDir, atomicWrite, validId };
