import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.obj':'text/plain','.ply':'application/octet-stream','.json':'application/json','.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/viewer.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)){res.writeHead(403);return res.end('forbidden');}
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404,{'content-type':'text/plain'});return res.end('404 '+p);}
    res.writeHead(200,{'content-type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    res.end(d);
  });
}).listen(8123,'127.0.0.1',()=>console.log('VIEWER_UP http://127.0.0.1:8123/'));
