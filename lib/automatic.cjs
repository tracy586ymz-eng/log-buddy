const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { defaultStore, storeDir, atomicWrite, validId } = require('./store.cjs');

function focusCapture(root, id) {
  if (!validId(id)) throw new Error('日志标识无效。');
  atomicWrite(path.join(storeDir(root), 'focus.json'), { id, requestedAt: Date.now() });
}
function focusedCapture(root = defaultStore()) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'focus.json'), 'utf8'));
    return validId(value.id) && Number.isFinite(value.requestedAt) ? value : null;
  } catch { return null; }
}
function presentViewer(invocation, root = defaultStore()) {
  const executable = invocation[0];
  const bundle = path.resolve(executable, '../../..');
  let child;
  if (process.platform === 'darwin' && bundle.endsWith('.app') && fs.existsSync(path.join(bundle, 'Contents/Info.plist'))) {
    // LaunchServices reopens the same native application; never open the product.
    child = spawn('/usr/bin/open', ['-a', bundle], { stdio: 'ignore' });
  } else {
    child = spawn(executable, [...invocation.slice(1), 'view', '--store', root], { detached: true, stdio: 'ignore' });
  }
  child.on('error', () => {}); child.unref();
}
module.exports = { focusCapture, focusedCapture, presentViewer };
function localPorts(text) {
  const ports = new Set();
  const expression = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{1,5})(?=[\s/\x1b])/g;
  for(const match of text.matchAll(expression)) {
    const port=Number(match[1]);if(port>0&&port<=65535)ports.add(port);
  }
  return [...ports];
}
module.exports.localPorts=localPorts;
