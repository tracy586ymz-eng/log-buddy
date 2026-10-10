const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { asset } = require('./assets.cjs');
function location(home = os.homedir()) { return path.join(home, '.agents', 'skills', 'customer-test-logs'); }
function integrationStatus(home) {
  const dir = location(home);
  try {
    const managed = JSON.parse(fs.readFileSync(path.join(dir, '.log-buddy-managed.json'), 'utf8'));
    return { installed: managed.product === 'test-log-buddy' && fs.existsSync(path.join(dir, 'SKILL.md')), version: managed.version };
  } catch { return { installed: false }; }
}
function installIntegration(invocation, home) {
  const dir = location(home), marker = path.join(dir, '.log-buddy-managed.json');
  if (fs.existsSync(dir) && !integrationStatus(home).installed)
    throw new Error('同名 Skill 已存在，未覆盖。请让 AI 检查后再安装。');
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  const text = asset('skills/customer-test-logs/SKILL.md').toString().replace('{{HELPER_INVOCATION}}', JSON.stringify(invocation));
  fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
  fs.writeFileSync(path.join(dir, 'agents/openai.yaml'), asset('skills/customer-test-logs/agents/openai.yaml'));
  fs.writeFileSync(marker, JSON.stringify({ product: 'test-log-buddy', version: '0.4.0' }));
  return { installed: true, version: '0.4.0' };
}
module.exports = { installIntegration, integrationStatus, location };
