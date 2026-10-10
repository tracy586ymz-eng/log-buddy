const fs=require('node:fs'), path=require('node:path'), sea=require('node:sea');
function asset(name) { return sea.isSea()?sea.getAsset(name,'utf8'):fs.readFileSync(path.join(__dirname,'..',name),'utf8'); }
module.exports={asset};
