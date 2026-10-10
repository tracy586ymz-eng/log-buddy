const fs=require('node:fs'), path=require('node:path');
function validateConfig(value,base=process.cwd(),imported=false) {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('配置应为 JSON 对象。');
  const command=value.command;
  if(!Array.isArray(command)||!command.length||command.length>100||
    command.some(x=>typeof x!=='string'||x.includes('\0')||x.length>8192)||!command[0])
    throw new Error('启动命令应为非空字符串数组，例如 ["npm","run","dev"]。');
  if(value.cwd!==undefined&&typeof value.cwd!=='string') throw new Error('工作目录格式不正确。');
  const cwd=imported?value.projectPath:path.resolve(base,value.cwd||'.');
  if(typeof cwd!=='string'||!path.isAbsolute(cwd)) throw new Error('请让 AI 重新生成含 projectPath 的本机配置，或从项目测试入口启动。');
  if(!fs.statSync(cwd,{throwIfNoEntry:false})?.isDirectory()) throw new Error('产品目录不存在；迁移后请让 AI 重新接入。');
  if(value.url) {
    const url=new URL(value.url);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||
      !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('首版仅支持无账号凭据的本地产品网址。');
  }
  const redact=value.redact||[];
  if(!Array.isArray(redact)||redact.length>100||redact.some(x=>typeof x!=='string'||x.length>4096)) throw new Error('脱敏补充项格式不正确。');
  return {name:String(value.name||path.basename(cwd)).slice(0,200),command:[...command],cwd,url:value.url||null,redact};
}
function loadConfig(file) {
  const full=path.resolve(file);
  return validateConfig(JSON.parse(fs.readFileSync(full,'utf8')),path.dirname(full));
}
module.exports={loadConfig,validateConfig};
