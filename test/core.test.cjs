const {test}=require('node:test'),assert=require('node:assert/strict'),{PassThrough}=require('node:stream');
const {createRedactor}=require('../lib/redact.cjs'),{capture}=require('../lib/capture.cjs'),{Session}=require('../lib/session.cjs');
test('redaction hides secrets, quoted whitespace, identities and URL credentials; idempotent',()=>{
  const r=createRedactor(['业务订单-123']);
  const raw='{"password":"FAKE hello \\"escaped\\" world","api_key":"FAKE_abcdef-secret"}\napi_key=FAKE_abcdef-secret\nuser=person@example.invalid 192.0.2.45 /Users/privateuser/app C:\\Users\\privateuser\\app https://alice:pass@localhost/x?token=FAKE_abcdef-secret 业务订单-123\nAuthorization: Bearer FAKE_abcdef-secret\nCookie: session=top-secret; user=alice';
  const text=r.redact(raw);
  for(const value of ['FAKE_abcdef-secret','hello','privateuser','person@example','192.0.2.45','alice:pass','top-secret','业务订单-123'])assert.ok(!text.includes(value),value);
  assert.equal(r.redact(text),text);
  assert.match(text,/"api_key":"\[SECRET_\d+\]"/);
  const quoted=text.match(/"api_key":"(\[SECRET_\d+\])"/)[1];
  assert.ok(text.includes('api_key='+quoted));
  assert.equal(r.redact('token=same secret=same Authorization: Bearer same').match(/\[SECRET_\d+\]/g).every((v,i,a)=>v===a[0]),true);
  assert.ok(!r.redact('address=[2001:db8::1] mapped=::ffff:192.0.2.1').includes('2001:db8'));
  assert.ok(!r.redact('address=[2001:db8::1] mapped=::ffff:192.0.2.1').includes('::ffff'));
  const phrase=r.redact('password=FAKE long SECRET phrase duration=123\napi_key=FAKE_Independent A_SECRET');
  for(const fragment of ['FAKE','long SECRET','A_SECRET'])assert.ok(!phrase.includes(fragment));
  assert.ok(phrase.includes('duration=123'));assert.equal(r.redact(phrase),phrase);
});
test('UTF8 chunks preserve originals; split credentials and PEM are redacted only in the copy',async()=>{
  const stream=new PassThrough(),s=new Session();
  capture(stream,'stdout',s);
  const data=Buffer.from('中文测试 api_key=split_FAKE_secret\n-----BEGIN PRIVATE KEY-----\nVERY_FAKE_PRIVATE_CONTENT\n-----END PRIVATE KEY-----\n正常\n');
  for(let i=0;i<data.length;i+=3)stream.write(data.subarray(i,i+3));stream.end();
  await new Promise(r=>setImmediate(r));
  const text=s.entries.map(x=>x.text).join('\n');
  assert.ok(text.includes('中文测试'));assert.ok(text.includes('split_FAKE_secret'));assert.ok(text.includes('VERY_FAKE_PRIVATE_CONTENT'));assert.ok(text.includes('正常'));
  const copy=s.preview({from:0,to:Date.now()+1000}).text;
  assert.ok(!copy.includes('split_FAKE_secret'));assert.ok(!copy.includes('VERY_FAKE_PRIVATE_CONTENT'));
  assert.equal(s.entries.map(x=>x.text).join('\n'),text);
});
test('oversize unterminated secret lines are omitted entirely',async()=>{
  const stream=new PassThrough(),s=new Session();capture(stream,'stderr',s);
  stream.write('token='+('s'.repeat(70000)));stream.end('suffix_secret\nError: still useful\n');
  await new Promise(r=>setImmediate(r));
  assert.ok(s.entries.some(e=>e.text.includes('Error: still useful')));
  assert.ok(!s.entries.some(e=>e.text.includes('suffix_secret')));
});
test('time selection retains the whole stack across a boundary and excludes unrelated records',()=>{
  const s=new Session();s.add('stderr','Error: something broke',1000);s.add('stderr','    at submit (app.js:4)',1100);s.add('stdout','later unrelated',3000);
  const preview=s.preview({from:1050,to:1150,note:'my email x@example.invalid'});
  assert.equal(preview.count,1);assert.ok(preview.text.includes('Error:'));assert.ok(preview.text.includes('at submit'));
  assert.ok(!preview.text.includes('later unrelated'));assert.ok(!preview.text.includes('x@example.invalid'));
});
test('bounded memory reports removed records and empty ranges honestly',()=>{
  const s=new Session({}, {maxEntries:2,maxBytes:100});
  s.add('stdout','a',1000);s.add('stdout','b',2000);s.add('stdout','c',3000);
  assert.equal(s.dropped,1);assert.equal(s.entries.length,2);
  assert.match(s.preview({from:0,to:100}).text,/没有终端输出/);
  assert.match(s.preview({from:0,to:5000}).text,/被淘汰/);
});
