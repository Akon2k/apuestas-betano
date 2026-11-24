'use strict';
// Pure accounting for fictitious CLP. No operator account or payment integration.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Simulation=api;})(typeof globalThis==='object'?globalThis:this,function(){
 const SPORTS=new Set(['football','tennis','nba','nfl']);
 const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'});
 const clone=value=>JSON.parse(JSON.stringify(value));
 const fail=message=>{throw new Error(message);};
 const time=value=>{const n=Date.parse(value);if(!Number.isFinite(n))fail('Fecha no válida.');return n;};
 const text=(value,max=300)=>typeof value==='string'&&value.trim()&&value.length<=max;
 const day=value=>dayFormat.format(new Date(value));
 function probabilities(value,sides){
  if(!value||Object.keys(value).sort().join()!==sides.slice().sort().join()||!Object.values(value).every(p=>Number.isFinite(p)&&p>=0&&p<=1)||Math.abs(Object.values(value).reduce((a,b)=>a+b,0)-1)>.001)fail('Probabilidades incompletas o no válidas.');
 }
 function snapshotValid(s,now){
  if(!s||!SPORTS.has(s.sport)||!text(s.event_id,100)||!text(s.event)||!text(s.market)||!text(s.pick)||!text(s.basis,100))fail('La selección no tiene datos completos.');
  if((s.competition!==undefined&&(typeof s.competition!=='string'||s.competition.length>300))||(s.model_version!==undefined&&!text(s.model_version,100)))fail('Los metadatos de la selección no son válidos.');
  if(time(s.start_utc)<=now)fail('Solo se pueden registrar partidos sin comenzar.');
  if(time(s.observed_utc)>now||now-time(s.observed_utc)>1800000)fail('La cuota debe tener una captura vigente de hasta 30 minutos.');
  const sides=s.sport==='football'?['1','X','2']:['1','2'];
  if(!sides.includes(s.selection)||!Number.isFinite(s.odds)||s.odds<=1||s.odds>10000)fail('Selección o cuota no válida.');
  probabilities(s.probabilities,sides);probabilities(s.market_probabilities,sides);
  if(s.virtual||s.stale||s.expired)fail('La selección está fuera de alcance o no está vigente.');
 }
 function sourceValid(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&value.length<=2048;}catch{return false;}
 }
 function create(now=Date.now()){
  return {version:1,initial_balance:10000,daily_goal:3000,created_utc:new Date(now).toISOString(),tickets:[]};
 }
 function payout(ticket){return !ticket.settlement?0:ticket.settlement.actual_selection==='void'?ticket.stake:ticket.settlement.actual_selection===ticket.selection?Math.round(ticket.stake*ticket.odds):0;}
 function balance(state){return state.initial_balance-state.tickets.reduce((n,t)=>n+t.stake,0)+state.tickets.reduce((n,t)=>n+payout(t),0);}
 function register(state,snapshot,stake,now=Date.now(),id=globalThis.crypto.randomUUID()){
  snapshotValid(snapshot,now);
  if(!Number.isSafeInteger(stake)||stake<1||stake>balance(state))fail('El importe debe ser entero, positivo y no superar el saldo disponible.');
  if(state.tickets.length>=5000)fail('Se alcanzó el límite de registros de esta cartera. Exporta tu copia.');
  if(state.tickets.some(t=>t.sport===snapshot.sport&&t.event_id===snapshot.event_id&&t.start_utc===snapshot.start_utc))fail('Este partido ya tiene una simulación registrada.');
  if(!text(id,100)||state.tickets.some(t=>t.id===id))fail('Identificador duplicado o no válido.');
  const keys=['sport','event_id','event','competition','market','start_utc','observed_utc','selection','pick','odds','basis','model_version','probabilities','market_probabilities'];
  const ticket=Object.fromEntries(keys.filter(k=>snapshot[k]!==undefined).map(k=>[k,clone(snapshot[k])]));
  ticket.id=id;ticket.stake=stake;ticket.recorded_utc=new Date(now).toISOString();ticket.settlement=null;
  const next=clone(state);next.tickets.push(ticket);return next;
 }
 function settle(state,id,result,now=Date.now()){
  const next=clone(state),ticket=next.tickets.find(t=>t.id===id);
  if(!ticket)fail('No existe esa simulación.');
  if(ticket.settlement)fail('El resultado ya fue confirmado y no se puede sustituir.');
  if(time(ticket.start_utc)>now)fail('El partido todavía no comienza.');
  if(!result||result.final!==true||!sourceValid(result.source_url))fail('Confirma el resultado final e indica una fuente HTTPS sin credenciales.');
  if(!['automatic','manual'].includes(result.confirmation_type))fail('Origen de confirmación no válido.');
  if(result.actual_selection!=='void'&&!Object.hasOwn(ticket.probabilities,result.actual_selection))fail('Resultado incompatible con el mercado.');
  ticket.settlement={actual_selection:result.actual_selection,source_url:result.source_url,confirmation_type:result.confirmation_type,final:true,confirmed_utc:new Date(now).toISOString()};
  return next;
 }
 function validate(state,now=Date.now()){
  if(!state||state.version!==1||state.initial_balance!==10000||state.daily_goal!==3000||!Array.isArray(state.tickets)||state.tickets.length>5000||time(state.created_utc)>now)fail('La copia no corresponde a una cartera simulada compatible.');
  const ids=new Set(),fixtures=new Set(),events=[];
  for(const ticket of state.tickets){
   const recorded=time(ticket.recorded_utc);
   if(recorded<time(state.created_utc)||recorded>now)fail('La fecha de registro no es válida.');
   snapshotValid(ticket,recorded);
   const fixture=JSON.stringify([ticket.sport,ticket.event_id,ticket.start_utc]);
   if(!text(ticket.id,100)||ids.has(ticket.id)||fixtures.has(fixture)||!Number.isSafeInteger(ticket.stake)||ticket.stake<1)fail('La copia contiene registros duplicados o importes inválidos.');
   ids.add(ticket.id);fixtures.add(fixture);events.push({at:recorded,delta:-ticket.stake,order:0});
   if(ticket.settlement){
    const result=ticket.settlement,confirmed=time(result.confirmed_utc);
    if(confirmed<time(ticket.start_utc)||confirmed<recorded||confirmed>now||!sourceValid(result.source_url)||result.final!==true||!['automatic','manual'].includes(result.confirmation_type)||!(result.actual_selection==='void'||Object.hasOwn(ticket.probabilities,result.actual_selection)))fail('La copia contiene una confirmación no válida.');
    events.push({at:confirmed,delta:payout(ticket),order:1});
   }
  }
  let available=10000;
  for(const event of events.sort((a,b)=>a.at-b.at||a.order-b.order)){available+=event.delta;if(available<0||!Number.isSafeInteger(available))fail('La copia contiene apuestas superiores al saldo disponible.');}
  return clone(state);
 }
 function summary(state,now=Date.now()){
  const completed=state.tickets.filter(t=>t.settlement),pending=state.tickets.filter(t=>!t.settlement);
  const scored=completed.filter(t=>t.settlement.actual_selection!=='void');
  const profit=t=>payout(t)-t.stake;
  const net=completed.reduce((n,t)=>n+profit(t),0),reserved=pending.reduce((n,t)=>n+t.stake,0);
  let equity=10000,peak=10000,maxDrawdown=0,maxDrawdownPercent=0;
  for(const t of completed.slice().sort((a,b)=>time(a.settlement.confirmed_utc)-time(b.settlement.confirmed_utc))){
   equity+=profit(t);peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak-equity);maxDrawdownPercent=Math.max(maxDrawdownPercent,(peak-equity)/peak);
  }
  const byOrigin=[];
  const versions=[...new Set(scored.map(t=>JSON.stringify([t.basis,t.model_version||'Sin versión'])))];
  for(const identity of versions)for(const origin of ['automatic','manual']){
   const [basis,version]=JSON.parse(identity),sample=scored.filter(t=>t.basis===basis&&(t.model_version||'Sin versión')===version&&t.settlement.confirmation_type===origin);if(!sample.length)continue;
   const brier=(t,p)=>Object.entries(p).reduce((n,[side,v])=>n+(v-(side===t.settlement.actual_selection?1:0))**2,0);
   byOrigin.push({basis,version,origin,count:sample.length,brier:sample.reduce((n,t)=>n+brier(t,t.probabilities),0)/sample.length,market_brier:sample.reduce((n,t)=>n+brier(t,t.market_probabilities),0)/sample.length});
  }
  const calendarNumber=value=>{const [y,m,d]=day(value).split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;};
  const days=Math.max(1,calendarNumber(now)-calendarNumber(state.created_utc)+1);
  return {available:balance(state),reserved,equity:balance(state)+reserved,net_profit:net,today_profit:completed.filter(t=>day(t.settlement.confirmed_utc)===day(now)).reduce((n,t)=>n+profit(t),0),
   pending:pending.length,settled:completed.length,scored:scored.length,wins:scored.filter(t=>t.selection===t.settlement.actual_selection).length,
   max_drawdown:maxDrawdown,max_drawdown_percent:maxDrawdownPercent,days_without_bets:Math.max(0,days-new Set(state.tickets.map(t=>day(t.recorded_utc))).size),comparison:byOrigin};
 }
 return {create,register,settle,validate,summary,payout,day,sourceValid};
});
