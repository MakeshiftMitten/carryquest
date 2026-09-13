export function random(seed){return ()=>{seed=(seed+0x6d2b79f5)|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return ((n^n>>>14)>>>0)/4294967296;};}
export const COLORS=["Red","Orange","Yellow","Green","Blue","Indigo","Violet"];
export const PALETTE=["#ff727e","#ffa45c","#ffe574","#77e5ae","#76cfff","#9b9aff","#e79dff"];
export const seconds=score=>11-score;
export const allowance=score=>[5,4,3,1,0][score-1];
export const operationScore=theme=>[...theme].reduce((sum,op)=>sum+(1<<"+−×".indexOf(op)),theme.length-1);
export const levelScore=node=>node.boss??operationScore(node.theme)+node.difficulty+node.speed+node.strictness+(node.questions??5)-5;
export function tuneLevel(node,change){
  if(node.boss!=null){
    node.boss=Math.max(6,node.boss+change);const rank=node.boss-6;
    node.difficulty=1+Math.floor(rank/3);node.speed=Math.min(10,1+Math.floor(rank/6));node.strictness=Math.min(5,1+Math.floor(rank/12));return node;
  }
  node.questions??=5;
  const target=Math.max(4,levelScore(node)+change);
  while(levelScore(node)!==target){
    const up=levelScore(node)<target,keys=["difficulty","speed","strictness","questions"].filter(k=>up?k==="difficulty"||node[k]<(k==="strictness"?5:10):node[k]>(k==="questions"?5:1));
    keys.sort((a,b)=>up?node[a]-node[b]:node[b]-node[a]);
    if(keys.length)node[keys[0]]+=up?1:-1;else node.theme="+";
  }
  return node;
}
export function makeMap(seed,offset=0){
  const rng=random(seed+offset),themes=["+","−","×","+−","+×","−×","+−×"];
  let spine=2;
  return Array.from({length:10},(_,row)=>{
    spine=Math.max(0,Math.min(4,spine+Math.floor(rng()*3)-1));
    return Array.from({length:5},(_,lane)=>{
      const stage=offset+row,challenge=rng()<.15,target=7+stage*2+(challenge?2:0),available=themes.filter(t=>operationScore(t)+3<=target);
      const theme=available[Math.floor(rng()*available.length)],stats={difficulty:1,speed:1,strictness:1,questions:5};
      while(operationScore(theme)+stats.difficulty+stats.speed+stats.strictness+stats.questions-5<target){
        const key=Object.keys(stats)[Math.floor(rng()*4)];if(key==="difficulty"||stats[key]<(key==="strictness"?5:10))stats[key]++;
      }
      const color=lane===spine?row%7:Math.floor(rng()*7),pieces=[color];
      if(challenge)pieces.push((color+1+Math.floor(rng()*6))%7);
      return {stage,lane,theme,...stats,challenge,pieces,seed:Math.floor(rng()*4294967296),x:10+lane*20,y:95-row*10};
    });
  });
}
export function worldProblem(node,index){
  const seed=(node.seed+Math.imul(index+1,2654435761))>>>0,rng=random(seed),operation=node.theme[index%node.theme.length];
  const max=[9,20,99,200,999][node.difficulty-1]??999+(node.difficulty-5)*300;
  let top=1+Math.floor(rng()*max),bottom=1+Math.floor(rng()*(operation==="×"?9:max));
  if(operation==="−"&&top<bottom)[top,bottom]=[bottom,top];
  return {id:`p-${seed}`,seed,top,bottom,operation,width:Math.max(String(top).length,String(bottom).length),mechanic:operation==="×"?"multiply":operation==="+"?"carry":"borrow",room:node.stage+1};
}
