const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createApp}=require('../lib/server.cjs'),{collectProcess}=require('../lib/collector.cjs');
const {defaultStore,listSources,readSession}=require('../lib/store.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'log-buddy-test-'));}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await sleep(30);}throw new Error('timed out');}
function requestWithHost(url,headers){return new Promise((resolve,reject)=>require('node:http').get(url,{headers},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));}
test('viewer connects after product starts; detach and close never stop that product',async()=>{
  const root=temp(),productDir=path.join(root,'product'),store=path.join(root,'records');
  fs.mkdirSync(productDir);fs.writeFileSync(path.join(productDir,'original.txt'),'original product');
  const collector=collectProcess({name:'Any product',cwd:productDir,command:[process.execPath,'-e','console.log("api_key=FAKE_PRODUCT_KEY");setInterval(()=>console.log("still running"),100);'],redact:[]},{store,output:false,stdin:'ignore'});
  let app;
  try{
    await until(()=>listSources(store).some(x=>x.status==='running'));
    app=await createApp({store,openBrowser:false});
    assert.equal(app.session.mode,'capture');
    await until(()=>app.session.entries.some(e=>e.text.includes('api_key=')));
    assert.ok(JSON.stringify(app.session.snapshot()).includes('FAKE_PRODUCT_KEY'));
    assert.ok(!app.session.preview({from:0,to:Date.now()+1000}).text.includes('FAKE_PRODUCT_KEY'));
    const headers={'X-Test-Log-Token':app.token,'Content-Type':'application/json'};
    await fetch(app.base+'/api/disconnect',{method:'POST',headers,body:'{}'});
    assert.doesNotThrow(()=>process.kill(collector.child.pid,0));
    app.connectSource(collector.session.id);await app.close();app=null;
    assert.doesNotThrow(()=>process.kill(collector.child.pid,0));
    assert.equal(collector.child.exitCode,null);
    assert.deepEqual(fs.readdirSync(productDir),['original.txt']);
    const saved=readSession(store,collector.session.id);
    assert.ok(saved.entries.length>0);assert.ok(JSON.stringify(saved).includes('FAKE_PRODUCT_KEY'));
    assert.equal(fs.statSync(path.join(store,collector.session.id+'.sqlite')).mode&0o777,0o600);
  }finally{
    await app?.close();collector.signal('SIGTERM');await collector.done;
    fs.rmSync(root,{recursive:true,force:true});
  }
});
test('two unrelated products can be selected without per-product setup files',async()=>{
  const root=temp(),store=path.join(root,'records');
  const a=collectProcess({name:'Product A',cwd:root,command:[process.execPath,'-e','console.log("Error: A");setInterval(()=>{},1000);'],redact:[]},{store,output:false,stdin:'ignore'});
  const b=collectProcess({name:'Product B',cwd:root,command:[process.execPath,'-e','console.log("Error: B");setInterval(()=>{},1000);'],redact:[]},{store,output:false,stdin:'ignore'});
  let app;
  try{
    await until(()=>listSources(store).filter(x=>x.status==='running').length===2);
    app=await createApp({store,openBrowser:false});assert.equal(app.session.status,'watching');
    app.connectSource(a.session.id);assert.equal(app.session.project,'Product A');
    app.connectSource(b.session.id);assert.equal(app.session.project,'Product B');
    await until(()=>app.session.entries.some(x=>x.text==='Error: B'));
    assert.ok(app.session.entries.some(x=>x.text==='Error: B'));
    assert.ok(!app.session.entries.some(x=>x.text==='Error: A'));
    assert.ok(!fs.existsSync(path.join(root,'test-logs.json')));
    assert.ok(!fs.existsSync(path.join(root,'.agents')));
  }finally{await app?.close();a.signal('SIGTERM');b.signal('SIGTERM');await Promise.all([a.done,b.done]);fs.rmSync(root,{recursive:true,force:true});}
});
test('completed product capture remains readable when viewer opens later',async()=>{
  const root=temp();
  try{
    const collector=collectProcess({name:'Finished',cwd:root,command:[process.execPath,'-e','console.error("Error: finished\\n    at original.js:7");process.exitCode=7;'],redact:[]},{store:root,output:false,stdin:'ignore'});
    assert.equal((await collector.done).code,7);
    const app=await createApp({store:root,openBrowser:false});
    try{const preview=app.session.preview({from:0,to:Date.now()+1000,note:'',secrets:[]});
      assert.match(preview.text,/original.js:7/);assert.match(preview.text,/退出码 7/);
    }finally{await app.close();}
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('existing file is read-only, includes ISO history and follows appended output',async()=>{
  const root=temp(),file=path.join(root,'runtime.log');
  const iso=new Date(Date.now()-600000).toISOString();
  const original=iso+' Error: old failure api_key=FAKE_FILE_SECRET\n    at app.js:42\n';
  fs.writeFileSync(file,original);
  const app=await createApp({store:path.join(root,'empty'),openBrowser:false,autoConnect:false});
  try{
    app.connectFile(file);
    await until(()=>app.session.entries.some(x=>x.text.includes('old failure')));
    assert.equal(fs.readFileSync(file,'utf8'),original);
    const preview=app.session.preview({from:Date.parse(iso)-1,to:Date.parse(iso)+1,note:'',secrets:[]});
    assert.match(preview.text,/app.js:42/);assert.ok(!preview.text.includes('FAKE_FILE_SECRET'));
    assert.equal(app.session.snapshot().earliestAt,Date.parse(iso));
    fs.appendFileSync(file,'Error: appended\n');
    await until(()=>app.session.entries.some(x=>x.text==='Error: appended'));
    assert.equal(fs.readFileSync(file,'utf8'),original+'Error: appended\n');
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('file rotation and truncation are followed without changing files',async()=>{
  const root=temp(),file=path.join(root,'runtime.log');fs.writeFileSync(file,'before rotation\n');
  const app=await createApp({store:path.join(root,'empty'),openBrowser:false,autoConnect:false});
  try{
    app.connectFile(file);await until(()=>app.session.entries.some(x=>x.text==='before rotation'));
    fs.renameSync(file,file+'.old');fs.writeFileSync(file,'after rotation\n');
    await until(()=>app.session.entries.some(x=>x.text==='after rotation'));
    fs.writeFileSync(file,'short\n');await until(()=>app.session.entries.some(x=>x.text==='short'));
    assert.equal(fs.readFileSync(file,'utf8'),'short\n');assert.equal(fs.readFileSync(file+'.old','utf8'),'before rotation\n');
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('viewer cannot launch a product and protects all log APIs',async()=>{
  const root=temp(),app=await createApp({store:root,openBrowser:false,autoConnect:false});
  const headers={'X-Test-Log-Token':app.token,'Content-Type':'application/json'};
  try{
    assert.equal((await fetch(app.base+'/api/sources')).status,401);
    assert.equal((await fetch(app.base+'/api/session',{headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
    assert.equal(await requestWithHost(app.base+'/api/session',{...headers,Host:'evil.invalid'}),403);
    const flag=path.join(root,'should-never-exist');
    const response=await fetch(app.base+'/api/start',{method:'POST',headers,body:JSON.stringify({config:{command:[process.execPath,'-e','require("node:fs").writeFileSync('+JSON.stringify(flag)+',"bad")']}})});
    assert.equal(response.status,400);assert.ok(!fs.existsSync(flag));
    assert.equal((await fetch(app.base+'/api/open-product',{method:'POST',headers,body:'{}'})).status,400);
    const setup=await (await fetch(app.base+'/api/setup-prompt',{headers})).json();
    assert.ok(setup.text.includes('无法补回历史'));assert.ok(setup.text.includes('原来的 AI/终端流程'));
    assert.throws(()=>app.connectSource('../outside'),/请选择列表/);
    assert.throws(()=>app.connectFile(path.join(root,'.env')),/请选择/);
    const html=await (await fetch(app.base+'/')).text();assert.ok(html.includes('等待 AI 启动你的产品'));
    assert.ok(!html.includes('id="connect-source"'));
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('native file selection cancellation does not disconnect the current source',async()=>{
  const root=temp(),app=await createApp({store:root,openBrowser:false,pickLog:async()=>null});
  try{
    const headers={'X-Test-Log-Token':app.token,'Content-Type':'application/json'};
    await fetch(app.base+'/api/demo',{method:'POST',headers,body:'{}'});const before=app.session.id;
    const result=await (await fetch(app.base+'/api/choose-log',{method:'POST',headers,body:'{}'})).json();
    assert.equal(result.cancelled,true);assert.equal(app.session.id,before);
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
