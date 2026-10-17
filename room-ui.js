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
 const t=roomTranslator(lang);
 const admin=!!room&&room.me.id===room.adminId;
 const enabled=status==='connected'&&!busy;
 const settingKey=room?.settings?JSON.stringify(room.settings):'';
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';remember('passnames-language',lang);},[lang]);
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
  const editable=enabled&&room.phase==='lobby'&&(admin||player.id===room.me.id);
  return h('div',{className:'room-member '+(player.team||'unassigned'),key:player.id},
   h('div',{className:'member-identity'},h('strong',{dir:'auto'},player.name),h('span',{className:'presence '+(player.online?'online':'offline')},t(player.online?'online':'offline')),player.id===room.adminId&&h('span',{className:'admin-badge'},t('admin'))),
   h('div',{className:'member-controls'},
    h('select',{'aria-label':t('teams')+' '+player.name,value:player.team||'',disabled:!editable,onChange:e=>send({type:'ASSIGN',targetId:player.id,team:e.target.value||null,role:player.role})},h('option',{value:''},t('unassigned')),h('option',{value:'blue'},t('blue')),h('option',{value:'red'},t('red'))),
    h('select',{'aria-label':t('perspective')+' '+player.name,value:player.role,disabled:!editable,onChange:e=>send({type:'ASSIGN',targetId:player.id,team:player.team,role:e.target.value})},h('option',{value:'spy'},t('spy')),h('option',{value:'agent'},t('agent'))),
    admin&&player.id!==room.adminId&&h(Button,{kind:'danger',disabled:!enabled,onClick:()=>requestConfirmation(t('kickQuestion',{name:player.name}),()=>send({type:'KICK',targetId:player.id}))},t('kick'))));
 }
 function settingsPanel(){return h('section',{className:'panel room-settings'},h('h2',null,t('settings')),
  h('div',{className:'mode-picker'},['standard','expanded'].map(mode=>h('button',{key:mode,type:'button',className:draft.mode===mode?'active':'',disabled:!admin||!enabled||room.phase!=='lobby',onClick:()=>setDraft(s=>({...s,mode}))},h('strong',null,t(mode)),h('span',null,t(mode+'Short'))))),
  h('label',{className:'toggle'},h('input',{type:'checkbox',checked:draft.timerEnabled,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,timerEnabled:e.target.checked}))}),t('timerEnable')),
  draft.timerEnabled&&h('label',null,t('seconds'),h('input',{id:'room-timer',type:'text',inputMode:'numeric',dir:'ltr',value:draft.timerInput,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,timerInput:latinDigits(e.target.value)}))})),
  h('p',{className:'fine'},t('timerHint')),
  draft.mode==='expanded'&&h('label',{className:'toggle'},h('input',{type:'checkbox',checked:draft.manualDraw,disabled:!admin||!enabled||room.phase!=='lobby',onChange:e=>setDraft(s=>({...s,manualDraw:e.target.checked}))}),t('manualDraw')),
  admin&&room.phase==='lobby'&&h(Button,{disabled:!enabled,onClick:()=>saveSettings(false)},t('saveSettings')),
  h('div',{className:'readiness'},h('h3',null,t('readyCheck')),room.readiness?.ready?h('p',{className:'ready-note'},t('canStart')):h('ul',null,(room.readiness?.problems||[]).map((problem,i)=>h('li',{key:i},roomError(lang,problem.code,problem.team)))),
   admin&&room.phase==='lobby'&&h(Button,{kind:'gold',disabled:!enabled||!room.readiness?.ready,onClick:()=>saveSettings(true)},t('readyButton'))));}
 function onlineLobby(){
  if(room.phase==='waiting')return h('section',{className:'panel waiting-panel'},h('span',{className:'waiting-symbol'},'◌'),h('h1',null,t('waiting')),h('p',null,t('waitingHint')),h('p',{className:'fine',dir:'ltr'},room.code),h(Button,{disabled:!enabled,onClick:()=>requestConfirmation(t('leaveQuestion'),leave)},t('leave')));
  const hostOffline=room.players.some(p=>p.id===room.adminId&&!p.online);
  return h(React.Fragment,null,
   h('section',{className:'room-summary panel'},h('div',null,h('span',{className:'eyebrow'},t('codeLabel')),h('strong',{className:'room-code',dir:'ltr'},room.code),h('p',{className:'fine'},t(room.locked?'locked':'unlocked'))),
    h('div',{className:'room-invitation'},h(Button,{kind:'gold',onClick:copyInvite},t(copied?'copied':'invite')),h('input',{'aria-label':t('invite'),readOnly:true,dir:'ltr',value:roomInvite(location.href,room.code),onFocus:e=>e.target.select()}))),
   hostOffline&&h('p',{className:'warning'},t('hostDisconnected')),
   room.phase==='ready'&&h('section',{className:'panel room-ready'},h('h2',null,t('readyTitle')),h('p',null,t('readyHint')),admin&&h(Button,{disabled:!enabled,onClick:()=>send({type:'BACK'})},t('backLobby'))),
   h('div',{className:'room-layout'},h('section',{className:'panel'},h('div',{className:'section-heading'},h('h2',null,t('roster')),h('span',{className:'pill',dir:'ltr'},room.players.length+' / 10')),h('p',{className:'fine'},t('choose')),room.players.map(memberRow),
    h('form',{className:'rename-row',onSubmit:async e=>{e.preventDefault();if(await send({type:'RENAME',name:rename}))remember('passnames-name',rename.trim());}},h('label',{htmlFor:'room-rename'},t('rename')),h('div',null,h('input',{id:'room-rename',maxLength:24,dir:'auto',value:rename,disabled:!enabled,onChange:e=>setRename(e.target.value)}),h(Button,{type:'submit',disabled:!enabled},t('renameSave'))))),settingsPanel()),
   admin&&h('section',{className:'panel approvals'},h('div',{className:'section-heading'},h('h2',null,t('pending')),h('span',{className:'pill'},room.pending.length)),h('p',{className:'fine'},t('lockHint')),h(Button,{disabled:!enabled,onClick:()=>send({type:'LOCK',locked:!room.locked})},t(room.locked?'unlock':'lock')),
    room.pending.length?h('div',{className:'pending-list'},room.pending.map(player=>h('div',{className:'pending-row',key:player.id},h('strong',{dir:'auto'},player.name),h('span',{className:'fine'},t(player.online?'online':'offline')),h(Button,{kind:'gold',disabled:!enabled||room.phase!=='lobby',onClick:()=>send({type:'APPROVE',targetId:player.id})},t('approve')),h(Button,{disabled:!enabled,onClick:()=>requestConfirmation(t('rejectQuestion',{name:player.name}),()=>send({type:'REJECT',targetId:player.id}))},t('reject'))))):h('p',{className:'muted'},t('noPending'))),
   h('footer',{className:'game-footer'},h('span',null,t('sameBrowser')),h(Button,{kind:'danger',disabled:!enabled,onClick:()=>requestConfirmation(t('leaveQuestion')+(admin?' '+t('leaveAdmin'):''),leave)},t('leave'))));
 }
 function entryPanel(){const last=stored('passnames-last-room');return h('section',{className:'panel room-entry'},h('label',{htmlFor:'entry-name'},t('name')),h('input',{id:'entry-name',value:name,maxLength:24,autoComplete:'nickname',dir:'auto',onChange:e=>setName(e.target.value)}),
  h('div',{className:'entry-create'},h(Button,{kind:'gold',disabled:busy,onClick:()=>enter(true)},t(busy?'working':'create'))),
  h('div',{className:'entry-join'},h('label',{htmlFor:'entry-code'},t('code')),h('input',{id:'entry-code',value:code,dir:'ltr',autoComplete:'off',onChange:e=>setCode(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!busy)enter(false);}}),h(Button,{disabled:busy,onClick:()=>enter(false)},t('join'))),
  last&&readSeat(last)&&h(Button,{disabled:busy,kind:'quiet',onClick:()=>{const old=readSeat(last);if(old){setCode(last);setSeat({code:last,token:old.token});setError('');}}},t('resume')),h('p',{className:'fine'},t('privateNote')));}
 return h('div',{className:'app room-app',dir:lang==='ar'?'rtl':'ltr',lang},
  h('header',{className:'topbar'},h('a',{className:'brand',href:'#',onClick:e=>e.preventDefault()},h('span',{className:'brand-icon'},'◈'),'passnames'),h('div',{className:'top-actions'},seat&&h('span',{className:'connection-status '+status,role:'status'},t(status)),languageSelect(),!seat&&h(Button,{kind:'quiet',onClick:onLocal},t('localTest')))),
  h('main',{className:'room-main'},h('div',{className:'intro'},h('span',{className:'eyebrow'},t('stage')),!room&&h('h1',null,t('headline')),!room&&h('p',null,t('subheading'))),
   h('p',{className:'stage-note'},t('stageNote')),error&&h('p',{className:'error',role:'alert'},roomError(lang,error)),storageWarning&&h('p',{className:'warning'},t('storageWarning')),notice&&h('p',{role:'status',className:'notice-text'},t(notice)),
   room?onlineLobby():seat?h('section',{className:'panel waiting-panel'},h('h2',null,t(status)),h('p',{className:'fine'},seat.code),h(Button,{onClick:()=>{connection.current?.stop();setSeat(null);setRoom(null);setStatus('closed');}},t('cancelConnection'))):entryPanel()),
  confirmation&&h('div',{className:'overlay'},h('section',{className:'modal confirm-modal',role:'dialog','aria-modal':true},h('p',null,confirmation.text),h('div',{className:'button-row'},h(Button,{kind:'gold',disabled:busy,onClick:async()=>{await confirmation.action();setConfirmation(null);}},t('confirm')),h(Button,{autoFocus:true,onClick:()=>setConfirmation(null)},t('cancel'))))));
}
