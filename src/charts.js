// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
// Small inline-SVG charts. Inline because the site's Content-Security-Policy is
// `script-src 'self'` — no charting library can be loaded from a CDN, and none is
// needed for bars and a line. Every function here is pure: data in, SVG string
// out, so the shapes can be tested without a browser.
//
// Colour follows the job rather than taste. These bars and lines all show
// magnitude, so they use one hue; the school's identity green, stepped to
// `#0a7a55` so it clears the lightness and chroma floors on a white panel.
// `#d03b3b` marks a value below the school's target — a status, not a series —
// and never carries that meaning alone: the figure is printed on every bar and
// the caption says what the threshold is.
//
// The charts are light-surface only, like the rest of the site.

export const CHART={
 data:'#0a7a55',        // magnitude, one hue
 alt:'#c8860d',         // a second magnitude where one is genuinely needed
 below:'#d03b3b',       // below target
 grid:'#dfe7e2',
 axis:'#63776f',
 ink:'#17372e',
 surface:'#ffffff'};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=(n,d=1)=>Number.isFinite(n)?Math.round(n*10**d)/10**d:null;
export const shorten=(s,n=16)=>{const v=String(s??'');return v.length>n?v.slice(0,n-1)+'…':v;};

// A bar with a 4px rounded data-end and a square baseline, as one path.
function barPath(x,y,w,h,r=4,dir='right'){
 const rr=Math.max(0,Math.min(r,dir==='right'?w:h));
 if(w<=0||h<=0)return '';
 if(dir==='right')
  return `M${x} ${y}H${x+w-rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h-2*rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}H${x}Z`;
 return `M${x} ${y+h}V${y+rr}a${rr} ${rr} 0 0 1 ${rr} ${-rr}h${w-2*rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${y+h}Z`;
}

const empty=message=>`<p class="chart-empty">${esc(message)}</p>`;

// Horizontal bars: the default for comparing magnitude across named things,
// and the only readable choice when the names are as long as "Lower Sixth Science".
export function barChart(rows,{max=100,unit='%',target=null,label='',emptyMessage='No data for this range.',width=680,barHeight=18,gap=12}={}){
 const data=rows.filter(r=>r&&r.value!==null&&r.value!==undefined);
 if(!data.length)return empty(emptyMessage);
 const top=Math.max(max,...data.map(r=>r.value))||1;
 const labelW=150,valueW=64,left=labelW+8,plot=width-left-valueW;
 const rowH=barHeight+gap,height=data.length*rowH+8;
 const bars=data.map((r,i)=>{
  const y=i*rowH+4,w=Math.max(2,plot*(r.value/top));
  const low=target!==null&&r.value<target;
  const fill=low?CHART.below:CHART.data;
  return `<g><title>${esc(r.key)}: ${esc(round(r.value))}${esc(unit)}${r.note?' · '+esc(r.note):''}</title>`
   +`<text x="${labelW}" y="${y+barHeight/2}" text-anchor="end" dominant-baseline="central" class="c-label">${esc(shorten(r.key,20))}</text>`
   +`<path d="${barPath(left,y,w,barHeight)}" fill="${fill}"/>`
   +`<text x="${left+w+7}" y="${y+barHeight/2}" dominant-baseline="central" class="c-value${low?' low':''}">${esc(round(r.value))}${esc(unit)}</text>`
   +`</g>`;
 }).join('');
 const rule=target!==null?`<line x1="${left+plot*(target/top)}" y1="0" x2="${left+plot*(target/top)}" y2="${height-8}" stroke="${CHART.below}" stroke-width="1" stroke-dasharray="3 3"/>`:'';
 return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${esc(label||'Bar chart')}" preserveAspectRatio="xMidYMid meet">${rule}${bars}</svg>`;
}

// Columns: for a short ordered sequence where the order itself means something —
// the days of the week, the periods of the day, bands of marks.
export function columnChart(rows,{max=100,unit='%',label='',emptyMessage='No data for this range.',width=680,height=190,target=null}={}){
 const data=rows.filter(r=>r&&r.value!==null&&r.value!==undefined);
 if(!data.length)return empty(emptyMessage);
 const top=Math.max(max,...data.map(r=>r.value))||1;
 const bottom=height-30,plotH=bottom-26;
 const band=width/data.length,barW=Math.min(24,band*0.5);
 const grid=[0,0.5,1].map(f=>`<line x1="0" y1="${bottom-plotH*f}" x2="${width}" y2="${bottom-plotH*f}" stroke="${CHART.grid}" stroke-width="1"/>`).join('');
 const bars=data.map((r,i)=>{
  const h=Math.max(2,plotH*(r.value/top)),x=band*i+(band-barW)/2,y=bottom-h;
  const low=target!==null&&r.value<target;
  return `<g><title>${esc(r.key)}: ${esc(round(r.value))}${esc(unit)}${r.note?' · '+esc(r.note):''}</title>`
   +`<path d="${barPath(x,y,barW,h,4,'up')}" fill="${low?CHART.below:CHART.data}"/>`
   +`<text x="${band*i+band/2}" y="${y-6}" text-anchor="middle" class="c-value${low?' low':''}">${esc(round(r.value))}</text>`
   +`<text x="${band*i+band/2}" y="${bottom+16}" text-anchor="middle" class="c-label">${esc(shorten(r.key,12))}</text>`
   +`</g>`;
 }).join('');
 return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${esc(label||'Column chart')}" preserveAspectRatio="xMidYMid meet">${grid}${bars}</svg>`;
}

