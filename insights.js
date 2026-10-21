'use strict';
window.insightsData={history:{},tracking:{records:[],summary:{}},sport_status:[]};
const svgNode=(tag,attributes={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,v);return n;};
window.oddsReading=function(points,eventName,sport){
 if(!points.length)return [];
 const teams=(eventName||'').split(' - '),labels={'1':teams[0]||'Participante 1','X':'Empate','2':teams[1]||'Participante 2'};
 const first=points[0].odds,last=points.at(-1).odds,keys=['1','X','2'].filter(s=>first[s]>1&&last[s]>1),lines=[];
 if(points.length===1)return ['Hay una sola observación: aún no se puede saber si las cuotas subieron o bajaron.'];
 for(const side of keys){const change=last[side]-first[side];lines.push(labels[side]+': '+(Math.abs(change)<1e-8?'la cuota quedó igual entre el primer y el último registro.':change<0?'la cuota bajó; acertar este resultado paga menos por el mismo monto apostado.':'la cuota subió; acertar este resultado paga más por el mismo monto apostado.'));}
 const complete=Object.keys(first).sort().join()===Object.keys(last).sort().join()&&keys.length===Object.keys(first).length;
 if(complete){const total=Object.values(last).reduce((n,v)=>n+1/v,0),oldTotal=Object.values(first).reduce((n,v)=>n+1/v,0);const favorite=keys.reduce((best,s)=>last[s]<last[best]?s:best,keys[0]);const tied=keys.filter(s=>Math.abs(last[s]-last[favorite])<1e-8).length>1;
  if(tied)lines.push('La última captura no tiene un favorito único.');
  else lines.push('Comparando todas las cuotas y normalizando el margen, '+labels[favorite]+' es el favorito del mercado: pasó de '+(100/first[favorite]/oldTotal).toFixed(1)+' % a '+(100/last[favorite]/total).toFixed(1)+' % de probabilidad implícita.');
 }
 lines.push('Esto describe las cuotas entre dos observaciones. No revela cuánto dinero se apostó ni la causa del cambio, y no garantiza el resultado.');return lines;
};
function historyChart(target,eventId,market){
 const points=(window.insightsData.history[eventId]||[]).filter(p=>!market||p.market===market);
 if(!points.length){target.append(element('p','Aún no hay capturas históricas de este mercado. Se guardarán con las próximas actualizaciones.','hint'));return;}
 const sides=['1','X','2'].filter(s=>points.some(p=>p.odds[s]));
 const first=points[0],last=points.at(-1);const legend=element('div',null,'history-legend');
 const colors={'1':'#ffad75','X':'#d2bdff','2':'#77d5bf'};
 for(const side of sides){
  const from=first.odds[side],to=last.odds[side];
  if(!from||!to)continue;
  const change=to-from;
  const box=element('div',null,'history-legend-box');
  box.style.borderLeftColor=colors[side];
  const trendText=change>0?'▲ Subió ':change<0?'▼ Bajó ':'• Sin cambio ';
  const pctText=(Math.abs(change/from)*100).toFixed(1)+' %';
  box.append(
    element('strong',side+' · '+from.toFixed(2)+' → '+to.toFixed(2),'history-legend-quote'),
    element('small',trendText+pctText,'history-legend-change'+(change>0?' up':change<0?' down':''))
  );
  legend.append(box);
 }
 target.append(legend);
 target.append(element('p',`${points.length} observaciones guardadas · ${date(first.observed_utc)} a ${date(last.observed_utc)} · Chile. Hasta 60 puntos por evento dentro de 90 días. Las nuevas cuotas iguales no duplican puntos.`,'hint'));
 const current=rows.filter(r=>r.event_id===eventId&&r.market===last.market);
 if(current.length===Object.keys(last.odds).length&&current.every(r=>Number(r.odds)===last.odds[r.selection])&&Date.parse(current[0]?.observed_utc)>Date.parse(last.observed_utc))target.append(element('p','Comprobadas nuevamente sin cambios el '+date(current[0].observed_utc,true)+' · Chile.','hint'));
 const reading=element('section',null,'insight-box odds-reading');reading.append(element('h3','Cómo leer este cambio'));
 const eventName=first.event||analyses.find(a=>a.event_id===eventId)?.event||'';
 reading.append(element('p',activeSport==='football'?'1 = local · X = empate · 2 = visita.':'1 = primer jugador/equipo · 2 = segundo jugador/equipo.'));
 for(const line of window.oddsReading(points,eventName,activeSport))reading.append(element('p',line));target.append(reading);
 if(points.length===1)target.append(element('p','Solo hay una captura: todavía no se puede mostrar una evolución.','hint'));
 const values=points.flatMap(p=>Object.values(p.odds)),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.1),min=Math.max(1,lo-pad),max=hi+pad;
 const svg=svgNode('svg',{viewBox:'0 0 760 250',role:'img','aria-label':'Evolución de cuotas por fecha de captura',class:'history-chart'});
 const t0=Date.parse(first.observed_utc),t1=Date.parse(last.observed_utc);
 const x=t=>60+(t1===t0?.5:(Date.parse(t)-t0)/(t1-t0))*675,y=v=>210-(v-min)/(max-min)*185;
 for(let i=0;i<5;i++){const value=min+(max-min)*i/4,py=y(value);svg.append(svgNode('line',{x1:60,x2:735,y1:py,y2:py,stroke:'#33425b'}));const label=svgNode('text',{x:8,y:py+4,fill:'#afc1da','font-size':12});label.textContent=value.toFixed(2);svg.append(label);}
 for(const side of sides){const valid=points.filter(p=>Number.isFinite(p.odds[side]));svg.append(svgNode('polyline',{points:valid.map(p=>x(p.observed_utc)+','+y(p.odds[side])).join(' '),fill:'none',stroke:colors[side],'stroke-width':2}));for(const p of valid){const dot=svgNode('circle',{cx:x(p.observed_utc),cy:y(p.odds[side]),r:3,fill:colors[side]});const title=svgNode('title');title.textContent=side+' · '+p.odds[side].toFixed(2)+' · '+date(p.observed_utc,true);dot.append(title);svg.append(dot);}}
 for(const [px,anchor,value] of [[60,'start',first.observed_utc],[735,'end',last.observed_utc]]){const label=svgNode('text',{x:px,y:239,'text-anchor':anchor,fill:'#afc1da','font-size':11});label.textContent=date(value);svg.append(label);}
 target.append(svg);const details=element('details',null,'dialog-detail');details.append(element('summary','Ver capturas y horas exactas'));
 for(const p of [...points].reverse().slice(0,20))details.append(element('p',date(p.observed_utc,true)+' · '+sides.filter(s=>p.odds[s]).map(s=>s+': '+p.odds[s].toFixed(2)).join(' · ')));
 target.append(details);
}
window.renderOddsHistory=function(content,a){const section=element('section',null,'insight-box');section.append(element('h3','Historial de cuotas'));const market=rows.find(r=>r.event_id===a.event_id)?.market;historyChart(section,a.event_id,market);content.append(section);};
window.renderHistorySelection=function(){const value=$('history-event').value;const target=$('history-content');target.replaceChildren();if(!value){target.append(element('p','No hay eventos con capturas históricas en esta disciplina.','hint'));return;}const selected=JSON.parse(value);historyChart(target,selected[0],selected[1]);};
window.renderInsights=function(data){
 window.insightsData={history:data.history||{},tracking:data.tracking||{records:[],summary:{}},sport_status:data.sport_status||[]};
 const current=$('history-event').value;const select=$('history-event');select.replaceChildren();
 const names=new Map([...analyses,...(data.tracking?.records||[])].map(a=>[a.event_id,a.event]));
 for(const [id,points] of Object.entries(window.insightsData.history))for(const market of new Set(points.map(p=>p.market))){const option=element('option',(names.get(id)||points[0]?.event||'Evento '+id)+' · '+market);option.value=JSON.stringify([id,market]);select.append(option);}
 if([...select.options].some(o=>o.value===current))select.value=current;
 window.renderHistorySelection();renderTracking();renderStatuses();
};
function renderTracking(){
 renderLeagueEvaluation();
 const data=window.insightsData.tracking,summary=data.summary||{};
 $('results-summary').textContent=`${summary.tracked||0} selecciones registradas · ${summary.confirmed||0} resultados confirmados · ${summary.pending||0} pendientes. Aciertos: ${summary.confirmed?percent(summary.hits/summary.confirmed):'sin resultados suficientes'}.`;
 const evaluation=$('results-evaluation');evaluation.replaceChildren();
 for(const group of summary.by_basis||[])evaluation.append(element('p',`${group.basis}: ${group.hits}/${group.confirmed} aciertos. Brier: ${group.brier.toFixed(3)}; mercado guardado en ese momento: ${group.market_brier.toFixed(3)}.`));
 const body=$('results-rows');body.replaceChildren();
 const filter=$('results-filter').value;
 for(const r of data.records||[]){if(filter!=='all'&&r.state!==filter)continue;const tr=element('tr');tr.append(element('td',r.event),element('td',date(r.start_utc)),element('td',r.pick+' · '+Number(r.pick_odds).toFixed(2)),element('td',r.basis),element('td',date(r.recorded_utc)));
  const result=element('td');result.append(element('strong',r.state==='confirmed'?(r.hit?'Acertada':'No acertada'):'Pendiente de confirmar'));
  if(r.state==='confirmed'){result.append(element('small',r.score.join('–'),'subline'));const a=element('a','Fuente','source');if(/^https:\/\//.test(r.source_url)){a.href=r.source_url;a.target='_blank';a.rel='noopener noreferrer';result.append(a);}}
  if(r.state==='pending'&&!staticMode){const button=element('button','Confirmar resultado','row-action');button.disabled=Date.parse(r.start_utc)>Date.now();button.title=button.disabled?'Disponible después del inicio, cuando compruebes el resultado final.':'';button.onclick=()=>openManualResult(r);result.append(button);}
  if(r.state==='confirmed'&&r.confirmation_type==='manual')result.append(element('small','Confirmación manual','subline'));
  tr.append(result);body.append(tr);
 }
 if(!body.children.length){const tr=element('tr'),td=element('td','Todavía no hay registros con este filtro. El seguimiento empieza con capturas válidas anteriores al inicio.','empty');td.colSpan=6;tr.append(td);body.append(tr);}
}
function renderStatuses(){
 const body=$('status-rows');body.replaceChildren();const labels={catalog:'Solo catálogo',error:'Error de captura',missing:'Sin captura',stale:'Cuotas antiguas',fresh:'Actualizado'};
 for(const s of window.insightsData.sport_status){let state=s.state;if(s.capture_utc&&state!=='error'&&state!=='catalog'){const age=Date.now()-Date.parse(s.capture_utc);state=age>1800000||age<0?'stale':'fresh';}const tr=element('tr');tr.append(element('td',s.name));const stateCell=element('td');stateCell.append(element('span',labels[state]||'Sin captura','capture-state '+state));tr.append(stateCell,element('td',String(s.events||0)),element('td',s.capture_utc?date(s.capture_utc,true):'Sin datos'),element('td',s.last_attempt_utc?date(s.last_attempt_utc,true):'Sin intento registrado'),element('td',s.message||'Sin registro de actualización.'));body.append(tr);}
}
document.addEventListener('DOMContentLoaded',()=>{$('history-event').onchange=window.renderHistorySelection;$('results-filter').onchange=renderTracking;});

let manualRecord=null;
function openManualResult(record){manualRecord=record;$('result-form').reset();$('result-event').textContent=record.event+' · '+record.market+' · '+date(record.start_utc);$('result-error').textContent='';$('result-dialog').showModal();}
document.addEventListener('DOMContentLoaded',()=>{
 $('result-cancel').onclick=()=>$('result-dialog').close();
 $('result-form').onsubmit=async event=>{event.preventDefault();if(staticMode||!manualRecord)return;const button=$('result-form').querySelector('[type="submit"]');button.disabled=true;
  try{const response=await fetch('/api/result?sport='+activeSport,{method:'POST',headers:{'X-Panel-Token':token,'Content-Type':'application/json'},body:JSON.stringify({event_id:manualRecord.event_id,market:manualRecord.market,start_utc:manualRecord.start_utc,home_score:Number($('result-home').value),away_score:Number($('result-away').value),source_url:$('result-source').value,final:$('result-final').checked})});const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo guardar.');$('result-dialog').close();signature=null;await load();}catch(error){$('result-error').textContent=error.message;}finally{button.disabled=false;}
 };
});

function renderLeagueEvaluation(){
 const data=window.insightsData.tracking.evaluation||{};const groups=data[$('evaluation-origin').value]||[];
 for(const [id,key,label] of [['evaluation-league','league','Todas las ligas'],['evaluation-model','basis','Todos los modelos']]){
  const select=$(id),previous=select.value;select.replaceChildren();const all=element('option',label);all.value='all';select.append(all);
  for(const value of [...new Set(groups.map(g=>g[key]))].sort()){const option=element('option',value);option.value=value;select.append(option);}
  if([...select.options].some(o=>o.value===previous))select.value=previous;
 }
 const body=$('league-evaluation-rows');body.replaceChildren();
 for(const g of groups){if($('evaluation-league').value!=='all'&&$('evaluation-league').value!==g.league||$('evaluation-model').value!=='all'&&$('evaluation-model').value!==g.basis)continue;
  const tr=element('tr'),model=element('td',g.basis);model.append(element('small',g.version,'subline'));
  const score=v=>v===null?'Sin resultados':v.toFixed(3);
  tr.append(element('td',g.league),model,element('td',g.confirmed),element('td',g.pending),element('td',g.hit_rate===null?'Sin resultados':percent(g.hit_rate)),element('td',g.hit_interval?percent(g.hit_interval[0])+' a '+percent(g.hit_interval[1]):'Sin resultados'),element('td',score(g.brier)),element('td',score(g.market_brier)),element('td',g.brier_difference===null?'Sin resultados':(g.brier_difference>0?'+':'')+g.brier_difference.toFixed(3)),element('td',g.limited?'Limitada · '+g.confirmed+'/30':'30 o más · descriptiva'));body.append(tr);
 }
 if(!body.children.length){const tr=element('tr'),td=element('td','No hay evaluaciones con estos filtros. Aparecerán al registrar selecciones y confirmar sus resultados.','empty');td.colSpan=10;tr.append(td);body.append(tr);}
}
document.addEventListener('DOMContentLoaded',()=>{for(const id of ['evaluation-origin','evaluation-league','evaluation-model'])$(id).onchange=renderLeagueEvaluation;});
