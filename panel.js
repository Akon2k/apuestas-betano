'use strict';
const token=document.querySelector('meta[name="panel-token"]').content;
const $=id=>document.getElementById(id);
const staticMode=Boolean(document.querySelector('meta[name="panel-static"]'));
let rows=[],analyses=[],combos=[],comboQuery='',signature=null,selectedEvent=null;
let available={},refreshState={running:false};
let activeSport=document.querySelector('meta[name="panel-sport"]').content;
const sportSettings=new Map();
const sportCatalog=JSON.parse($('sport-catalog').textContent);
const sportNames=Object.fromEntries(Object.entries(sportCatalog).map(([id,info])=>[id,info.name]));
for(const [id,info] of Object.entries(sportCatalog)){
 const option=element('option',info.name+(info.supported?'':' · catálogo'));option.value=id;$('sport-select').append(option);
 const button=element('button');button.dataset.sport=id;button.setAttribute('aria-pressed','false');button.append(element('strong',info.name),element('small',info.supported?'Con captura':'Solo catálogo'));document.querySelector('.sport-tabs').append(button);
}
const sides=()=>sportCatalog[activeSport].outcomes===3?['1','X','2']:['1','2'];
const percent=n=>(n*100).toFixed(1)+' %';
const competition=a=>[a.country,a.competition].filter(Boolean).join(' · ')||'Campeonato o torneo no disponible';
function date(value,seconds=false){const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-CL',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{}),hourCycle:'h23'});}
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(className)node.className=className;return node;}
const labelBasis=a=>a.basis==='Mercado Betano'?'Solo cuotas':a.basis==='Poisson experimental'?'Historial de equipos':'Predicción externa';
const shortAdvice=a=>a.status==='value'?a.pick:a.status==='market'?'Favorito del mercado':a.stale?'Actualizar cuotas':a.expired?'Ya iniciado':a.virtual?'Fuera de alcance':'Sin apuesta clara';
function render(){
 const groups=new Map();for(const r of rows){if(!groups.has(r.event_id))groups.set(r.event_id,[]);groups.get(r.event_id).push(r);}
 $('count').textContent=analyses.filter(a=>!a.virtual).length;$('predictions').textContent=analyses.filter(a=>a.historical||a.statistics?.available||a.basis!=='Mercado Betano').length;$('updated').textContent=available.capture_utc?date(available.capture_utc,true):rows.length?date(rows[0].observed_utc,true):'Sin captura';
 const query=$('search').value.toLocaleLowerCase();
 const visible=analyses.filter(a=>(a.event+' '+competition(a)).toLocaleLowerCase().includes(query)&&($('filter').value==='all'||!a.virtual)&&($('filter').value!=='candidates'||['market','value'].includes(a.status))&&($('filter').value!=='historical'||a.historical||a.statistics?.available));
 if($('sort').value==='probability-desc')visible.sort((a,b)=>b.probability-a.probability);
 else if($('sort').value!=='analysis')visible.sort((a,b)=>{const x=Date.parse(a.start_utc),y=Date.parse(b.start_utc);if(!Number.isFinite(x))return Number.isFinite(y)?1:0;if(!Number.isFinite(y))return -1;return ($('sort').value==='date-desc'?-1:1)*(x-y);});
 const body=$('matches');body.replaceChildren();
 for(const a of visible){
  const group=groups.get(a.event_id);if(!group)continue;const first=group[0];const tr=element('tr');if(a.probability>=.5){tr.classList.add('probability-high');}
  const name=element('td');name.title=first.market;name.append(element('span',a.event,'match-name'),element('small',competition(a),'subline competition'));tr.append(name);
  const start=element('td');const time=element('time',date(a.start_utc));time.dateTime=a.start_utc;start.append(time);if(a.expired)start.append(element('small','Ya iniciado','subline'));tr.append(start);
  const odds=element('td');const oddsList=element('div',null,'odds');for(const side of sides()){const r=group.find(r=>r.selection===side);const pill=element('span',null,'odd');pill.append(element('small',side),document.createTextNode(r?Number(r.odds).toFixed(2):'—'));oddsList.append(pill);}odds.append(oddsList);tr.append(odds);
  const favorite=element('td');favorite.append(element('span',a.winner,'match-name'),element('small',percent(a.probability),'subline'));tr.append(favorite);
  const advice=element('td');advice.append(element('span',shortAdvice(a),a.status==='value'?'positive':null),element('small',labelBasis(a),'subline'));if(a.status==='value')advice.append(element('small',`Cuota ${a.pick_odds.toFixed(2)} · VE ${percent(a.expected_value)}`,'subline'));tr.append(advice);
  const action=element('td');const button=element('button',a.historical||a.statistics?.available?(activeSport==='tennis'?'Analizar jugadores':'Analizar equipos'):'Ver disponibilidad','row-action');button.onclick=()=>openAnalysis(a.event_id);action.append(button);tr.append(action);body.append(tr);
 }
 if(!body.children.length){const tr=element('tr');const td=element('td',!sportCatalog[activeSport].supported?'Esta categoría está en el catálogo. Su captura aún no está adaptada; consulta Abrir en Betano.':rows.length?'No hay partidos con estos filtros.':$('day').value==='today'?'No hay partidos de hoy sin comenzar en la captura. Actualiza los datos o selecciona Todos los capturados.':'Todavía no hay cuotas. Pulsa Actualizar datos.','empty');td.colSpan=6;tr.append(td);body.append(tr);}
 $('match-count').textContent=`${visible.length} partidos visibles · análisis y fuentes disponibles en cada fila.`;
}
function profileCard(name,profile){
 const card=element('section',null,'team-card');card.append(element('h3',name));const recent=profile.recent;
 const form=element('div',null,'form');form.setAttribute('aria-label','Últimos resultados, el más reciente al final');for(const match of profile.last_matches){const mark=element('span',match.result,match.result);mark.title=`${match.date} · ${match.opponent} · ${match.goals_for}-${match.goals_against}`;form.append(mark);}card.append(form,element('small','Últimos cinco de liga · reciente a la derecha · V victoria, E empate, D derrota'));
 const stats=element('div',null,'stats-line');for(const [label,value] of [['Victorias',recent.wins],['Goles a favor',recent.goals_for],['En contra',recent.goals_against]]){const box=element('div',label);box.append(element('b',value));stats.append(box);}card.append(stats);
 const overall=profile.overall,venue=profile.venue;
 card.append(element('p',`Últimos ${recent.matches}: ${recent.wins}V · ${recent.draws}E · ${recent.losses}D. Promedio: ${recent.scored_per_match.toFixed(2)} goles marcados y ${recent.conceded_per_match.toFixed(2)} recibidos por partido.`,'profile-note'));
 card.append(element('p',`${profile.venue_label}: ${venue.wins}V · ${venue.draws}E · ${venue.losses}D en ${venue.matches} partidos. Goles: ${venue.goals_for} a favor / ${venue.goals_against} en contra.`,'profile-note'));
 card.append(element('small',`Muestra general: ${overall.matches} partidos · ${overall.wins}V-${overall.draws}E-${overall.losses}D.`));
 for(const match of [...profile.last_matches].reverse()){const row=element('div',null,'recent-match');const parts=match.date.split('-');row.append(element('span',`${parts[2]}/${parts[1]}`),element('span',`${match.at_home?'Casa':'Fuera'} · ${match.opponent}`),element('b',`${match.goals_for}–${match.goals_against} ${match.result}`));card.append(row);}return card;
}
function renderPublicStatistics(content,a,teams){
 const info=a.statistics;
 const resultDate=value=>activeSport==='nfl'?value.slice(0,10).split('-').reverse().join('/'):date(value);
 const note=element('section',null,'insight-box');note.append(element('h3','Resultados recientes · '+info.source_name),element('p',info.period),element('p',info.warning));
 note.append(element('p','Estadísticas descriptivas: no modifican los porcentajes del mercado. Consulta: '+date(info.fetched_utc,true)+' · Chile.'));
 if(info.cache_old)note.append(element('p','Datos de hace más de 24 horas. Actualiza antes de interpretarlos.','no-history'));
 content.append(note);const grid=element('div',null,'team-grid');
 for(const [i,p] of info.profiles.entries()){
  const card=element('section',null,'team-card');card.append(element('h3',teams[i]));
  if(!p){card.append(element('p','Sin resultados reconocidos en esta muestra.'));grid.append(card);continue;}
  card.append(element('p',`${p.matches} partidos de muestra: ${p.wins} victorias, ${p.losses} derrotas${p.draws?', '+p.draws+' empates':''}.`));
  if(activeSport==='tennis')card.append(element('p',`Sets: ${p.sets_for} ganados / ${p.sets_against} perdidos.`));
  else card.append(element('p',`Promedio de puntos: ${p.scored_per_match.toFixed(1)} a favor / ${p.conceded_per_match.toFixed(1)} en contra.`),element('p',`${p.venue_label}: ${p.venue_wins} victorias en ${p.venue_matches} partidos de esta muestra.`));
  card.append(element('small','Último resultado: '+resultDate(p.latest_result)+(activeSport==='nfl'?' · fecha de la fuente':' · Chile')));
  for(const match of [...p.last_matches].reverse()){
   const row=element('div',null,'recent-match');row.append(element('span',resultDate(match.date).split(',')[0]),element('span',match.opponent+(match.tournament?' · '+match.tournament:match.at_home?' · Local':' · Visitante')),element('b',`${match.score_for}–${match.score_against} ${match.result}`));card.append(row);
  }
  card.append(element('small','V victoria · E empate · D derrota'+(activeSport==='tennis'?' · marcador en sets':'')));grid.append(card);
 }
 content.append(grid);
 if(info.head_to_head){const h=info.head_to_head;content.append(element('p',h.matches?`Enfrentamientos encontrados en esta muestra: ${h.matches}. ${teams[0]} ganó ${h.first_wins}; ${teams[1]} ganó ${h.matches-h.first_wins}.`:'No se encontraron enfrentamientos directos en esta muestra parcial. No representa el historial completo.','hint'));}
 const link=element('a','Consultar fuente · '+info.source_name,'source');link.href=info.source_url;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
}
function openAnalysis(eventId){selectedEvent=eventId;renderAnalysis();if(!$('team-dialog').open)$('team-dialog').showModal();}
function renderAnalysis(){
 const dialog=$('team-dialog');const keepState=dialog.dataset.eventId===selectedEvent;
 const previousScroll=keepState?dialog.scrollTop:0;
 const methodOpen=keepState&&Boolean(dialog.querySelector('details')?.open);
 const a=analyses.find(a=>a.event_id===selectedEvent);if(!a){$('team-content').replaceChildren(element('p','Este partido ya no aparece en la captura actual. Cierra la ficha y revisa los partidos disponibles.','no-history'));return;}
 $('team-title').textContent=a.event;$('team-basis').textContent=labelBasis(a);$('team-date').textContent=competition(a)+' · '+date(a.start_utc)+' · hora de Chile';
 const content=$('team-content');content.replaceChildren();const teams=a.event.split(' - ');
 const probabilities=element('div',null,'probabilities');if(sides().length===2)probabilities.classList.add('two-way');for(const side of sides()){const box=element('div',side==='X'?'Empate':side==='1'?teams[0]:teams[1]||'Participante 2');box.append(element('b',percent(a.probabilities[side])),element('small',a.basis!=='Mercado Betano'?`Mercado: ${percent((a.market_probabilities||a.probabilities)[side])}`:'Estimación del mercado'));probabilities.append(box);}content.append(probabilities);
 const h=a.historical;
 if(h?.home_profile&&h?.away_profile){
  const home=h.home_profile.recent,away=h.away_profile.recent;
  const insights=element('section',null,'insight-box');insights.append(element('h3','Lectura del enfrentamiento'));
  const homePoints=home.wins*3+home.draws,awayPoints=away.wins*3+away.draws;
  insights.append(element('p',`En sus últimos ${home.matches}/${away.matches} partidos, ${teams[0]} sumó ${homePoints} puntos y ${teams[1]} ${awayPoints}. ${teams[0]} marcó ${home.goals_for} goles y recibió ${home.goals_against}; ${teams[1]} marcó ${away.goals_for} y recibió ${away.goals_against}.`));
  insights.append(element('p',`${teams[0]} como local: ${h.home_profile.venue.wins} victorias en ${h.home_profile.venue.matches}. ${teams[1]} como visitante: ${h.away_profile.venue.wins} victorias en ${h.away_profile.venue.matches}. El modelo estima ${h.home_goals.toFixed(2)} / ${h.away_goals.toFixed(2)} goles para este partido.`));
  content.append(insights);const grid=element('div',null,'team-grid');grid.append(profileCard(teams[0],h.home_profile),profileCard(teams[1],h.away_profile));content.append(grid);
 }else if(a.statistics?.available){
  renderPublicStatistics(content,a,teams);
 }else{
  const empty=element('div',null,'no-history');if(!['football','tennis','nba','nfl'].includes(activeSport)){empty.append(element('h3','Favorito del mercado'),element('p','Se comparan las cuotas del mercado principal capturado. No hay estadísticas independientes conectadas para esta disciplina. Las reglas de empate y prórroga dependen del mercado de Betano.'));content.append(empty);}else{empty.append(element('h3',activeSport!=='football'?'Favoritismo de '+sportNames[activeSport]+' según las cuotas':'Sin historial suficiente para comparar estos equipos'),element('p',['nba','nfl'].includes(activeSport)?`${teams[0]} y ${teams[1]}: se comparan las dos cuotas del mercado Ganador. No hay resultados disponibles para estos equipos en la fuente gratuita. No se incorporan lesiones ni alineaciones. Consulta en Betano las reglas de prórroga y empate para este mercado.`:activeSport==='tennis'?`${teams[0]} y ${teams[1]||'el segundo participante'}: las probabilidades mostradas se calculan con las cuotas del ganador del partido. No hay empate. No hay resultados reconocidos para estos jugadores en la muestra gratuita. No se incorporan ranking, superficie ni lesiones.`:`${teams[0]} y ${teams[1]||'el visitante'} no tienen una comparación histórica disponible en la fuente conectada. Las cuotas permiten identificar favoritismo, pero no describen su forma ni su rendimiento.`));content.append(empty);}
 }
 const decision=element('section',null,'insight-box');decision.append(element('h3',a.recommendation),element('p',a.reason));content.append(decision);
 if(h){
  content.append(element('p',`Historial de ${h.league_label||'la liga cubierta'}. Resultados usados: ${h.oldest_result} a ${h.latest_result}. No incluye otras competiciones, lesiones, alineaciones ni noticias de última hora.`,'hint'));
  const link=element('a','Consultar fuente de resultados · Football-Data','source');link.href=h.source_url;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
  const detail=element('details',null,'dialog-detail');detail.open=methodOpen;detail.append(element('summary','Método y validación'));const validation=h.validation||{};detail.append(element('p',`Poisson experimental basado en goles y promedio de liga. Evaluación cronológica: ${validation.matches||0} partidos. Muestra limitada; no prueba rentabilidad ni garantiza calibración de los porcentajes.`));content.append(detail);
 }
 dialog.dataset.eventId=selectedEvent;dialog.scrollTop=previousScroll;
}
const comboOpen=new Set();
function renderCombos(){
 const container=$('combo-cards');container.replaceChildren();$('combo-status').textContent=combos.length?`${combos.length} opciones · ordenadas por probabilidad conjunta estimada.`:'No hay suficientes selecciones vigentes para ese rango. Actualiza los datos o ajusta los límites.';
 for(const [i,combo] of combos.entries()){
  const card=element('article',null,'combo-card');card.append(element('span',`Opción ${i+1} · ${combo.legs.length} partidos`,'badge'),element('p',`× ${combo.factor.toFixed(3)}`,'factor'));
  const probability=element('div',null,'combo-probability');probability.append(element('span','PROBABILIDAD CONJUNTA ESTIMADA','combo-probability-label'),element('strong',percent(combo.probability),'combo-probability-value'),element('small','Aproximación bajo independencia · no es garantía'));card.append(probability);
  const list=element('ol');for(const leg of combo.legs){const item=element('li',`${leg.pick} gana · ${leg.odds.toFixed(2)}`);item.append(element('small',`${leg.event} · ${competition(leg)} · ${date(leg.start_utc)}`,'subline'));list.append(item);}card.append(list,element('small',combo.basis));
  const detail=element('details',null,'dialog-detail');const key=combo.legs.map(l=>l.event_id).join('-');detail.dataset.comboKey=key;detail.open=comboOpen.has(key);detail.addEventListener('toggle',()=>{if(!detail.isConnected)return;if(detail.open)comboOpen.add(key);else comboOpen.delete(key);});detail.append(element('summary','Supuestos y valor esperado'),element('p',`*Aproximación bajo independencia. Valor esperado teórico: ${percent(combo.expected_value)}. Cuotas bajas no garantizan rentabilidad.`));card.append(detail);
  const copy=element('button','Copiar selecciones','secondary');copy.onclick=async()=>{try{await navigator.clipboard.writeText(combo.legs.map(l=>`${l.event}: ${l.pick} (${l.odds.toFixed(2)})`).join('\n')+`\nFactor ${combo.factor.toFixed(3)} · cuotas sujetas a cambio`);copy.textContent='Copiado';}catch{copy.textContent='No se pudo copiar';}};card.append(copy);container.append(card);
 }
}
const elapsedTime=seconds=>{const s=Math.max(0,Math.floor(seconds));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
function renderActivity(){
 $('refresh-activity').hidden=!refreshState.running;if(!refreshState.running)return;
 const started=Date.parse(refreshState.started_utc);const elapsed=Number.isFinite(started)?Math.max(0,(Date.now()-started)/1000):0;
 const estimate=Number(refreshState.estimated_seconds)||40;const remaining=Math.max(0,Math.ceil(estimate-elapsed));
 $('refresh-phase').textContent=refreshState.phase_label||'Actualizando datos';$('refresh-clock').textContent='Transcurrido '+elapsedTime(elapsed);
 $('refresh-estimate').textContent=remaining>0?'Faltan aproximadamente '+elapsedTime(remaining)+' · estimación, no tiempo exacto.':'Está tardando más de lo estimado; la consulta sigue en curso.';
}
function renderUpcoming(){
 const visible=$('day').value==='today'&&!rows.length&&available.upcoming_events>0;
 $('upcoming-notice').hidden=!visible;
 if(visible)$('upcoming-text').textContent='No hay partidos de hoy sin comenzar en esta captura. Hay '+available.upcoming_events+' partidos para próximas fechas. El primero comienza el '+date(available.next_start_utc)+' (Chile).';
}
async function load(){
 const requestedSport=activeSport,requestedDay=$('day').value;
 try{
  let data;if(staticMode){data=await window.staticData(requestedSport,requestedDay);}else{const response=await fetch('/api/data'+(comboQuery||'?')+(comboQuery?'&':'')+'sport='+requestedSport+'&day='+requestedDay);if(!response.ok)throw new Error();data=await response.json();}if(requestedSport!==activeSport||requestedDay!==$('day').value)return;rows=data.rows;analyses=data.analysis||[];combos=data.combinations||[];available=data.availability||{};refreshState=data;renderActivity();renderUpcoming();
  $('refresh').disabled=!sportCatalog[activeSport].supported||data.running;$('refresh').textContent=data.running?'Actualizando…':'Actualizar datos';$('status').textContent=data.message;$('status').classList.toggle('error',data.refresh_status==='error');
  if(staticMode){$('refresh').disabled=false;$('refresh').textContent='Cargar última publicación';}
  const next=JSON.stringify([rows,analyses,combos,available]);if(next!==signature){render();renderCombos();if($('team-dialog').open)renderAnalysis();signature=next;}
 }catch{if(requestedSport!==activeSport||requestedDay!==$('day').value)return;$('status').textContent=staticMode?'No se pudo cargar la publicación. Revisa la conexión y vuelve a intentarlo.':'No se pudo conectar al panel. Vuelve a abrir Abrir Betano.';$('status').classList.add('error');refreshState={running:false};renderActivity();}
}
async function post(path){const response=await fetch(path,{method:'POST',headers:{'X-Panel-Token':token}});if(!response.ok)throw new Error();await load();}
$('refresh').onclick=async()=>{if(staticMode){await load();return;}$('refresh').disabled=true;try{await post('/api/refresh?sport='+activeSport);}catch{$('status').textContent='No se pudo iniciar la actualización.';$('refresh').disabled=false;}};
$('combo-build').onclick=async()=>{const minimum=Number($('combo-min').value),maximum=Number($('combo-max').value);if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<1.5||maximum<minimum||maximum>10){$('combo-status').textContent='El mínimo debe ser al menos 1,50; el máximo debe ser mayor o igual al mínimo y hasta 10.';return;}comboQuery='?'+new URLSearchParams({combo_min:minimum,combo_max:maximum,combo_leg:$('combo-leg').value,combo_legs:$('combo-legs').value});$('combo-build').disabled=true;await load();$('combo-build').disabled=false;};
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{for(const tab of document.querySelectorAll('[data-tab]')){const active=tab===button;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active));$('view-'+tab.dataset.tab).hidden=!active;}};
$('close-analysis').onclick=()=>$('team-dialog').close();$('team-dialog').addEventListener('click',event=>{if(event.target===$('team-dialog')){const rect=$('team-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('team-dialog').close();}});
function sportLabels(){
 const info=sportCatalog[activeSport];$('sport-select').value=activeSport;$('sport-source').href=info.url;$('catalog-status').textContent=info.supported?'Captura de mercado principal · cobertura de la página cargada':'Catálogo: mercado aún no adaptado';
 const football=activeSport==='football',tennis=activeSport==='tennis',name=sportNames[activeSport];
 $('page-title').textContent=name+' · Partidos y análisis';document.title='ApuestasBetano · '+name;
 for(const button of document.querySelectorAll('[data-sport]')){const active=button.dataset.sport===activeSport;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 $('sport-name').textContent='BETANO CHILE · '+name.toUpperCase();$('search').placeholder=tennis?'Buscar jugador o torneo…':'Buscar equipo o campeonato…';
 $('odds-title').textContent=sides().length===3?'CUOTAS · 1 / X / 2':tennis?'CUOTAS · JUGADOR 1 / 2':'CUOTAS · EQUIPO 1 / 2';
 $('filter').querySelector('[value="real"]').textContent=name+' · partidos reales';$('filter').querySelector('[value="historical"]').hidden=false;
 $('sport-hint').textContent=football?'Pulsa Analizar equipos para comparar forma, goles y rendimiento local/visitante. «Solo cuotas» indica que no hay historial suficiente.':tennis?'Ganador del partido · dos participantes, sin empate. Consulta resultados recientes en Analizar jugadores. Muestra parcial gratuita; los porcentajes siguen basados en cuotas.':name+' real · mercado Ganador de dos resultados. No incluye simulaciones, hándicaps ni totales. Estadísticas gratuitas en Analizar equipos; porcentajes basados en cuotas; consulta las reglas de prórroga y empate del mercado.';
 if(!['football','tennis','nba','nfl'].includes(activeSport))$('sport-hint').textContent=info.supported?'Mercado principal de '+info.name+'. Porcentajes derivados de cuotas; sin estadísticas independientes. No garantiza todas las ligas ni todos los eventos.':'Categoría encontrada en el menú público de Betano. Su mercado necesita un adaptador específico; utiliza Abrir en Betano para consultarla.';
 $('download').href=staticMode?'#':'/download?sport='+activeSport+'&day='+$('day').value;$('download').download='cuotas-'+activeSport+'.csv';
}
function selectSport(nextSport){
 if(nextSport===activeSport)return;
 const ids=['search','filter','sort','day','combo-min','combo-max','combo-leg','combo-legs'];
 sportSettings.set(activeSport,{values:Object.fromEntries(ids.map(id=>[id,$(id).value])),comboQuery});
 activeSport=nextSport;const saved=sportSettings.get(activeSport);
 const defaults={search:'',filter:'real',sort:'probability-desc',day:'today','combo-min':'1.50','combo-max':'2.00','combo-leg':'1.45','combo-legs':'4'};
 for(const id of ids)$(id).value=saved?saved.values[id]:defaults[id];comboQuery=saved?saved.comboQuery:'';
 rows=[];analyses=[];combos=[];available={};refreshState={running:false};renderActivity();renderUpcoming();signature=null;selectedEvent=null;$('team-dialog').close();
 sportLabels();render();renderCombos();$('refresh').disabled=true;$('status').textContent='Cargando '+sportNames[activeSport]+'…';load();
}
for(const button of document.querySelectorAll('[data-sport]'))button.onclick=()=>selectSport(button.dataset.sport);
$('sport-select').onchange=()=>selectSport($('sport-select').value);
$('show-upcoming').onclick=()=>{$('day').value='upcoming';$('day').dispatchEvent(new Event('change'));};
$('day').onchange=()=>{rows=[];analyses=[];combos=[];available={};refreshState={running:false};renderActivity();renderUpcoming();signature=null;selectedEvent=null;$('team-dialog').close();sportLabels();render();renderCombos();load();};
$('download').addEventListener('click',event=>{if(!staticMode)return;event.preventDefault();const fields=['event','competition','start_utc','market','selection','odds','observed_utc'];const csv=[fields,...rows.map(r=>fields.map(k=>r[k]||''))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=element('a');a.href=url;a.download='cuotas-'+activeSport+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('search').addEventListener('input',render);$('filter').addEventListener('change',render);$('sort').addEventListener('change',render);sportLabels();load();setInterval(load,staticMode?60000:2500);setInterval(renderActivity,1000);
