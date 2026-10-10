const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createApp}=require('../lib/server.cjs');
const {collectProcess}=require('../lib/collector.cjs');
const {focusCapture}=require('../lib/automatic.cjs');
const {localPorts}=require('../lib/automatic.cjs');
const {followLog}=require('../lib/follow.cjs');
const {saveSession}=require('../lib/store.cjs');
const {installIntegration,integrationStatus,location}=require('../lib/integration.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<80;i++){if(fn())return;await sleep(25);}throw Error('timed out');}
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'log-buddy-auto-'));}
function product(root,name){return collectProcess({name,cwd:root,command:[process.execPath,'-e','console.log("Error: '+name+' api_key=FAKE_SECRET");setInterval(()=>{},1000)'],redact:[]},{store:root,output:false,stdin:'ignore',onReady:id=>focusCapture(root,id)});}
test('already-open viewer follows new product immediately without selecting logs; focus switches isolate products',async()=>{
  const root=temp(),app=await createApp({store:root,openBrowser:false});let a,b;
  try{
    a=product(root,'First');const start=Date.now();
    await until(()=>app.session.entries.some(e=>e.text.includes('Error: First')));
    assert.ok(Date.now()-start<1100);
    const old=app.session.sourceId;b=product(root,'Second');
    await until(()=>app.session.entries.some(e=>e.text.includes('Error: Second')));
    assert.notEqual(app.session.sourceId,old);
    assert.ok(!app.session.entries.some(e=>e.text.includes('Error: First')));
    assert.ok(JSON.stringify(app.session.snapshot()).includes('FAKE_SECRET'));
    assert.ok(!app.session.preview({from:0,to:Date.now()+1000}).text.includes('FAKE_SECRET'));
    await app.close();assert.equal(a.child.exitCode,null);assert.equal(b.child.exitCode,null);
  }finally{await app.close();a?.signal('SIGTERM');b?.signal('SIGTERM');await Promise.all([a?.done,b?.done]);fs.rmSync(root,{recursive:true,force:true});}
});
test('AI-prepared existing file retains file rows, event time, and redaction in automatically selected record',async()=>{
  const root=temp(),file=path.join(root,'product.log'),store=path.join(root,'captures');
  const iso='2026-10-09T08:00:00+08:00';fs.writeFileSync(file,iso+' Error: file api_key=FILE_SECRET\n    at product.js:9\n');
  const follower=followLog(file);saveSession(store,follower.session);focusCapture(store,follower.session.id);
  const app=await createApp({store,openBrowser:false});
  try{
    const text=app.session.preview({from:Date.parse(iso)-1,to:Date.parse(iso)+1,note:'',secrets:[]}).text;
    assert.match(text,/product.js:9/);assert.ok(!text.includes('FILE_SECRET'));
    assert.equal(app.session.timeBasis,'explicit-iso-or-read');
    fs.appendFileSync(file,'Error: appended\n');await until(()=>follower.session.entries.some(x=>x.text==='Error: appended'));
    saveSession(store,follower.session);await until(()=>app.session.entries.some(x=>x.text==='Error: appended'));
  }finally{await app.close();follower.stop();fs.rmSync(root,{recursive:true,force:true});}
});
test('one-time integration is user-scoped, resolves helper path, and refuses unrelated skill overwrite',()=>{
  const home=temp();try{
    const argv=['/Applications/Log Buddy.app/Contents/MacOS/test-log-buddy'];
    assert.equal(integrationStatus(home).installed,false);installIntegration(argv,home);
    assert.equal(integrationStatus(home).installed,true);
    const skill=fs.readFileSync(path.join(location(home),'SKILL.md'),'utf8');
    assert.ok(skill.includes(JSON.stringify(argv)));assert.ok(!skill.includes('{{HELPER_INVOCATION}}'));
    fs.unlinkSync(path.join(location(home),'.log-buddy-managed.json'));
    assert.throws(()=>installIntegration(argv,home),/未覆盖/);
    assert.equal(fs.readFileSync(path.join(location(home),'SKILL.md'),'utf8'),skill);
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('browser matching uses only verified loopback ports, never remote URLs, partial numbers or query secrets',async()=>{
  assert.deepEqual(localPorts('http://localhost:3000/?token=HIDDEN http://127.0.0.1:4321/ https://example.com:9000/ http://localhost:3'),[3000,4321]);
  assert.deepEqual(localPorts('http://localhost:123456/ http://127.0.0.1:0/'),[]);
  const root=temp();let a,b;
  const app=await createApp({store:root,openBrowser:false});
  const headers={'X-Test-Log-Token':app.token,'Content-Type':'application/json'};
  const focus=async port=>(await (await fetch(app.base+'/api/focus-port',{method:'POST',headers,body:JSON.stringify({port})})).json());
  try{
    a=collectProcess({name:'Mapped',cwd:root,command:[process.execPath,'-e','console.log("http://localhost:4321/?token=FAKE_QUERY_SECRET");setInterval(()=>{},1000)'],redact:[]},{store:root,output:false,stdin:'ignore'});
    await until(()=>a.session.ports.includes(4321));await sleep(180);
    const match=await focus(4321);assert.equal(match.matched,true);assert.equal(app.session.project,'Mapped');
    assert.ok(!JSON.stringify(require('../lib/store.cjs').listSources(root)).includes('FAKE_QUERY_SECRET'));
    const id=app.session.id;assert.equal((await focus(9999)).matched,false);assert.equal(app.session.id,id);
    b=collectProcess({name:'Ambiguous',cwd:root,command:[process.execPath,'-e','setInterval(()=>{},1000)'],redact:[]},{store:root,output:false,stdin:'ignore',port:4321});
    await until(()=>b.session.status==='running');assert.equal((await focus(4321)).matched,false);
    assert.equal((await fetch(app.base+'/api/focus-port',{method:'POST',body:'{"port":4321}'})).status,401);
  }finally{await app.close();a?.signal('SIGTERM');b?.signal('SIGTERM');await Promise.all([a?.done,b?.done]);fs.rmSync(root,{recursive:true,force:true});}
});
