// Standalone rules. No DOM, network, browser storage, or framework dependencies.
export const TEAMS = ['blue', 'red'];
export const CARD_NAMES = {second:'فرصة ثانية', scan:'فحص', swap:'تبديل', luck:'حظ أوفر'};
export const TEAM_NAMES = {blue:'الأزرق', red:'الأحمر'};
const other = team => team === 'blue' ? 'red' : 'blue';
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
export function shuffled(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function normalizeWord(value) {
  return value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim().replace(/\s+/g, ' ');
}
export function checkPool(pool) {
  assert(Array.isArray(pool), 'ملف الكلمات يجب أن يكون مصفوفة JSON.');
  assert(pool.every(w => typeof w === 'string' && w.trim() && /\p{Script=Arabic}/u.test(w)), 'ملف الكلمات يحتوي كلمة غير صالحة.');
  const unique = [...new Map(pool.map(w => [normalizeWord(w), w.trim()])).values()];
  assert(unique.length >= 36, 'ملف الكلمات يحتاج ٣٦ كلمة مختلفة على الأقل.');
  return unique;
}
function log(s, text, visibility = 'all') {
  s.log.push({id:s.nextId++, turn:s.turnNumber, team:s.active, text, visibility});
}
function eligible(s, team, type) {
  return s.teams[team].hand.find(c => c.type === type && c.usableTurn <= s.teams[team].turns);
}
function draw(s, team, usableTurn, rng) {
  if (!s.deck.length) {
    s.deck = shuffled(s.discard, rng); s.discard = [];
  }
  if (!s.deck.length) { log(s, 'لا توجد بطاقة متاحة للسحب.', team); return; }
  const type = s.deck.pop();
  if (type === 'luck') {
    s.discard.push(type); log(s, 'سحب الفريق: حظ أوفر. لا توجد بطاقة بديلة.', team);
  } else {
    s.teams[team].hand.push({id:s.nextId++, type, usableTurn});
    log(s, 'سحب الفريق بطاقة: ' + CARD_NAMES[type], team);
  }
}
function grant(s, team, usableTurn, rng) {
  if (s.settings.manualDraw) {
    s.teams[team].pendingDraw = {usableTurn};
    log(s, 'استُحقت محاولة سحب. تنتهي عند بداية دور الفريق القادم.', team);
  } else draw(s, team, usableTurn, rng);
}
export function maxClueCount(s, team = s.active) { return s.teams[team].target; }
function beginTurn(s, team) {
  const t = s.teams[team];
  s.active = team;
  if (t.pendingDraw) {
    t.pendingDraw = null; log(s, 'انتهت محاولة السحب غير المستخدمة.', team);
  }
  t.turns++;
  s.turnNumber++;
  s.phase = 'clue'; s.clue = null; s.guesses = 0; s.good = 0; s.broken = false;
  s.actionUsed = false; s.deadline = null; s.remainingMs = null; s.marks = {};
  log(s, 'بدأ دور الفريق ' + TEAM_NAMES[team] + '.');
}
function finishTurn(s, reason, rng) {
  const team = s.active, t = s.teams[team];
  const qualifies = s.clue && typeof s.clue.count === 'number' && s.clue.count > 0 && s.good >= s.clue.count && !s.broken;
  if (s.settings.mode === 'expanded') {
    if (qualifies) {
      t.streak++;
      if (t.streak === 2) {
        t.streak = 0; grant(s, team, t.turns + 1, rng);
      }
    } else t.streak = 0;
  }
  log(s, reason);
  beginTurn(s, other(team));
}
function win(s, team, reason) {
  s.phase = 'finished'; s.winner = team; s.deadline = null; s.pause = null; s.marks = {};
  s.teams.blue.pendingDraw = null; s.teams.red.pendingDraw = null;
  log(s, reason + ' فاز الفريق ' + TEAM_NAMES[team] + '.');
}
export function score(s, team) {
  return s.board.filter(c => c.revealed && c.color === team).length + s.teams[team].yellow;
}
function checkWin(s) {
  for (const team of TEAMS) {
    if (score(s, team) >= s.teams[team].target) {
      win(s, team, 'اكتمل الهدف.'); return true;
    }
  }
  return false;
}
function consume(s, type) {
  const t = s.teams[s.active];
  const card = eligible(s, s.active, type);
  assert(card, 'هذه البطاقة غير متاحة الآن.');
  assert(t.turns > 1, 'لا يمكن استخدام الأكشن في الدور الأول للفريق.');
  assert(!s.actionUsed, 'يُسمح بأكشن واحد فقط في الدور.');
  t.hand = t.hand.filter(c => c.id !== card.id);
  s.discard.push(type); s.actionUsed = true;
  log(s, 'استُخدمت بطاقة ' + CARD_NAMES[type] + '.', s.active);
}
export function createMatch(settings, players, pool, now = Date.now(), rng = Math.random) {
  const words = checkPool(pool);
  assert(settings.mode === 'standard' || settings.mode === 'expanded', 'وضع اللعب غير صالح.');
  assert(Number.isInteger(settings.timerSeconds) && (settings.timerSeconds === 0 || settings.timerSeconds >= 10 && settings.timerSeconds <= 600), 'المؤقت: دون وقت أو من ١٠ إلى ٦٠٠ ثانية.');
  assert(players.length >= 4 && players.length <= 10, 'عدد اللاعبين من ٤ إلى ١٠.');
  assert(new Set(players.map(p => p.id)).size === players.length, 'هويات اللاعبين غير صالحة.');
  assert(players.every(p => typeof p.name === 'string' && p.name.trim() && p.name.trim().length <= 24 && TEAMS.includes(p.team) && ['spy','agent'].includes(p.role)), 'أكمل أسماء اللاعبين وفرقهم وأدوارهم.');
  assert(new Set(players.map(p => p.name.trim())).size === players.length, 'استخدم أسماء مختلفة للاعبين.');
  for (const team of TEAMS) {
    assert(players.filter(p => p.team === team && p.role === 'spy').length === 1, 'كل فريق يحتاج جاسوس واحدًا بالضبط.');
    assert(players.some(p => p.team === team && p.role === 'agent'), 'كل فريق يحتاج عميلًا واحدًا على الأقل.');
  }
  const expanded = settings.mode === 'expanded';
  const start = expanded ? 'blue' : rng() < 0.5 ? 'blue' : 'red';
  const colors = expanded ? [...Array(11).fill('blue'), ...Array(10).fill('red'), ...Array(11).fill('neutral'), 'yellow','yellow','black','black'] : [...Array(9).fill(start), ...Array(8).fill(other(start)), ...Array(7).fill('neutral'), 'black'];
  const layout = shuffled(colors, rng), picked = shuffled(words, rng).slice(0, layout.length);
  const teamState = team => ({target:expanded ? team === 'blue' ? 11 : 10 : team === start ? 9 : 8, turns:0, streak:0, yellow:0, hand:[], pendingDraw:null, initialDrawn:false, scans:[]});
  const s = {settings:{mode:settings.mode,timerSeconds:settings.timerSeconds,manualDraw:expanded && !!settings.manualDraw}, players:players.map(p=>({...p,name:p.name.trim()})), adminId:players[0].id,
    board:layout.map((color,i)=>({id:i,word:picked[i],color,revealed:false,yellowOwner:null})), size:expanded ? 6 : 5,
    teams:{blue:teamState('blue'),red:teamState('red')}, deck:expanded ? shuffled(['second','second','scan','scan','swap','swap','luck','luck','luck','luck'],rng) : [], discard:[],
    nextId:1, log:[], clues:[], active:start, firstTeam:start, phase:'deal', turnNumber:0, clue:null, guesses:0, good:0, broken:false, actionUsed:false, deadline:null, remainingMs:null, marks:{}, winner:null, pause:null, createdAt:now};
  log(s, expanded ? 'مباراة موسّعة: يبدأ الأزرق.' : 'مباراة عادية: يبدأ الفريق ' + TEAM_NAMES[start] + '.');
  if (expanded) {
    for (const team of TEAMS) {
      if (s.settings.manualDraw) s.teams[team].pendingDraw = {usableTurn:2};
      else { draw(s,team,2,rng); s.teams[team].initialDrawn = true; }
    }
  }
  if (!expanded) beginTurn(s,start);
  return s;
}
function expire(s, now, rng) {
  if (s.pause || s.deadline === null || now < s.deadline) return;
  s.broken = true;
  finishTurn(s, s.phase === 'second' ? 'انتهت مهلة اختيار فرصة ثانية.' : 'انتهى وقت التخمين.', rng);
}
export function transition(state, action, now = Date.now(), rng = Math.random) {
  const s = structuredClone(state);
  const wasPhase = s.phase, wasTurn = s.turnNumber;
  expire(s, now, rng);
  if (action.type === 'TICK') return s;
  // A stale click cannot act in the next turn after an expired deadline.
  if (s.turnNumber !== wasTurn || s.phase !== wasPhase && wasPhase === 'second') return s;
  const actor = s.players.find(p => p.id === action.playerId);
  assert(actor, 'لاعب غير معروف.');
  if (action.type === 'PAUSE') {
    assert(actor.id === s.adminId && !['deal','finished'].includes(s.phase), 'الإيقاف متاح للمشرف أثناء اللعب.');
    if (s.pause) {
      s.deadline = s.pause.remaining === null ? null : now + s.pause.remaining;
      s.pause = null; log(s, 'استؤنفت المباراة.');
    } else {
      s.pause = {remaining:s.deadline === null ? null : Math.max(0,s.deadline-now)};
      s.deadline = null; log(s, 'أُوقفت المباراة مؤقتًا للاختبار المحلي.');
    }
    return s;
  }
  assert(!s.pause, 'المباراة متوقفة مؤقتًا.');
  assert(s.phase !== 'finished', 'انتهت المباراة.');
  if (action.type === 'DRAW') {
    assert(s.settings.manualDraw && actor.role === 'spy', 'السحب اليدوي للجاسوس فقط.');
    const t = s.teams[actor.team];
    assert(t.pendingDraw, 'لا توجد محاولة سحب متاحة.');
    assert(s.phase === 'deal' || actor.team !== s.active, 'انتهت نافذة السحب.');
    draw(s,actor.team,t.pendingDraw.usableTurn,rng); t.pendingDraw = null;
    if (s.phase === 'deal') t.initialDrawn = true;
    return s;
  }
  if (action.type === 'BEGIN') {
    assert(actor.id === s.adminId && s.phase === 'deal', 'بدء الأدوار متاح للمشرف فقط.');
    assert(TEAMS.every(team => s.teams[team].initialDrawn), 'يجب إكمال سحب البداية للفريقين قبل بدء اللعب.');
    beginTurn(s,s.firstTeam); return s;
  }
  assert(s.phase !== 'deal', 'ابدأ الأدوار أولًا.');
  if (action.type === 'MARK') {
    assert(actor.role === 'agent', 'التحديد للعملاء فقط.');
    assert(s.board.some(c => c.id === action.cell && !c.revealed), 'اختر كلمة غير مكشوفة.');
    const key=String(action.cell), marks=s.marks[key] || [];
    s.marks[key]=marks.includes(actor.id) ? marks.filter(id=>id!==actor.id) : [...marks,actor.id];
    return s;
  }
  assert(actor.team === s.active, 'انتظر دور فريقك.');
  if (action.type === 'CLUE') {
    assert(actor.role === 'spy' && s.phase === 'clue', 'التلميح لجاسوس الفريق وفي مرحلة التلميح فقط.');
    const text = String(action.text ?? '').trim().replace(/\s+/g,' ');
    assert(text.length > 0 && text.length <= 60 && text.split(' ').length <= 2 && /^[\p{Script=Arabic}\p{M} ]+$/u.test(text) && !/[\p{Dash_Punctuation}_\u0640]/u.test(text), 'أدخل تلميحًا عربيًا: كلمة واحدة، دون شرطات أو شرطة سفلية.');
    const normalized = normalizeWord(text);
    assert(!s.board.some(c=>!c.revealed && normalizeWord(c.word) === normalized), 'التلميح يطابق كلمة غير مكشوفة.');
    const max = maxClueCount(s);
    const count=action.count;
    assert(count === 'unlimited' || Number.isInteger(count) && count >= (s.settings.mode === 'expanded' ? 0 : 1) && count <= max, 'عدد التلميح غير صالح.');
    s.clue={text,count}; s.phase='guess'; s.deadline=s.settings.timerSeconds ? now+s.settings.timerSeconds*1000 : null;
    s.clues.push({team:s.active,turn:s.turnNumber,text,count});
    log(s, 'التلميح: ' + text + ' · ' + (count==='unlimited' ? 'بلا حدود' : count));
    if (s.settings.mode === 'expanded' && (count === 0 || count === 'unlimited')) {
      s.teams[s.active].streak=0; log(s, 'هذا التلميح يقطع تسلسل الإنجاز ولا يحقق تقدمًا نحو سحب الأكشن.');
    }
    return s;
  }
  assert(actor.role === 'agent', 'هذا الإجراء للعملاء فقط.');
  if (action.type === 'SCAN') {
    assert(['clue','guess'].includes(s.phase) && s.guesses === 0, 'الفحص قبل أول تخمين فقط.');
    const c=s.board.find(c=>c.id===action.cell && !c.revealed); assert(c,'اختر كلمة غير مكشوفة.');
    consume(s,'scan');
    s.teams[s.active].scans.push({cell:c.id,word:c.word,black:c.color==='black',turn:s.turnNumber});
    log(s,'فحص «'+c.word+'»: '+(c.color==='black'?'سوداء':'ليست سوداء')+'.',s.active);
    return s;
  }
  if (action.type === 'SWAP') {
    assert(s.phase === 'clue','التبديل قبل التلميح فقط.');
    assert(Array.isArray(action.cells) && action.cells.length===2 && action.cells[0]!==action.cells[1], 'اختر كلمتين مختلفتين.');
    const cells=action.cells.map(id=>s.board.find(c=>c.id===id && !c.revealed));
    assert(cells.every(Boolean),'اختر كلمتين غير مكشوفتين.');
    consume(s,'swap');
    const [a,b]=cells; const aw=a.word,bw=b.word; [a.word,b.word]=[b.word,a.word]; s.marks={};
    log(s,'تبدّلت كلمتا «'+aw+'» و«'+bw+'». بقيت الألوان في مواقعها.');
    return s;
  }
  if (action.type === 'SECOND' || action.type === 'DECLINE') {
    assert(s.phase === 'second','لا يوجد قرار فرصة ثانية الآن.');
    if (action.type==='DECLINE') {finishTurn(s,'لم تُستخدم فرصة ثانية.',rng);return s;}
    consume(s,'second'); s.phase='guess';
    s.deadline=s.settings.timerSeconds ? now+s.remainingMs : null; s.remainingMs=null;
    log(s,'استمر التخمين بما بقي من المحاولات والوقت.'); return s;
  }
  assert(s.phase === 'guess','انتظر التلميح أو أكمل قرار فرصة ثانية.');
  if (action.type === 'END') {
    assert(s.guesses>=1,'يجب تأكيد تخمين واحد على الأقل.');
    finishTurn(s,'أنهى الفريق دوره.',rng); return s;
  }
  assert(action.type==='GUESS','إجراء غير معروف.');
  const cell=s.board.find(c=>c.id===action.cell && !c.revealed); assert(cell,'الكلمة مكشوفة أو غير صالحة.');
  assert(s.clue.count==='unlimited' || s.guesses<s.clue.count+1,'انتهت محاولات التخمين.');
  cell.revealed=true; s.guesses++; delete s.marks[String(cell.id)];
  log(s,actor.name+' أكّد «'+cell.word+'».');
  if (cell.color==='black') {win(s,other(s.active),'كُشفت بطاقة سوداء.');return s;}
  if (cell.color==='yellow') {cell.yellowOwner=s.active;s.teams[s.active].yellow++;s.good++;}
  else if (cell.color===s.active) s.good++;
  if (checkWin(s)) return s;
  if (cell.color===other(s.active)) {
    s.broken=true;finishTurn(s,'كُشفت كلمة للخصم.',rng);return s;
  }
  const remaining=s.clue.count==='unlimited' ? Infinity : s.clue.count+1-s.guesses;
  if (cell.color==='neutral') {
    s.broken=true;
    const t=s.teams[s.active];t.streak=0;
    if (remaining>0 && t.turns>1 && !s.actionUsed && eligible(s,s.active,'second')) {
      s.phase='second'; s.remainingMs=s.deadline===null ? null : Math.max(0,s.deadline-now);
      s.deadline=s.settings.timerSeconds ? now+10000 : null;
      log(s,'اختر استخدام فرصة ثانية أو إنهاء الدور.');
    } else finishTurn(s,'كُشفت كلمة محايدة؛ انتهى الدور.',rng);
    return s;
  }
  if (remaining<=0) finishTurn(s,'اكتملت محاولات التلميح.',rng);
  return s;
}
// Deliberately construct a role-specific projection, never return raw state.
export function playerView(s, playerId) {
  const p=s.players.find(p=>p.id===playerId); assert(p,'لاعب غير معروف.');
  const agent=p.role==='agent', spy=p.role==='spy';
  const teamInfo=team=>({target:s.teams[team].target,score:score(s,team),yellow:s.teams[team].yellow,streak:s.teams[team].streak,turns:s.teams[team].turns,initialDrawn:s.teams[team].initialDrawn});
  return {
    me:{...p},adminId:s.adminId,settings:{...s.settings},players:s.players.map(p=>({...p})),active:s.active,phase:s.phase,size:s.size,turnNumber:s.turnNumber,
    clue:s.clue ? {...s.clue}:null,guesses:s.guesses,good:s.good,actionUsed:s.actionUsed,deadline:s.deadline,pause:!!s.pause,winner:s.winner,
    teams:{blue:teamInfo('blue'),red:teamInfo('red')},
    board:s.board.map(c=>({id:c.id,word:c.word,revealed:c.revealed,yellowOwner:c.yellowOwner,color:(spy && s.phase!=='deal') || c.revealed || s.phase==='finished' ? c.color:null,
      marks:agent ? (s.marks[String(c.id)]||[]).filter(id=>s.players.some(p2=>p2.id===id && p2.role==='agent' && p2.team===p.team)).map(id=>s.players.find(p2=>p2.id===id).name):[]})),
    hand:agent ? s.teams[p.team].hand.map(c=>({...c,available:c.usableTurn<=s.teams[p.team].turns && s.teams[p.team].turns>1 && !s.actionUsed && s.active===p.team && !s.pause && !['deal','finished'].includes(s.phase)})):[],
    canDraw:spy && s.settings.manualDraw && !!s.teams[p.team].pendingDraw && (s.phase==='deal'||p.team!==s.active) && !s.pause,
    scans:agent ? s.teams[p.team].scans.map(scan=>({...scan})):[],
    clues:s.clues.map(c=>({...c})),
    log:s.log.filter(entry=>entry.visibility==='all'||agent&&entry.visibility===p.team).map(({visibility,...entry})=>entry)
  };
}
