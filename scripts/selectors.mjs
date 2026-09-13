// Shorten only distinctive CSS class names. Share the mapping with browser checks
// so source selectors stay readable and the production DOM is still exercised.
export function compactSelectors(css){
 const names=[...new Set(css.match(/(?<=\.)(?:[a-z]+(?:-[a-z]+)+|operand|topbar|keypad|backdrop|countdown)\b/g))].sort();
 const aliases=new Map(names.map((name,index)=>[name,String.fromCharCode(97+index%26)+(index<26?'':Math.floor(index/26))]));
 const pattern=new RegExp('(?<![\\w-])('+names.join('|')+')(?![\\w-])','g');
 return text=>text.replace(pattern,name=>aliases.get(name));
}
