const $ = (s) => document.querySelector(s);
const state = { readings: [], mode: 'uniform', selected: -1, chartPoints: [] };
const fmt = new Intl.NumberFormat('en-IN');
const dateFmt = new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

function seeded(seed=42){ return ()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; }
function generate(mode='uniform', count=10080){
  const rand=seeded(mode==='uniform'?47:917), data=[];
  let t=Date.now()-30*864e5; t-=t%(5*60e3);
  for(let i=0;i<count;i++){
    const d=new Date(t), hour=d.getHours()+d.getMinutes()/60;
    const morning=1.35*Math.exp(-(((hour-8)/2.4)**2)), evening=2.1*Math.exp(-(((hour-19)/2.7)**2));
    const weekend=[0,6].includes(d.getDay())?.35:0;
    const value=Math.max(.18,.55+morning+evening+weekend+(rand()-.5)*.32);
    data.push({timestamp:t,value:+value.toFixed(3)});
    // Deliberately skew the irregular dataset: a dense cluster followed by sparse readings.
    // This breaks interpolation search's assumption that values are distributed evenly.
    const gap=mode==='uniform'?5:(i<count*.82?1+Math.floor(rand()*3):30+Math.floor(rand()*210));
    t+=gap*60e3;
  }
  return data;
}

function interpolationSearch(a,target){
  let lo=0,hi=a.length-1,probes=0;
  while(lo<=hi&&target>=a[lo].timestamp&&target<=a[hi].timestamp){
    if(a[hi].timestamp===a[lo].timestamp){probes++;return {index:lo,probes};}
    let pos=lo+Math.floor(((target-a[lo].timestamp)*(hi-lo))/(a[hi].timestamp-a[lo].timestamp));
    pos=Math.max(lo,Math.min(hi,pos)); probes++;
    if(a[pos].timestamp===target)return {index:pos,probes};
    if(a[pos].timestamp<target)lo=pos+1;else hi=pos-1;
  }
  return {index:closestIndex(a,target,lo,hi),probes};
}
function binarySearch(a,target){
  let lo=0,hi=a.length-1,probes=0;
  while(lo<=hi){const mid=(lo+hi)>>1;probes++;if(a[mid].timestamp===target)return {index:mid,probes};if(a[mid].timestamp<target)lo=mid+1;else hi=mid-1;}
  return {index:closestIndex(a,target,lo,hi),probes};
}
function closestIndex(a,target,...candidates){return candidates.filter(i=>i>=0&&i<a.length).reduce((best,i)=>best<0||Math.abs(a[i].timestamp-target)<Math.abs(a[best].timestamp-target)?i:best,-1)}

function benchmark(fn,target){
  const samples=[];let result;
  for(let batch=0;batch<11;batch++){const start=performance.now();for(let i=0;i<1000;i++)result=fn(state.readings,target);samples.push((performance.now()-start)*1000/1000);}
  samples.sort((a,b)=>a-b);return {...result,time:samples[5]};
}
function displayTime(us){return us<1?`${(us*1000).toFixed(0)} ns`:`${us.toFixed(2)} µs`}

