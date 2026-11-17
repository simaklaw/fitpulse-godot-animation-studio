import fs from 'node:fs';
import zlib from 'node:zlib';
export function decodePNG(p){
  const b=fs.readFileSync(p);
  let off=8,idat=[],w=0,h=0,bpp=4;
  while(off<b.length){
    const len=b.readUInt32BE(off);
    const t=b.slice(off+4,off+8).toString('ascii');
    const d=b.slice(off+8,off+8+len);
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bpp=d[9]===6?4:3;}
    if(t==='IDAT')idat.push(d);
    off+=12+len;
    if(t==='IEND')break;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=w*bpp;
  const out=Buffer.alloc(w*h*bpp);
  let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const ft=raw[y*(stride+1)];
    const line=raw.slice(y*(stride+1)+1,(y+1)*(stride+1));
    const cur=Buffer.alloc(stride);
    for(let i=0;i<stride;i++){
      const a=i>=bpp?cur[i-bpp]:0;
      const bb=prev[i];
      const c=i>=bpp?prev[i-bpp]:0;
      let v=line[i];
      if(ft===1)v+=a;else if(ft===2)v+=bb;else if(ft===3)v+=((a+bb)>>1);
      else if(ft===4){const pp=a+bb-c;const pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);v+= (pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c);}
      cur[i]=v&255;
    }
    cur.copy(out,y*stride);
    prev=cur;
  }
  return {w,h,bpp,px:out,get:(x,y)=>{const i=y*stride+x*bpp;return [out[i],out[i+1],out[i+2]];}};
}
