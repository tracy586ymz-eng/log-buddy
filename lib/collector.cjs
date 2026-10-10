const { spawn } = require('node:child_process');
const { Session } = require('./session.cjs');
const { capture } = require('./capture.cjs');
const { saveSession, defaultStore } = require('./store.cjs');
const { commandSpec, productEnv } = require('./process.cjs');
const { localPorts } = require('./automatic.cjs');

function collectProcess(config, options = {}) {
  const session = new Session(config);
  const root = options.store || defaultStore();
  const archive=require('./archive.cjs').createArchive(root,session);
  session.startedAt = Date.now();
  session.status = 'starting';
  if(Number.isInteger(options.port)&&options.port>0&&options.port<=65535)session.ports=[options.port];
  session.add('system', '本记录仅收集产品终端输出，产品仍在原来的网页或窗口中运行。');
  saveSession(root, session);
  const spec = commandSpec(config.command);
  const child = spawn(spec.executable, spec.args, { cwd: config.cwd, env: productEnv(),
    stdio: [options.stdin || 'inherit', 'pipe', 'pipe'], windowsHide: true,
    windowsVerbatimArguments: spec.verbatim });
  capture(child.stdout, 'stdout', session);
  capture(child.stderr, 'stderr', session);
  // Retain only loopback port numbers, never URL paths, queries or remote hosts.
  let addressTail='';
  function detectPorts(chunk) {
    const text=addressTail+chunk.toString('utf8');
    const ports=localPorts(text);
    for(const port of ports)if(session.ports.length<32&&!session.ports.includes(port)){session.ports.push(port);session.revision++;}
    addressTail=text.slice(-256);
  }
  child.stdout.on('data',detectPorts);child.stderr.on('data',detectPorts);
  // Keep original terminal output and private local history; redact only copies.
  if (options.output !== false) {
    child.stdout.on('data', data => process.stdout.write(data));
    child.stderr.on('data', data => process.stderr.write(data));
  }
  let saved = session.revision;
  const timer = setInterval(() => {
    if (saved !== session.revision) {
      saveSession(root, session); saved = session.revision;
    }
  }, 150);
  child.once('spawn', () => {
    session.status = 'running'; session.revision++;
    saveSession(root, session);
    options.onReady?.(session.id);
  });
  child.once('error', () => {
    session.status = 'failed';
    session.add('system', '产品未能启动，请检查原来的启动命令和依赖。');
  });
  const done = new Promise(resolve => child.once('close', (code, signal) => {
    clearInterval(timer);
    session.status = code === 0 ? 'stopped' : 'failed';
    session.exitCode = code;
    session.add('system', signal ? '产品已结束，信号：' + signal : '产品已结束，退出码：' + code);
    saveSession(root, session);
    archive.close();
    resolve({ code, signal });
  }));
  function signal(name) { if (child.exitCode === null) child.kill(name); }
  return { session, child, done, signal };
}
module.exports = { collectProcess };
