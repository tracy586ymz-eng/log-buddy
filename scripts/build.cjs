const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {buildSync}=require('esbuild'),{inject}=require('postject');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist',process.platform+'-'+process.arch);
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
function run(program,args) {
  const result=spawnSync(program,args,{stdio:'inherit',cwd:root});
  if(result.error||result.status!==0)throw new Error('构建步骤失败：'+program);
}
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const bundled=path.join(out,'main.cjs');
  buildSync({entryPoints:[path.join(root,'bin/test-log-buddy.cjs')],bundle:true,platform:'node',target:'node22',format:'cjs',outfile:bundled,banner:{js:"// Test Log Buddy — MIT license"}});
  const assets={};
  for(const name of ['web/index.html','web/style.css','web/app.js','lib/redactor-core.cjs','skills/customer-test-logs/SKILL.md','skills/customer-test-logs/agents/openai.yaml'])assets[name]=path.join(root,name);
  const blob=path.join(out,'sea-prep.blob'), config=path.join(out,'sea-config.json');
  fs.writeFileSync(config,JSON.stringify({main:bundled,output:blob,disableExperimentalSEAWarning:true,useCodeCache:false,useSnapshot:false,assets}));
  run(process.execPath,['--experimental-sea-config',config]);
  const executable=path.join(out,process.platform==='win32'?'test-log-buddy.exe':'test-log-buddy');
  fs.copyFileSync(process.execPath,executable);fs.chmodSync(executable,0o755);
  if(process.platform==='darwin') {
    const architectures=spawnSync('lipo',['-archs',executable],{encoding:'utf8'}).stdout?.trim().split(/\s+/)||[];
    if(architectures.length>1) {
      const thin=executable+'.thin';
      run('lipo',[executable,'-thin',process.arch==='arm64'?'arm64':'x86_64','-output',thin]);
      fs.renameSync(thin,executable);
    }
  }
  if(process.platform==='darwin')run('codesign',['--remove-signature',executable]);
  await inject(executable,'NODE_SEA_BLOB',fs.readFileSync(blob),{sentinelFuse:'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',...(process.platform==='darwin'?{machoSegmentName:'NODE_SEA'}:{})});
  if(process.platform==='darwin') {
    run('codesign',['--sign','-',executable]);
    const app=path.join(out,'Log Buddy.app'),macos=path.join(app,'Contents','MacOS');
    fs.mkdirSync(macos,{recursive:true});fs.copyFileSync(executable,path.join(macos,'test-log-buddy'));
    run('swiftc',['-O','-framework','AppKit','-framework','WebKit',path.join(root,'native/LogBuddy.swift'),'-o',path.join(macos,'LogBuddy')]);
    const resources=path.join(app,'Contents','Resources');fs.mkdirSync(resources,{recursive:true});
    fs.copyFileSync(path.join(root,'LICENSE'),path.join(resources,'LICENSE'));
    fs.copyFileSync(path.join(root,'NODE-LICENSE'),path.join(resources,'NODE-LICENSE'));
    fs.writeFileSync(path.join(app,'Contents','Info.plist'),'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>Log Buddy</string><key>CFBundleDisplayName</key><string>Log Buddy</string><key>CFBundleIdentifier</key><string>local.testlogbuddy.app</string><key>CFBundleVersion</key><string>'+version+'</string><key>CFBundleShortVersionString</key><string>'+version+'</string><key>CFBundleExecutable</key><string>LogBuddy</string><key>CFBundlePackageType</key><string>APPL</string><key>NSAppleEventsUsageDescription</key><string>读取 Safari 当前标签页地址，匹配已接入的本机产品并自动显示测试日志。地址不保存、不上传；不读取网页内容或浏览历史。</string><key>NSHighResolutionCapable</key><true/><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>\n');
    run('codesign',['--force','--deep','--sign','-','--entitlements',path.join(root,'native/automation.entitlements.plist'),app]);
    fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE'));
    run('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,path.join(out,'Log-Buddy-mac-'+process.arch+'-v'+version+'.zip')]);
  }
  console.log('构建完成：'+executable);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
