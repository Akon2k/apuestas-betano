'use strict';
(function(){
 const E=window.Simulation,byId=id=>document.getElementById(id);
 const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
 const percent=n=>(100*n).toFixed(1)+' %';
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 let state=null,opening=null,manualTicket=null,imported=null,saving=false;
 const feeds=new Map();
 const dbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('Este navegador no permite guardar la cartera.'));return;}
  const request=indexedDB.open('betano-simulation:'+new URL('./',location.href).pathname,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('wallet');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('No se pudo abrir la cartera privada. Revisa los permisos de almacenamiento.'));
  request.onblocked=()=>reject(new Error('Cierra otras pestañas de esta página para abrir la cartera.'));
 });
 async function transaction(change,replace=false){
  const db=await dbPromise;
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('wallet','readwrite'),store=tx.objectStore('wallet'),request=store.get('state');let next,error;
   request.onsuccess=()=>{try{const current=replace?E.create():request.result?E.validate(request.result):E.create();next=change(current);E.validate(next);store.put(next,'state');}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>{state=next;render();resolve(next);};
   tx.onabort=()=>reject(error||new Error('No se pudo guardar. La cartera anterior se conserva.'));
   tx.onerror=()=>{error=error||new Error('El navegador no pudo guardar la cartera. Descarga tu copia y revisa el espacio disponible.');};
  });
 }
 function showError(id,message){byId(id).textContent=message;byId(id).hidden=!message;}
 function labels(ticket){const teams=ticket.event.split(' - ',2);return {'1':teams[0]||'Participante 1','X':'Empate','2':teams[1]||'Participante 2'};}
 function options(select,ticket,voidOption=false){
  select.replaceChildren();for(const side of Object.keys(ticket.probabilities)){const option=node('option',labels(ticket)[side]);option.value=side;select.append(option);}
  if(voidOption){const option=node('option','Mercado anulado · devolver importe');option.value='void';select.append(option);}
 }
 function render(){
  if(!state)return;
  const s=E.summary(state);byId('wallet-available').textContent=money(s.available);byId('wallet-reserved').textContent=money(s.reserved);byId('wallet-profit').textContent=money(s.net_profit);
  byId('wallet-today').textContent='Resultado confirmado hoy: '+money(s.today_profit)+' · '+s.pending+' pendientes. La referencia diaria no es una ganancia prometida.';
  byId('wallet-empty').hidden=state.tickets.length>0;
  const journal=byId('wallet-journal');journal.replaceChildren();
  for(const ticket of state.tickets.slice(-200).reverse()){
   const row=node('article',undefined,'wallet-entry'),heading=node('div',undefined,'wallet-entry-heading');
   heading.append(node('strong',ticket.event),node('span',ticket.settlement?(ticket.settlement.actual_selection==='void'?'Anulada':ticket.selection===ticket.settlement.actual_selection?'Acertada':'Fallada'):'Pendiente','simulation-label'));
   row.append(heading,node('p',ticket.pick+' · cuota '+ticket.odds.toFixed(2)+' · importe '+money(ticket.stake)),node('p',ticket.basis+' · '+(sportCatalog[ticket.sport]?.name||ticket.sport)+' · '+ticket.market,'nota-suave'),node('p','Registrada '+date(ticket.recorded_utc,true)+' · inicio '+date(ticket.start_utc)+' (Chile)','nota-suave'));
   if(ticket.settlement){
    row.append(node('p','Resultado neto: '+money(E.payout(ticket)-ticket.stake)+' · confirmación '+(ticket.settlement.confirmation_type==='automatic'?'automática':'manual')));
    const source=node('a','Consultar fuente','source');source.href=ticket.settlement.source_url;source.target='_blank';source.rel='noopener noreferrer';row.append(source);
   }else if(Date.parse(ticket.start_utc)<=Date.now()){
    const button=node('button','Confirmar con fuente','secondary');button.type='button';button.onclick=()=>openResult(ticket);row.append(button,node('p','Si no hay una coincidencia verificada, permanece pendiente.','nota-suave'));
   }
   journal.append(row);
  }
  byId('wallet-metrics').textContent=s.settled+' confirmadas · '+s.pending+' pendientes · aciertos '+(s.scored?percent(s.wins/s.scored):'sin muestra')+' · mayor caída realizada '+money(s.max_drawdown)+' ('+percent(s.max_drawdown_percent)+') · '+s.days_without_bets+' días sin registros. El listado muestra hasta 200 registros recientes; las métricas y la copia incluyen todos.';
  const comparison=byId('wallet-comparison');comparison.replaceChildren();
  if(!s.comparison.length)comparison.append(node('p','La comparación aparecerá cuando haya resultados confirmados.','nota-suave'));
  for(const group of s.comparison)comparison.append(node('p',`${group.basis} · ${group.version} · ${group.origin==='automatic'?'automática':'manual'} · ${group.count} registros · Brier ${group.brier.toFixed(4)} / mercado ${group.market_brier.toFixed(4)}.`));
 }
 async function refreshPrivate(){try{await transaction(s=>s);return true;}catch(error){showError('wallet-error',error.message);return false;}}
 function snapshot(analysis,rows,side){
  if(!analysis||analysis.stale||analysis.expired||analysis.virtual)throw new Error('Actualiza las cuotas antes de registrar este partido.');
  const group=rows.filter(r=>r.event_id===analysis.event_id),row=group.find(r=>r.selection===side);
  if(!row)throw new Error('La selección no está disponible.');
  // Reject a partially stale market, not just the selected side.
  for(const quote of group){const observed=Date.parse(quote.observed_utc);if(!Number.isFinite(observed)||observed>Date.now()||Date.now()-observed>1800000)throw new Error('La captura del mercado ya no está vigente.');}
  return {sport:analysis.sport,event_id:analysis.event_id,event:analysis.event,competition:analysis.competition||'',market:row.market,start_utc:row.start_utc,observed_utc:row.observed_utc,
   selection:side,pick:labels(analysis)[side],odds:Number(row.odds),basis:analysis.basis,model_version:analysis.model_version,
   probabilities:analysis.probabilities,market_probabilities:analysis.market_probabilities};
 }
 function updateEstimate(){
  if(!opening)return;
  try{const selected=snapshot(opening.analysis,opening.rows,byId('simulation-side').value),stake=Number(byId('simulation-stake').value);
   byId('simulation-evidence').textContent=selected.basis+' · '+percent(selected.probabilities[selected.selection])+' estimado · cuota '+selected.odds.toFixed(2)+' · captura '+date(selected.observed_utc,true);
   byId('simulation-return').textContent=Number.isSafeInteger(stake)&&stake>0?'Si acierta: ganancia '+money(Math.round(stake*selected.odds)-stake)+'. Si falla: pérdida '+money(stake)+'.':'Introduce un importe para ver el resultado posible.';
  }catch(error){showError('simulation-error',error.message);}
 }
 async function open(analysis,rows){
  try{await refreshPrivate();if(!state)throw new Error('La cartera no está disponible.');opening={analysis:structuredClone(analysis),rows:structuredClone(rows)};
   byId('simulation-form').reset();showError('simulation-error','');byId('simulation-event').textContent=analysis.event+' · '+date(analysis.start_utc)+' (Chile)';options(byId('simulation-side'),analysis);
   byId('simulation-side').value=analysis.winner_selection||'1';byId('simulation-stake').max=E.summary(state).available;
   byId('simulation-balance').textContent='Disponible: '+money(E.summary(state).available)+'. El importe quedará reservado.';
   updateEstimate();byId('simulation-dialog').showModal();
  }catch(error){showError('wallet-error',error.message);window.selectView('wallet');}
 }
 function openResult(ticket){manualTicket=ticket;byId('simulation-result-form').reset();showError('simulation-result-error','');byId('simulation-result-event').textContent=ticket.event+' · '+ticket.market;options(byId('simulation-result-side'),ticket,true);byId('simulation-result-dialog').showModal();}
 async function consume(data,sport){
  feeds.set(sport,data.tracking?.settlements||[]);
  try{await transaction(current=>{
   let next=current;
   for(const ticket of current.tickets){
    if(ticket.settlement||Date.parse(ticket.start_utc)>Date.now())continue;
    const candidates=(feeds.get(ticket.sport)||[]).filter(r=>r.event_id===ticket.event_id&&r.market===ticket.market&&r.start_utc===ticket.start_utc&&r.confirmation_type!=='manual');
    const unique=new Map(candidates.map(r=>[r.result_selection,r]));if(unique.size!==1)continue;
    const result=[...unique.values()][0];
    try{next=E.settle(next,ticket.id,{actual_selection:result.result_selection,source_url:result.source_url,confirmation_type:'automatic',final:true});}catch{/* No unverified result is substituted. */}
   }return next;
  });}catch(error){showError('wallet-error',error.message);}
 }
 async function refreshResults(){
  const statuses=await Promise.allSettled(Object.keys(sportCatalog).map(async sport=>{
   let data;if(staticMode)data=await window.staticData(sport,'all');else{const r=await fetch('/api/data?sport='+sport);if(!r.ok)throw new Error('Sin datos');data=await r.json();}await consume(data,sport);
  }));
  if(statuses.some(s=>s.status==='rejected'))showError('wallet-error','No se pudieron consultar todos los resultados. Los registros sin fuente permanecen pendientes.');
 }
 function download(){if(!state)return;const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='cartera-simulada-'+E.day(Date.now())+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 byId('simulation-side').onchange=updateEstimate;byId('simulation-stake').oninput=updateEstimate;
 byId('simulation-cancel').onclick=()=>byId('simulation-dialog').close();byId('simulation-result-cancel').onclick=()=>byId('simulation-result-dialog').close();
 byId('simulation-form').onsubmit=async event=>{
  event.preventDefault();if(saving)return;saving=true;byId('simulation-submit').disabled=true;
  try{const selected=snapshot(opening.analysis,opening.rows,byId('simulation-side').value);await transaction(s=>E.register(s,selected,Number(byId('simulation-stake').value)));byId('simulation-dialog').close();window.selectView('wallet');}
  catch(error){showError('simulation-error',error.message);}finally{saving=false;byId('simulation-submit').disabled=false;}
 };
 byId('simulation-result-form').onsubmit=async event=>{
  event.preventDefault();if(saving)return;saving=true;byId('simulation-result-submit').disabled=true;
  try{const result={actual_selection:byId('simulation-result-side').value,source_url:byId('simulation-result-source').value,confirmation_type:'manual',final:byId('simulation-result-final').checked};await transaction(s=>E.settle(s,manualTicket.id,result));byId('simulation-result-dialog').close();}
  catch(error){showError('simulation-result-error',error.message);}finally{saving=false;byId('simulation-result-submit').disabled=false;}
 };
 byId('wallet-export').onclick=async()=>{if(await refreshPrivate())download();};byId('wallet-import-backup').onclick=download;
 byId('wallet-import-open').onclick=()=>byId('wallet-import').click();
 byId('wallet-import').onchange=async event=>{
  try{const file=event.target.files[0];if(!file)return;if(file.size>32000000)throw new Error('La copia supera el límite de 32 MB.');imported=E.validate(JSON.parse(await file.text()));const s=E.summary(imported);byId('wallet-import-description').textContent=imported.tickets.length+' registros · saldo disponible '+money(s.available)+'.';byId('wallet-import-dialog').showModal();}
  catch(error){showError('wallet-error',error.message);}finally{event.target.value='';}
 };
 byId('wallet-import-cancel').onclick=()=>{imported=null;byId('wallet-import-dialog').close();};
 byId('wallet-import-confirm').onclick=async()=>{try{if(!imported)return;await transaction(()=>E.validate(imported),true);imported=null;byId('wallet-import-dialog').close();showError('wallet-error','');}catch(error){showError('wallet-error',error.message);}};
 window.Wallet={open,consume,refresh:async()=>{await refreshPrivate();await refreshResults();}};
 window.addEventListener('focus',refreshPrivate);
 refreshPrivate();
 const requestedView=new URL(location.href).searchParams.get('view');
 if(['matches','wallet','history','results','combos','status'].includes(requestedView))window.selectView(requestedView);
})();
