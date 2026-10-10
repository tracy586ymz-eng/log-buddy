const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {Session}=require('../lib/session.cjs'),{createArchive,readArchive}=require('../lib/archive.cjs');
const {saveSession}=require('../lib/store.cjs'),{createApp}=require('../lib/server.cjs');
const {createRedactor}=require('../lib/redact.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'buddy-history-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('full local history survives eviction, exit and reopen; search and copy reach early logs beyond an hour',async()=>{
  const root=temp(),session=new Session({name:'History fixture'}),archive=createArchive(root,session);
  const start=Date.now()-7200000;session.startedAt=start;session.status='stopped';
  let app;
  try{
    for(let i=0;i<20000;i++)session.add('stdout',i===3?'Error: EARLY_FAILURE api_key=FAKE_OLD_KEY':`row ${i} ${'x'.repeat(320)}`,start+i*360);
    session.add('stderr','Error: final failure',Date.now());session.add('stderr','    at useful.js:42',Date.now());
    assert.equal(session.entries.length,1000);assert.equal(session.dropped,0);assert.equal(session.totalEntries,20001);
    saveSession(root,session);archive.close();
    assert.ok(session.preview({from:start,to:start+2000}).text.includes('EARLY_FAILURE'));
    const reader=readArchive(root,session.id);try{
      let page=reader.window(),count=page.entries.length;
      assert.equal(page.entries.length,1000);assert.equal(page.hasOlder,true);
      while(page.hasOlder){page=reader.window({before:page.before});count+=page.entries.length;}
      assert.equal(count,20001);
    }finally{reader.close();}
    app=await createApp({store:root,openBrowser:false});
    const headers={'X-Test-Log-Token':app.token,'Content-Type':'application/json'};
    const found=await (await fetch(app.base+'/api/logs?search=EARLY_FAILURE',{headers})).json();
    assert.equal(found.entries.length,1);assert.ok(found.entries[0].text.includes('FAKE_OLD_KEY'));
    const copy=app.session.preview({from:start,to:start+2000}).text;
    assert.ok(copy.includes('EARLY_FAILURE'));assert.ok(!copy.includes('FAKE_OLD_KEY'));assert.ok(!copy.includes('row 19999'));
    assert.ok(app.session.preview({from:Date.now()-1000,to:Date.now()+1000}).text.includes('useful.js:42'));
    assert.equal((await fetch(app.base+'/api/logs')).status,401);
    assert.equal((await fetch(app.base+'/api/preview',{method:'POST',headers,body:JSON.stringify({sessionId:'different-product',from:0,to:Date.now(),note:'',secrets:[]})})).status,400);
    assert.equal(fs.statSync(path.join(root,session.id+'.sqlite')).mode&0o777,0o600);
  }finally{await app?.close();archive.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('bulk selected text uses surrounding raw context, including a keyless credential and PEM body; browser and server agree',()=>{
  const browser={URL};vm.createContext(browser);vm.runInContext(fs.readFileSync(path.join(__dirname,'../lib/redactor-core.cjs'),'utf8'),browser);
  const original='api_key=FAKE_KEY_WITHOUT_LABEL\n-----BEGIN PRIVATE KEY-----\nFAKE_PEM_BODY_ONLY\n-----END PRIVATE KEY-----\n'+Array.from({length:1500},(_,i)=>`Error ${i}: 中文堆栈 user=person@example.invalid ip=192.0.2.12`).join('\n');
  const selection='FAKE_KEY_WITHOUT_LABEL\nFAKE_PEM_BODY_ONLY\n'+original.slice(original.indexOf('Error 0'));
  function copy(factory){const r=factory(['订单隐私']);r.learn(original);return r.selection(selection);}
  const safe=copy(createRedactor),client=copy(browser.LogBuddyRedaction.createRedactor);
  assert.equal(safe,client);
  for(const value of ['FAKE_KEY_WITHOUT_LABEL','FAKE_PEM_BODY_ONLY','person@example.invalid','192.0.2.12'])assert.ok(!safe.includes(value),value);
  assert.match(safe,/Error 1499: 中文堆栈/);assert.equal(createRedactor().selection(safe),safe);
  assert.ok(original.includes('FAKE_KEY_WITHOUT_LABEL'));
});
test('existing file imports all history beyond 1 MiB, keeps original untouched and continues reading',async()=>{
  const root=temp(),file=path.join(root,'product.log'),start=Date.now()-3600000;
  const original=Array.from({length:5000},(_,i)=>new Date(start+i*500).toISOString()+` row ${i} `+'x'.repeat(300)).join('\n')+'\n';
  fs.writeFileSync(file,original);const app=await createApp({store:path.join(root,'records'),openBrowser:false,autoConnect:false});
  try{
    app.connectFile(file);
    for(let i=0;i<150&&app.session.totalEntries<5001;i++)await sleep(20);
    assert.equal(app.session.totalEntries,5001);assert.equal(app.session.entries.length,1000);
    assert.match(app.session.preview({from:start,to:start+1}).text,/row 0/);
    const reader=readArchive(path.join(root,'records'),app.session.id);try{
      for(let i=0;i<20&&!reader.window({search:'row 0 '}).entries.length;i++)await sleep(20);
      assert.equal(reader.window({search:'row 0 '}).entries.length,1);
    }finally{reader.close();}
    fs.appendFileSync(file,'Error: fresh api_key=FAKE_FRESH_KEY\n');
    for(let i=0;i<100&&app.session.totalEntries<5002;i++)await sleep(20);
    assert.equal(app.session.totalEntries,5002);
    assert.ok(!app.session.preview({from:0,to:Date.now()+1000}).text.includes('FAKE_FRESH_KEY'));
    assert.equal(fs.readFileSync(file,'utf8'),original+'Error: fresh api_key=FAKE_FRESH_KEY\n');
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('stopping a file reader saves an unterminated final line before closing its archive',async()=>{
  const root=temp(),file=path.join(root,'tail.log');fs.writeFileSync(file,'Error: last line api_key=FAKE_TAIL_KEY');
  const app=await createApp({store:path.join(root,'records'),openBrowser:false,autoConnect:false});
  try{
    app.connectFile(file);const session=app.session;await app.close();await sleep(10);
    const reader=readArchive(path.join(root,'records'),session.id);try{
      assert.equal(reader.window({search:'last line'}).entries.length,1);
      const copy=session.preview({from:0,to:Date.now()+1000}).text;
      assert.ok(copy.includes('last line'));assert.ok(!copy.includes('FAKE_TAIL_KEY'));
    }finally{reader.close();}
    assert.equal(fs.readFileSync(file,'utf8'),'Error: last line api_key=FAKE_TAIL_KEY');
  }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
