const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
async function pickLog() {
  if (process.platform === 'darwin') {
    try {
      return (await exec('/usr/bin/osascript',
        ['-e', 'POSIX path of (choose file with prompt "选择产品已有的日志文件（.log、.txt、.jsonl、.out）")'],
        { timeout: 180000, maxBuffer: 8192 })).stdout.trim() || null;
    } catch (error) {
      if (String(error.stderr).includes('-128')) return null;
      throw new Error('未能打开选择窗口，你也可以填入日志文件的位置。');
    }
  }
  if (process.platform === 'win32') {
    const script = "Add-Type -AssemblyName System.Windows.Forms; $p = New-Object System.Windows.Forms.OpenFileDialog; $p.Filter='Log files|*.log;*.txt;*.jsonl;*.ndjson;*.out'; if ($p.ShowDialog() -eq 'OK') { $p.FileName }";
    try {
      return (await exec('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
        { timeout: 180000, maxBuffer: 8192 })).stdout.trim() || null;
    } catch { throw new Error('未能打开选择窗口，请填入日志位置。'); }
  }
  throw new Error('当前系统请填入日志文件的位置。');
}
module.exports = { pickLog };
