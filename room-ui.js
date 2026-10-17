import words from './words.json';
import App from './game-ui.js';
import {message} from './i18n.js';
import React,{useEffect,useRef,useState} from 'react';
import {RoomConnection,enterRoom,parseRoomCode,readSeat,forgetSeat,roomInvite} from './room-client.js';
import {roomTranslator,roomError} from './room-text.js';
import {latinDigits,timerValue} from './ui-utils.js';
const h=React.createElement;
function stored(key,fallback=''){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function remember(key,value){try{localStorage.setItem(key,value);}catch{}}
function invitationCode(){try{return parseRoomCode(new URL(location.href).searchParams.get('room')||'');}catch{return '';}}
function initialSeat(){const code=invitationCode();const seat=code&&readSeat(code);return seat?{code,token:seat.token}:null;}
function Button({children,kind='',...props}){return h('button',{type:'button',className:'button '+kind,...props},children);}
function Icon({name='key',size=22}){
 const paths={key:'M14 5a5 5 0 1 1-3 9l-7 7H1v-3l7-7a5 5 0 0 1 6-6Z M16 8h.01',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7L12 3Z M8 12l3 3 5-6',settings:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',spy:'M4 13h16 M7 12l2-8h6l2 8 M6 16h4v3H6v-3Z M14 16h4v3h-4v-3Z M10 17h4',arrow:'M5 12h14 M13 6l6 6-6 6',card:'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M8 9h8 M8 13h5'};
 return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]||paths.key}));
}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase();}
export default function RoomHub({onLocal}){
 const [lang,setLang]=useState(()=>stored('passnames-language','ar')==='en'?'en':'ar');
 const [name,setName]=useState(()=>stored('passnames-name'));
 const [code,setCode]=useState(invitationCode);
 const [seat,setSeat]=useState(initialSeat);
 const [room,setRoom]=useState(null);
 const [status,setStatus]=useState('closed');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [copied,setCopied]=useState(false);
 const [storageWarning,setStorageWarning]=useState(false);
 const [draft,setDraft]=useState({mode:'standard',timerEnabled:false,timerInput:'60',manualDraw:false});
 const [rename,setRename]=useState('');
 const [notice,setNotice]=useState('');
 const [confirmation,setConfirmation]=useState(null);
 const connection=useRef(null),leaving=useRef(false);
 const [roomControls,setRoomControls]=useState(false);
 const [now,setNow]=useState(Date.now());
 const t=roomTranslator(lang);
 const admin=!!room&&room.me.id===room.adminId;
 const enabled=status==='connected'&&!busy;
 const settingKey=room?.settings?JSON.stringify(room.settings):'';
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';remember('passnames-language',lang);},[lang]);
 useEffect(()=>{setRoomControls(false);},[room?.match?.id]);
 useEffect(()=>{if(!room?.recovery?.adminDeadline)return;const id=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(id);},[room?.recovery?.adminDeadline]);
 useEffect(()=>{
  if(!roomControls)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const escape=e=>{if(e.key==='Escape')setRoomControls(false);};window.addEventListener('keydown',escape);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);};
 },[roomControls]);
 useEffect(()=>{if(!settingKey)return;const values=JSON.parse(settingKey);setDraft({mode:values.mode,timerEnabled:values.timerSeconds>0,timerInput:String(values.timerSeconds||60),manualDraw:values.manualDraw});},[settingKey]);
 useEffect(()=>{
  if(!seat)return;
  setRoom(null);setStatus('connecting');setRename('');setCopied(false);setNotice('');setConfirmation(null);leaving.current=false;
  const link=new RoomConnection({...seat,
   onRoom:next=>{setRoom(next);setError('');setName(next.me.name);remember('passnames-name',next.me.name);setRename(current=>current||next.me.name);},
   onStatus:setStatus,onError:setError,
   onRemoved:reason=>{if(leaving.current)return;if(['ROOM_NOT_FOUND','SESSION_INVALID'].includes(reason))forgetSeat(seat.code);setError(reason);setRoom(null);setSeat(null);setStatus('closed');}
  });
  connection.current=link;link.open();
  const url=new URL(location.href);url.searchParams.set('room',seat.code);history.replaceState(null,'',url);
  return()=>{link.stop();if(connection.current===link)connection.current=null;};
 },[seat?.code,seat?.token]);
 async function enter(create){
  if(!name.trim()){setError('NAME_REQUIRED');return;}
  setBusy(true);setError('');
  try{const result=await enterRoom({name,code,create});remember('passnames-name',name.trim());setCode(result.code);setStorageWarning(!result.persisted);setSeat({code:result.code,token:result.token});}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function send(action){
  setBusy(true);setError('');setNotice('');
  try{await connection.current.send(action);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}
 }
 function roomConfig(){try{return {mode:draft.mode,timerSeconds:timerValue(draft.timerEnabled,draft.timerInput),manualDraw:draft.manualDraw};}catch{throw Error('TIMER_INVALID');}}
 async function saveSettings(start=false){
  let values;try{values=roomConfig();}catch(e){setError(e.message);return;}
  if(await send({type:'SETTINGS',settings:values})){if(start)await send({type:'START'});else setNotice('saved');}
 }
 async function leave(){
  leaving.current=true;
  if(await send({type:'LEAVE'})){
   connection.current?.stop();forgetSeat(seat.code);setSeat(null);setRoom(null);setStatus('closed');setError('');setNotice('');setConfirmation(null);
   const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);setCode('');
  }else leaving.current=false;
 }
 async function copyInvite(){try{await navigator.clipboard.writeText(roomInvite(location.href,room.code));setCopied(true);setNotice('');}catch{setNotice('copyFailed');}}
 function requestConfirmation(text,action){setConfirmation({text,action});}
 function languageSelect(){return h('select',{className:'language-select',value:lang,'aria-label':t('language'),onChange:e=>setLang(e.target.value)},h('option',{value:'ar'},'العربية'),h('option',{value:'en'},'English'));}
 function memberRow(player){
  const canEdit=room.phase==='lobby'&&(admin||player.id===room.me.id),editable=canEdit&&enabled;
  return h('article',{className:'room-member '+(player.team||'unassigned')+(player.role==='spy'?' spy-member':''),key:player.id},
   h('div',{className:'member-identity'},h('span',{className:'seat-avatar','aria-hidden':true},initials(player.name)),
    h('div',{className:'member-name'},h('strong',{dir:'auto'},player.name),h('div',{className:'member-tags'},h('span',{className:'seat-role'},t(player.role)),player.id===room.me.id&&h('span',{className:'you-tag'},t('you')),player.id===room.adminId&&h('span',{className:'admin-badge'},t('admin')))),
    h('span',{className:'presence '+(player.online?'online':'offline')},t(player.online?'online':'offline'))),
   (canEdit||admin&&player.id!==room.adminId)&&h('div',{className:'member-controls'},
    canEdit&&h('select',{'aria-label':t('teams')+' '+player.name,value:player.team||'',disabled:!editable,onChange:e=>send({type:'ASSIGN',targetId:player.id,team:e.target.value||null,role:player.role})},h('option',{value:''},t('unassigned')),h('option',{value:'blue'},t('blue')),h('option',{value:'red'},t('red'))),
    canEdit&&h('select',{'aria-label':t('perspective')+' '+player.name,value:player.role,disabled:!editable,onChange:e=>send({type:'ASSIGN',targetId:player.id,team:player.team,role:e.target.value})},h('option',{value:'spy'},t('spy')),h('option',{value:'agent'},t('agent'))),
    admin&&player.id!==room.adminId&&h(Button,{kind:'danger',disabled:!enabled,onClick:()=>requestConfirmation(t('kickQuestion',{name:player.name}),()=>send({type:'KICK',targetId:player.id}))},t('kick'))));
 }
 function emptySeat(team,role){return h('div',{className:'empty-seat '+role},h(Icon,{name:role==='spy'?'spy':'people'}),h('strong',null,t(role==='spy'?'emptySpy':'emptyAgent')),
  room.phase==='lobby'&&h(Button,{kind:'quiet',disabled:!enabled,onClick:()=>send({type:'ASSIGN',targetId:room.me.id,team,role})},t('takeSeat')));}
 function teamSeats(team){const members=room.players.filter(p=>p.team===team),spies=members.filter(p=>p.role==='spy'),agents=members.filter(p=>p.role==='agent');
  return h('section',{className:'seating-team '+team,key:team,'aria-label':t('team',{team:t(team)})},
   h('header',{className:'seating-header'},h('span',{className:'team-seal','aria-hidden':true},h(Icon,{name:'spy',size:28})),h('div',null,h('span',{className:'eyebrow'},t('teamBrief')),h('h2',null,t('team',{team:t(team)}))),h('span',{className:'pill',dir:'ltr'},members.length)),
   h('div',{className:'spy-seat'},h('h3',null,t('spySeat')),spies.length?spies.map(memberRow):emptySeat(team,'spy')),
   h('div',{className:'agent-seats'},h('h3',null,t('agentSeats')),agents.length?agents.map(memberRow):emptySeat(team,'agent')),
   members.filter(p=>p.role==='spectator').map(memberRow));
 }
 function settingsPanel(){let invalid=false;try{timerValue(draft.timerEnabled,draft.timerInput);}catch{invalid=true;}
  return h('details',{className:'panel room-settings'},h('summary',null,h('span',{className:'summary-icon'},h(Icon,{name:'settings'})),h('span',null,h('strong',null,t('settings')),h('small',null,t(draft.mode)+' · '+(draft.timerEnabled?t('timerSelected',{n:latinDigits(draft.timerInput)||'—'}):t('untimedLabel')))),h('span',{className:'summary-chevron','aria-hidden':true},'+')),
   h('div',{className:'settings-content'},
    h('div',{className:'mode-picker'},['standard','expanded'].map(mode=>h('button',{key:mode,type:'button',className:draft.mode===mode?'active':'','aria-pressed':draft.mode===mode,disabled:!admin||!enabled||room.phase!=='lobby',onClick:()=>setDraft(s=>({...s,mode}))},h(Icon,{name:'card'}),h('strong',null,t(mode)),h('span',null,t(mode+'Short'))))),
    h('label',{className:'toggle'},h('input',{type:'checkbox',checked:draft.timerEnabled,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,timerEnabled:e.target.checked}))}),t('timerEnable')),
    draft.timerEnabled&&h('label',null,t('seconds'),h('input',{id:'room-timer',type:'text',inputMode:'numeric',dir:'ltr',value:draft.timerInput,'aria-invalid':invalid,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,timerInput:latinDigits(e.target.value)}))})),
    h('p',{className:'fine'},t('timerHint')),
    draft.mode==='expanded'&&h('label',{className:'toggle'},h('input',{type:'checkbox',checked:draft.manualDraw,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,manualDraw:e.target.checked}))}),t('manualDraw')),
    admin&&room.phase==='lobby'&&h(Button,{disabled:!enabled,onClick:()=>saveSettings(false)},t('saveSettings'))));
 }
 function readinessPanel(){return h('section',{className:'panel readiness-panel'},h('div',{className:'readiness-heading'},h(Icon,{name:'shield'}),h('h2',null,t('readyCheck'))),
  room.readiness?.ready?h('p',{className:'ready-note'},t('canStart')):h('ul',null,(room.readiness?.problems||[]).map((problem,i)=>h('li',{key:i},roomError(lang,problem.code,problem.team)))),
  admin&&room.phase==='lobby'&&h(Button,{kind:'gold launch-button',disabled:!enabled||!room.readiness?.ready,onClick:()=>saveSettings(true)},t('readyButton')),
  !admin&&h('p',{className:'fine'},t('hostStarts')));
 }
 function seatingPanel(){const unassigned=room.players.filter(p=>!p.team);return h('section',{className:'seating-panel'},
  h('div',{className:'section-heading lobby-section-title'},h('div',null,h('span',{className:'eyebrow'},t('takePlaces')),h('h1',null,t('roster'))),h('span',{className:'pill',dir:'ltr'},room.players.length+' / 10')),
  h('p',{className:'fine seating-hint'},t('choose')),h('div',{className:'team-seating'},['blue','red'].map(teamSeats)),
  unassigned.length>0&&h('section',{className:'panel unassigned-seats'},h('h3',null,t('unassigned')),unassigned.map(memberRow)),replacementControls(),
  h('details',{className:'rename-details'},h('summary',null,t('rename')),h('form',{className:'rename-row',onSubmit:async e=>{e.preventDefault();if(await send({type:'RENAME',name:rename}))remember('passnames-name',rename.trim());}},h('label',{htmlFor:'room-rename'},t('rename')),h('div',null,h('input',{id:'room-rename',maxLength:24,dir:'auto',value:rename,disabled:!enabled,onChange:e=>setRename(e.target.value)}),h(Button,{type:'submit',disabled:!enabled},t('renameSave'))))));
 }
 function transferNotice(){
  const notice=room?.recovery?.notice;if(!notice||notice.toId!==room.adminId)return null;
  const name=room.players.find(p=>p.id===room.adminId)?.name||'';
  return h('p',{className:'notice-text recovery-notice',role:'status'},t('adminTransferred',{name}));
 }
 function hostRecovery(){
  const deadline=room?.recovery?.adminDeadline;
  const seconds=deadline?Math.max(0,Math.ceil((deadline-now-(room.clockOffset||0))/1000)):60;
  return h('p',{className:'warning',role:'status'},t(seconds>0?'hostCountdown':'hostWaiting',{n:seconds}));
 }
 function replacementControls(){
  if(!admin||!room.match?.pause)return null;
  const options=room.match.recovery?.replacements||[];
  return h('section',{className:'panel recovery-options'},h('h3',null,t('replaceTitle')),h('p',{className:'fine'},t('replaceHint')),
   options.length?options.map(option=>h(Button,{key:option.targetId,kind:'gold',disabled:!enabled,onClick:()=>requestConfirmation(t('replaceQuestion',{name:option.name,team:t(option.team)}),()=>send({type:'REPLACE_SPY',matchId:room.match.id,version:room.match.version,team:option.team,spyId:option.spyId,targetId:option.targetId}))},t('replaceWith',{name:option.name})))
    :h('p',{className:'fine'},t('noReplacement')));
 }
 function onlineLobby(){
  if(room.phase==='waiting')return h('section',{className:'panel waiting-panel'},h('span',{className:'waiting-symbol'},'◌'),h('h1',null,t('waiting')),h('p',null,t('waitingHint')),h('p',{className:'fine',dir:'ltr'},room.code),h(Button,{disabled:!enabled,onClick:()=>requestConfirmation(t('leaveQuestion'),leave)},t('leave')));
  const hostOffline=room.players.some(p=>p.id===room.adminId&&!p.online);
  return h(React.Fragment,null,
   h('section',{className:'room-summary panel'},h('div',{className:'room-code-block'},h('span',{className:'eyebrow'},h(Icon,{name:'shield',size:15}),t('privateTable')),h('span',{className:'fine'},t('codeLabel')),h('strong',{className:'room-code',dir:'ltr'},room.code),h('p',{className:'fine'},t(room.locked?'locked':'unlocked'))),
    h('div',{className:'room-invitation'},h(Button,{kind:'gold',onClick:copyInvite},t(copied?'copied':'invite')),h('input',{'aria-label':t('invite'),readOnly:true,dir:'ltr',value:roomInvite(location.href,room.code),onFocus:e=>e.target.select()}))),
   hostOffline&&hostRecovery(),transferNotice(),
   room.phase==='ready'&&h('section',{className:'panel room-ready'},h('h2',null,t('readyTitle')),h('p',null,t('readyHint')),admin&&h(Button,{kind:'gold',disabled:!enabled||!room.readiness?.ready,onClick:()=>send({type:'LAUNCH'})},t('start')),admin&&h(Button,{disabled:!enabled,onClick:()=>send({type:'BACK'})},t('backLobby'))),
   h('div',{className:'room-layout'},seatingPanel(),h('aside',{className:'room-aside'},settingsPanel(),readinessPanel())),
   admin&&h('section',{className:'panel approvals'},h('div',{className:'section-heading'},h('h2',null,t('pending')),h('span',{className:'pill'},room.pending.length)),h('p',{className:'fine'},t('lockHint')),h(Button,{disabled:!enabled,onClick:()=>send({type:'LOCK',locked:!room.locked})},t(room.locked?'unlock':'lock')),
    room.pending.length?h('div',{className:'pending-list'},room.pending.map(player=>h('div',{className:'pending-row',key:player.id},h('strong',{dir:'auto'},player.name),h('span',{className:'fine'},t(player.online?'online':'offline')),h(Button,{kind:'gold',disabled:!enabled||room.phase!=='lobby',onClick:()=>send({type:'APPROVE',targetId:player.id})},t('approve')),h(Button,{disabled:!enabled,onClick:()=>requestConfirmation(t('rejectQuestion',{name:player.name}),()=>send({type:'REJECT',targetId:player.id}))},t('reject'))))):h('p',{className:'muted'},t('noPending'))),
   h('footer',{className:'game-footer'},h('span',null,t('sameBrowser')),h(Button,{kind:'danger',disabled:!enabled,onClick:()=>requestConfirmation(t('leaveQuestion')+(admin?' '+t('leaveAdmin'):''),leave)},t('leave'))));
 }
 function entryPanel(){const last=stored('passnames-last-room');return h('section',{className:'panel room-entry'},
  h('div',{className:'entry-pass-heading'},h(Icon,{name:'key',size:30}),h('span',{className:'eyebrow'},t('entryKicker')),h('span',{className:'pass-number',dir:'ltr'},'01')),
  h('h2',null,t('entryTitle')),h('p',{className:'fine'},t('entryHint')),
  h('label',{htmlFor:'entry-name'},t('name')),h('input',{id:'entry-name',value:name,maxLength:24,autoComplete:'nickname',dir:'auto',placeholder:t('namePlaceholder'),onChange:e=>setName(e.target.value)}),
  h('div',{className:'entry-create'},h(Button,{kind:'gold',disabled:busy,onClick:()=>enter(true)},h(Icon,{name:'key',size:18}),t(busy?'working':'create'))),
  h('div',{className:'entry-join'},h('span',{className:'join-divider'},t('alreadyInvited')),h('label',{htmlFor:'entry-code'},t('code')),h('input',{id:'entry-code',value:code,dir:'ltr',autoComplete:'off',placeholder:'ABCD23456',onChange:e=>setCode(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!busy)enter(false);}}),h(Button,{disabled:busy,onClick:()=>enter(false)},t('join'))),
  last&&readSeat(last)&&h(Button,{disabled:busy,kind:'quiet',onClick:()=>{const old=readSeat(last);if(old){setCode(last);setSeat({code:last,token:old.token});setError('');}}},t('resume')),h('p',{className:'fine private-entry-note'},h(Icon,{name:'shield',size:15}),t('privateNote')));}
 function entryStory(){return h('div',{className:'entry-story'},h('span',{className:'eyebrow hero-kicker'},h('span',{className:'tiny-star','aria-hidden':true},'✦'),t('gameNight')),h('h1',null,t('heroLine1'),h('br'),h('em',null,t('heroLine2'))),h('p',{className:'hero-description'},t('heroDescription')));}
 function entryShowcase(){return h('div',{className:'entry-showcase'},h('div',{className:'sample-deck','aria-hidden':true},h('span',{className:'deck-orbit'}),words.slice(0,3).map((word,i)=>h('div',{key:i,className:'sample-card sample-'+i},h('span',{className:'sample-icon'},h(Icon,{name:'spy',size:34})),h('strong',{lang:'ar',dir:'rtl'},word),h('small',null,t(i===0?'blue':i===1?'red':'brand')))),h('span',{className:'deck-stamp'},t('topSecret'))),
  h('div',{className:'entry-features'},h('span',null,h(Icon,{name:'people',size:18}),t('playerRange')),h('span',null,h(Icon,{name:'shield',size:18}),t('privateTable')),h('span',null,h(Icon,{name:'card',size:18}),t('twoModes'))));}
 return h('div',{className:'app room-app',dir:lang==='ar'?'rtl':'ltr',lang},
  !room?.match&&h('header',{className:'topbar'},h('a',{className:'brand',href:'#',onClick:e=>e.preventDefault()},h('span',{className:'brand-icon'},'◈'),'passnames'),h('div',{className:'top-actions'},seat&&h('span',{className:'connection-status '+status,role:'status'},t(status)),languageSelect(),!seat&&h(Button,{kind:'quiet',onClick:onLocal},t('localTest')))),
  !room?.match&&h('main',{className:'room-main'+(!room&&!seat?' entry-main':'')},
   error&&h('p',{className:'error',role:'alert'},/[\p{Script=Arabic}]/u.test(error)?message(lang,error):roomError(lang,error)),storageWarning&&h('p',{className:'warning'},t('storageWarning')),notice&&h('p',{role:'status',className:'notice-text'},t(notice)),
   room?onlineLobby():seat?h('section',{className:'panel waiting-panel'},h(Icon,{name:'shield',size:36}),h('h2',null,t(status)),h('p',{className:'fine'},seat.code),h(Button,{onClick:()=>{connection.current?.stop();setSeat(null);setRoom(null);setStatus('closed');}},t('cancelConnection'))):h('div',{className:'entry-layout'},entryStory(),entryPanel(),entryShowcase())),
  room?.match&&h(React.Fragment,null,
   error&&h('p',{className:'error',role:'alert'},/[\p{Script=Arabic}]/u.test(error)?message(lang,error):roomError(lang,error)),
   room.recovery?.adminDeadline&&hostRecovery(),transferNotice(),
   h(App,{key:room.match.id,remote:{view:room.match,presence:Object.fromEntries(room.players.map(p=>[p.id,p.online])),lang,onLang:setLang,connected:enabled,clockOffset:room.clockOffset||0,status,statusLabel:t(status),
    onAction:action=>send({type:'GAME',matchId:room.match.id,version:room.match.version,turnNumber:room.match.turnNumber,action}),
    onRematch:()=>send({type:'REMATCH',matchId:room.match.id}),onRoom:()=>setRoomControls(true)}}),
   roomControls&&h('div',{className:'drawer-overlay',onClick:()=>setRoomControls(false)},h('aside',{className:'team-drawer room-drawer',role:'dialog','aria-modal':true,onClick:e=>e.stopPropagation()},h('div',{className:'section-heading'},h('h2',null,t('settings')),h(Button,{autoFocus:true,onClick:()=>setRoomControls(false)},t('close'))),onlineLobby()))),
  confirmation&&h('div',{className:'overlay'},h('section',{className:'modal confirm-modal',role:'dialog','aria-modal':true},h('p',null,confirmation.text),h('div',{className:'button-row'},h(Button,{kind:'gold',disabled:busy,onClick:async()=>{await confirmation.action();setConfirmation(null);}},t('confirm')),h(Button,{autoFocus:true,onClick:()=>setConfirmation(null)},t('cancel'))))));
}
