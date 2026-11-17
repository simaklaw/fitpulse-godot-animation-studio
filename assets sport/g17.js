const {fk,err,T}=require('./fk.js');
// Штраф только за ГРУБЫЕ нарушения анатомии, жёстко: локоть ниже плеча >=4см,
// локоть сзади >=3см, E.x <= -0.12 (не к центру). Всё остальное свободно.
function cost(l,r,f,t,ab,e){
 const q=fk(l,r,f,t,ab,e);
 const base=err(l,r,f,t,ab,e);
 const below=q.S[1]-q.E[1];
 const behind=q.E[2]-q.S[2];
 let pen=base;
 if(below<0.04)pen+=0.5+(0.04-below);
 if(behind<0.03)pen+=0.5+(0.03-behind);
 if(q.E[0]>-0.12)pen+=0.5+(q.E[0]+0.12);
 return pen;
}
function run(seed){
 const arr=seed.slice(); let bd=cost(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
 for(const step of [4,2,1,0.5,0.2,0.08,0.03,0.01]){
  for(let it=0;it<150;it++){let imp=false;
   for(let ki=0;ki<6;ki++)for(let sg=-1;sg<=1;sg+=2){
    const old=arr[ki]; arr[ki]=old+sg*step;
    const d=cost(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
    if(d<bd-1e-13){bd=d;imp=true;}else{arr[ki]=old;}}
   if(!imp)break;}}
 return {bd:bd,arr:arr};
}
let best=null;
for(let l=0;l<=40;l+=10)for(let r=-20;r<=10;r+=10)for(let f=-120;f<=40;f+=40)for(let t=-150;t<=150;t+=75)for(let ab=-20;ab<=80;ab+=25)for(let e=70;e<=150;e+=40){
 const res=run([l,r,f,t,ab,e]);
 if(!best||res.bd<best.bd)best=res;
}
const a=best.arr; const q=fk(a[0],a[1],a[2],a[3],a[4],a[5]);
console.log('=== cost',best.bd.toFixed(4),'err mm',(err(a[0],a[1],a[2],a[3],a[4],a[5])*1000).toFixed(2));
console.log('lift',a[0].toFixed(1),'ret',a[1].toFixed(1),'flex',a[2].toFixed(1),'twist',a[3].toFixed(1),'abd',a[4].toFixed(1),'elbow',a[5].toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
console.log('below',(q.S[1]-q.E[1]).toFixed(3),'behind',(q.E[2]-q.S[2]).toFixed(3),'E.x',q.E[0].toFixed(3));
