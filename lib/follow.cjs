const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { Session } = require('./session.cjs');
const { capture } = require('./capture.cjs');
const allowed = new Set(['.log','.txt','.jsonl','.ndjson','.out']);
function followLog(input,options={}) {
  if (typeof input !== 'string' || !input || input.length > 8192 || input.includes('\0')) throw new Error('日志位置格式不正确。');
  const file = path.resolve(input);
  if (!allowed.has(path.extname(file).toLowerCase())) throw new Error('请选择 .log、.txt、.jsonl、.ndjson 或 .out 文件。');
  if (!fs.statSync(file).isFile()) throw new Error('请选择普通日志文件。');
  const session = new Session({ name: path.basename(file) });
  session.mode = 'file'; session.startedAt = Date.now(); session.status = 'watching';
  session.timeBasis = 'explicit-iso-or-read';
  options.onSession?.(session);
  let cursor = 0, identity = null, stopped = false, busy = false, stream, finishStream, lastEventAt = null;
  function newStream() {
    finishStream?.();stream?.end(); stream = new PassThrough(); lastEventAt = null;
    finishStream=capture(stream, 'file', { add(source, text) {
      const match = text.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))/);
      const parsed = match ? Date.parse(match[1].replace(' ', 'T')) : NaN;
      let at = Date.now();
      if (Number.isFinite(parsed)) { at = parsed; lastEventAt = parsed; }
      else if (/^(?:\s+|Caused by:)/.test(text) && lastEventAt !== null) at = lastEventAt;
      else lastEventAt = null;
      session.add(source, text, at);
    }});
  }
  newStream();
  session.add('system', '只读跟随已有日志；不会启动或停止产品。带显式时区的 ISO 时间会被识别，其他行按读取时间。');
  function read() {
    if (stopped || busy) return; busy = true;
    let fd,success=false;
    try {
      fd = fs.openSync(file, 'r');
      const stat = fs.fstatSync(fd), key = stat.dev + ':' + stat.ino;
      if (!stat.isFile()) throw new Error('日志不再是普通文件');
      const initial = identity === null;
      if (identity !== key || stat.size < cursor) {
        if (!initial) { newStream(); session.add('system', '日志文件已轮换或清空，继续读取新的输出。'); }
        identity = key;
        cursor = 0;
      }
      for (let i = 0; i < 16 && cursor < stat.size; i++) {
        const buffer = Buffer.alloc(Math.min(65536, stat.size - cursor));
        const count = fs.readSync(fd, buffer, 0, buffer.length, cursor);
        if (!count) break;
        cursor += count; stream.write(buffer.subarray(0,count));
      }
      success=true;
      if(cursor<stat.size)setImmediate(read);
    } catch {
      if(session.status!=='waiting'){session.status = 'waiting';session.revision++;}
      // Retain captured messages and resume when the path is created again.
    } finally { if (fd !== undefined) fs.closeSync(fd); busy = false; }
    if (session.status === 'waiting' && success) { session.status = 'watching'; session.revision++; }
  }
  read();
  const timer = setInterval(read, 500);
  function stop() { stopped = true; clearInterval(timer);finishStream();stream.end(); session.status = 'paused'; session.revision++; }
  return { session, stop };
}
module.exports = { followLog };