// A line for change over time. One series, so no legend: the heading says what it
// is. Only the first, last and worst points are labelled — a number on every point
// is noise nobody reads.
export function lineChart(rows,{unit='%',label='',emptyMessage='Not enough data to show a trend.',width=680,height=200,min=null,max=100}={}){
 const data=rows.filter(r=>r&&r.value!==null&&r.value!==undefined);
 if(data.length<2)return empty(emptyMessage);
 // Fit the axis to the data with a little padding, rather than always showing
 // 0–100: attendance that moves between 91% and 96% is a flat line on a 0–100
 // axis, and the weeks where it dipped are the whole point of drawing it. Bars
 // keep their zero baseline — truncating those would exaggerate differences —
 // but a line already reads as change rather than magnitude.
 const values=data.map(r=>r.value);
 const highest=Math.max(...values),lowest=Math.min(...values);
 const pad=Math.max(1,(highest-lowest)*0.25);
 const lo=min!==null?min:Math.max(0,Math.floor((lowest-pad)/5)*5);
 const hi=min!==null?Math.max(max,...values):Math.min(max,Math.ceil((highest+pad)/5)*5);
 const left=34,bottom=height-26,plotH=bottom-14,plotW=width-left-12;
 const x=i=>left+(data.length===1?plotW/2:plotW*i/(data.length-1));
 const y=v=>bottom-plotH*((v-lo)/((hi-lo)||1));
 const ticks=[lo,(lo+hi)/2,hi].map(v=>
  `<line x1="${left}" y1="${y(v)}" x2="${width}" y2="${y(v)}" stroke="${CHART.grid}" stroke-width="1"/>`
  +`<text x="${left-6}" y="${y(v)}" text-anchor="end" dominant-baseline="central" class="c-axis">${esc(round(v,0))}</text>`).join('');
 const path=data.map((r,i)=>`${i?'L':'M'}${round(x(i),2)} ${round(y(r.value),2)}`).join(' ');
 const worst=data.reduce((a,b)=>b.value<a.value?b:a,data[0]);
 const dots=data.map((r,i)=>{
  const highlight=i===0||i===data.length-1||r===worst;
  return `<g><title>${esc(r.key)}: ${esc(round(r.value))}${esc(unit)}${r.note?' · '+esc(r.note):''}</title>`
   +`<circle cx="${round(x(i),2)}" cy="${round(y(r.value),2)}" r="4.5" fill="${CHART.data}" stroke="${CHART.surface}" stroke-width="2"/>`
   +(highlight?`<text x="${round(x(i),2)}" y="${round(y(r.value),2)-11}" text-anchor="middle" class="c-value">${esc(round(r.value))}</text>`:'')
   +`</g>`;
 }).join('');
 // Label the ends of the axis rather than every week, so the labels never collide.
 const marks=[0,data.length-1].map(i=>`<text x="${round(x(i),2)}" y="${bottom+16}" text-anchor="${i?'end':'start'}" class="c-label">${esc(data[i].key)}</text>`).join('');
 return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${esc(label||'Trend')}" preserveAspectRatio="xMidYMid meet">`
  +`${ticks}<path d="${path}" fill="none" stroke="${CHART.data}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${marks}</svg>`;
}

// A single headline number. Often the honest answer where a one-bar chart would go.
export function statTile(label,value,{unit='',note='',tone=''}={}){
 const shown=value===null||value===undefined?'—':`${value}${unit}`;
 return `<article class="stat${tone?' '+tone:''}"><span class="stat-label">${esc(label)}</span>`
  +`<strong class="stat-value">${esc(shown)}</strong>`
  +(note?`<span class="stat-note">${esc(note)}</span>`:'')+`</article>`;
}

// The figures behind a chart, for anyone who would rather read than look — and for
// a screen reader, which cannot read a picture.
export function figureTable(rows,{headings=['','Value'],format=r=>r.value}={}){
 if(!rows.length)return '';
 return `<details class="chart-figures"><summary>Show the figures</summary><div class="table-scroll"><table><thead><tr>${headings.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>`
  +`<tbody>${rows.map(r=>`<tr><td>${esc(r.key)}</td><td>${esc(format(r))}</td></tr>`).join('')}</tbody></table></div></details>`;
}