function runSearch(target){
  if(!Number.isFinite(target))return;
  target=Math.max(state.readings[0].timestamp,Math.min(state.readings.at(-1).timestamp,target));
  const inter=benchmark(interpolationSearch,target), binary=benchmark(binarySearch,target); state.selected=inter.index;
  const r=state.readings[inter.index], offset=Math.abs(r.timestamp-target), exact=offset===0;
  $('#resultTime').textContent=dateFmt.format(r.timestamp); $('#resultKwh').textContent=r.value.toFixed(2);
  $('#resultOffset').textContent=exact?'exact':offset<36e5?`${Math.round(offset/6e4)} min`:`${(offset/36e5).toFixed(1)} hr`;
  $('#resultIndex').textContent=fmt.format(inter.index); $('#resultCost').textContent=`₹${(r.value*7.1).toFixed(2)}`;
  $('#matchBadge').textContent=exact?'EXACT MATCH':'NEAREST';
  $('#iTime').textContent=displayTime(inter.time); $('#iProbes').textContent=inter.probes; $('#iMemory').textContent=`${inter.probes*8} B`;
  $('#bTime').textContent=displayTime(binary.time); $('#bProbes').textContent=binary.probes; $('#bMemory').textContent=`${binary.probes*8} B`;
  const diff=inter.probes-binary.probes;
  $('#raceInsight').textContent=diff<0?`Interpolation used ${-diff} fewer probe${diff===-1?'':'s'} by estimating the target position.`:diff>0?`Irregular spacing cost interpolation ${diff} extra probe${diff===1?'':'s'}—binary search stayed predictable.`:'Both algorithms needed the same number of probes for this target.';
  drawChart(); $('#resultSection').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function setData(data,mode=state.mode){
  state.readings=data.sort((a,b)=>a.timestamp-b.timestamp);state.mode=mode;state.selected=-1;
  $('#readingCount').textContent=fmt.format(data.length);$('#rangeDays').textContent=Math.max(1,Math.ceil((data.at(-1).timestamp-data[0].timestamp)/864e5));
  const min=toLocalInput(data[0].timestamp),max=toLocalInput(data.at(-1).timestamp);$('#targetTime').min=min;$('#targetTime').max=max;$('#targetTime').value=toLocalInput(data[Math.floor(data.length*.72)].timestamp+2*60e3);
  $('#rangeHelp').textContent=`Available: ${dateFmt.format(data[0].timestamp)} — ${dateFmt.format(data.at(-1).timestamp)}`;
  document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  updateLesson();renderDaily();drawChart();runSearch(new Date($('#targetTime').value).getTime());
}
function toLocalInput(t){const d=new Date(t-datetimeOffset(t));return d.toISOString().slice(0,16)}
function datetimeOffset(t){return new Date(t).getTimezoneOffset()*60000}

function renderDaily(){
  const days=new Map();for(const r of state.readings){const key=new Date(r.timestamp-datetimeOffset(r.timestamp)).toISOString().slice(0,10);if(!days.has(key))days.set(key,[]);days.get(key).push(r);}
  const rows=[...days].slice(-7).reverse().map(([day,rs])=>{const avg=rs.reduce((s,r)=>s+r.value,0)/rs.length, hours=(rs.at(-1).timestamp-rs[0].timestamp)/36e5;const energy=avg*Math.min(24,hours||.083);const peak=Math.max(...rs.map(r=>r.value));return `<tr><td>${new Date(day+'T12:00').toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'})}</td><td>${energy.toFixed(1)} kWh</td><td>${peak.toFixed(2)} kW</td><td>${avg.toFixed(2)} kW</td></tr>`}).join('');
  $('#dailyBody').innerHTML=rows;
}
function updateLesson(){
  const irregular=state.mode==='irregular';$('#lessonTitle').textContent=irregular?'Interpolation loses its shortcut.':'Interpolation thrives on regular data.';
  $('#lessonCopy').textContent=irregular?'Large, unpredictable gaps distort the position estimate. It may jump to the wrong region repeatedly, while binary search keeps halving the range.':'With evenly spaced timestamps, it can estimate where the target lives and often jump there in very few probes.';
  $('#toggleLesson').innerHTML=`Switch to ${irregular?'regular':'irregular'} data <span aria-hidden="true">→</span>`;
  const rand=seeded(8);$('#distributionVisual').innerHTML=Array.from({length:42},(_,i)=>`<i style="margin-left:${irregular&&i?Math.floor(rand()*13):0}px"></i>`).join('');
}
function drawChart(){
  const canvas=$('#usageChart'),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);
  const w=rect.width,h=rect.height,p={l:44,r:12,t:12,b:30};c.clearRect(0,0,w,h);
  const center=state.selected>=0?state.selected:state.readings.length-1, span=Math.min(state.readings.length,576),start=Math.max(0,Math.min(state.readings.length-span,center-Math.floor(span/2)));const raw=state.readings.slice(start,start+span),step=Math.max(1,Math.ceil(raw.length/240)),points=raw.filter((_,i)=>i%step===0||i===raw.length-1);state.chartPoints=[];
  const max=Math.max(4,...points.map(r=>r.value));c.strokeStyle='#24374c';c.lineWidth=1;c.fillStyle='#758ba2';c.font='10px ui-monospace, monospace';
  for(let i=0;i<5;i++){const y=p.t+(h-p.t-p.b)*i/4;c.beginPath();c.moveTo(p.l,y);c.lineTo(w-p.r,y);c.stroke();c.fillText((max*(1-i/4)).toFixed(1),5,y+3)}
  c.beginPath();points.forEach((r,i)=>{const x=p.l+(w-p.l-p.r)*i/(points.length-1),y=p.t+(h-p.t-p.b)*(1-r.value/max);state.chartPoints.push({x,y,r});i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle='#57e39b';c.lineWidth=2;c.stroke();
  const grad=c.createLinearGradient(0,p.t,0,h-p.b);grad.addColorStop(0,'rgba(87,227,155,.22)');grad.addColorStop(1,'rgba(87,227,155,0)');c.lineTo(w-p.r,h-p.b);c.lineTo(p.l,h-p.b);c.closePath();c.fillStyle=grad;c.fill();
  if(state.selected>=start&&state.selected<start+span){const r=state.readings[state.selected],ratio=(state.selected-start)/(span-1),x=p.l+(w-p.l-p.r)*ratio,y=p.t+(h-p.t-p.b)*(1-r.value/max);c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fillStyle='#ffbf69';c.fill();c.strokeStyle='#08111e';c.lineWidth=2;c.stroke()}
  c.fillStyle='#758ba2';c.fillText(dateFmt.format(raw[0].timestamp),p.l,h-7);const endText=dateFmt.format(raw.at(-1).timestamp);c.fillText(endText,w-p.r-c.measureText(endText).width,h-7);
  const avg=points.reduce((s,r)=>s+r.value,0)/points.length;$('#chartSummary').textContent=`Demand chart from ${dateFmt.format(raw[0].timestamp)} to ${dateFmt.format(raw.at(-1).timestamp)}. Average ${avg.toFixed(2)} kilowatts, peak ${max.toFixed(2)} kilowatts.`;
}

$('#searchForm').addEventListener('submit',e=>{e.preventDefault();runSearch(new Date($('#targetTime').value).getTime())});
document.querySelectorAll('.segment').forEach(b=>b.addEventListener('click',()=>setData(generate(b.dataset.mode),b.dataset.mode)));
$('#regenerate').addEventListener('click',()=>setData(generate(state.mode),state.mode));$('#toggleLesson').addEventListener('click',()=>setData(generate(state.mode==='uniform'?'irregular':'uniform'),state.mode==='uniform'?'irregular':'uniform'));
$('#exportCsv').addEventListener('click',()=>{const csv='timestamp,value_kw\n'+state.readings.map(r=>`${new Date(r.timestamp).toISOString()},${r.value}`).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='smart-meter-readings.csv';a.click();URL.revokeObjectURL(a.href)});
$('#csvInput').addEventListener('change',async e=>{const text=await e.target.files[0]?.text();if(!text)return;const rows=text.trim().split(/\r?\n/).slice(1).map(line=>{const [t,v]=line.split(',');return{timestamp:new Date(t).getTime(),value:+v}}).filter(r=>Number.isFinite(r.timestamp)&&Number.isFinite(r.value));if(rows.length>1)setData(rows,'imported');else alert('CSV needs timestamp,value_kw columns and at least two valid rows.')});
$('#usageChart').addEventListener('mousemove',e=>{if(!state.chartPoints.length)return;const rect=e.target.getBoundingClientRect(),x=e.clientX-rect.left,p=state.chartPoints.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a),tip=$('#chartTooltip');tip.hidden=false;tip.textContent=`${dateFmt.format(p.r.timestamp)} · ${p.r.value.toFixed(2)} kW`;tip.style.left=`${Math.min(rect.width-170,p.x+10)}px`;tip.style.top=`${Math.max(0,p.y-35)}px`});$('#usageChart').addEventListener('mouseleave',()=>$('#chartTooltip').hidden=true);
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawChart,100)});
setData(generate('uniform'),'uniform');
