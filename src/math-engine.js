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
  if(problem.operation==="×"&&(!Number.isInteger(problem.bottom)||problem.bottom<0||problem.bottom>9))throw new Error("Multiplier must be one digit");
  const top=digits(problem.top,problem.width);
  return prepare({problem,originalTop:[...top],top,bottom:digits(problem.bottom,problem.width),carries:Array(problem.width).fill(0),answer:Array(problem.width+1).fill(null),activeColumn:problem.width-1,phase:"answer",queue:[],complete:false},problem.width-1);
}

const columnValue=state=>{
  const c=state.activeColumn;
  return state.problem.operation==="×"?state.top[c]*state.problem.bottom+state.carries[c]:state.problem.operation==="+"?state.top[c]+state.bottom[c]+state.carries[c]:state.top[c]-state.bottom[c];
};

export function expectedStep(state){
  if(state.complete)return null;
  if(state.phase==="borrow")return state.queue[0]??null;
  if(state.phase==="carry")return {kind:"swipe",direction:"up",column:state.activeColumn-1,reason:"carry"};
  if(state.phase==="leading")return {kind:"digit",digit:state.leadingCarry,column:-1,reason:"leading"};
  const column=state.activeColumn;
  const value=columnValue(state);
  return {kind:"digit",digit:((value%10)+10)%10,column,reason:"answer"};
}

function reject(state,expected,action){
  let errorCode="wrong_digit",message=`Check the ${placeName(expected.column,state.problem.width)} column.`;
  if(expected.kind==="swipe"&&action.kind==="digit"){
    errorCode=expected.reason==="carry"?"carry_skipped":"borrow_skipped";
    message=expected.reason==="carry"?"Move the carry first.":"Borrow first.";
  }else if(expected.kind==="digit"&&action.kind==="swipe"){
    errorCode="unexpected_gesture";
    message="Enter the result digit.";
  }else if(expected.kind==="swipe"&&action.kind==="swipe"){
    if(expected.column!==action.column){errorCode="wrong_column";message="Use the highlighted column.";}
    else {errorCode="wrong_direction";message=expected.direction==="up"?"Flick up.":"Flick down.";}
  }
  return {state,expected,correct:false,errorCode,message};
}

export function applyAction(state,action){
  const expected=expectedStep(state);
  if(!expected)return {state,expected:null,correct:false,errorCode:"complete",message:"Done."};
  if(state.phase==="carry"&&action.kind==="swipe"&&action.column===expected.column&&["up","down"].includes(action.direction)){
    const carryDial=((state.carryDial??0)+(action.direction==="up"?1:9))%10,next={...state,carryDial};
    if(carryDial!==state.pendingCarry)return {state:next,expected,correct:true,adjusting:true,message:"Adjust the carry."};
    if(expected.column<0)return {state:{...next,leadingCarry:carryDial,phase:"leading"},expected,correct:true,message:"Carry set."};
    const carries=[...state.carries];carries[expected.column]+=carryDial;
    return {state:prepare({...next,carries},expected.column),expected,correct:true,message:"Carry set."};
  }
  const matches=expected.kind===action.kind&&(expected.kind==="digit"?expected.digit===action.digit:expected.column===action.column&&expected.direction===action.direction);
  if(!matches)return reject(state,expected,action);
  let next={...state};
  if(expected.kind==="digit"){
    const answer=[...state.answer];
    if(state.phase==="leading"){
      answer[0]=expected.digit;
      next={...next,answer,phase:"complete",activeColumn:-1,complete:true};
    }else{
      answer[state.activeColumn+1]=expected.digit;
      next={...next,answer};
      if(state.problem.operation!=="−"){
        const sum=columnValue(state);
        next=sum>=10?{...next,phase:"carry",pendingCarry:Math.floor(sum/10),carryDial:0}:prepare(next,state.activeColumn-1);
      }else next=prepare(next,state.activeColumn-1);
    }
  }else{
    const top=[...state.top];
    top[expected.column]+=expected.direction==="up"?10:-1;
    const queue=state.queue.slice(1);
    next={...next,top,queue,phase:queue.length?"borrow":"answer"};
  }
  return {state:next,expected,correct:true,message:next.complete?"Clean solve!":"Correct."};
}
