import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import words from './words.json';
import {createMatch, transition, playerView, maxClueCount, checkPool} from './engine.js';
import {translator, message} from './i18n.js';
import {latinDigits, parseInteger, timerValue} from './ui-utils.js';
import './style.css';
const h=React.createElement;
function saved(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,value);}catch{}}
function firstPlayers(){return [
 {id:'p1',name:saved('passnames-name','الجاسوس الأزرق'),team:'blue',role:'spy'},
 {id:'p2',name:'العميل الأزرق',team:'blue',role:'agent'},
 {id:'p3',name:'الجاسوس الأحمر',team:'red',role:'spy'},
 {id:'p4',name:'العميل الأحمر',team:'red',role:'agent'}
];}
function Button({children,kind='',...props}){return h('button',{type:'button',className:'button '+kind,...props},children);}
function ClickIcon(){return h('svg',{viewBox:'0 0 24 24',width:21,height:21,fill:'none','aria-hidden':true},h('path',{d:'M9 3v3M3 9h3M5 5l2 2M13 4l-1 2M4 13l2-1',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round'}),h('path',{d:'m9 9 3 12 3-4 5-1-11-7Z',fill:'currentColor',stroke:'currentColor',strokeLinejoin:'round'}));}
function Trophy(){return h('svg',{className:'trophy',viewBox:'0 0 64 64',fill:'none','aria-hidden':true},h('path',{d:'M19 10h26v15c0 11-6 17-13 17s-13-6-13-17V10Z',fill:'currentColor'}),h('path',{d:'M19 15H9v9c0 9 6 13 14 13M45 15h10v9c0 9-6 13-14 13M32 42v11M22 55h20',stroke:'currentColor',strokeWidth:5,strokeLinecap:'round',strokeLinejoin:'round'}));}
function Celebration({team}){return h('div',{className:'confetti '+team,'aria-hidden':true},Array.from({length:72},(_,i)=>h('i',{key:i,style:{'--x':((i*37)%101)+'vw','--delay':((i%12)*.12)+'s','--duration':(2.8+(i%5)*.35)+'s','--drift':((i%2?1:-1)*(30+i%80))+'px','--spin':(180+(i*73)%600)+'deg','--shade':i%3}})));}
function App(){
 const [lang,setLang]=useState(()=>saved('passnames-language','ar')==='en'?'en':'ar');
 const [settings,setSettings]=useState({mode:'standard',timerEnabled:false,timerInput:'60',manualDraw:false});
 const [players,setPlayers]=useState(firstPlayers);
 const [state,setState]=useState(null);
 const [viewer,setViewer]=useState('p1');
 const [error,setError]=useState('');
 const [help,setHelp]=useState(false);
 const [drawer,setDrawer]=useState(false);
 const [clueText,setClueText]=useState('');
 const [clueCount,setClueCount]=useState(1);
 const [tool,setTool]=useState(null);
 const [selected,setSelected]=useState([]);
 const [highlights,setHighlights]=useState({});
 const [now,setNow]=useState(Date.now());
 const [tab,setTab]=useState('clues');
 const [confirm,setConfirm]=useState(false);
 const [health,setHealth]=useState('');
 const t=translator(lang);
 const view=state?playerView(state,viewer):null;
 const mode=view?view.settings.mode:settings.mode;
 const myTurn=view?.active===view?.me.team;
 const activeAgent=view?.me.role==='agent'&&myTurn&&!view.pause&&!['deal','finished'].includes(view.phase);
 const max=state?maxClueCount(state):0;
 const timeLeft=view?.deadline!=null?Math.max(0,Math.ceil((view.deadline-now)/1000)):null;
 const countLabel=n=>n==='unlimited'?t('unlimited'):String(n);
 let poolError='';try{checkPool(words);}catch(e){poolError=message(lang,e.message);}
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';save('passnames-language',lang);},[lang]);
 useEffect(()=>{if(!state||state.deadline===null||state.pause)return;const id=setInterval(()=>{const current=Date.now();setNow(current);setState(s=>s?transition(s,{type:'TICK'},current):null);},200);return()=>clearInterval(id);},[state?.deadline,state?.pause]);
 useEffect(()=>{setClueText('');setClueCount(1);setTool(null);setSelected([]);setError('');setConfirm(false);},[state?.turnNumber,viewer]);
 useEffect(()=>{if(state?.phase!=='clue'&&tool==='swap'){setTool(null);setSelected([]);}},[state?.phase]);
 useEffect(()=>{const fn=e=>{if(e.key==='Escape'){setHelp(false);setDrawer(false);setConfirm(false);setTool(null);setSelected([]);}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[]);
 useEffect(()=>{if(!drawer&&!help&&!confirm)return;const prior=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=prior;};},[drawer,help,confirm]);
 function dispatch(type,extra={}){
  try{setState(transition(state,{type,playerId:viewer,...extra},Date.now()));setError('');setNow(Date.now());return true;}catch(e){setError(e.message);return false;}
 }
 function start(){try{
  const timerSeconds=timerValue(settings.timerEnabled,settings.timerInput);
  const next=createMatch({...settings,timerSeconds},players,words);
  save('passnames-name',players[0].name.trim());setState(next);setViewer(players[0].id);setError('');setHealth('');setNow(Date.now());setDrawer(false);setHighlights({});
 }catch(e){setError(e.message);}}
 function rematch(){setState(null);setTool(null);setSelected([]);setHighlights({});setError('');setConfirm(false);setDrawer(false);setClueText('');setClueCount(1);}
 function changePlayer(id,key,value){setPlayers(ps=>ps.map(p=>p.id===id?{...p,[key]:value}:p));}
 function boardClick(cell){
  if(view.me.role==='spy'){
   if(view.phase==='deal')return;
   setHighlights(all=>{const old=all[viewer]||[];return {...all,[viewer]:old.includes(cell.word)?old.filter(w=>w!==cell.word):[...old,cell.word]};});
   return;
  }
  if(view.pause||['deal','finished'].includes(view.phase)||cell.revealed)return;
  if(tool==='swap')setSelected(ids=>ids.includes(cell.id)?ids.filter(id=>id!==cell.id):ids.length<2?[...ids,cell.id]:[ids[1],cell.id]);
  else if(tool==='scan')setSelected([cell.id]);
  else dispatch('MARK',{cell:cell.id});
 }
 function playTool(){if(dispatch(tool==='swap'?'SWAP':'SCAN',tool==='swap'?{cells:selected}:{cell:selected[0]})){setTool(null);setSelected([]);}}
 async function checkServer(){setHealth('checking');try{const response=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok||!data.ok)throw Error();setHealth('serverReady');}catch{setHealth('serverError');}}
 function languageSelect(){return h('select',{className:'language-select','aria-label':t('language'),value:lang,onChange:e=>setLang(e.target.value)},h('option',{value:'ar'},'العربية'),h('option',{value:'en'},'English'));}
 function teamPanel(team){const info=view.teams[team];return h('section',{key:team,className:'team-score '+team+((view.phase==='finished'?view.winner:view.active)===team?' current':'')},
  h('div',{className:'score-head'},h('strong',null,t('team',{team:t(team)})),h('span',{className:'score-number',dir:'ltr'},info.score,h('small',null,' / '+info.target))),
  h('div',{className:'progress'},h('span',{style:{width:Math.min(100,info.score/info.target*100)+'%'}})),
  h('div',{className:'team-detail'},h('span',null,t('remaining',{n:Math.max(0,info.target-info.score)})),mode==='expanded'&&h('span',null,t('yellowScore',{n:info.yellow})+' · '+t('streakShort',{n:info.streak}))),
  h('div',{className:'roster'},view.players.filter(p=>p.team===team).map(p=>h('span',{key:p.id,className:p.id===viewer?'me':''},p.name+' · '+t(p.role)))));
 }
 function lobby(){return h('main',{className:'lobby'},
  h('div',{className:'intro'},h('span',{className:'eyebrow'},t('tagline')),h('h1',null,t('title')),h('p',null,t('subtitle'))),
  h('div',{className:'lobby-grid'},h('section',{className:'panel'},h('h2',null,t('setup')),
   h('div',{className:'mode-picker'},['standard','expanded'].map(m=>h('button',{key:m,type:'button',className:settings.mode===m?'active':'',onClick:()=>setSettings(s=>({...s,mode:m}))},h('strong',null,t(m)),h('span',null,t(m+'Short'))))),
   h('label',{className:'toggle'},h('input',{type:'checkbox',checked:settings.timerEnabled,onChange:e=>setSettings(s=>({...s,timerEnabled:e.target.checked}))}),h('span',null,t('timerEnable'))),
   settings.timerEnabled&&h('label',null,t('seconds'),h('input',{id:'timer-input',type:'text',inputMode:'numeric',dir:'ltr',value:settings.timerInput,'aria-invalid':!Number.isInteger(parseInteger(settings.timerInput))||parseInteger(settings.timerInput)<10||parseInteger(settings.timerInput)>600,onChange:e=>setSettings(s=>({...s,timerInput:latinDigits(e.target.value)}))})),
   h('p',{className:'fine'},t('timerHint')),h('p',{className:'fine'},t('lockedTime')),
   settings.mode==='expanded'&&h(React.Fragment,null,h('label',{className:'toggle'},h('input',{type:'checkbox',checked:settings.manualDraw,onChange:e=>setSettings(s=>({...s,manualDraw:e.target.checked}))}),h('span',null,t('manualDraw'))),h('p',{className:'fine'},t(settings.manualDraw?'manualHint':'autoHint')))),
   h('section',{className:'panel'},h('div',{className:'section-heading'},h('h2',null,t('teams')),h('span',{className:'pill',dir:'ltr'},players.length+' / 10')),h('p',{className:'fine'},t('rosterHint')),
    players.map((p,i)=>h('div',{className:'player-row',key:p.id},
     h('input',{'aria-label':t('playerName',{n:i+1}),value:p.name,maxLength:24,dir:'auto',onChange:e=>changePlayer(p.id,'name',e.target.value)}),
     h('select',{'aria-label':t('teams'),value:p.team,onChange:e=>changePlayer(p.id,'team',e.target.value)},['blue','red'].map(team=>h('option',{key:team,value:team},t(team)))),
     h('select',{'aria-label':t('perspective'),value:p.role,onChange:e=>changePlayer(p.id,'role',e.target.value)},['spy','agent'].map(role=>h('option',{key:role,value:role},t(role)))),
     h(Button,{kind:'remove',disabled:players.length<=4||i===0,'aria-label':t('removePlayer'),onClick:()=>setPlayers(ps=>ps.filter(x=>x.id!==p.id))},'×'))),
    h(Button,{disabled:players.length>=10,onClick:()=>setPlayers(ps=>[...ps,{id:crypto.randomUUID(),name:'',team:ps.filter(p=>p.team==='blue').length<=ps.filter(p=>p.team==='red').length?'blue':'red',role:'agent'}])},t('addPlayer')),
    h('p',{className:'local-note'},t('localHint')))),
  (error||poolError)&&h('p',{className:'error',role:'alert'},poolError||message(lang,error)),
  h('div',{className:'launch-row'},h(Button,{kind:'gold large',disabled:!!poolError,onClick:start},t('start')),h(Button,{kind:'quiet',onClick:checkServer},t('serverCheck')),h('span',{role:'status'},health?t(health):'')),h('p',{className:'fine'},t('wordSource')));
 }
 function gameBoard(){return h('div',{className:'board','data-size':view.size,style:{'--size':view.size},dir:'rtl','aria-label':t('brand')},view.board.map(cell=>{
  const color=cell.color;
  const isSpy=view.me.role==='spy';
  const highlighted=isSpy&&(highlights[viewer]||[]).includes(cell.word);
  const mine=cell.marks.includes(view.me.name), suspect=cell.marks.length>0;
  const targeted=selected.includes(cell.id);
  const interactive=isSpy?view.phase!=='deal':!cell.revealed&&!view.pause&&!['deal','finished'].includes(view.phase);
  const canReveal=activeAgent&&view.phase==='guess'&&!tool&&!cell.revealed&&suspect;
  const scan=view.scans.filter(s=>s.cell===cell.id).at(-1);
  return h('div',{key:cell.id,'data-cell':cell.id,className:'word-cell '+(color?'color-'+color:'concealed')+(cell.revealed?' revealed':'')+(suspect?' suspected':'')+(mine?' own-suspect':'')+(highlighted?' spy-highlight':'')+(targeted?' selected':'')},
   h('button',{type:'button',className:'word-face',disabled:!interactive,onClick:()=>boardClick(cell),'aria-pressed':interactive?(isSpy?highlighted:mine||targeted):undefined,'aria-label':cell.word+(color?' · '+t(color):'')+(highlighted?' · '+t('highlighted'):'')},
    h('span',{className:'cell-index',dir:'ltr'},cell.id+1),h('span',{className:'word',lang:'ar',dir:'rtl'},cell.word),
    color&&h('span',{className:'identity',dir:lang==='ar'?'rtl':'ltr'},cell.revealed?'✓ '+t(color):t(color)),
    cell.yellowOwner&&h('span',{className:'yellow-owner',dir:lang==='ar'?'rtl':'ltr'},t('credit',{team:t(cell.yellowOwner)}))),
   suspect&&h('div',{className:'marks',title:cell.marks.join('، '),'aria-label':t('suspect')},cell.marks.join('، ')),
   scan&&!cell.revealed&&h('span',{className:'scan-label',dir:lang==='ar'?'rtl':'ltr'},t(scan.black?'scanYes':'scanNo')),
   canReveal&&h('button',{type:'button',className:'reveal-icon','aria-label':t('reveal',{word:cell.word}),title:t('reveal',{word:cell.word}),onClick:e=>{e.stopPropagation();dispatch('GUESS',{cell:cell.id});}},h(ClickIcon)));
 }));}
 function actionsPanel(){
  if(mode!=='expanded')return null;
  if(view.me.role==='spy')return view.settings.manualDraw&&h('section',{className:'panel action-panel'},h('h3',null,t('drawTitle')),h('p',{className:'muted'},t(view.canDraw?'drawReady':'drawWaiting')),h(Button,{disabled:!view.canDraw,kind:view.canDraw?'gold draw-ready':'faded',onClick:()=>dispatch('DRAW')},t('draw')),h('p',{className:'fine'},t('drawExpiry')));
  const info=view.teams[view.me.team];
  return h('section',{className:'panel action-panel'},h('div',{className:'section-heading'},h('h3',null,t('actions')),h('span',{className:'pill'},t('agentPrivate'))),h('p',{className:'fine'},t('oneAction')),
   view.hand.length?h('div',{className:'hand'},view.hand.map(card=>{
    const allowed=card.available&&(card.type==='swap'?view.phase==='clue':card.type==='scan'?['clue','guess'].includes(view.phase)&&view.guesses===0:view.phase==='second');
    return h('button',{type:'button',className:'action-card',key:card.id,disabled:!allowed,onClick:()=>{if(card.type==='second')dispatch('SECOND');else{setTool(card.type);setSelected([]);}}},h('strong',null,t(card.type)),h('small',null,card.usableTurn>info.turns?t('usableTurn',{n:card.usableTurn}):t(allowed?'useCard':'notAvailable')));
   })):h('p',{className:'muted'},t('noCards')),
   h('div',{className:'streak-box'},h('strong',null,t('streak',{n:info.streak})),h('p',{className:'fine'},t('streakWarning'))),
   view.scans.length>0&&h('details',null,h('summary',null,t('scanHistory')),view.scans.map((scan,i)=>h('p',{key:i,className:'fine'},t('position',{n:scan.cell+1})+' · '+scan.word+' · '+t(scan.black?'scanYes':'scanNo')))));
 }
 function controlPanel(){
  if(view.phase==='finished')return h('section',{className:'panel finish-controls'},h('p',null,t('winNote')),view.me.id===view.adminId&&h(Button,{kind:'gold',onClick:()=>setConfirm(true)},t('rematch')));
  if(view.phase==='deal'){
   const ready=['blue','red'].every(team=>view.teams[team].initialDrawn);
   return h('section',{className:'panel pregame'},h('h2',null,t('initial')),h('p',null,t('initialHint')),
    !view.settings.manualDraw&&h('p',{className:'fine'},t('automaticDone')),
    h('div',{className:'initial-status'},['blue','red'].map(team=>h('span',{key:team,className:team},t(team)+' · '+t(view.teams[team].initialDrawn?'drawn':'drawPending')))),
    view.me.id===view.adminId&&h(Button,{kind:'gold',disabled:!ready,onClick:()=>dispatch('BEGIN')},t('startPlay')),
    !ready&&h('p',{className:'fine'},t('initialRequired')));
  }
  if(view.pause)return h('section',{className:'panel notice'},h('h2',null,t('pauseTitle')),h('p',null,t('pauseHint')));
  if(view.phase==='second')return h('section',{className:'panel second-choice'},h('h2',null,t('secondQuestion')),h('p',null,t('secondHint')),activeAgent?h('div',{className:'button-row'},h(Button,{kind:'gold',onClick:()=>dispatch('SECOND')},t('useSecond')),h(Button,{onClick:()=>dispatch('DECLINE')},t('endTurn'))):h('p',{className:'muted'},t('waitDecision',{team:t(view.active)})));
  if(view.phase==='clue'&&view.me.role==='spy'&&myTurn){
   const min=mode==='expanded'?0:1;
   return h('section',{className:'panel clue-panel'},h('div',{className:'section-heading'},h('h2',null,t('sendClue')),h('span',{className:'fine'},t('oneWord'))),
    h('form',{className:'clue-form',onSubmit:e=>{e.preventDefault();dispatch('CLUE',{text:clueText,count:clueCount});}},
     h('label',{className:'clue-input',htmlFor:'clue-text'},t('clue'),h('input',{id:'clue-text',dir:'rtl',lang:'ar',value:clueText,maxLength:60,autoComplete:'off',placeholder:t('cluePlaceholder'),onChange:e=>setClueText(e.target.value)})),
     h('label',{className:'count-input',htmlFor:'clue-count'},t('clueCount'),h('select',{id:'clue-count',dir:'ltr',value:clueCount,onChange:e=>setClueCount(e.target.value==='unlimited'?'unlimited':parseInteger(e.target.value))},Array.from({length:max-min+1},(_,i)=>i+min).map(n=>h('option',{key:n,value:n},n)),h('option',{value:'unlimited'},t('unlimited')))),
     h(Button,{kind:'gold',type:'submit'},t('sendClue'))),
    h('p',{className:'fine'},t('clueCap',{n:max})),
    mode==='expanded'&&(clueCount===0||clueCount==='unlimited')&&h('p',{className:'warning'},t('streakWarning')));
  }
  return h('section',{className:'panel turn-controls'},h('h3',null,t(view.phase==='clue'?'waitingClue':'guessing')),h('p',{className:'muted'},view.phase==='clue'?t('waitingSpy',{team:t(view.active)}):activeAgent?t('suspectHelp'):t('waitingAgents',{team:t(view.active)})),activeAgent&&view.phase==='guess'&&h(Button,{disabled:view.guesses===0,onClick:()=>dispatch('END')},t('endTurn')));
 }
 function history(){return h('section',{className:'panel logs'},h('div',{className:'tab-row'},['clues','events'].map(key=>h('button',{key,type:'button',className:tab===key?'active':'',onClick:()=>setTab(key)},t(key)))),
  tab==='clues'?(view.clues.length?h('ol',null,[...view.clues].reverse().map(clue=>h('li',{key:clue.turn,className:clue.team},h('strong',{lang:'ar',dir:'rtl'},clue.text),h('span',null,countLabel(clue.count)),h('small',null,t('turnNumber',{n:clue.turn})+' · '+t(clue.team))))):h('p',{className:'muted'},t('noClues'))):h('ol',null,[...view.log].reverse().map(entry=>h('li',{key:entry.id},h('span',null,message(lang,entry.text)),h('small',null,t('turnNumber',{n:entry.turn}))))));}
 function helpDialog(){return h('div',{className:'overlay',onClick:()=>setHelp(false)},h('section',{className:'modal',role:'dialog','aria-modal':true,'aria-labelledby':'help-title',onClick:e=>e.stopPropagation()},h('div',{className:'section-heading'},h('h2',{id:'help-title'},t('helpTitle')),h(Button,{autoFocus:true,onClick:()=>setHelp(false)},t('close'))),
  h('p',null,t('helpCore')),h('h3',null,t('suspect')),h('p',null,t('helpSuspect')),h('p',null,t('helpHighlight')),h('h3',null,t('clue')),h('p',null,t('helpClue')),h('p',null,t('helpCount')),h('p',null,t('helpStandard')),h('h3',null,t('guessTime')),h('p',null,t('helpTime')),h('h3',null,t('actions')),h('p',null,t('helpStreak')),h('p',null,t('helpActions')),h('p',null,t('helpDeck')),h('h3',null,t('local')),h('p',null,t('helpLocal'))));}
 function game(){
  const result=view.phase==='finished';
  const active=view.phase==='deal'?'none':result?view.winner:view.active;
  const boardHint=view.phase==='deal'?t('hiddenHelp'):view.me.role==='spy'?t('spyHelp'):t('suspectHelp');
  return h('main',{className:'game'},
   h('section',{className:'view-switch'},h('label',{htmlFor:'player-view'},t('perspective')),h('select',{id:'player-view',value:viewer,onChange:e=>setViewer(e.target.value)},view.players.map(p=>h('option',{key:p.id,value:p.id},p.name+' · '+t(p.team)+' · '+t(p.role)))),h('span',{className:'role-badge '+view.me.team},t(view.me.role)),view.me.id===view.adminId&&h('span',{className:'admin-badge'},t('admin'))),
   result&&h(React.Fragment,null,h(Celebration,{team:view.winner}),h('section',{className:'win-banner '+view.winner,role:'status','aria-live':'polite'},h(Trophy),h('div',null,h('span',{className:'eyebrow'},t('missionComplete')),h('h1',null,t('won',{team:t(view.winner)}))))),
   h('section',{className:'mission-bar'},h('div',{className:'mission-heading'},h('span',{className:'eyebrow'},t(mode)+' · '+view.size+' × '+view.size),h('h2',null,view.phase==='deal'?t('initial'):result?t('missionComplete'):view.pause?t('pauseTitle'):t('turn',{team:t(view.active)})),view.clue&&h('div',{className:'live-clue'},h('strong',{lang:'ar',dir:'rtl'},view.clue.text),h('span',null,countLabel(view.clue.count)),h('small',null,t('guessCount',{used:view.guesses,max:view.clue.count==='unlimited'?'∞':view.clue.count+1})))),
    !result&&h('div',{className:'timer '+(timeLeft!==null&&timeLeft<=10?'urgent':'')},h('strong',null,view.pause?t('paused'):timeLeft!==null?t('secondsShort',{n:timeLeft}):view.phase==='clue'?t('cluePrep'):t('noTimer')),h('small',null,t(view.phase==='second'?'decisionTime':view.phase==='clue'?'cluePrep':'guessTime')))),
   error&&h('p',{className:'error',role:'alert'},message(lang,error)),
   h('section',{className:'board-frame turn-'+active+(result?' victory-frame':'')},h('p',{className:'board-caption'},boardHint),
    tool&&h('div',{className:'tool-bar'},h('strong',null,t(tool==='swap'?'chooseSwap':'chooseScan')),h('span',{dir:'ltr'},selected.length+' / '+(tool==='swap'?2:1)),h(Button,{kind:'gold',disabled:selected.length!==(tool==='swap'?2:1),onClick:playTool},t('useTool',{card:t(tool)})),h(Button,{onClick:()=>{setTool(null);setSelected([]);}},t('cancel'))),
    gameBoard()),
   h('div',{className:'tools-dock'},controlPanel(),actionsPanel()),
   h('footer',{className:'game-footer'},h('span',null,t('refreshHint')),view.me.id===view.adminId&&h('div',{className:'button-row'},!['finished','deal'].includes(view.phase)&&h(Button,{onClick:()=>dispatch('PAUSE')},t(view.pause?'resume':'pauseTest')),!result&&h(Button,{kind:'danger',onClick:()=>setConfirm(true)},t('rematch')))),
   drawer&&h('div',{className:'drawer-overlay',onClick:()=>setDrawer(false)},h('aside',{className:'team-drawer',role:'dialog','aria-modal':true,'aria-labelledby':'drawer-title',onClick:e=>e.stopPropagation()},h('div',{className:'section-heading'},h('h2',{id:'drawer-title'},t('teamProgress')),h(Button,{autoFocus:true,onClick:()=>setDrawer(false)},t('close'))),teamPanel('blue'),teamPanel('red'),history())));
 }
 return h('div',{className:'app',dir:lang==='ar'?'rtl':'ltr',lang},
  h('header',{className:'topbar'},h('a',{className:'brand',href:'#',onClick:e=>e.preventDefault()},h('span',{className:'brand-icon'},'◈'),'passnames'),h('div',{className:'top-actions'},view&&h(Button,{kind:'score-toggle',onClick:()=>setDrawer(true),'aria-expanded':drawer,'aria-label':t('scores')},h('span',{className:'turn-dot '+(view.phase==='finished'?view.winner:view.active)}),t('teams')),languageSelect(),h(Button,{kind:'quiet help-toggle','aria-label':t('rules'),onClick:()=>setHelp(true)},h('span',{className:'rules-label'},t('rules')),h('span',{className:'rules-icon','aria-hidden':true},'?')))),
  state?game():lobby(),help&&helpDialog(),
  confirm&&h('div',{className:'overlay'},h('section',{className:'modal confirm-modal',role:'dialog','aria-modal':true,'aria-labelledby':'confirm-title'},h('h2',{id:'confirm-title'},t('rematchTitle')),h('p',null,t('rematchText')),h('div',{className:'button-row'},h(Button,{kind:'gold',onClick:rematch},t('backLobby')),h(Button,{autoFocus:true,onClick:()=>setConfirm(false)},t('cancel'))))));
}
createRoot(document.getElementById('root')).render(h(App));
