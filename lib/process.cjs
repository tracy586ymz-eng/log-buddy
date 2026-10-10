const {spawn}=require('node:child_process');
function productEnv() {
  const env={...process.env};
  if(process.platform==='darwin') env.PATH=[env.PATH,'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin'].filter(Boolean).join(':');
  return env;
}
function commandSpec(command) {
  let executable=command[0],args=command.slice(1),verbatim=false;
  if(process.platform==='win32'&&(/(?:^|[\\/])(?:npm|npx|pnpm|yarn)(?:\.cmd)?$/i.test(executable)||/\.(?:cmd|bat)$/i.test(executable))) {
    if(command.some(x=>/[&|<>^%!()\r\n"]/.test(x))) throw new Error('启动参数含暂不支持的 Windows 特殊字符，请使用原产品的直接可执行入口。');
    args=['/d','/s','/c','"'+command.map(x=>'"'+x+'"').join(' ')+'"'];
    executable=process.env.ComSpec||'cmd.exe';verbatim=true;
  }
  return {executable,args,verbatim};
}
function openUrl(url) {
  const [cmd,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:['xdg-open',[url]];
  const child=spawn(cmd,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}

module.exports={openUrl,commandSpec,productEnv};
