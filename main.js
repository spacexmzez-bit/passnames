import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import words from './words.json';
import {createMatch, transition, playerView, TEAM_NAMES, CARD_NAMES, checkPool} from './engine.js';
import './style.css';
const h=React.createElement;
const digits=n=>new Intl.NumberFormat('ar-SA',{useGrouping:false}).format(n);
const colorLabel={blue:'أزرق',red:'أحمر',neutral:'محايد',yellow:'أصفر',black:'أسود'};
const roleLabel={spy:'قائد جواسيس',agent:'مخمّن'};
const countLabel=n=>n==='unlimited'?'بلا حدود':digits(n);
function rememberedName(){try{return localStorage.getItem('passnames-name')||'القائد الأزرق';}catch{return 'القائد الأزرق';}}
function remember(name){try{localStorage.setItem('passnames-name',name);}catch{}}
const firstPlayers=()=>[{id:'p1',name:rememberedName(),team:'blue',role:'spy'},{id:'p2',name:'المخمّن الأزرق',team:'blue',role:'agent'},{id:'p3',name:'القائد الأحمر',team:'red',role:'spy'},{id:'p4',name:'المخمّن الأحمر',team:'red',role:'agent'}];
function Button({children,onClick,kind='',...rest}){return h('button',{type:'button',className:'button '+kind,onClick,...rest},children);}
function Help({close}){return h('div',{className:'overlay',onClick:close},h('section',{className:'modal',role:'dialog','aria-modal':true,'aria-labelledby':'help-title',onClick:e=>e.stopPropagation()},
 h('div',{className:'section-heading'},h('h2',{id:'help-title'},'دليل المهمة'),h(Button,{onClick:close,autoFocus:true},'إغلاق')),
 h('p',null,'أكمل كلمات فريقك قبل الخصم. البطاقة السوداء تعني الخسارة فورًا. قائد الجواسيس يرى المفتاح ويكتب التلميح؛ المخمّنون يرشّحون الكلمات ويؤكدون التخمين.'),
 h('h3',null,'الترشيح ليس تخمينًا'),h('p',null,'اضغط الكلمة لترشيحها. يظهر اسمك لمخمّني فريقك فقط. لكشف كلمة، اضغط زر «تأكيد» المنفصل تحتها. يستطيع أي مخمّن من الفريق صاحب الدور تأكيد التخمين. تُمسح الترشيحات عند نهاية الدور.'),
 h('h3',null,'التلميحات والوقت'),h('p',null,'التلميح كلمة واحدة؛ تُقبل الكلمات المركّبة من جزأين مفصولين بمسافة. لا شرطات أو شرطة سفلية. لا يجوز تطابق التلميح مع كلمة غير مكشوفة. يراجع اللاعبون بأنفسهم صلة المعنى والأجزاء والجذور.'),
 h('p',null,'لكل تلميح رقمي عدد محاولات أقصاه الرقم + ١، ويمكن إنهاء الدور بعد أول تخمين. الصفر في الموسّع يسمح بتخمين واحد. «بلا حدود» يزيل الحد العددي فقط؛ الخطأ أو نفاد الوقت ينهي الدور. الصفر وبلا حدود يقطعان تسلسل الأكشن.'),
 h('p',null,'لا مؤقت لتحضير التلميح. إذا فُعّل الوقت قبل المباراة، يبدأ بعد إرسال التلميح ولا يمكن تغييره أثناء المباراة.'),
 h('h3',null,'الوضع العادي'),h('p',null,'شبكة ٥ × ٥. الفريق البادئ يُختار عشوائيًا وله ٩ كلمات؛ الآخر ٨. توجد ٧ محايدة وبطاقة سوداء واحدة. لا أكشن ولا صفر.'),
 h('h3',null,'الوضع الموسّع'),h('p',null,'شبكة ٦ × ٦: ١١ أزرق، ١٠ أحمر، ١١ محايد، ٢ أصفر، ٢ أسود. يبدأ الأزرق. الأصفر يُحسب رصيدًا للفريق الذي يكشفه ويسمح بمتابعة التخمين. هدف الأزرق ١١ والأحمر ١٠ من كلمات لونه + رصيده الأصفر.'),
 h('h3',null,'الأكشن'),h('p',null,'يسحب كل فريق بطاقة بداية. لا يُستخدم الأكشن في الدور الأول للفريق. دور ناجح يعني كشف كلمات من لونك أو الأصفر بعدد يساوي رقم التلميح أو يزيد. بعد دورين ناجحين متتاليين لفريقك تستحق بطاقة، ثم يُصفّر التسلسل. دور الخصم لا يقطعه. الأبيض أو لون الخصم أو نفاد الوقت يقطع التسلسل حتى بعد تحقيق العدد. تكرار تلميح ١ مسموح.'),
 h('ul',null,h('li',null,'فحص: قبل أول تخمين، يختار المخمّن موقعًا ليعرف هل بطاقته سوداء فقط. النتيجة لمخمّني فريقه وحدهم ولا تستهلك محاولة.'),h('li',null,'تبديل: قبل التلميح، تبديل كلمتين غير مكشوفتين مع بقاء الألوان في مواقعها. لا يستهلك محاولة.'),h('li',null,'فرصة ثانية: بعد محايد ومع وجود محاولات متبقية، يمكن المتابعة بالوقت والمحاولات المتبقية؛ يبقى المحايد مكشوفًا وينقطع التسلسل. في المباراة المؤقتة توجد ١٠ ثوانٍ لاتخاذ القرار، ثم يُستأنف وقت التخمين المحفوظ.'),h('li',null,'حظ أوفر: تُهمل فورًا بلا بديل. الرزمة تضم نسختين من كل أكشن و٤ حظ أوفر. عند النفاد تُخلط المهملات فقط.')),
 h('p',null,'أكشن واحد في الدور. البطاقة المكتسبة تصبح قابلة للاستخدام في دور فريقك التالي. في السحب اليدوي يسحب القائد فقط؛ الأيدي والنتائج للمخمّنين. محاولة السحب المكتسبة تنتهي عند بداية دور الفريق القادم. بطاقات البداية اليدوية تُسحب قبل بدء الأدوار.'),
 h('h3',null,'نسخة الاختبار المحلي'),h('p',null,'بدّل اللاعب من الشريط العلوي لاختبار وجهات النظر على الجهاز نفسه. هذه النسخة لا توفر حماية أسرار على الجهاز؛ نقل السلطة إلى الخادم والغرف الخاصة في المرحلة الثالثة. لا يُحفظ سجل مباريات؛ تحديث الصفحة يعيدك للإعداد. يُحفظ اسم اللاعب الأول فقط في متصفحك.')));}
