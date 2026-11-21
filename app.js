const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// cycle 107: waiver add kickoff clock; a 'soon' card whose kickoff has passed since the run reads as started.
const clockPill = (c) => { const st = c.state === 'soon' && Date.now() >= c.at ? 'started' : c.state;
  return `<span class="pill clock-${esc(st)}" title="${st === 'soon' ? 'His game is today: approve before kickoff to use him this week' : 'His game this week already started, so he is locked for this week'}">${esc(st === c.state ? c.pill : '🔒 Game started')}</span>`; };
const et = (ms, opts = {}) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...opts }) + ' ET';
let S = null, view = (location.hash || '#today').slice(1);

const PL = () => esc(S?.league?.platform || 'Sleeper'); // imported league's platform (Sleeper | ESPN)
async function api(path, opts) { const r = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || r.status), { code: j.code, state: j.state }); } return r.json(); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }

const img = (p) => `<img loading="lazy" src="${esc(p?.headshot)}" onerror="this.style.visibility='hidden'" alt="">`;
const badge = (p) => p?.bye ? `<span class="inj BYE">BYE</span>` : p?.cleared ? `<span class="inj OK" title="${esc(p.injNote || 'Cleared')}">OK</span>` : p?.pending && !p?.injury ? `<span class="inj TBD" title="${esc(p.injNote || 'No status yet this week')}">TBD</span>` : p?.injury ? `<span class="inj ${esc(p.injury)}"${p.irReturn || p.inactive || p.inGame ? ` title="${esc(p.injNote || '')}"` : ''}>${esc(p.inactive ? 'INACT' : p.injury === 'Questionable' ? 'Q' : p.injury === 'Doubtful' ? 'D' : p.injury)}</span>` : '';
const plCell = (p, extra = '') => p ? `<div class="pl">${img(p)}<div><b>${esc(p.name)}</b>${badge(p)}<small>${esc(p.pos)} · ${esc(p.team || 'FA')}${p.opp ? ' vs ' + esc(p.opp) : p.bye ? ' · bye' : ''}${extra}${p.qbNote ? ` · <span class="qbn" title="${esc(p.qbNote.text)}">🏈 ${esc(p.qbNote.starter)} ${esc(p.qbNote.status)}</span>` : ''}${p.usageNote ? ` · <span class="usn ${p.usageNote.trend === 'up' ? 'up' : 'down'}" title="${esc(p.usageNote.text)}">${p.usageNote.trend === 'up' ? '📈' : '📉'} ${esc(p.usageNote.short)}</span>` : ''}</small></div></div>` : '<span class="mut">— empty —</span>';
const prChip = (p) => p?.practice ? `<span class="prac ${esc(p.practice.short || 'TBD')}${p.practice.rest ? ' rest' : ''}" title="${esc(p.practice.label || '')}">${esc(p.practice.text)}</span>` : '';
function practiceLine(s, P, pl) {
  const pair = s.type === 'lineup' ? [['▲', pl.in], ['▼', pl.out]] : s.type === 'injury' ? [['⚠', pl.watch], ['↺', pl.backup]] : null;
  const items = (pair || []).filter(([, id]) => P[id]?.practice).map(([a, id]) => `${a} ${esc(P[id].name)}: ${prChip(P[id])}`);
  return items.length ? `<div class="prac-line">${items.join(' <span class="mut">·</span> ')}</div>` : '';
}
const TYPE = { lineup: 'Start / Sit', waiver: 'Waiver', trade: 'Trade idea', injury: 'Injury impact', weather: 'Weather' };

