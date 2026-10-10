(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LogBuddyRedaction=factory();})(globalThis,function(){
function createRedactor(literals = [], literalKind = 'SECRET') {
  const labels = new Map(), counts = {}, known = new Map();
  function label(value, kind = 'SECRET') {
    if (!value || /^\[[A-Z]+_\d+\]$/.test(value)) return value;
    const digest = kind + '\0' + value;
    if (!labels.has(digest)) labels.set(digest, '[' + kind + '_' + (counts[kind] = (counts[kind] || 0) + 1) + ']');
    known.set(value, { kind, value, replacement: labels.get(digest) });
    return labels.get(digest);
  }
  function redact(input) {
    let text = String(input).replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g, '');
    text = text.replace(/^[A-Za-z0-9+/=]{40,}$/gm, v => label(v,'ENCODEDDATA'));
    for (const value of [...literals].filter(Boolean).sort((a,b) => b.length-a.length)) text = text.split(value).join(label(value,literalKind));
    text = text.replace(/-----BEGIN [^\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^\n]*PRIVATE KEY-----|$)/g, v => label(v, 'PRIVATEKEY'));
    text = text.replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, (_,p,u,v) => p+label(u,'USER')+':'+label(v)+'@');
    text = text.replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.:-]+/gi, v => v.split(/\s+/)[0]+' '+label(v.replace(/^\S+\s+/,'')));
    text = text.replace(/((?:authorization|cookie|set-cookie)\s*:\s*)([^\r\n]+)/gi, (_,p,v) => {
      const bearer=v.match(/^(Bearer|Basic)\s+(\[[A-Z]+_\d+\])$/i);
      return p+(bearer?v:label(v));
    });
    const key = '(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|client[_-]?secret|authorization|cookie|set-cookie|session[_-]?id)';
    text = text.replace(new RegExp('([?&]'+key+'=)([^&#\\s]+)', 'gi'),(_,p,v)=>p+label(v));
    text = text.replace(new RegExp('(["\\\']?' + key + '["\\\']?\\s*[:=]\\s*)("(?:\\\\.|[^"\\\\])*"|\\\'' + "(?:\\\\.|[^'\\\\])*" + '\\\')', 'gi'),
      (_,p,q) => p+q[0]+label(q.slice(1,-1))+q.at(-1));
    text = text.replace(new RegExp('(\\b'+key+'\\s*[:=]\\s*)(?!\\[[A-Z]+_\\d+\\]|(?:Bearer|Basic)\\s+\\[)([^\\s,;&}\\]"\'][^\\r\\n,;&}\\]"\']*?)(?=\\s+[\\w-]+\\s*[:=]|[,;&}\\]]|\\r?$)', 'gim'), (_,p,v) => p+label(v.trimEnd()));
    text = text.replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{15,}|github_pat_[A-Za-z0-9_]{15,}|AKIA[A-Z0-9]{16})\b/g, v => label(v));
    text = text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, v => label(v));
    text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, v => label(v,'EMAIL'));
    text = text.replace(/(?:[0-9a-f]{0,4}:){2,}[0-9a-f:.]+(?:%[A-Za-z0-9]+)?/gi, v => isIPv6(v) ? label(v,'IP') : v);
    text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, v => v.split('.').every(x=>Number(x)<=255) ? label(v,'IP') : v);
    text = text.replace(/(\/(?:Users|home)\/)([^/\s"'<>]+)/g, (_,p,v) => p+label(v,'USER'));
    text = text.replace(/([A-Z]:\\Users\\)([^\\\s"'<>]+)/gi, (_,p,v) => p+label(v,'USER'));
    return text;
  }
  function learn(input) {
    redact(input);
    for(const block of String(input).matchAll(/-----BEGIN [^\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^\n]*PRIVATE KEY-----|$)/g)) {
      for(const line of block[0].split('\n').slice(1,-1))if(line.trim())label(line.trim(),'PRIVATEKEY');
    }
  }
  function selection(input) {
    let text=redact(input);
    for(const item of [...known.values()].sort((a,b)=>b.value.length-a.value.length)) {
      if(item.value.length>=4)text=text.split(item.value).join(item.replacement);
    }
    return text;
  }
  return { redact, selection, learn, counts };
}
function isIPv6(value) {
  if(!value.includes(':'))return false;
  try{const url=new URL('http://['+value.replace(/%[^:]+$/,'')+']/');return url.hostname.startsWith('[');}catch{return false;}
}
return { createRedactor };
});
