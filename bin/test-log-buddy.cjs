#!/usr/bin/env node
const path=require('node:path'),sea=require('node:sea');
const {createApp}=require('../lib/server.cjs');
const {validateConfig,loadConfig}=require('../lib/config.cjs');
const {collectProcess}=require('../lib/collector.cjs');
const {listSources,defaultStore,saveSession}=require('../lib/store.cjs');
const {focusCapture,presentViewer}=require('../lib/automatic.cjs');
const {installIntegration}=require('../lib/integration.cjs');
function parse(argv) {
  const flags={},command=[];
  let mode=argv[0]&&!argv[0].startsWith('-')?argv.shift():'view';
  while(argv.length) {
    const key=argv.shift();
    if(key==='--'){command.push(...argv);break;}
    if(key==='--no-open')flags['no-open']=true;
    else if(['--config','--cwd','--name','--port','--store','--file','--id'].includes(key)) {
      if(!argv.length)throw new Error('参数缺少值：'+key);
      flags[key.slice(2)]=argv.shift();
    }else if(key==='--help'||key==='-h')mode='help';
    else throw new Error('未知参数：'+key);
  }
  return {mode,flags,command};
}
function invocation() {return sea.isSea()?[process.execPath]:[process.execPath,path.resolve(__filename)];}
function demoProduct(port) {
  const http=require('node:http');
  console.log('产品正在启动……');
  console.log('demo only: api_key=sk-demo_FAKE_1234567890123456');
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.url==='/checkout') {
      console.log('POST /checkout customer=sample@example.invalid ip=192.0.2.25');
      console.error('Error: 支付服务未连接，订单提交失败');
      console.error('    at submitOrder (checkout.js:42:9)');
      console.error('    at handleCheckout (server.js:18:3)');
      console.log('Authorization: Bearer demo_FAKE_TOKEN_123456');
      res.end('<h1>订单提交失败</h1><p>这是用于体验日志窗口的模拟故障。</p><a href="/">返回产品</a>');return;
    }
    console.log('GET / 浏览产品');
    res.end('<!doctype html><meta charset="utf-8"><title>小店订单 · 演示</title><style>body{font:20px system-ui;max-width:640px;margin:100px auto;background:#f6f5ef;color:#26382d}a{display:inline-block;padding:16px 28px;background:#276548;color:white;border-radius:12px;text-decoration:none}</style><h1>小店订单</h1><p>这是一个本地演示产品。点击提交订单，会产生一段带堆栈和模拟秘密的错误日志。</p><a href="/checkout">提交订单 · 触发模拟故障</a>');
  });
  server.listen(port,'127.0.0.1',()=>console.log('产品已就绪：端口 '+port));
}
async function main(argv=process.argv.slice(2)) {
  const {mode,flags,command}=parse([...argv]);
  if(mode==='help') {
    console.log('Log Buddy 0.4.0\nview：独立日志窗口\ncollect --cwd <project> --name <product> -- <original-program> <args>：采集并自动打开窗口\nwatch --file <existing-log>：只读跟随已有日志并自动打开窗口\nintegrate：个人安装一次共享采集 Skill\n--no-open：仅采集，不打开窗口\ndemo：仅展示演示日志，不启动产品');return;
  }
  if(mode==='demo-product'){demoProduct(Number(flags.port));return;}
  if(mode==='sources'){console.log(JSON.stringify(listSources(flags.store),null,2));return;}
  if(mode==='integrate'){console.log(JSON.stringify(installIntegration(invocation())));return;}
  const ready=id=>{
    focusCapture(flags.store||defaultStore(),id);
    if(!flags['no-open'])presentViewer(invocation(),flags.store||defaultStore());
  };
  if(mode==='show') {
    if(!listSources(flags.store).some(x=>x.id===flags.id))throw new Error('没有找到这份产品记录。');
    ready(flags.id);return;
  }
  if(mode==='watch') {
    if(!flags.file)throw new Error('请由 AI 指定现有产品日志。');
    const observation=require('../lib/follow.cjs').followLog(flags.file,{onSession:session=>require('../lib/archive.cjs').createArchive(flags.store||defaultStore(),session)});
    if(flags.port)observation.session.ports=[Number(flags.port)].filter(x=>Number.isInteger(x)&&x>0&&x<=65535);
    if(flags.name)observation.session.project=flags.name;
    const root=flags.store||defaultStore();saveSession(root,observation.session);ready(observation.session.id);
    const timer=setInterval(()=>saveSession(root,observation.session),150);
    const stop=()=>{clearInterval(timer);observation.stop();saveSession(root,observation.session);observation.session.archive?.close();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);return;
  }
  if(mode==='collect'||mode==='run') {
    const config=flags.config?loadConfig(flags.config):validateConfig({command,cwd:flags.cwd||'.',name:flags.name});
    const collector=collectProcess(config,{store:flags.store,onReady:ready,port:Number(flags.port)});
    process.on('SIGINT',()=>collector.signal('SIGINT'));
    process.on('SIGTERM',()=>collector.signal('SIGTERM'));
    const result=await collector.done;
    process.exitCode=Number.isInteger(result.code)?result.code:1;
    return;
  }
  if(mode==='init')throw new Error('新版无需给每个产品生成专用入口。请使用共享 Skill 接入原启动流程，或直接在日志助手中查看已有日志。');
  if(!['view','demo','service'].includes(mode))throw new Error('未知操作：'+mode);
  const app=await createApp({openBrowser:mode!=='service'&&!flags['no-open'],store:flags.store,demo:mode==='demo',helperInvocation:invocation()});
  if(mode==='service'){process.stdout.write(JSON.stringify({event:'ready',url:app.url})+'\n');}
  else {
  console.log('日志助手已打开，产品继续在原来的网页或窗口中运行。');
  if(flags['no-open'])console.log(app.url);
  }
  const close=()=>app.close();
  process.on('SIGINT',close);process.on('SIGTERM',close);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main,parse,invocation};
