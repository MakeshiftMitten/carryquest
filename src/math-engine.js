export const DEMO_PROBLEMS=[
  {top:47,bottom:38,operation:"+",mechanic:"carry"},
  {top:62,bottom:27,operation:"−",mechanic:"borrow"},
  {top:168,bottom:257,operation:"+",mechanic:"carry"},
  {top:302,bottom:178,operation:"−",mechanic:"borrow-chain"},
  {top:700,bottom:286,operation:"−",mechanic:"borrow-chain"}
];

export function problemForRoom(room,seed){
  const problem=DEMO_PROBLEMS[(room-1)%DEMO_PROBLEMS.length];
  return {...problem,id:`p-${seed.toString(36)}-${room}`,seed:(seed^Math.imul(room,2654435761))>>>0,width:Math.max(String(problem.top).length,String(problem.bottom).length),room};
}

const digits=(value,width)=>String(value).padStart(width,"0").split("").map(Number);

export function placeName(column,width){
  const power=width-1-column;
  return ["ones","tens","hundreds","thousands"][power]??`10^${power}`;
}

function prepare(state,column){
  if(column<0)return {...state,activeColumn:-1,phase:"complete",complete:true};
  if(state.problem.operation==="−"&&state.top[column]<state.bottom[column]){
    let donor=column-1;
    while(donor>=0&&state.top[donor]===0)donor-=1;
    if(donor<0)throw new Error("No borrow donor");
    const queue=[{kind:"swipe",direction:"down",column:donor,reason:"borrow-give"}];
    for(let target=donor+1;target<=column;target+=1){
      queue.push({kind:"swipe",direction:"up",column:target,reason:"borrow-receive"});
      if(target<column)queue.push({kind:"swipe",direction:"down",column:target,reason:"borrow-give"});
    }
    return {...state,activeColumn:column,phase:"borrow",queue};
  }
  return {...state,activeColumn:column,phase:"answer",queue:[]};
}

export function startProblem(problem){
  const top=digits(problem.top,problem.width);
  return prepare({problem,originalTop:[...top],top,bottom:digits(problem.bottom,problem.width),carries:Array(problem.width).fill(0),answer:Array(problem.width+1).fill(null),activeColumn:problem.width-1,phase:"answer",queue:[],revision:0,complete:false},problem.width-1);
}

export function expectedStep(state){
  if(state.complete)return null;
  if(state.phase==="borrow")return state.queue[0]??null;
  if(state.phase==="carry")return {kind:"swipe",direction:"up",column:state.activeColumn-1,reason:"carry"};
  if(state.phase==="leading")return {kind:"digit",digit:1,column:-1,reason:"leading"};
  const column=state.activeColumn;
  const value=state.problem.operation==="+"?state.top[column]+state.bottom[column]+state.carries[column]:state.top[column]-state.bottom[column];
  return {kind:"digit",digit:((value%10)+10)%10,column,reason:"answer"};
}

function reject(state,expected,action){
  let errorCode="wrong_digit",message=`Check the ${placeName(expected.column,state.problem.width)} column.`;
  if(expected.kind==="swipe"&&action.kind==="digit"){
    errorCode=expected.reason==="carry"?"carry_skipped":"borrow_skipped";
    message=expected.reason==="carry"?"Carry the ten before moving left.":"Finish the borrow before answering.";
  }else if(expected.kind==="digit"&&action.kind==="swipe"){
    errorCode="unexpected_gesture";
    message="That column is ready. Enter its result digit.";
  }else if(expected.kind==="swipe"&&action.kind==="swipe"){
    if(expected.column!==action.column){errorCode="wrong_column";message="Work one column at a time, from right to left.";}
    else {errorCode="wrong_direction";message=expected.direction==="up"?"Flick up to add the small 1.":"Flick down to give one away.";}
  }
  return {state,expected,correct:false,errorCode,message};
}

export function applyAction(state,action){
  const expected=expectedStep(state);
  if(!expected)return {state,expected:null,correct:false,errorCode:"complete",message:"Done."};
  const matches=expected.kind===action.kind&&(expected.kind==="digit"?expected.digit===action.digit:expected.column===action.column&&expected.direction===action.direction);
  if(!matches)return reject(state,expected,action);
  let next={...state,revision:state.revision+1};
  if(expected.kind==="digit"){
    const answer=[...state.answer];
    if(state.phase==="leading"){
      answer[0]=1;
      next={...next,answer,phase:"complete",activeColumn:-1,complete:true};
    }else{
      answer[state.activeColumn+1]=expected.digit;
      next={...next,answer};
      if(state.problem.operation==="+"){
        const sum=state.top[state.activeColumn]+state.bottom[state.activeColumn]+state.carries[state.activeColumn];
        next=sum>=10?{...next,phase:state.activeColumn===0?"leading":"carry"}:prepare(next,state.activeColumn-1);
      }else next=prepare(next,state.activeColumn-1);
    }
  }else if(state.phase==="carry"){
    const carries=[...state.carries];
    carries[expected.column]+=1;
    next=prepare({...next,carries},expected.column);
  }else{
    const top=[...state.top];
    top[expected.column]+=expected.direction==="up"?10:-1;
    const queue=state.queue.slice(1);
    next={...next,top,queue,phase:queue.length?"borrow":"answer"};
  }
  return {state:next,expected,correct:true,message:next.complete?"Clean solve!":"Step locked in."};
}
