'use strict';
// Browser-only data adapter. No local endpoints or credentials.
const publishedCache=new Map();
window.clearStaticData=()=>publishedCache.clear();
const chileFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'});
window.staticData=async function(sport,period){
 let entry=publishedCache.get(sport);const now=Date.now();
 if(!entry||now-entry.fetched>180000){const response=await fetch('./datos/'+encodeURIComponent(sport)+'.json',{cache:'no-cache'});if(!response.ok)throw new Error('Publicación no disponible');entry={payload:await response.json(),fetched:now,offline:response.headers.get('X-Betano-Offline')==='1'};publishedCache.set(sport,entry);}
 const payload=entry.payload;
 const offline=entry.offline||!navigator.onLine;
 const note=document.getElementById('offline-note');if(note)note.hidden=!offline;
 const chileDay=value=>chileFormatter.format(new Date(value));
 const tomorrowDay=()=>{const d=new Date(now);d.setDate(d.getDate()+1);return chileFormatter.format(d);};
 const upcoming=payload.rows.filter(r=>Date.parse(r.start_utc)>now);
 const selected=payload.rows.filter(r=>{
  if(period==='all')return true;
  const t=Date.parse(r.start_utc);
  if(!Number.isFinite(t)||t<=now)return false;
  if(period==='upcoming')return true;
  const d=chileDay(t);
  if(period==='today')return d===chileDay(now);
  if(period==='today-tomorrow')return d===chileDay(now)||d===tomorrowDay();
  return false;
 });
 const ids=new Set(selected.map(r=>r.event_id));
 const analysis=payload.analysis.filter(a=>ids.has(a.event_id)).map(a=>{
  const observed=selected.filter(r=>r.event_id===a.event_id).map(r=>Date.parse(r.observed_utc));
  const stale=observed.some(t=>!Number.isFinite(t)||now-t>1800000||t>now),expired=!(Date.parse(a.start_utc)>now);
  const statistics=a.statistics?{...a.statistics,cache_old:!a.statistics.fetched_utc||now-Date.parse(a.statistics.fetched_utc)>86400000}:{};
  if(stale||expired)return {...a,statistics,stale,expired,status:'skip',recommendation:'No recomendar todavía',reason:expired?'El partido ya comenzó o no tiene una hora válida.':'Las cuotas publicadas tienen más de 30 minutos. Hace falta una nueva captura desde el PC.'};
  return {...a,statistics,stale,expired};
 });
 const starts=upcoming.map(r=>r.start_utc).sort();
 return {rows:selected,analysis,combinations:window.staticCombinations(selected,analysis),
  history:payload.history||{},tracking:payload.tracking||{},sport_status:payload.sport_status||[],
  availability:{capture_utc:payload.rows[0]?.observed_utc,upcoming_events:new Set(upcoming.map(r=>r.event_id)).size,next_start_utc:starts[0]},
  running:false,refresh_status:'idle',message:'Publicación: '+date(payload.built_utc,true)+' (Santiago) · Cuotas oficiales capturadas desde el PC'};
};
window.staticCombinations=function(rows,analyses){
 const minimum=Number($('combo-min').value),maximum=Number($('combo-max').value),limit=Number($('combo-leg').value),maxLegs=Number($('combo-legs').value);
 if(!(minimum>=1.5&&minimum<=maximum&&maximum<=10&&limit>=1.05&&limit<=1.6&&maxLegs>=2&&maxLegs<=5))return [];
 const candidates=[];
 for(const a of analyses){
  if(a.stale||a.expired||a.virtual||/sub-|sub |u21|u19|reservas|reserve/i.test(a.event))continue;
  const row=rows.find(r=>r.event_id===a.event_id&&r.selection===a.winner_selection);
  if(!row)continue;
  const price=Number(row.odds),p=a.probabilities[a.winner_selection];
  if(!(price>=1.05&&price<=limit&&p>=.65)||(a.basis!=='Mercado Betano'&&p*price<1))continue;
  candidates.push({event_id:a.event_id,event:a.event,competition:a.competition,country:a.country,pick:a.winner,selection:a.winner_selection,odds:price,probability:p,basis:a.basis,start_utc:a.start_utc});
 }
 candidates.sort((a,b)=>b.probability-a.probability);const pool=candidates.slice(0,24),result=[];
 function search(index,legs,teams,factor,probability){
  if(legs.length>=2&&factor>=minimum&&factor<=maximum)result.push({legs:[...legs],factor,probability,expected_value:probability*factor-1,basis:legs.some(l=>l.basis==='Mercado Betano')?'Incluye estimaciones de mercado':'Estimaciones independientes'});
  if(legs.length>=maxLegs)return;
  for(let i=index;i<pool.length;i++){
   const leg=pool[i],names=leg.event.toLowerCase().split(' - ');
   if(names.length!==2||names[0]===names[1]||names.some(n=>teams.has(n))||factor*leg.odds>maximum)continue;
   search(i+1,[...legs,leg],new Set([...teams,...names]),factor*leg.odds,probability*leg.probability);
  }
 }
 search(0,[],new Set(),1,1);
 return result.sort((a,b)=>b.probability-a.probability||a.legs.length-b.legs.length||a.factor-b.factor).slice(0,5);
};