function App(){
 const [settings,setSettings]=useState({mode:'standard',timerSeconds:0,manualDraw:false});
 const [players,setPlayers]=useState(firstPlayers);
 const [state,setState]=useState(null);
 const [viewer,setViewer]=useState('p1');
 const [error,setError]=useState('');
 const [help,setHelp]=useState(false);
 const [clueText,setClueText]=useState('');
 const [clueCount,setClueCount]=useState(1);
 const [tool,setTool]=useState(null);
 const [selected,setSelected]=useState([]);
 const [now,setNow]=useState(Date.now());
 const [tab,setTab]=useState('clues');
 const [confirm,setConfirm]=useState(null);
 const [health,setHealth]=useState('');
 let poolError='';try{checkPool(words);}catch(e){poolError=e.message;}
 const view=state?playerView(state,viewer):null;
 useEffect(()=>{if(!state||state.deadline===null||state.pause)return;const id=setInterval(()=>{const t=Date.now();setNow(t);setState(s=>s?transition(s,{type:'TICK'},t):null);},200);return()=>clearInterval(id);},[state?.deadline,state?.pause]);
 useEffect(()=>{setClueText('');setClueCount(1);setTool(null);setSelected([]);setError('');setConfirm(null);},[state?.turnNumber,viewer]);
 useEffect(()=>{if(state?.phase!=='clue'&&tool==='swap'){setTool(null);setSelected([]);}},[state?.phase]);
 useEffect(()=>{const fn=e=>{if(e.key==='Escape'){setHelp(false);setConfirm(null);setTool(null);setSelected([]);}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[]);
 function dispatch(type,extra={}){
   try{const next=transition(state,{type,playerId:viewer,...extra},Date.now());setState(next);setError('');setNow(Date.now());return true;}catch(e){setError(e.message);return false;}
 }
 function start(){try{const s=createMatch(settings,players,words);remember(players[0].name.trim());setState(s);setViewer(players[0].id);setError('');setHealth('');setNow(Date.now());}catch(e){setError(e.message);}}
 function changePlayer(id,key,value){setPlayers(ps=>ps.map(p=>p.id===id?{...p,[key]:value}:p));}
 function rematch(){setState(null);setTool(null);setSelected([]);setError('');setConfirm(null);setClueText('');setClueCount(1);}
 function ask(title,text,action,label='تأكيد'){setConfirm({title,text,action,label});}
 function boardClick(cell){
   if(view.pause||view.phase==='finished'||view.me.role!=='agent'||cell.revealed)return;
   if(tool==='swap')setSelected(ids=>ids.includes(cell.id)?ids.filter(id=>id!==cell.id):ids.length<2?[...ids,cell.id]:[ids[1],cell.id]);
   else if(tool==='scan')setSelected([cell.id]);
   else dispatch('MARK',{cell:cell.id});
 }
 function playTool(){if(dispatch(tool==='swap'?'SWAP':'SCAN',tool==='swap'?{cells:selected}:{cell:selected[0]})){setTool(null);setSelected([]);}}
 async function checkServer(){setHealth('جارٍ الفحص…');try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok||!d.ok)throw Error('تعذر الاتصال');setHealth('الخادم جاهز ✓');}catch(e){setHealth('فشل الفحص: '+e.message);}}
 const myTurn=view&&view.active===view.me.team;
 const canAgent=view&&view.me.role==='agent'&&myTurn&&!view.pause&&!['deal','finished'].includes(view.phase);
 const max=state?state.board.filter(c=>!c.revealed).length:36;
 const warnStreak=settings.mode==='expanded'&&(clueCount===0||clueCount==='unlimited');
 const mode=view?view.settings.mode:settings.mode;
 const timeLeft=view?.deadline===null||!view?null:Math.max(0,Math.ceil((view.deadline-now)/1000));
 function teamPanel(team){const t=view.teams[team];return h('section',{className:'team-score '+team+(view.active===team?' current':''),key:team},h('div',{className:'score-head'},h('span',null,'الفريق '+TEAM_NAMES[team]),h('strong',null,digits(t.score),h('small',null,' / '+digits(t.target)))),h('div',{className:'progress','aria-label':'رصيد الفريق'},h('span',{style:{width:Math.min(100,t.score/t.target*100)+'%'}})),h('div',{className:'team-detail'},h('span',null,'المتبقي '+digits(Math.max(0,t.target-t.score))),mode==='expanded'&&h('span',null,'أصفر '+digits(t.yellow)+' · الإنجاز '+digits(t.streak)+' / ٢')),h('div',{className:'roster'},view.players.filter(p=>p.team===team).map(p=>h('span',{key:p.id,className:p.id===viewer?'me':''},p.role==='spy'?'◈ ':'• ',p.name))));}
 function gameBoard(){return h('div',{className:'board',style:{'--size':view.size},'aria-label':'شبكة الكلمات'},view.board.map(cell=>{
  const visible=cell.color, mine=cell.marks.includes(view.me.name), target=selected.includes(cell.id);
  const interactive=view.me.role==='agent'&&!cell.revealed&&!view.pause&&view.phase!=='finished'&&view.phase!=='deal';
  const canGuess=canAgent&&view.phase==='guess'&&!tool&&!cell.revealed;
  const scan=view.scans.filter(s=>s.cell===cell.id).at(-1);
  return h('div',{key:cell.id,className:'word-cell '+(visible?'color-'+visible:'concealed')+(cell.revealed?' revealed':'')+(mine?' nominated':'')+(target?' selected':'')},
    h('button',{type:'button',className:'word-face',disabled:!interactive,onClick:()=>boardClick(cell),'aria-pressed':interactive?mine||target:undefined,'aria-label':cell.word+(cell.revealed?'، مكشوفة '+colorLabel[visible]:visible?'، '+colorLabel[visible]:'')},h('span',{className:'cell-index'},digits(cell.id+1)),h('span',{className:'word'},cell.word),visible&&h('span',{className:'identity'},cell.revealed?'✓ '+colorLabel[visible]:colorLabel[visible]),cell.yellowOwner&&h('span',{className:'yellow-owner'},'رصيد '+TEAM_NAMES[cell.yellowOwner])),
    cell.marks.length>0&&h('div',{className:'marks',title:cell.marks.join('، ')},cell.marks.join('، ')),
    scan&&!cell.revealed&&h('span',{className:'scan-label'},scan.black?'فحص: سوداء':'فحص: ليست سوداء'),
    canGuess&&h('button',{className:'confirm-word',type:'button',onClick:()=>ask('تأكيد التخمين','هل تريد كشف «'+cell.word+'»؟ هذا تخمين فعلي ويستهلك محاولة.',()=>dispatch('GUESS',{cell:cell.id}),'كشف الكلمة')},'تأكيد ↗'));
 }));}
 function actionsPanel(){if(mode!=='expanded')return null;
  if(view.me.role==='spy')return view.settings.manualDraw&&h('section',{className:'panel'},h('h3',null,'سحب الأكشن'),h('p',{className:'muted'},view.canDraw?'لديك محاولة سحب متاحة.':'تضيء البطاقة عند استحقاق محاولة سحب.'),h(Button,{disabled:!view.canDraw,onClick:()=>dispatch('DRAW'),kind:view.canDraw?'gold':'faded'},'اسحب بطاقة'),h('p',{className:'fine'},'المحاولة المكتسبة تنتهي عند بداية دور فريقك القادم. البطاقات للمخمّنين فقط.'));
  const t=view.teams[view.me.team];
  return h('section',{className:'panel'},h('div',{className:'section-heading'},h('h3',null,'بطاقات فريقك'),h('span',{className:'pill'},'خاصة بالمخمّنين')),
   h('p',{className:'fine'},'أكشن واحد في الدور · لا أكشن في دورك الأول'),
   view.hand.length?h('div',{className:'hand'},view.hand.map(c=>{const allowed=c.available&&(c.type==='swap'?view.phase==='clue':c.type==='scan'?['clue','guess'].includes(view.phase)&&view.guesses===0:view.phase==='second');return h('button',{className:'action-card',type:'button',key:c.id,disabled:!allowed,onClick:()=>{if(c.type==='second')dispatch('SECOND');else{setTool(c.type);setSelected([]);}}},h('strong',null,CARD_NAMES[c.type]),h('small',null,c.usableTurn>t.turns?'من دورك '+digits(c.usableTurn):allowed?'استخدم البطاقة':'غير متاحة الآن'));})):h('p',{className:'muted'},'لا توجد بطاقات في يد الفريق.'),
   h('div',{className:'streak-box'},h('strong',null,'تسلسل الإنجاز '+digits(t.streak)+' / ٢'),h('p',{className:'fine'},'الصفر وبلا حدود يقطعان التسلسل.')),
   view.scans.length>0&&h('details',null,h('summary',null,'سجل الفحص الخاص'),view.scans.map((s,i)=>h('p',{key:i,className:'fine'},'الموقع '+digits(s.cell+1)+' · وقت الفحص: '+s.word+' · '+(s.black?'سوداء':'ليست سوداء')))));
 }
 function controlPanel(){
  if(view.phase==='finished')return h('section',{className:'result'},h('span',{className:'eyebrow'},'انتهت المهمة'),h('h2',null,'فاز الفريق '+TEAM_NAMES[view.winner]),h('p',null,'لا تُحفظ النتائج. ارجع للإعداد لمباراة جديدة.'),view.me.id===view.adminId&&h(Button,{kind:'gold',onClick:()=>ask('إعادة المباراة','سيُمسح سجل هذه المباراة وتعود المجموعة للإعداد مع الأسماء والفرق والإعدادات نفسها.',rematch,'العودة للإعداد')},'إعادة المباراة'));
  if(view.phase==='deal')return h('section',{className:'panel'},h('h2',null,'بطاقات البداية'),h('p',null,'بدّل إلى كل قائد جواسيس واضغط «اسحب بطاقة» في لوحته. ثم يبدأ المشرف الأدوار. لا يُستخدم الأكشن في الدور الأول.'),view.me.id===view.adminId&&h(Button,{kind:'gold',onClick:()=>ask('بدء الأدوار','أي محاولة لسحب بطاقة بداية لم تُستخدم ستنتهي. هل تريد البدء؟',()=>dispatch('BEGIN'),'ابدأ الأدوار')},'بدء الأدوار'));
  if(view.pause)return h('section',{className:'panel notice'},h('h2',null,'المباراة متوقفة مؤقتًا'),h('p',null,'المؤقت متوقف. يمكن للمشرف استئناف الاختبار.'));
  if(view.phase==='second')return h('section',{className:'panel second-choice'},h('h2',null,'فرصة ثانية؟'),h('p',null,'كُشفت بطاقة محايدة. يبقى تسلسل الإنجاز مقطوعًا حتى بعد استخدام البطاقة.'),canAgent?h('div',{className:'button-row'},h(Button,{kind:'gold',onClick:()=>dispatch('SECOND')},'استخدم فرصة ثانية'),h(Button,{onClick:()=>dispatch('DECLINE')},'إنهاء الدور')):h('p',{className:'muted'},'ينتظر القرار من مخمّني الفريق '+TEAM_NAMES[view.active]+'.'));
  if(view.phase==='clue'&&view.me.role==='spy'&&myTurn)return h('section',{className:'panel'},h('h2',null,'أرسل التلميح'),h('p',{className:'muted'},'كلمة واحدة · تحضير التلميح دون مؤقت'),h('form',{onSubmit:e=>{e.preventDefault();dispatch('CLUE',{text:clueText,count:clueCount});}},
   h('label',{htmlFor:'clue-text'},'التلميح'),h('input',{id:'clue-text',value:clueText,maxLength:60,autoComplete:'off',placeholder:'اكتب كلمة واحدة',onChange:e=>setClueText(e.target.value)}),
   h('label',{htmlFor:'clue-count'},'عدد الكلمات'),h('select',{id:'clue-count',value:clueCount,onChange:e=>setClueCount(e.target.value==='unlimited'?'unlimited':Number(e.target.value))},Array.from({length:max+(mode==='expanded'?1:0)},(_,i)=>i+(mode==='expanded'?0:1)).map(n=>h('option',{key:n,value:n},digits(n))),h('option',{value:'unlimited'},'بلا حدود')),
   warnStreak&&h('p',{className:'warning'},'هذا الاختيار يقطع تسلسل الإنجاز ولا يكسب تقدمًا نحو بطاقة أكشن.'),h(Button,{kind:'gold',type:'submit'},'إرسال التلميح')));
  return h('section',{className:'panel'},h('h2',null,view.phase==='clue'?'في انتظار التلميح':'مرحلة التخمين'),h('p',null,view.phase==='clue'?'قائد الفريق '+TEAM_NAMES[view.active]+' يحضّر التلميح دون مؤقت.':canAgent?'اضغط الكلمة لترشيحها، أو زر «تأكيد» لكشفها.':'انتظر مخمّني الفريق '+TEAM_NAMES[view.active]+'.'),canAgent&&view.phase==='guess'&&h(Button,{disabled:view.guesses===0,onClick:()=>dispatch('END')},'إنهاء الدور'));
 }
 return h(React.Fragment,null,
  h('header',{className:'topbar'},h('a',{className:'brand',href:'#',onClick:e=>e.preventDefault()},h('span',{className:'brand-icon'},'◈'),'passnames',h('small',null,'كلمات سرية')),h('div',{className:'top-actions'},h('span',{className:'local-tag'},'اختبار محلي · المرحلة ٢'),h(Button,{onClick:()=>setHelp(true),kind:'quiet'},'القواعد'))),
  !state?h('main',{className:'lobby'},h('div',{className:'intro'},h('span',{className:'eyebrow'},'كلمة واحدة. أكثر من احتمال.'),h('h1',null,'ابدأ مهمتك التالية'),h('p',null,'جهّز الفريقين، اختر القواعد، واختبر اللعبة من منظور كل لاعب.')),
   h('div',{className:'lobby-grid'},h('section',{className:'panel settings'},h('h2',null,'إعداد المباراة'),
    h('div',{className:'mode-picker'},h('button',{type:'button',className:settings.mode==='standard'?'active':'',onClick:()=>setSettings(s=>({...s,mode:'standard'}))},h('strong',null,'عادي'),h('span',null,'٥ × ٥ · دون أكشن')),h('button',{type:'button',className:settings.mode==='expanded'?'active':'',onClick:()=>setSettings(s=>({...s,mode:'expanded'}))},h('strong',null,'موسّع'),h('span',null,'٦ × ٦ · أصفر وأكشن'))),
    h('label',{className:'toggle'},h('input',{type:'checkbox',checked:settings.timerSeconds>0,onChange:e=>setSettings(s=>({...s,timerSeconds:e.target.checked?60:0}))}),h('span',null,'تفعيل وقت التخمين')),
    settings.timerSeconds>0&&h('label',null,'مدة الدور بالثواني',h('input',{type:'number',min:10,max:600,step:1,value:settings.timerSeconds,onChange:e=>setSettings(s=>({...s,timerSeconds:Number(e.target.value)}))})),
    h('p',{className:'fine'},'لا وقت للتلميحات. إعداد الوقت ثابت حتى نهاية المباراة.'),
    settings.mode==='expanded'&&h(React.Fragment,null,h('label',{className:'toggle'},h('input',{type:'checkbox',checked:settings.manualDraw,onChange:e=>setSettings(s=>({...s,manualDraw:e.target.checked}))}),h('span',null,'السحب اليدوي لقائد الجواسيس')),h('p',{className:'fine'},settings.manualDraw?'تضيء محاولة السحب عند استحقاقها وتنتهي عند بداية دور فريقك القادم.':'السحب تلقائي. لا يظهر زر السحب للقائد.')),
    h('div',{className:'setup-summary'},h('strong',null,settings.mode==='standard'?'التحدي الكلاسيكي':'تحدٍ بمزايا إضافية'),h('p',null,settings.mode==='standard'?'البادئ عشوائي · ٩ مقابل ٨ · أسود واحد':'الأزرق يبدأ · ١١ مقابل ١٠ · أصفران وأسودان'))),
    h('section',{className:'panel players'},h('div',{className:'section-heading'},h('h2',null,'الفريقان'),h('span',{className:'pill'},digits(players.length)+' / ١٠')),
     h('p',{className:'fine'},'قائد واحد ومخمّن واحد على الأقل لكل فريق. اللاعب الأول هو المشرف.'),
     players.map((p,i)=>h('div',{className:'player-row',key:p.id},h('input',{'aria-label':'اسم اللاعب '+(i+1),value:p.name,maxLength:24,onChange:e=>changePlayer(p.id,'name',e.target.value)}),h('select',{'aria-label':'فريق '+p.name,value:p.team,onChange:e=>changePlayer(p.id,'team',e.target.value)},h('option',{value:'blue'},'أزرق'),h('option',{value:'red'},'أحمر')),h('select',{'aria-label':'دور '+p.name,value:p.role,onChange:e=>changePlayer(p.id,'role',e.target.value)},h('option',{value:'spy'},'قائد جواسيس'),h('option',{value:'agent'},'مخمّن')),h(Button,{kind:'remove',disabled:players.length<=4||i===0,'aria-label':'إزالة '+p.name,onClick:()=>setPlayers(ps=>ps.filter(x=>x.id!==p.id))},'×'))),
     h(Button,{disabled:players.length>=10,onClick:()=>setPlayers(ps=>[...ps,{id:crypto.randomUUID(),name:'',team:ps.filter(p=>p.team==='blue').length<=ps.filter(p=>p.team==='red').length?'blue':'red',role:'agent'}])},'+ إضافة لاعب'),
     h('p',{className:'local-note'},'هذه الأسماء شخصيات للاختبار على جهاز واحد. الغرف واتصال الأجهزة في المرحلة الثالثة.'))),
   (error||poolError)&&h('p',{className:'error',role:'alert'},error||poolError),
   h('div',{className:'launch-row'},h(Button,{kind:'gold large',disabled:!!poolError,onClick:start},'ابدأ المباراة ←'),h(Button,{kind:'quiet',onClick:checkServer},'فحص الخادم'),h('span',{role:'status'},health)),h('p',{className:'fine'},'تُقرأ الكلمات من words.json وحده. لا يُحفظ سجل المباريات.')):
  h('main',{className:'game'},
    h('section',{className:'view-switch'},h('div',null,h('strong',null,'منظور اللاعب'),h('span',{className:'fine'},'اختبار على الجهاز نفسه؛ ليس اتصال لاعبين عبر الإنترنت')),h('select',{'aria-label':'تبديل منظور اللاعب',value:viewer,onChange:e=>setViewer(e.target.value)},view.players.map(p=>h('option',{key:p.id,value:p.id},p.name+' · '+TEAM_NAMES[p.team]+' · '+roleLabel[p.role]))),h('span',{className:'role-badge '+view.me.team},roleLabel[view.me.role]),view.me.id===view.adminId&&h('span',{className:'pill'},'المشرف')),
    h('div',{className:'score-grid'},teamPanel('blue'),teamPanel('red')),
    h('div',{className:'mission-bar'},h('div',null,h('span',{className:'eyebrow'},mode==='standard'?'الوضع العادي · ٥ × ٥':'الوضع الموسّع · ٦ × ٦'),h('h2',null,view.phase==='finished'?'اكتملت المهمة':view.phase==='deal'?'الاستعداد':view.pause?'إيقاف مؤقت':'دور الفريق '+TEAM_NAMES[view.active]),view.clue&&h('div',{className:'live-clue'},h('strong',null,view.clue.text),h('span',null,countLabel(view.clue.count)),h('small',null,'المحاولات: '+digits(view.guesses)+' / '+(view.clue.count==='unlimited'?'∞':digits(view.clue.count+1))))),h('div',{className:'timer '+(timeLeft!==null&&timeLeft<=10?'urgent':'')},h('strong',null,view.pause?'متوقف':timeLeft!==null?digits(timeLeft)+' ث':view.phase==='clue'?'دون وقت':view.settings.timerSeconds===0?'دون مؤقت':'—'),h('small',null,view.phase==='second'?'مهلة قرار فرصة ثانية':view.phase==='clue'?'تحضير التلميح':'وقت التخمين'))),
    error&&h('p',{className:'error',role:'alert'},error),
    h('div',{className:'game-layout'},h('section',{className:'board-area'},h('div',{className:'board-caption'},h('span',null,view.me.role==='spy'?'المفتاح ظاهر لك · لا توجّه التخمين':'ترشيح: اضغط الكلمة · كشف: اضغط «تأكيد»'),h('span',null,'الأبيض ينهي الدور · الأسود خسارة')),
     tool&&h('div',{className:'tool-bar'},h('strong',null,tool==='swap'?'اختر كلمتين للتبديل':'اختر كلمة للفحص'),h('span',null,digits(selected.length)+' / '+(tool==='swap'?'٢':'١')),h(Button,{kind:'gold',disabled:selected.length!==(tool==='swap'?2:1),onClick:playTool},'استخدم '+CARD_NAMES[tool]),h(Button,{onClick:()=>{setTool(null);setSelected([]);}},'إلغاء')),
     gameBoard(),h('div',{className:'legend'},Object.entries(colorLabel).filter(([color])=>mode==='expanded'||color!=='yellow').map(([color,label])=>h('span',{key:color},h('i',{className:color}),label)))),
     h('aside',{className:'sidebar'},controlPanel(),actionsPanel(),h('section',{className:'panel logs'},h('div',{className:'tab-row'},h('button',{className:tab==='clues'?'active':'',onClick:()=>setTab('clues')},'التلميحات'),h('button',{className:tab==='log'?'active':'',onClick:()=>setTab('log')},'سجل الأحداث')),
      tab==='clues'?(view.clues.length?h('ol',null,[...view.clues].reverse().map(c=>h('li',{key:c.turn,className:c.team},h('strong',null,c.text),h('span',null,countLabel(c.count)),h('small',null,'الدور '+digits(c.turn)+' · '+TEAM_NAMES[c.team])))):h('p',{className:'muted'},'ستظهر التلميحات هنا.')):h('ol',null,[...view.log].reverse().map(e=>h('li',{key:e.id},h('span',null,e.text),h('small',null,'الدور '+digits(e.turn)))))))),
    h('footer',{className:'game-footer'},h('span',null,'لا تُحفظ المباراة عند تحديث الصفحة. يمكن تبديل الأدوار بين المباريات.'),view.me.id===view.adminId&&h('div',{className:'button-row'},!['finished','deal'].includes(view.phase)&&h(Button,{onClick:()=>dispatch('PAUSE')},view.pause?'استئناف الاختبار':'إيقاف مؤقت للاختبار'),view.phase!=='finished'&&h(Button,{kind:'danger',onClick:()=>ask('إعادة المباراة الآن؟','ستتوقف المباراة الحالية ويُمسح سجلها وتعود للإعداد، مع الاحتفاظ بالأسماء والفرق والإعدادات.',rematch,'إعادة المباراة')},'إعادة المباراة')))),
  help&&h(Help,{close:()=>setHelp(false)}),
  confirm&&h('div',{className:'overlay'},h('section',{className:'modal confirm-modal',role:'dialog','aria-modal':true,'aria-labelledby':'confirm-title'},h('h2',{id:'confirm-title'},confirm.title),h('p',null,confirm.text),h('div',{className:'button-row'},h(Button,{kind:'gold',onClick:()=>{const action=confirm.action;setConfirm(null);action();}},confirm.label),h(Button,{autoFocus:true,onClick:()=>setConfirm(null)},'إلغاء')))));
}
createRoot(document.getElementById('root')).render(h(App));