function suggCard(s) {
  const P = S.players; const f = (id, cls, arrow) => P[id] ? `<span class="face">${img(P[id])}<span class="arrow ${cls}">${arrow}</span>${esc(P[id].name)}</span>` : '';
  const pl = s.players || {};
  const faces = s.type === 'lineup' ? f(pl.in, 'in', '▲ START') + f(pl.out, 'out', '▼ SIT')
    : s.type === 'waiver' ? f(pl.add, 'in', '+ ADD') + f(pl.drop, 'out', '− DROP')
    : s.type === 'trade' ? f(pl.get, 'in', '← GET') + f(pl.give, 'out', '→ GIVE')
    : s.type === 'injury' ? f(pl.watch, 'out', '⚠ WATCH') + f(pl.backup, 'in', '↺ BACKUP') : f(pl.watch, '', '☁');
  const pending = s.status === 'pending';
  const approveLbl = { lineup: pl.out ? 'Approve swap' : 'Fill slot', waiver: `Approve claim${s.faabBid ? ` ($${s.faabBid})` : ''}`, trade: 'Send offer', injury: 'Arm guard', weather: 'Got it' }[s.type];
  return `<div class="sugg ${s.status}" id="s-${s.id}">
    <div class="hd"><span class="tag t-${s.type}">${TYPE[s.type]}</span><span class="conf">${esc(s.confidence)} confidence</span>${s.type === 'lineup' && s.highTotal ? `<span class="pill hi-total" title="High-total game (26+ implied): upside context only, the projection and pick are unchanged">🔥 ${s.highTotal.side === 'out' ? 'Benched ' : ''}${esc(s.highTotal.team)} ${esc(s.highTotal.implied)} implied</span>` : ''}${s.type === 'waiver' && s.need && P[pl.add] ? `<span class="pill need-${esc(s.need)}" title="Positional need this week">${{ high: 'Fills a hole', medium: 'Adds depth', low: 'Depth' }[s.need] || 'Need'}: ${esc(P[pl.add].pos)}</span>` : ''}${s.type === 'waiver' && s.addClock ? clockPill(s.addClock) : ''}${s.type !== 'waiver' && s.lockClock && !s.lockedNow && s.lockClock.at > Date.now() ? `<span class="pill clock-soon" title="Approve before kickoff: once this game starts the move can't count this week">${esc(s.lockClock.pill)}</span>` : ''}${s.type === 'waiver' && s.openSpot ? '<span class="pill need-medium" title="You have an open roster spot">No drop needed</span>' : ''}${s.delta != null ? `<span class="delta">+${s.delta} ${s.type === 'lineup' ? 'proj pts' : 'value'}</span>` : ''}</div>
    <div class="ttl" style="margin-top:8px">${esc(s.title)}</div>
    <div class="sum">${esc(s.summary)}${s.llm ? ` <span class="pill">✍ ${esc(s.llm)}</span>` : ''}</div>
    <div class="faces">${faces}</div>
    ${practiceLine(s, P, pl)}
    ${s.flip && pending ? `<div class="flip">↻ ${esc(s.flip)}</div>` : ''}
    <details><summary>Why? ${s.reasons.length} reasons</summary><ul>${s.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>
    <div class="actions">${pending && s.lockedNow ? `<span class="status">🔒 Game already kicked off, so this swap can't count</span><button class="btn no" data-act="reject" data-id="${s.id}">✕ Dismiss</button>`
      : pending ? `<button class="btn ok" data-act="approve" data-id="${s.id}">✓ ${approveLbl}</button><button class="btn no" data-act="reject" data-id="${s.id}">✕ Reject</button>`
      : `<span class="status ${s.status}">${s.locked ? '🔒 Locked' : s.status === 'approved' ? '✓ Approved' : '✕ Rejected'}</span><span class="result">· ${esc(s.result || '')} ${s.decidedAt ? '· ' + et(s.decidedAt) : ''}</span>`}</div>
  </div>`;
}

function activityRun(r, full) {
  return `<div class="run"><div class="when">${/^(scheduled|caught up on start)/.test(r.trigger) ? '🌙' : '▶'} ${esc(r.trigger)} run <small>${et(r.startedAt)} · ${((r.finishedAt - r.startedAt) / 1000).toFixed(1)}s</small></div>
  <div class="feed">${r.steps.map(s => `<div class="fitem"><div class="ic">${s.icon}</div><div class="tx">${esc(s.text)}${full && s.detail ? `<small>${esc(s.detail)}</small>` : ''}</div></div>`).join('')}</div></div>`;
}

// Cycle 68: once the week's games start, show points banked (Sleeper live stats) plus starters still to play.
const wpNow = () => (S.live && S.live.winProb != null ? S.live.winProb : S.winProb);
function heroPts(side, proj, label) {
  if (!side) return `<div class="pts">${proj}</div><div class="rec">${label}</div>`;
  // Cycle 69 (Improver #69b): starters mid-game count as still to play, so a 1:30 PM Sunday hero never says "all starters done".
  const playing = side.playing || [];
  const left = side.toPlay.length + playing.length;
  const who = left === 1 ? esc([...side.toPlay, ...playing][0]) : left + ' starters';
  const rest = left ? `+${side.remaining} projected from ${who} still to play${playing.length ? ` (${playing.length} in progress)` : ''}` : 'all starters done';
  return `<div class="pts" title="points scored so far (Sleeper live stats)">${side.banked}</div><div class="rec">scored so far · ${rest}</div><div class="rec">est. final ${side.est} (was ${proj} projected)</div>`;
}

// Cycle 108: "Act by" strip (same rule as lib/act-by.js): pending cards whose add kicks off before the next run lock at
// kickoff, so they sort first and get one line naming the deadline. Disappears on its own once the game starts.
// Cycle 112: start/sit and guard cards carry lockClock (server lib/act-by.js lockClock) and join the strip.
const dueOf = (s) => (s.lockedNow ? null : s.addClock && s.addClock.state === 'soon' ? s.addClock : s.type !== 'waiver' && s.lockClock ? s.lockClock : null);
const dueAt = (s) => { const d = dueOf(s); return d && d.at > Date.now() ? d.at : Infinity; };
const dueLabel = (s) => { const t = s.title || ''; let m = /^Add (.+?) \(/.exec(t); if (m) return m[1];
  m = /start (.+?)(?: over |\?|$)/i.exec(t); if (s.type === 'lineup' && m) return 'start ' + m[1];
  m = /^Auto-swap guard: if (.+?) is ruled out/.exec(t); return m ? `the ${m[1]} guard` : t; };
const byDeadline = (a) => a.map((s, i) => [s, i]).sort((x, y) => (dueAt(x[0]) - dueAt(y[0])) || (x[1] - y[1])).map(x => x[0]);
// Cycle 109: the reminder push for that kickoff (server lib/act-by-nudge.js nudgeStatus): scheduled / sent / not set up.
let NUDGE = {}; // kept across action responses that return a plain view without actByNudge
const nudgeNote = (at) => { if (S && S.actByNudge) NUDGE = S.actByNudge; const st = NUDGE[at]; return st && st.text ? ` <span class="nudge nudge-${esc(st.state)}">${esc(st.text)}</span>` : ''; };
function actByStrip(pend) {
  const g = new Map();
  for (const s of pend) { const at = dueAt(s); if (at === Infinity) continue; const gm = dueOf(s).game || null, e = g.get(at) || { at, game: gm, names: [], adds: 0 };
    const gk = (x) => String(x).split(' vs ').sort().join('|'); if (gm && e.names.length && (!e.game || gk(e.game) !== gk(gm))) e.game = null; e.names.push((s.type === 'waiver' ? '\u0001' : '') + dueLabel(s)); if (s.type === 'waiver') e.adds++; g.set(at, e); }
  if (!g.size) return '';
  const et = (ms, o) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', ...o });
  const today = et(Date.now(), { dateStyle: 'short' });
  return [...g.values()].sort((a, b) => a.at - b.at).map((e, gi) => {
    const when = et(e.at, { dateStyle: 'short' }) === today ? (+et(e.at, { hour: 'numeric', hourCycle: 'h23' }) >= 17 ? 'tonight' : 'today') : et(e.at, { weekday: 'short' });
    const n = e.names.length, mixed = e.adds < n;
    e.names = e.names.map(x => x[0] === '\u0001' ? (mixed ? 'add ' : '') + x.slice(1) : x);
    if (mixed) return `<div class="act-by" title="Approve before kickoff: once a game starts, a start/sit swap or guard for it can't count this week">⏰ <b>Act by ${esc(et(e.at, { hour: 'numeric', minute: '2-digit' }))} ET ${when}:</b> ${n === 1 ? '1 move' : n + ' moves'} (${esc(e.names.join(', '))}) lock${n === 1 ? 's' : ''} at ${e.game ? 'the ' + esc(e.game) + ' ' : ''}kickoff. ${n === 1 ? "It's" : "They're"} listed ${gi ? 'next' : 'first'}.${nudgeNote(e.at)}</div>`;
    return `<div class="act-by" title="Approve before kickoff: once the game starts the player is locked for this week">⏰ <b>Act by ${esc(et(e.at, { hour: 'numeric', minute: '2-digit' }))} ET ${when}:</b> ${n === 1 ? '1 add' : n + ' adds'} (${esc(e.names.join(', '))}) ${n === 1 ? 'plays' : 'play'}${e.game ? ' in ' + esc(e.game) : ''} and lock${n === 1 ? 's' : ''} at kickoff. ${n === 1 ? "It's" : "They're"} listed ${gi ? 'next' : 'first'}.${nudgeNote(e.at)}</div>`;
  }).join('');
}

const V = {
  today() {
    const pend = byDeadline(S.suggestions.filter(s => s.status === 'pending')), done = S.suggestions.filter(s => s.status !== 'pending');
    const gain = pend.filter(s => s.type === 'lineup').reduce((a, s) => a + (s.delta || 0), 0);
    return `<div class="grid" style="gap:16px">
      <div class="card hero">
        <div class="side-t"><b>${esc(S.me.name)}</b><div class="rec">${S.me.record.w}-${S.me.record.l} · ${S.league.demo ? 'demo record' : PL() + ' record'}</div>${heroPts(S.live?.me, S.me.proj, 'projected (your current lineup)')}</div>
        <div class="vs"><div class="prob">${S.live ? (S.live.final ? 'Final*' : 'Live win probability*') : 'Win probability*'}</div><div style="font-size:28px;font-weight:800">${wpNow() == null ? '—' : wpNow() + '%'}</div><div class="bar"><i style="width:${wpNow() || 0}%"></i></div><div class="prob" style="margin-top:6px">Week ${S.week} · ${esc(S.scoring.replace('pts_', '').replace('_', '-').toUpperCase())}</div></div>
        ${S.opponent ? `<div class="side-t right"><b>${esc(S.opponent.name)}</b><div class="rec">${S.opponent.record.w}-${S.opponent.record.l} · ${S.league.demo ? 'demo opponent' : 'this week\'s opponent'}</div>${heroPts(S.live?.opp, S.opponent.proj, 'projected (optimal)')}</div>` : `<div class="side-t right"><b>No matchup</b><div class="rec">${PL()} has no Week ${S.week} opponent for you (bye or season over)</div></div>`}
      </div>
      ${S.lastWeek ? `<div class="card last-week" style="padding:10px 16px"><b>Week ${S.lastWeek.week} final:</b> ${esc(S.lastWeek.me.name)} ${S.lastWeek.me.pts}, ${esc(S.lastWeek.opp.name)} ${S.lastWeek.opp.pts} <span class="pill ${S.lastWeek.result === 'won' ? 'in' : ''}">you ${S.lastWeek.result}</span> <span class="conf">Sleeper final stats on the lineup you played</span></div>` : ''}
      ${changesBanner()}
      ${gameDayCard()}
      ${practiceStatusCard()}
      <div class="kpis">
        <div class="kpi"><b>${pend.length}</b><span>suggestions awaiting you</span></div>
        <div class="kpi"><b class="in">+${gain.toFixed(1)}</b><span>proj pts if you approve start/sits</span></div>
        <div class="kpi"><b>${S.me.optimalProj}</b><span>optimal lineup projection</span></div>
        <div class="kpi"><b>${S.league.faab == null ? '—' : '$' + S.league.faab}</b><span>${S.league.faab == null ? 'no FAAB (rolling waivers)' : S.league.demo ? 'FAAB remaining (demo)' : 'FAAB remaining'}</span></div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Daily suggestions <span class="pill">${S.llm ? 'LLM: ' + esc(S.llm) : 'rules-v0 · $0'}</span></h3>
          ${actByStrip(pend)}${pend.length ? pend.map(suggCard).join('') : `<div class="empty">🎉 Inbox zero. Your lineup is optimized — the agent will check again overnight.</div>`}
          ${done.length ? `<details style="margin-top:8px"><summary>History (${done.length})</summary><div style="margin-top:10px">${done.map(suggCard).join('')}</div></details>` : ''}
        </div>
        <div class="grid" style="align-content:start">
          <div class="card"><h3>Agent activity <a data-go="agent">full log →</a></h3>${S.activity[0] ? activityRun(S.activity[0], false) : '<div class="empty">No runs yet</div>'}</div>
          <div class="card"><h3>Your injury report</h3>${injMine()}</div>
          <div class="card"><h3>Auto-swap guards <span class="pill">armed by you</span></h3>${guardsCard()}</div>
          ${digestCard()}
        </div>
      </div>
      <div class="conf">* Win probability and "value" are transparent heuristics (logistic on projected-point margin; value = 55% season PPG + 45% Sleeper weekly projection). Projections come from Sleeper's free projections feed.</div>
    </div>`;
  },
  roster() {
    const mu = (p) => { const m = p?.matchup; if (!m) return ''; const b = []; if (p.pos === 'DEF') { if (m.oppImplied != null) b.push(`${esc(m.opp)} implied ${m.oppImplied} pts (fewer is better)`); } else if (m.implied != null) b.push(`team implied ${m.implied} pts`); if (m.dvpRank != null) { const o = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); b.push(`${esc(m.opp)} allows ${m.dvpRank <= m.dvpTeams / 2 ? o(m.dvpRank) + '-most' : o(m.dvpTeams - m.dvpRank + 1) + '-fewest'} ${esc(p.pos)} pts`); } return b.length ? `<small style="display:block;color:var(--mut)">${b.join(' · ')}</small>` : ''; };
    const row = (slot, p) => `<tr><td class="slot">${slot}</td><td>${plCell(p)}${prChip(p)}</td><td class="hide-sm">${p?.game ? esc(p.game.name) + `<small style="display:block;color:var(--mut)">${et(new Date(p.game.date).getTime(), { month: undefined, day: undefined, weekday: 'short' })}${p.game.indoor ? ' · dome' : ''}</small>${mu(p)}` : p?.bye ? 'BYE' : ''}</td><td class="num">${p ? p.ppg : ''}</td><td class="num"><b>${p ? p.proj : ''}</b></td></tr>`;
    const head = `<tr><th>Slot</th><th>Player</th><th class="hide-sm">Game</th><th class="num">PPG</th><th class="num">Proj</th></tr>`;
    return `<div class="grid g2"><div class="card"><h3>Starters <span class="pill">${S.me.proj} proj</span></h3><table>${head}${S.roster.starters.map(s => row(s.slot, s.player)).join('')}</table>
      <h3 style="margin-top:20px">Bench</h3><table>${head}${S.roster.bench.map(p => row('BN', p)).join('')}</table>${(S.roster.parked || []).length ? `<h3 style="margin-top:20px">Taxi / IR <span class="pill">not startable until moved in ${PL()}</span></h3><table>${head}${S.roster.parked.map(p => row(p.parked, p)).join('')}</table>` : ''}</div>
      <div class="grid" style="align-content:start"><div class="card"><h3>Pending for your roster</h3>${S.suggestions.filter(s => s.status === 'pending').map(s => `<div class="fitem" style="margin-bottom:8px"><span class="tag t-${s.type}">${TYPE[s.type]}</span><div class="tx">${esc(s.title)}</div></div>`).join('') || '<div class="empty">Nothing pending</div>'}
      <button class="btn" data-go="today" style="margin-top:8px">Review on Today →</button></div>
      <div class="card"><h3>Data notes</h3><div class="conf">PPG & projections: Sleeper (${esc(S.scoring)}). Injury tags: Sleeper. Kickoffs/odds: ESPN. ${S.league.demo ? 'Roster is a demo draft by Sleeper ADP; your starting lineup began "set by season PPG" (how many managers leave it), so the agent has real start/sit work against this week\'s projections and news.' : `Roster and lineup are your real ${PL()} team (read-only, synced ${S.league.syncedAt ? et(S.league.syncedAt) : '—'}). Make approved moves in the ${PL()} app; the next sync picks them up.`}</div></div></div></div>`;
  },
  league() {
    const tag = S.league.demo ? '<span class="pill">demo</span>' : `<span class="pill in">${PL()}</span>`;
    return `${connectCard()}<div class="grid g2" style="margin-top:16px"><div class="card"><h3>Standings ${tag}</h3><table><tr><th>#</th><th>Team</th><th class="num">W-L</th><th class="num">PF</th><th class="num hide-sm">Wk ${S.week} proj</th></tr>
      ${S.standings.map((t, i) => `<tr class="${t.me ? 'me' : ''}"><td>${i + 1}</td><td><b>${esc(t.name)}</b><small style="display:block;color:var(--mut)">${esc(t.manager)}</small></td><td class="num">${t.w}-${t.l}</td><td class="num">${t.pf}</td><td class="num hide-sm">${t.proj}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>Week ${S.week} matchups ${tag}</h3><table>${S.matchups.length ? '' : '<tr><td class="mut">No matchups this week</td></tr>'}${S.matchups.map(m => `<tr class="${m.mine ? 'me' : ''}"><td>${esc(m.a)}<br><b>${m.aProj}</b></td><td style="color:var(--mut)">vs</td><td class="num">${esc(m.b)}<br><b>${m.bProj}</b></td></tr>`).join('')}</table>
      <div class="conf" style="margin-top:8px">Projections use each team's optimal lineup of real players. ${S.league.demo ? 'Import your real Sleeper or ESPN league above to replace this.' : `Teams, records and matchups come from your ${PL()} league.`}</div></div></div>`;
  },
  news() {
    return `<div class="grid g2"><div class="card"><h3>Injury wire <span class="pill">Sleeper · live tags</span></h3><table><tr><th>Player</th><th>Status</th><th class="num hide-sm">Updated</th></tr>
      ${S.injuries.map(p => `<tr><td>${plCell(p, (p.injuryBody ? ' · ' + esc(p.injuryBody) : '') + (p.pending ? (p.carryOver ? ' · last game\'s tag, practiced this week; no game status yet' : ' · no status yet this week (ESPN placeholder)') : p.staleTag ? ' · stale Sleeper Out, now: ' + esc(p.injury || 'Active') : ''))}</td><td>${badge(p)} ${p.mine ? '<span class="mine">YOUR PLAYER</span>' : ''}</td><td class="num hide-sm conf">${p.newsUpdated ? et(p.newsUpdated) : ''}</td></tr>`).join('')}</table></div>
      <div class="grid" style="align-content:start"><div class="card"><h3>Trending adds (24h) <span class="pill">Sleeper</span></h3>${(n => n ? `<p class="mut" style="margin:0 0 6px">${n} already played this week, listed last: an add helps from Week ${Number(S.week) + 1}.</p>` : '')(S.trending.filter(t => t.played).length)}<table>${S.trending.map(t => `<tr${t.played ? ' class="played" style="opacity:.6"' : ''}><td>${t.rank}</td><td>${plCell(t, t.played ? ` · <span class="pill" title="${esc(t.played.note)}">${esc(t.played.pill)}</span>` : '')}</td><td class="num conf">+${t.count.toLocaleString()}<br>${t.available ? `<span class="in">${t.played ? 'FA · for Week ' + (Number(S.week) + 1) : 'FA in your league'}</span>` : 'rostered'}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>News on your players <span class="pill">ESPN · matched by player id</span></h3>${(S.playerNews || []).length ? `<div class="feed">${S.playerNews.map(n => `<div class="fitem"><div class="ic">🗞️</div><div class="tx"><span class="mine">${esc(n.players.join(', '))}</span> <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.headline)}</a><small>${n.published ? et(Date.parse(n.published)) : ''}${n.type ? ' · ' + esc(n.type) : ''}</small></div></div>`).join('')}</div>` : '<div class="empty">No ESPN stories tagged with your players right now</div>'}</div>
      <div class="card"><h3>NFL headlines <span class="pill">ESPN RSS</span></h3><div class="feed">${S.news.map(n => `<div class="fitem"><div class="ic">📰</div><div class="tx"><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>${n.mentions.length ? ` <span class="mine">· ${esc(n.mentions.join(', '))}</span>` : ''}<small>${esc(n.description)}</small></div></div>`).join('')}</div></div></div></div>`;
  },
  agent() {
    const src = Object.values(S.sources).map(s => `<tr><td>${esc(s.label)}</td><td class="conf">${et(s.fetchedAt)}</td><td>${s.stale ? '<span class="inj Questionable">stale</span>' : s.cached ? '<span class="pill">cache</span>' : '<span class="pill in">live</span>'}</td></tr>`).join('');
    return `<div class="grid g2"><div class="card"><h3>Agent runs</h3>${S.activity.map(r => activityRun(r, true)).join('')}</div>
      <div class="grid" style="align-content:start"><div class="card"><h3>Schedule (ET)</h3><div class="feed">
        <div class="fitem"><div class="ic">🌙</div><div class="tx">3:00 AM daily — overnight sweep<small>injuries, news, trending, projections, weather → fresh suggestions by breakfast</small></div></div>
        <div class="fitem"><div class="ic">☀️</div><div class="tx">9:00 AM daily — morning refresh<small>catches overnight practice reports & beat-writer news</small></div></div>
        <div class="fitem"><div class="ic">🏈</div><div class="tx">Sun 11:30 AM — pre-kickoff sweep<small>fresh suggestions before the early games</small></div></div>
        <div class="fitem"><div class="ic">🛡️</div><div class="tx">90, 60, 30 and 10 min before each guarded player's kickoff<small>re-checks the injury feed and fires armed auto-swap guards only if the player is ruled inactive (TNF, Sunday, SNF, MNF)</small></div></div></div></div>
      <div class="card"><h3>Data sources (all free)</h3><table>${src}</table></div>
      <div class="card"><h3>Guardrails</h3><div class="conf">The agent never changes your team without approval. Approved "guards" are the only automatic action, and only fire on an official inactive. Every suggestion shows its sources.</div></div></div></div>`;
  },
  record() {
    const T = S.tr;
    if (!T) { loadTR(); return '<div class="card"><div class="empty">Grading the agent against real results (Sleeper weekly stats)…</div></div>'; }
    if (T.error) return `<div class="card"><div class="empty">Couldn't load the track record: ${esc(T.error)}</div></div>`;
    const D = T.decisions, sm = D.summary, nxt = `after Week ${T.week}'s Monday night game`;
    const dec = sm.count ? `<div class="kpis" style="margin-bottom:12px;grid-template-columns:repeat(3,1fr)"><div class="kpi"><b>${sm.pct ?? '—'}%</b><span>start/sit calls right (${sm.right} of ${sm.count})</span></div><div class="kpi"><b>${sm.gainedByApproving >= 0 ? '+' : ''}${sm.gainedByApproving}</b><span>pts gained by approving</span></div><div class="kpi"><b>${sm.leftByRejecting >= 0 ? '+' : ''}${sm.leftByRejecting}</b><span>pts you'd have gained on calls you rejected</span></div></div>
      <table><tr><th>Wk</th><th>Call</th><th class="num">Start</th><th class="num">Sit</th><th>You</th></tr>${D.graded.map(g => `<tr><td>${g.week}</td><td>Start <b>${esc(g.inName)}</b> over ${esc(g.outName)} <span class="pill ${g.verdict === 'right' ? 'in' : g.verdict === 'wrong' ? 'out' : ''}">${g.verdict === 'right' ? '✓ right' : g.verdict === 'wrong' ? '✗ wrong' : 'push'}</span></td><td class="num">${g.inPts}</td><td class="num">${g.outPts}</td><td>${g.status === 'approved' ? 'approved' : 'rejected'}</td></tr>`).join('')}</table>`
      : `<div class="empty">No graded start/sit calls yet. ${D.waiting.length ? `${D.waiting.length} decision${D.waiting.length > 1 ? 's' : ''} from Week ${T.week} will be graded ${nxt}.` : `Approve or reject a start/sit card and it gets graded ${nxt}.`}</div>`;
    const K = T.skips, ks = K?.summary; // cycle 99: waiver adds the agent skipped, graded
    const sk = !K ? '' : ks.count ? `<div class="kpis" style="margin-bottom:12px;grid-template-columns:repeat(2,1fr)"><div class="kpi"><b>${ks.pct ?? '—'}%</b><span>skips that were right (${ks.right} of ${ks.count}: the player you kept scored as much)</span></div><div class="kpi"><b>${ks.missedPts}</b><span>pts the missed adds outscored the player you kept (bench backups for stash skips, so not lineup points)</span></div></div>
      <table><tr><th>Wk</th><th>Skipped add</th><th class="num">Add</th><th class="num">Kept</th></tr>${K.graded.slice(0, 12).map(g => `<tr><td>${g.week}</td><td><b>${esc(g.add.name)}</b> vs ${esc(g.vs.name)} <span class="pill ${g.verdict === 'right' ? 'in' : 'out'}">${g.verdict === 'right' ? '✓ right to skip' : '✗ missed'}</span><small class="conf" style="display:block">${esc(g.why)}; proj ${g.add.proj} vs ${g.vs.proj}</small></td><td class="num">${g.addPts}</td><td class="num"><b>${g.vsPts}</b></td></tr>`).join('')}</table>${K.graded.length > 12 ? `<p class="conf">+${K.graded.length - 12} more</p>` : ''}`
      : `<div class="empty">No graded skips yet.${K.waiting ? ` ${K.waiting} skipped add${K.waiting > 1 ? 's' : ''} get graded after Week ${T.week}'s Monday night game.` : ''}</div>`;
    const LW = T.lastWeek;
    const lw = LW ? `<div class="kpis" style="margin-bottom:12px;grid-template-columns:repeat(3,1fr)"><div class="kpi"><b>${LW.pickPts}</b><span>pts from ${LW.basis === 'played' ? 'the lineup you played' : "the projections' lineup"}</span></div><div class="kpi"><b>${LW.bestPts}</b><span>best possible in hindsight</span></div><div class="kpi"><b>${LW.captured ?? '—'}%</b><span>of the max captured</span></div></div>
      <table><tr><th>Slot</th><th>Player</th><th class="num">Proj</th><th class="num">Actual</th></tr>${LW.lineup.map(r => `<tr><td>${esc(r.slot)}</td><td>${esc(r.name)} ${r.best ? '' : '<span class="pill out">not in best lineup</span>'}</td><td class="num">${r.proj}</td><td class="num"><b>${r.act}</b></td></tr>`).join('')}</table>
      ${LW.benchedBoomers.length ? `<p class="conf" style="margin-top:8px">Should have started: ${LW.benchedBoomers.map(p => `${esc(p.name)} (${p.act} pts, proj ${p.proj})`).join(', ')}.</p>` : `<p class="conf" style="margin-top:8px">${LW.basis === 'played' ? 'You played' : 'The projections picked'} the best possible lineup from this roster.</p>`}
      <p class="conf">${LW.basis === 'played' ? `Your actual Week ${LW.week} lineup and roster, as of the agent's last check that week (${new Date(LW.snapshotAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}), vs the best lineup in hindsight` : `Uses your current roster with Week ${LW.week} projections and results (from next week on, the lineup you actually played is saved and graded instead)`}; QB/RB/WR/TE only (K and DEF not graded yet).</p>` : '<div class="empty">No finished week yet.</div>';
    const B = T.calibration.bands, row = (k, lbl) => B[k] ? `<tr><td><b>${lbl}</b></td><td><div class="bar"><i style="width:${B[k].pct || 0}%"></i></div></td><td class="num"><b>${B[k].pct ?? '—'}%</b></td><td class="num conf hide-sm">${B[k].n.toLocaleString()} pairs</td></tr>` : '';
    const cal = `<table><tr><th>Agent confidence</th><th></th><th class="num">Favourite won</th><th class="num hide-sm">Sample</th></tr>${row('High', 'High (gap > 4 pts)')}${row('Medium', 'Medium (1.5-4 pts)')}${row('Low', 'Low (&lt; 1.5 pts)')}</table>
      <p class="conf" style="margin-top:8px">Every same-position pair of players projected ${T.calibration.minProj || 8}+ pts (the calls you actually make) who both played, Weeks 1-${T.week - 1}. A coin flip is 50%. This is why the agent labels small gaps "Low" and calls them close calls instead of forcing a confident pick.</p>${matchupBT(T.matchupBacktest)}`;
    return `<div class="grid g2"><div class="grid" style="align-content:start"><div class="card"><h3>Your start/sit decisions <span class="pill">graded vs actual points</span></h3>${dec}</div>
      ${sk ? `<div class="card"><h3>Waiver adds the agent skipped <span class="pill">graded vs actual points</span></h3>${sk}</div>` : ''}
      <div class="card"><h3>Week ${LW ? LW.week : '—'} on your roster <span class="pill">${LW?.basis === 'played' ? 'your lineup' : 'projections'} vs hindsight</span></h3>${lw}</div></div>
      <div class="grid" style="align-content:start"><div class="card"><h3>How much to trust each confidence label <span class="pill">${T.season} season</span></h3>${cal}</div>
      ${freezeCard(T.freezeAudit)}
      ${gradeCard(T.cardGrades)}
      <div class="card"><h3>Why this matters</h3><div class="conf">ESPN never tells you how its advice turned out. Every call the agent makes is graded here against real Sleeper stats once the games are over, including the ones you rejected.${boardLine(T.boardHistory)} Source: ${esc(T.source)}${T.errors.length ? ` · ⚠️ ${T.errors.length} week(s) unavailable` : ''}.</div></div></div></div>`;
  },
  why() {
    const rows = [['Lineup help', 'Generic rankings; you check every player', 'Daily start/sit for <i>your</i> roster with reasons + one-tap approve'],
      ['Waivers', 'You hunt the wire yourself', 'Trending adds + injury handcuffs matched to your weakest bench spot, with a FAAB bid'],
      ['Injuries', 'Red "O" tag after the fact', 'Overnight injury sweep + auto-swap guard before kickoff (only if you arm it)'],
      ['Trades', 'Trade machine, no ideas', 'Fair-value trade ideas aimed at your weakest position'],
      ['Always-on', 'Only when you open the app', '24/7 agent: news, injuries, weather, trends — logged so you see what it checked'],
      ['Control', '—', 'AI proposes, you approve. Nothing changes without a tap'],
      ['Cost', 'Free (with ads) / premium add-ons', 'Free core; built on free data, near-$0 to run'],
      ['Track record', 'Never shows how its advice turned out', 'Every start/sit call graded against real points, even the ones you rejected'],
      ['Your league', 'ESPN only', 'Import your Sleeper league or a public ESPN league in one step (read-only); approve here, make the move there']];
    return `<div class="grid"><div class="card why-hero"><h2>Keep your league. Fire the busywork.</h2><p>Autopilot FF is a co-manager for ESPN players: every morning it has already checked injuries, news, weather and the waiver wire, and it hands you a short list of moves with reasons. You approve or reject — that's it.</p>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-go="today">See today's suggestions</button><span class="pill">~2 min/day instead of 30</span><span class="pill">Football only</span></div></div>
      <div class="card"><h3>ESPN Fantasy vs Autopilot FF</h3><table class="compare"><tr><th></th><th>ESPN Fantasy</th><th>Autopilot FF</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table></div></div>`;
  },
};
// Morning digest preview: the same text the 3:00 AM run saves (and pushes only if DIGEST_NTFY_TOPIC / DIGEST_WEBHOOK_URL is set).
let dgBusy = false;
async function loadDigest() { if (dgBusy) return; dgBusy = true; try { S.digest = await api('/api/digest'); } catch (e) { S.digest = { error: e.message }; } dgBusy = false; if (view === 'today') render(); }
function digestCard() {
  if (!S.digest) { loadDigest(); return '<div class="card"><h3>Morning digest</h3><div class="empty">Loading…</div></div>'; }
  const D = S.digest, d = D.digest;
  if (!d) return `<div class="card"><h3>Morning digest</h3><div class="empty">Couldn't build the digest (${esc(D.error || 'unknown')}).</div></div>`;
  const on = D.channels && (D.channels.ntfy || D.channels.webhook);
  return `<div class="card" id="digestCard"><h3>Morning digest <span class="pill">${on ? 'push on' : 'preview only · $0'}</span></h3>
    <div style="font-weight:700;margin-bottom:6px">${esc(d.subject)}</div>
    <pre style="white-space:pre-wrap;font:13px/1.45 inherit;color:#cbd5e1;margin:0 0 8px">${esc(d.lines.map(l => '• ' + l).join('\n'))}</pre>
    <small style="color:var(--mut)">${on ? `Sent after the 3:00 AM ET run${D.lastSent ? ` · last pushed ${et(D.lastSent.at)} via ${esc((D.lastSent.channels || []).join(', '))}` : ' · nothing pushed yet'}.` : 'Saved after every scheduled run. To get it on your phone for free, set <code>DIGEST_NTFY_TOPIC</code> (ntfy.sh) on the server. Anyone who knows an ntfy topic name can read it, so use a long random one, like <code>ff-</code> plus 16 random characters.'} Nothing is applied until you approve it.</small>
    <div style="margin-top:8px"><button class="btn" id="digestCopy">Copy digest</button></div></div>`;
}
function guardsCard() {
  const G = S.guards || [];
  if (!G.length) return '<div class="empty">No guards armed. When a starter is Questionable, the agent offers one: approve it and the agent swaps in your backup only if he\'s ruled inactive before kickoff.</div>';
  const lbl = { armed: ['Armed', 'in'], fired: ['Fired', 'in'], expired: ['Not needed', ''], moot: ['Not needed', ''], blocked: ['Needs you', 'out'], missed: ['Missed', 'out'] };
  return `<div class="feed">${G.map(g => { const [t, c] = lbl[g.status] || [g.status, ''];
    return `<div class="fitem"><div class="ic">${g.status === 'fired' ? '🔁' : g.status === 'armed' ? '🛡️' : (g.status === 'blocked' || g.status === 'missed') ? '⚠️' : '✓'}</div><div class="tx"><b>${esc(g.watch?.name || '?')}</b>${badge(g.watch)} → ${esc(g.backup?.name || '?')} <span class="pill ${c}">${t}</span>
      <small>${g.status === 'armed' ? `Kickoff ${g.kickoff ? et(g.kickoff, { month: undefined, day: undefined, weekday: 'short' }) : 'TBD'} · next check ${g.nextCheck ? et(g.nextCheck, { month: undefined, day: undefined, weekday: 'short' }) : 'at the next agent run'}` : esc(g.note || '')}</small></div></div>`; }).join('')}</div>
    ${G.some(g => g.status === 'armed') ? '<button class="btn" id="guardBtn" style="margin-top:8px">Check guards now</button>' : ''}`;
}
function injMine() {
  const all = [...S.roster.starters.map(s => s.player), ...S.roster.bench].filter(p => p && (p.injury || p.bye || p.pending || p.cleared));
  return all.length ? `<table>${all.map(p => `<tr><td>${plCell(p, (p.injuryBody && !p.pending ? ' · ' + esc(p.injuryBody) : '') + (p.pending || p.cleared || p.irReturn || p.inactive || p.inGame ? ' · ' + esc(p.injNote || 'No status yet this week') : p.staleTag ? ' · Sleeper still shows last game\'s Out' : '') + (p.practice ? ' · ' + esc(p.practice.text) : ''))}</td></tr>`).join('')}</table>` : '<div class="empty">All healthy 💪</div>';
}

