// A4 print sheets have a fixed box. Fit the entire report, including signatures,
// into that box without deleting text or changing marks and calculations.
export function reportFitScale(fits){
 if(fits(1))return 1;
 let low=0,high=1;
 for(let i=0;i<12;i++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
 return Math.max(.0001,Math.floor(low*100000)/100000);
}
export function fitReportCards(root=document){
 for(const page of root.querySelectorAll('.report-card')){
  const content=page.querySelector('.rc-page-content');if(!content)continue;
  page.style.setProperty('--rc-fit-scale','1');content.style.width='';
  const style=getComputedStyle(page),insetX=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),insetY=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  const width=page.clientWidth-insetX,height=page.clientHeight-insetY;
  const targetWidth=width-2,targetHeight=height-4;
  if(targetWidth<=0||targetHeight<=0)continue;
  // Keep the card as wide as the sheet when reducing its height. Wider natural
  // layout also lets long subject names and notes wrap into fewer lines.
  const fits=scale=>{
   content.style.width=(targetWidth/scale)+'px';
   page.style.setProperty('--rc-fit-scale',String(scale));
   return content.getBoundingClientRect().height<=targetHeight&&content.scrollWidth*scale<=targetWidth+1;
  };
  const scale=reportFitScale(fits);
  content.style.width=(targetWidth/scale)+'px';
  page.style.setProperty('--rc-fit-scale',String(scale));
 }
}
