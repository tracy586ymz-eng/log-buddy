const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { Session } = require('./session.cjs');
const { asset } = require('./assets.cjs');
const { openUrl } = require('./process.cjs');
const { defaultStore, listSources, observeCapture, storeDir } = require('./store.cjs');
const { followLog } = require('./follow.cjs');
const { pickLog } = require('./picker.cjs');
const { focusedCapture } = require('./automatic.cjs');
const { integrationStatus, installIntegration } = require('./integration.cjs');

async function createApp(options = {}) {
  if (options.config) throw new Error('日志助手只查看日志。请在原来的 AI/终端流程中运行产品。');
  const token = randomBytes(32).toString('hex');
  const root = options.store || defaultStore();
  storeDir(root);
  let session = new Session(), observation = null, base, closing = false, picking = false;
  let automatic = options.autoConnect !== false, focusSeen = 0;
  const clients = new Set();
  function attach(next) {
    observation?.stop(); observation = next; session = next.session;
    return session.snapshot();
  }
  function connectSource(id) { return attach(observeCapture(root, id)); }
  function connectFile(file) {
    const next=followLog(file,{onSession:session=>require('./archive.cjs').createArchive(root,session)});
    const flush=setInterval(()=>next.session.archive?.flush?.(),150);
    const stop=next.stop;next.stop=()=>{clearInterval(flush);stop();next.session.archive?.close?.();};
    return attach(next);
  }
  function demoRecord() {
    const value = new Session({ name: '演示日志 · 不启动产品' });
    value.mode = 'demo'; value.status = 'watching'; value.startedAt = Date.now();
    value.add('stdout', '产品已经在自己的网页或窗口中运行。');
    value.add('stdout', 'api_key=sk-demo_FAKE_1234567890123456');
    value.add('stdout', 'POST /checkout customer=sample@example.invalid ip=192.0.2.25');
    value.add('stderr', 'Error: 订单提交失败');
    value.add('stderr', '    at submitOrder (checkout.js:42:9)');
    return attach({ session: value, stop() { value.status = 'paused'; value.revision++; } });
  }
  function json(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) throw new Error('请求内容过长。');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  function setupPrompt() {
    const home = require('node:os').homedir(), sep = require('node:path').sep;
    const location = (options.helperInvocation || []).map(x => x.startsWith(home + sep) ? '~' + x.slice(home.length) : x);
    return [
      '请把我当前正在测试的产品运行输出接入 Log Buddy。',
      '保持产品现有的网页、弹窗、启动方式和工作目录；不要把产品嵌入日志助手，不要修改产品源码。',
      '如果已有产品日志文件，请你使用 watch --file <日志> --name <产品名> 接入并打开独立窗口，不要让我找日志位置。',
      '如果终端输出尚未保存，请说明无法补回历史。仅停止你自己启动的测试进程，在原来的 AI/终端流程中用日志助手 collect 包装原启动命令，再按原方式打开产品。',
      'collect --cwd <原工作目录> --name <产品名> -- <原程序> <原参数>；保留原终端输出，并自动打开独立日志窗口，不打开产品。',
      location.length ? '日志助手调用入口（~ 代表用户目录）：' + JSON.stringify(location) : '请定位已安装的 Log Buddy 可执行入口。',
      '提供普通产品网址前，验证日志窗口已接入运行输出。产品继续在 Safari、内置浏览器或原窗口中测试。'
    ].join('\n');
  }
  const server = http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries({
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    })) res.setHeader(key, value);
    if (req.headers.host !== new URL(base).host || (req.headers.origin && req.headers.origin !== base))
      return json(res, 403, { error: '来源校验失败。' });
    const url = new URL(req.url, base), pathname = url.pathname;
    if (pathname.startsWith('/api/')) {
      const supplied = Buffer.from(req.headers['x-test-log-token'] || ''), expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        return json(res, 401, { error: '请重新打开日志助手。' });
      try {
        if (req.method === 'GET' && pathname === '/api/session') {
          if (Number(url.searchParams.get('revision')) === session.revision && url.searchParams.get('id') === session.id)
            return json(res, 200, { unchanged: true });
          return json(res, 200, { ...session.snapshot(), observerOnly: true });
        }
        if (req.method === 'GET' && pathname === '/api/sources')
          return json(res, 200, { sources: listSources(root) });
        if (req.method === 'GET' && pathname === '/api/logs') {
          const args=Object.fromEntries(url.searchParams);
          if(args.search?.length>4000)throw Error('搜索内容过长。');
          if(session.archive)return json(res,200,{...session.archive.window(args),sessionId:session.id});
          const before=Number(args.before)||Number.MAX_SAFE_INTEGER;
          const from=args.from?Number(args.from):-Number.MAX_VALUE,to=args.to?Number(args.to):Number.MAX_VALUE;
          const entries=session.entries.filter(e=>e.id<before&&e.at<=to&&e.endedAt>=from&&e.text.toLowerCase().includes((args.search||'').toLowerCase()));
          return json(res,200,{entries:entries.slice(-1000),hasOlder:entries.length>1000,before:entries.at(-1000)?.id||entries[0]?.id||null,sessionId:session.id});
        }
        if (req.method === 'GET' && pathname === '/api/setup-prompt')
          return json(res, 200, { text: setupPrompt() });
        if (req.method === 'GET' && pathname === '/api/integration')
          return json(res, 200, integrationStatus(options.integrationHome));
        if (req.method === 'POST' && pathname === '/api/install-integration')
          return json(res, 200, installIntegration(options.helperInvocation || [], options.integrationHome));
        if (req.method === 'POST' && pathname === '/api/connect-source') {
          const value = await body(req); automatic = false; return json(res, 200, connectSource(value.id));
        }
        if (req.method === 'POST' && pathname === '/api/focus-port') {
          const value=await body(req);
          if(!Number.isInteger(value.port)||value.port<1||value.port>65535)throw new Error('本机产品端口无效。');
          const matches=listSources(root).filter(x=>['starting','running','watching'].includes(x.status)&&
            Array.isArray(x.ports)&&x.ports.includes(value.port)&&
            (()=>{try{process.kill(x.collectorPid,0);return true;}catch{return false;}})());
          if(matches.length!==1)return json(res,200,{matched:false});
          const changed=session.sourceId!==matches[0].id;
          if(changed)connectSource(matches[0].id);
          return json(res,200,{matched:true,changed});
        }
        if (req.method === 'POST' && pathname === '/api/connect-file') {
          const value = await body(req); automatic = false; return json(res, 200, connectFile(value.file));
        }
        if (req.method === 'POST' && pathname === '/api/choose-log') {
          if (picking) throw new Error('选择窗口已经打开。');
          picking = true;
          try {
            const file = await (options.pickLog || pickLog)();
            return json(res, 200, file ? connectFile(file) : { cancelled: true });
          } finally { picking = false; }
        }
        if (req.method === 'POST' && ['/api/disconnect', '/api/stop'].includes(pathname)) {
          automatic = false; observation?.stop(); return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/marker')
          return json(res, 200, session.mark());
        if (req.method === 'POST' && pathname === '/api/preview') {
          const value = await body(req);
          if(value.sessionId&&value.sessionId!==session.id)throw Error('产品已切换，请先复制当前选中的日志或重新选择范围。');
          if (typeof value.note !== 'string' || value.note.length > 4000 || !Array.isArray(value.secrets) ||
              value.secrets.length > 100 || value.secrets.some(x => typeof x !== 'string' || x.length > 4096))
            throw new Error('描述或脱敏补充项过长。');
          return json(res, 200, session.preview(value));
        }
        if (req.method === 'POST' && ['/api/start', '/api/open-product'].includes(pathname))
          throw new Error('日志助手不启动或打开产品。请继续使用原来的 AI、网页或产品窗口。');
        if (req.method === 'POST' && pathname === '/api/demo')
          return json(res, 200, demoRecord());
        if (req.method === 'POST' && pathname === '/api/quit') {
          json(res, 200, { ok: true }); setTimeout(close, 50); return;
        }
        return json(res, 404, { error: '找不到该操作。' });
      } catch (error) { return json(res, 400, { error: error.message }); }
    }
    const assets = { '/': ['web/index.html','text/html'], '/app.js': ['web/app.js','text/javascript'], '/redactor.js':['lib/redactor-core.cjs','text/javascript'], '/style.css': ['web/style.css','text/css'] };
    if (req.method === 'GET' && assets[pathname]) {
      const [name, type] = assets[pathname];
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); res.end(asset(name)); return;
    }
    json(res, 404, { error: '找不到该页面。' });
  });
  server.on('connection', socket => { clients.add(socket); socket.once('close', () => clients.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port || 0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
  const url = base + '/#' + token;
  async function close() {
    if (closing) return; closing = true; clearInterval(autoTimer); observation?.stop();
    // Observation owns no product process. Closing the viewer only detaches readers.
    for (const socket of clients) socket.destroy();
    await new Promise(resolve => server.close(resolve)); options.onClose?.();
  }
  function autoRefresh() {
    if(closing || options.demo) return;
    const focus = focusedCapture(root);
    if(focus && focus.requestedAt > focusSeen) {
      try {
        if(session.sourceId !== focus.id) connectSource(focus.id);
        focusSeen = focus.requestedAt; automatic = true;
      } catch {}
      return;
    }
    if(!automatic || session.startedAt) return;
    const sources = listSources(root);
    const running = sources.filter(x => ['running','starting','watching'].includes(x.status) &&
      (!x.collectorPid || (()=>{try { process.kill(x.collectorPid,0); return true; } catch {return false;}})()));
    const candidates = running.length ? running.sort((a,b)=>b.startedAt-a.startedAt) : sources;
    if(candidates.length) try {connectSource(candidates[0].id);} catch {}
  }
  if(options.demo) demoRecord();
  else if(automatic) autoRefresh();
  const autoTimer=setInterval(autoRefresh,250);
  // Refresh only our own managed integration after moving/updating the app.
  if(options.helperInvocation?.length&&integrationStatus(options.integrationHome).installed)
    installIntegration(options.helperInvocation,options.integrationHome);
  if (options.openBrowser !== false) openUrl(url);
  return { server, base, url, token, close, connectSource, connectFile, get session() { return session; } };
}
module.exports = { createApp };