let trBusy = false;
// #76: last week's pre-game data graded (D&R freeze audit): error as a lineup decision sees it, who sat out, how old the copy was.
const PRAC = { DNP: 'did not practice', LP: 'limited practice', FP: 'full practice', NIR: 'rest day (not injury)' };
// Cycle 105: the cards as you saw them before kickoff, graded by D&R's card-grade.js (lineup: in vs out; waiver: add vs drop that week).
function gradeCard(G) {
  if (!G) return '';
  if (G.state === 'pending') return `<div class="card"><h3>Week ${G.week} cards, as you saw them <span class="pill">grading Tuesday</span></h3><div class="conf">📸 ${G.gradeable} start/sit and waiver card${G.gradeable === 1 ? '' : 's'} saved so far (${G.snaps} board version${G.snaps === 1 ? '' : 's'}). Each one gets graded on the Tuesday after Monday night's game, as it stood right before its own kickoff: did the player it started (or added) outscore the one it benched (or dropped)?</div></div>`;
  const pct = G.n ? Math.round(100 * G.right / G.n) : 0;
  const sgn = (x) => `${x > 0 ? '+' : ''}${x}`;
  const conf = Object.entries(G.byConfidence || {}).map(([k, v]) => `${esc(k)} ${v.right}/${v.n}`).join(' · ');
  const rows = (G.cards || []).slice(0, 8).map(c => `<tr><td>${c.right ? '✅' : '❌'} ${esc(c.title)}</td><td class="hide-sm">${esc(c.confidence || '')}</td><td class="num">${c.pick} vs ${c.alt}</td><td class="num">${sgn(c.gain)}</td></tr>`).join('');
  return `<div class="card"><h3>Week ${G.week} cards, as you saw them <span class="pill">graded vs actual points</span></h3>
    <div style="margin-bottom:8px"><b>${G.right}/${G.n}</b> right (${pct}%) · net <b>${sgn(G.net)}</b> pts${conf ? ` · ${conf}` : ''}${G.approved?.n ? ` · you approved ${G.approved.n} (${G.approved.right} right)` : ''}</div>
    <table><tr><th>Card</th><th class="hide-sm">Conf.</th><th class="num">Pick vs other</th><th class="num">Gain</th></tr>${rows}</table>
    <div class="conf">Each card as it stood right before its own kickoff, ${G.scoring === 'pts_ppr' ? 'PPR' : G.scoring === 'pts_std' ? 'standard' : 'half-PPR'} points. Waivers count this week only, not rest of season.${G.ungraded ? ` ${G.ungraded} trade/other card${G.ungraded === 1 ? '' : 's'} not graded.` : ''}</div></div>`;
}
function freezeCard(F) {
  if (!F) return '';
  const fresh = F.staleTeams ? `${F.staleTeams} of ${F.teams} teams were graded on a copy more than ${F.staleH} h old at kickoff (median ${F.medianGapH} h, worst ${F.maxGapH} h). The app now refreshes a copy that old automatically before kickoff.` : `Every team's copy was under ${F.staleH} h old at kickoff (median ${F.medianGapH} h).`;
  const sat = F.satOut.length ? `<p class="conf" style="margin-top:8px">Sat out despite a ${F.minProj}+ projection: ${F.satOut.map(p => `${esc(p.name)} (${esc(p.pos)} ${esc(p.team)}, proj ${p.proj}${p.status && !/^act/i.test(p.status) ? `, ${esc(p.status)}` : ''}${PRAC[p.practice] ? `, ${PRAC[p.practice]}` : ''})`).join(', ')}.</p>` : '';
  const qb = F.qb ? `<p class="conf">Starting QB right for ${F.qb.matched} of ${F.qb.teams} teams${F.qb.misses.length ? `; missed ${F.qb.misses.map(esc).join('; ')}` : ''}.</p>` : '';
  return `<div class="card"><h3>Week ${F.week} pre-game data, graded <span class="pill">honest error</span></h3>
    <div class="kpis" style="margin-bottom:12px;grid-template-columns:repeat(3,1fr)"><div class="kpi"><b>${F.mae ?? '—'}</b><span>pts off per player, no-shows as 0 (${F.n} players ${F.minProj}+)</span></div><div class="kpi"><b>${F.noShows}</b><span>sat out (${F.noShowPoints} projected pts lost)</span></div><div class="kpi"><b>${F.maePlayedOnly ?? '—'}</b><span>pts off for players who played</span></div></div>
    <p class="conf">${fresh}</p>${sat}${qb}<p class="conf">Most sites only grade players who played. This counts a starter who sat as 0, because that is what it costs your lineup.</p></div>`;
}
// Cycle 102: the board is saved after every run and decision so each card is graded as it stood before its own kickoff.
const boardLine = (H) => !H || !H.snaps ? '' : ` 📸 Week ${H.week}'s board is saved after every agent run and every approve/reject (${H.snaps} version${H.snaps > 1 ? 's' : ''} of ${H.cards} card${H.cards === 1 ? '' : 's'} since ${new Date(H.first).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET), so each card is graded as you saw it right before its kickoff, not as it looks afterwards.`;
async function loadTR() { if (trBusy) return; trBusy = true; try { S.tr = await api('/api/track-record'); } catch (e) { S.tr = { error: e.message }; } trBusy = false; if (view === 'record') render(); }
function matchupBT(bt) {
  if (!bt?.lowFavourite || !bt?.softerDefence) return '';
  return `<h3 style="margin-top:16px">Do matchups break close calls? <span class="pill">backtest</span></h3><table><tr><th>Close calls (gap &lt; 1.5 pts)</th><th></th><th class="num">Won</th><th class="num hide-sm">Sample</th></tr>
    <tr><td><b>Pick the projection favourite</b></td><td><div class="bar"><i style="width:${bt.lowFavourite.pct}%"></i></div></td><td class="num"><b>${bt.lowFavourite.pct}%</b></td><td class="num conf hide-sm">${bt.lowFavourite.n.toLocaleString()} pairs</td></tr>
    <tr><td><b>Pick the softer defence</b></td><td><div class="bar"><i style="width:${bt.softerDefence.pct}%"></i></div></td><td class="num"><b>${bt.softerDefence.pct}%</b></td><td class="num conf hide-sm">${bt.softerDefence.n.toLocaleString()} pairs</td></tr></table>
    <p class="conf" style="margin-top:8px">Weeks ${bt.weeks[0]}-${bt.weeks[1]}, players projected ${bt.minProj}+ pts, defence ranked by points allowed to the position in prior weeks. Projections already price in the matchup, so the agent shows matchup and Vegas totals as context on close calls but doesn't flip picks on them. Past Vegas lines aren't kept by ESPN, so those can't be backtested yet.</p>`;
}
const TITLES = { today: 'Today', roster: 'My Team', league: 'League', news: 'Injuries & News', agent: 'Agent Log', record: 'Track record', why: 'Why switch from ESPN' };
function render() {
  if (!V[view]) view = 'today';
  $('#title').textContent = TITLES[view];
  $('#eyebrow').textContent = `${S.league.name} · Week ${S.week}, ${S.season} · last agent run ${S.lastRun ? et(S.lastRun) : '—'}`;
  const bn = $('#banner'); bn.classList.toggle('real', !S.league.demo);
  bn.innerHTML = S.league.demo ? '🧪 <b>Demo league:</b> teams, managers, records &amp; matchups are mock data. Players, projections, injuries, trends, schedule &amp; weather are <b>real</b> (Sleeper, ESPN, Open-Meteo). <a data-go="league">Import your Sleeper or ESPN league →</a>'
    : `🔗 <b>Your ${PL()} league:</b> ${esc(S.league.name)} as ${S.league.source === 'espn' ? esc(S.league.teamName || '') : '@' + esc(S.league.username || '')} · synced ${S.league.syncedAt ? et(S.league.syncedAt) : '—'}${S.league.syncError ? ' · ⚠️ last sync failed' : ''}. Read-only: approve here, then make the move in ${PL()}.`;
  $('#view').innerHTML = V[view]();
  document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $('#sideFoot').innerHTML = `Data: Sleeper · ESPN · Open-Meteo<br>Agent cost today: <b>$0.00</b>${S.demoMode?.on ? '<br>⏸ Scheduled runs paused (demo mode)' : ''}`;
  const dm = $('#demoMode'); if (dm) { dm.classList.toggle('on', !!S.demoMode?.on); dm.title = S.demoMode?.on ? `Demo mode ON: scheduled agent runs paused${S.demoMode.source === 'env DEMO_MODE' ? ' (set by DEMO_MODE env; restart without it to change)' : ''}. Manual "Run agent now" still works.` : 'Demo mode OFF: scheduled runs (3:00 & 9:00 AM ET daily, Thu 5 PM, Sat 9 AM, Sun 11:30 AM) are active. Turn on to freeze cards during a demo.'; $('.lbl', dm).textContent = S.demoMode?.on ? 'Demo mode: ON' : 'Demo mode: off'; }
}
function go(v) { view = v; location.hash = v; render(); window.scrollTo(0, 0); }
document.addEventListener('click', async (e) => {
  const nav = e.target.closest('[data-view],[data-go]'); if (nav) { e.preventDefault(); return go(nav.dataset.view || nav.dataset.go); }
  if (e.target.closest('#digestCopy')) { const t = S.digest?.digest?.text || ''; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Digest copied'), () => toast('Copy failed: select the text instead')); return; }
  if (e.target.closest('#guardBtn')) { const g = e.target.closest('#guardBtn'); g.disabled = true;
    try { const r = await api('/api/guards/check', { method: 'POST' }); S = r.state; render(); toast(r.fired ? `🔁 ${r.fired} guard${r.fired > 1 ? 's' : ''} fired: lineup updated` : `🛡️ Checked ${r.checked} guard${r.checked === 1 ? '' : 's'}: no one ruled out, nothing changed`); }
    catch (err) { toast('Error: ' + err.message); g.disabled = false; } return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  b.disabled = true;
  try { const r = await api(`/api/suggestions/${b.dataset.id}/${b.dataset.act}`, { method: 'POST' }); S = r.state; render(); toast((b.dataset.act === 'approve' ? '✓ ' : '✕ ') + r.note); }
  catch (err) { if (err.state) { S = err.state; render(); toast('↻ ' + err.message); } else { toast('Error: ' + err.message); b.disabled = false; } }
});
$('#runBtn').addEventListener('click', async () => {
  const b = $('#runBtn'); b.disabled = true; b.classList.add('busy'); $('.lbl', b).textContent = 'Agent working…';
  try { S = await api('/api/agent/run', { method: 'POST', body: JSON.stringify({ force: true }) }); render(); toast(`🤖 ${S.activity[0].steps.at(-1).text}`); }
  catch (err) { toast('Error: ' + err.message); }
  b.disabled = false; b.classList.remove('busy'); $('.lbl', b).textContent = 'Run agent now';
});
$('#demoMode')?.addEventListener('click', async () => {
  const b = $('#demoMode'); b.disabled = true;
  try { S.demoMode = await api('/api/demo-mode', { method: 'POST', body: JSON.stringify({ on: !S.demoMode?.on }) }); render(); toast(S.demoMode.on ? '⏸ Demo mode on: scheduled runs paused, cards stay put' : '▶ Demo mode off: scheduled runs resume'); }
  catch (err) { toast('Error: ' + err.message); }
  b.disabled = false;
});
$('#resetBtn')?.addEventListener('click', async () => {
  if (!confirm('Reset the demo? This restores the demo league and clears all approvals, rejections and any imported league.')) return;
  const b = $('#resetBtn'); b.disabled = true; b.textContent = 'Resetting…';
  try { S = await api('/api/reset', { method: 'POST' }); LG = { user: '', list: null, err: '', busy: false }; EL = { input: '', info: null, err: '', busy: false, teamId: null }; go('today'); toast(`↺ Demo reset: ${S.suggestions.filter(s => s.status === 'pending').length} fresh suggestions`); }
  catch (err) { toast('Error: ' + err.message); }
  b.disabled = false; b.textContent = '↺ Reset demo';
});
window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'today'; render(); });
api('/api/state').then(s => { S = s; render(); }).catch(e => ($('#view').innerHTML = `<div class="card">Failed to load: ${esc(e.message)}</div>`));

