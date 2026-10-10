const { StringDecoder } = require('node:string_decoder');
function capture(stream, source, session) {
  const decoder = new StringDecoder('utf8');
  let buffer='', dropping=false,finished=false;
  const limit=64*1024;
  function line(text) {
    text=text.replace(/\r$/, '');
    session.add(source,text);
  }
  function ingest(chunk) {
    buffer+=chunk; let index;
    while((index=buffer.indexOf('\n'))!==-1) {
      const text=buffer.slice(0,index); buffer=buffer.slice(index+1);
      if(!dropping) {
        if(text.length>limit) session.add('system','一行输出过长，已省略该行以避免占用过多内存。');
        else line(text);
      }
      dropping=false;
    }
    if(buffer.length>limit) {
      if(!dropping) session.add('system','一行输出过长，已省略该行以避免占用过多内存。');
      buffer=''; dropping=true;
    }
  }
  function finish(){if(finished)return;ingest(decoder.end());if(buffer&&!dropping)line(buffer);buffer='';finished=true;}
  stream.on('data',data=>{if(!finished)ingest(decoder.write(data));});
  stream.on('end',finish);
  return finish;
}
module.exports={capture};
