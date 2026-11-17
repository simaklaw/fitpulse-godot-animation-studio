// Procedural PBR-ish atlas for gym equipment (rubber, steel, leather)
export function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;}}
const clamp=(v)=>v<0?0:v>255?255:v;
function hash2(x,y,seed){let h=x*374761393+y*668265263+seed*1442695041;h=(h^(h>>13))>>>0;h=(h*1274126177)>>>0;return (h^(h>>16))/4294967296;}
function vnoise(x,y,seed){const xi=Math.floor(x),yi=Math.floor(y);const xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi,seed),b=hash2(xi+1,yi,seed),c=hash2(xi,yi+1,seed),d=hash2(xi+1,yi+1,seed);return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;}
function fbm(x,y,seed,oct=4){let s=0,a=0.5,f=1;for(let i=0;i<oct;i++){s+=a*vnoise(x*f,y*f,seed+i*17);f*=2;a*=0.5;}return s;}
export function buildAtlas(){const size=1024;const albedo=Buffer.alloc(size*size*4);const normal=Buffer.alloc(size*size*4);
// quadrant regions: 0 rubber, 1 steel, 2 leather, 3 accent stripe
const HALF=size/2;
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const qx=x<HALF?0:1, qy=y<HALF?0:1; const region=qy*2+qx; const i=(y*size+x)*4;
 let r=0,g=0,b=0,nx=0.5,ny=0.5;
 if(region===0){ // rubber: dark grey speckle
  const n=fbm(x/6,y/6,7,4); const s=hash2(x,y,99);
  const base=44+n*16+(s>0.93?16:0); r=base; g=base+1; b=base+3;
  nx=0.5+(fbm(x/9,y/9,11,3)-0.5)*0.12; ny=0.5+(fbm(x/9+3,y/9+7,12,3)-0.5)*0.12;
 } else if(region===1){ // brushed steel
  const streak=fbm(x/40,y/1.7,21,3); const fine=hash2(x,y*3,5)*0.08;
  const base=150+streak*55+fine*255*0.5; r=base; g=base+2; b=base+6;
  nx=0.5+(fbm(x/60,y/2,23,2)-0.5)*0.10; ny=0.5+(hash2(x,y*9,31)-0.5)*0.06;
 } else if(region===2){ // leather: fine grain + pores
  const grain=fbm(x/3.2,y/3.2,41,4); const pore=hash2(x,y,47)>0.965?22:0;
  const base=88+grain*38-pore; r=base+16; g=base+2; b=base-6;
  nx=0.5+(fbm(x/3.2,y/3.2,41,3)-0.5)*0.55; ny=0.5+(fbm(x/3.2+9,y/3.2+5,43,3)-0.5)*0.55;
 } else { // accent: matte orange with slight wear
  const wear=fbm(x/5,y/5,61,4); const s=hash2(x,y,71);
  const base=196+wear*28-(s>0.95?24:0); r=base; g=base*0.42+8; b=base*0.10;
  nx=0.5+(fbm(x/8,y/8,63,2)-0.5)*0.18; ny=0.5+(fbm(x/8,y/8,67,2)-0.5)*0.18;
 }
 albedo[i]=clamp(r);albedo[i+1]=clamp(g);albedo[i+2]=clamp(b);albedo[i+3]=255;
 normal[i]=clamp(nx*255);normal[i+1]=clamp(ny*255);normal[i+2]=255;normal[i+3]=255;
}
return {size,albedo,normal};}
const CRC=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
function crc32(buf){let c=~0;for(let i=0;i<buf.length;i++)c=CRC[(c^buf[i])&255]^(c>>>8);return (~c)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const t=Buffer.from(type,'ascii');const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
export function encodePNG(rgba,w,h){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
const zlib=require_zlib();const idat=zlib.deflateSync(raw,{level:9});
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);}
import zlibMod from 'node:zlib';
function require_zlib(){return zlibMod;}
export function decodePNG(buf){return zlibMod.inflateSync(buf);}