function gameDayCard() {
  const g = S.gameDay; if (!g || !g.items?.length) return '';
  return `<div class="card gameday"><h3>🏟️ Game-day plan <span class="pill">${g.live ? 'games underway' : g.firstKick ? 'first kickoff ' + esc(et(g.firstKick, { month: undefined, day: undefined, weekday: 'short' })) : ''}</span></h3>
    <ul>${g.items.map(x => `<li class="${esc(x.level || '')}">${x.icon} ${esc(x.text)}</li>`).join('')}</ul></div>`;
}
function practiceStatusCard() {
  const p = S.practiceStatus; if (!p) return '';
  return `<div class="card pracstat"><h3>📋 Practice reports <span class="pill">${p.teamsIn != null ? esc(p.teamsIn + ' of ' + p.total + ' teams in') : 'Week ' + esc(p.week)}</span></h3><div class="conf">${esc(p.text)}</div></div>`;
}
function changesBanner() {
  const c = S.changes; if (!c || !c.since || !c.items?.length) return '';
  const ic = (x) => x.dir === 'worse' ? '🔻' : x.dir === 'better' ? '🟢' : '•';
  return `<div class="card changes"><h3>🔔 Changed since last run <span class="pill">vs ${esc(new Date(c.since).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }))} ET</span></h3>
    <ul>${c.items.map(x => `<li class="${x.dir || ''}">${ic(x)} ${esc(x.text)}</li>`).join('')}</ul></div>`;
}

// ---- Real league import (Sleeper or public ESPN, read-only) ----
let LG = { user: '', list: null, err: '', busy: false };
let EL = { input: '', info: null, err: '', busy: false, teamId: null };
function connectCard() {
  if (!S.league.demo) { const espn = S.league.source === 'espn';
    return `<div class="card connect"><h3>Connected league <span class="pill in">${PL()} · read-only</span></h3>
    <div class="conf"><b>${esc(S.league.name)}</b> (${S.league.size} teams) as ${espn ? esc(S.league.teamName || '') + (S.league.username ? ' (' + esc(S.league.username) + ')' : '') : '@' + esc(S.league.username || '')}. Synced ${S.league.syncedAt ? et(S.league.syncedAt) : '—'}; the agent re-syncs on each run (at most every 15 min).${S.league.unsupportedSlots?.length ? ` Slots not handled yet: ${esc(S.league.unsupportedSlots.join(', '))}.` : ''}${S.league.unmapped?.length ? ` ${S.league.unmapped.length} player(s) couldn't be matched and are skipped: ${esc(S.league.unmapped.slice(0, 5).join(', '))}.` : ''}${S.league.syncError ? ` ⚠️ Last sync failed: ${esc(S.league.syncError)}.` : ''}</div>
    <div style="margin-top:10px"><button class="btn" id="demoBtn">Back to demo league</button></div></div>`; }
  const sc = (k) => esc(String(k || '').replace('pts_', '').replace('_', '-').toUpperCase());
  return `<div class="card connect"><h3>Bring your real league <span class="pill">Sleeper · free · no password</span></h3>
    <div class="conf">Enter your Sleeper username. We only read public league data (rosters, lineups, records, matchups). Nothing is changed in Sleeper.</div>
    <form id="lgForm"><input id="lgUser" placeholder="Sleeper username" value="${esc(LG.user)}" autocomplete="off"><button class="btn primary" ${LG.busy ? 'disabled' : ''}>${LG.busy ? 'Looking…' : 'Find my leagues'}</button></form>
    ${LG.err ? `<div class="conf" style="color:#f87171;margin-top:8px">${esc(LG.err)}</div>` : ''}
    ${LG.list ? (LG.list.leagues.length ? `<div class="lg-list">${LG.list.leagues.map(l => `<div class="lg-item"><div><b>${esc(l.name)}</b><small>${l.size} teams · ${sc(l.scoring)} · ${l.faab != null ? '$' + l.faab + ' FAAB' : 'rolling waivers'} · ${esc(l.season)} ${esc(l.status)}</small></div><button class="btn ok" data-import="${esc(l.leagueId)}">Import</button></div>`).join('')}</div>`
      : `<div class="conf" style="margin-top:8px">@${esc(LG.list.user.username || LG.user)} has no ${esc(LG.list.season)} NFL leagues on Sleeper.</div>`) : ''}
    <h3 style="margin-top:18px">…or an ESPN league <span class="pill">public leagues · no login</span></h3>
    <div class="conf">Paste your ESPN league URL (or just the league ID), then pick your team. Works for leagues set to "viewable to the public" in ESPN league settings; we never ask for your ESPN password or cookies. Nothing is changed in ESPN.</div>
    <form id="espnForm"><input id="espnIn" placeholder="https://fantasy.espn.com/football/league?leagueId=…" value="${esc(EL.input)}" autocomplete="off"><button class="btn primary" ${EL.busy ? 'disabled' : ''}>${EL.busy ? 'Looking…' : 'Find league'}</button></form>
    ${EL.err ? `<div class="conf" style="color:#f87171;margin-top:8px">${esc(EL.err)}</div>` : ''}
    ${EL.info ? `<div class="conf" style="margin-top:8px"><b>${esc(EL.info.name)}</b> · ${EL.info.size} teams · ${sc(EL.info.scoring)} · ${EL.info.faab != null ? '$' + EL.info.faab + ' FAAB budget' : 'no FAAB'} · ${esc(EL.info.season)}${EL.info.unsupportedSlots?.length ? ' · slots not handled yet: ' + esc(EL.info.unsupportedSlots.join(', ')) : ''}. Which team is yours?</div>
      <div class="lg-list">${EL.info.teams.map(t => `<div class="lg-item"><div><b>${esc(t.name)}</b>${EL.info.suggestedTeamId === t.teamId ? ' <span class="pill in">from your link</span>' : ''}<small>${esc(t.manager)} · ${t.record.w}-${t.record.l}${t.record.t ? '-' + t.record.t : ''} · ${t.record.pf} PF</small></div><button class="btn ok" data-espn-team="${t.teamId}">This is me</button></div>`).join('')}</div>` : ''}
  </div>`;
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'espnForm') return; e.preventDefault();
  EL.input = $('#espnIn').value.trim(); if (!EL.input) return;
  EL.busy = true; EL.err = ''; EL.info = null; render();
  try { EL.info = await api('/api/import/espn/league?league=' + encodeURIComponent(EL.input)); } catch (err) { EL.err = err.message; }
  EL.busy = false; render();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-espn-team]'); if (!b || !EL.info) return;
  b.disabled = true; b.textContent = 'Importing…';
  try {
    S = await api('/api/import/espn', { method: 'POST', body: JSON.stringify({ league: EL.info.leagueId, season: EL.info.season, teamId: Number(b.dataset.espnTeam) }) });
    EL = { input: EL.input, info: null, err: '', busy: false, teamId: null };
    go('today'); toast(`🔗 Imported ${S.league.name} from ESPN: ${S.suggestions.filter(s => s.status === 'pending').length} suggestions for your real team`);
  } catch (err) { EL.err = err.message; render(); }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'lgForm') return; e.preventDefault();
  LG.user = $('#lgUser').value.trim(); if (!LG.user) return;
  LG.busy = true; LG.err = ''; LG.list = null; render();
  try { LG.list = await api('/api/import/sleeper/leagues?username=' + encodeURIComponent(LG.user)); } catch (err) { LG.err = err.message; }
  LG.busy = false; render();
});
document.addEventListener('click', async (e) => {
  const imp = e.target.closest('[data-import]'), demo = e.target.closest('#demoBtn');
  if (!imp && !demo) return;
  (imp || demo).disabled = true; (imp || demo).textContent = imp ? 'Importing…' : 'Switching…';
  try {
    S = imp ? await api('/api/import/sleeper', { method: 'POST', body: JSON.stringify({ username: LG.user, leagueId: imp.dataset.import }) })
      : await api('/api/league/demo', { method: 'POST' });
    LG = { user: LG.user, list: null, err: '', busy: false };
    go('today'); toast(imp ? `🔗 Imported ${S.league.name}: ${S.suggestions.filter(s => s.status === 'pending').length} suggestions for your real team` : '🧪 Back on the demo league');
  } catch (err) { LG.err = err.message; render(); }
});
