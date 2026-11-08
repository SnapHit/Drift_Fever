/* THE SCREENS. Title, career, garage and results, as plain DOM over the
   canvas, each rebuilt from the save when shown. Every button carries a
   data-action and an optional data-arg, and one click handler hands them
   to the host. Big targets for thumbs: everything is reachable in
   390x844 portrait and in landscape. No images, no fonts, system text. */
import { ROSTER, PAINTS, carById, upgradeLevels, UPGRADE_STATS, UPGRADE_NAMES } from '../garage/roster.js';
import { CAREER, careerUnlocked, careerStars } from '../loop/modes.js';
import { missionTally } from '../loop/missions.js';
import { LOOP } from '../tune.js';
import { fullscreenSupported, isFullscreen, fullscreenIcon } from './fullscreen.js';
import { soundIcon } from '../audio/sound.js';
import { FIELDS } from '../lab/code.js';
import { crossoverOffered, format as formatCode } from '../lab/lab.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stars = (n, dim) => '<span class="stars' + (dim ? ' dim' : '') + '">' + [0, 1, 2].map(i => '<span class="' + (i < n ? 'on' : 'off') + '">&#9733;</span>').join('') + '</span>';
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/* a track's three missions as pips */
const pips = done => '<span class="pips m">' + [0, 1, 2].map(i => '<i class="' + (done && done[i] ? 'on' : '') + '"></i>').join('') + '</span>';

export function createScreens(root, onAction) {
  const el = document.createElement('div');
  el.id = 'screens';
  root.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled || b.tagName === 'FORM') return;
    e.preventDefault();
    onAction(b.dataset.action, b.dataset.arg);
  });
  /* a form (the code entry) submits by its button or by Enter in its field */
  el.addEventListener('submit', e => { const f = e.target.closest('form[data-action]'); if (!f) return; e.preventDefault(); onAction(f.dataset.action, (f.querySelector('input') || {}).value); });
  let current = null;

  function show(name, html) {
    current = name;
    el.innerHTML = '<div class="screen ' + name + '">' + html + '</div>';
    el.classList.add('on');
  }
  function hide() { current = null; el.classList.remove('on'); el.innerHTML = ''; }

  function coins(save) { return '<div class="coins"><span class="coin">&#9679;</span> ' + fmt(save.coins) + '</div>'; }

  function title(save, info) {
    const daily = save.daily && save.daily.date === info.dailyDate ? save.daily : null;
    const total = careerStars(save);
    show('title', `
      ${coins(save)}
      <img class="lockup" src="assets/brand/snaphit-lockup.svg" alt="SnapHit Studios. Instant. Play.">
      <h1><img class="wordmark" src="assets/brand/drift-fever-wordmark.svg" alt="Drift Fever"></h1>
      <p class="sub">${info.standIn ? 'test track build' : 'CrazyGames edition'}${info.storage ? '' : ' <em>(no memory on this device)</em>'}</p>
      ${info.backPay ? `<p class="sub pay">+${fmt(info.backPay)} coins for the stars you have already won</p>` : ''}
      <div class="menu">
        <button type="button" class="big primary" data-action="daily"><b>DAILY DRIFT</b><small>${esc(info.dailyName)} ${info.dailyKind}${daily ? ' &middot; best ' + fmt(daily.best) + ' ' + stars(daily.stars, true) : ''}</small></button>
        <button type="button" class="big" data-action="career"><b>CAREER</b><small>${total}/${CAREER.length * 3} stars &middot; ${info.missions}/${info.missionsOf} missions</small></button>
        <button type="button" class="big" data-action="free"><b>FREE DRIFT</b><small>the car park, no timer</small></button>
        <button type="button" class="big" data-action="garage"><b>GARAGE</b><small>${esc(carById(save.car).name)}</small></button>
        <button type="button" class="big" data-action="lab"><b>TRACK LAB</b><small>${info.labCodes ? info.labCodes + ' of your tracks saved' : 'make and share tracks'}</small></button>
      </div>
      <div class="opts">
        ${fullscreenSupported() ? `<button type="button" class="fsbtn" data-action="fullscreen">${fullscreenIcon(isFullscreen())}<span>${isFullscreen() ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}</span></button>` : ''}
        ${info.sound ? `<button type="button" class="fsbtn" data-action="sound">${soundIcon(info.sound === 'off')}<span>SOUND ${info.sound === 'on' ? 'ON' : 'OFF'}</span></button>` : ''}
        ${info.sound ? `<button type="button" class="fsbtn" data-action="music"><span>&#9835;</span><span>MUSIC ${info.music === 'on' ? 'ON' : 'OFF'}</span></button>` : ''}
        <button type="button" class="fsbtn" data-action="onboard"><span>?</span><span>HOW TO PLAY</span></button>
      </div>
      <p class="hint">Steer left and right. DRIFT / BRAKE with steering throws the tail out; on its own it brakes. The car drives itself.</p>`);
  }

  function career(save) {
    const rows = CAREER.map((c, i) => {
      const e = save.career[String(i)], open = careerUnlocked(save, i);
      return `<button type="button" class="row${open ? '' : ' locked'}" data-action="play-career" data-arg="${i}" ${open ? '' : 'disabled'}>
        <span class="n">${i + 1}</span>
        <span class="name"><b>${esc(c.name)}</b><small>${c.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint'}${e && e.best ? ' &middot; best ' + fmt(e.best) : ''}</small></span>
        ${open ? '<span class="col">' + stars(e ? e.stars : 0) + pips(save.missions && save.missions['career:' + i]) + '</span>' : '<span class="lock">&#128274;</span>'}
      </button>`;
    }).join('');
    const tally = missionTally(save, CAREER.length);
    show('career', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>CAREER</h2><span class="tally">${careerStars(save)} &#9733; &middot; ${tally} of ${CAREER.length * 3} missions</span></header><div class="list">${rows}</div>`);
  }

  /* the upgrades of an owned car: a row per stat, its steps as pips and
     the price of the next step */
  function upgrades(save, id) {
    const lv = upgradeLevels(save.cars[id].up), P = LOOP.UPGRADE_PRICES;
    return '<div class="ups">' + UPGRADE_STATS.map(k => {
      const n = lv[k], price = P[n], pips = P.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      const can = price !== undefined && save.coins >= price;
      return `<button type="button" class="up" data-action="upgrade" data-arg="${k}" ${can ? '' : 'disabled'}><b>${UPGRADE_NAMES[k]}</b><span class="pips">${pips}</span><small>${price === undefined ? 'full' : '<span class="coin">&#9679;</span> ' + fmt(price)}</small></button>`;
    }).join('') + '</div>';
  }

  function garage(save, picked) {
    const sel = picked || save.car;
    const car = carById(sel), owned = !!save.cars[sel], chosen = save.car === sel;
    const cards = ROSTER.map(c => {
      const own = !!save.cars[c.id];
      return `<button type="button" class="card${c.id === sel ? ' sel' : ''}${own ? ' owned' : ''}" data-action="pick-car" data-arg="${c.id}">
        <span class="swatch" style="background:#${(PAINTS.find(p => p.id === (own ? save.cars[c.id].paint : c.paint)) || PAINTS[0]).hex.toString(16).padStart(6, '0')}"></span>
        <b>${esc(c.name)}</b><small>${own ? (save.car === c.id ? 'chosen' : 'owned') : '<span class="coin">&#9679;</span> ' + fmt(c.price)}</small></button>`;
    }).join('');
    const myPaint = owned ? save.cars[sel].paint : car.paint;
    const paints = PAINTS.map(p => `<button type="button" class="paint${p.id === myPaint ? ' sel' : ''}" data-action="paint" data-arg="${p.id}" style="background:#${p.hex.toString(16).padStart(6, '0')}" aria-label="${p.name}" ${owned ? '' : 'disabled'}>${p.id === car.paint || p.id === myPaint ? '' : '<small>' + LOOP.PAINT_PRICE + '</small>'}</button>`).join('');
    let action;
    if (!owned) action = `<button type="button" class="big primary" data-action="buy-car" data-arg="${sel}" ${save.coins >= car.price ? '' : 'disabled'}><b>BUY</b><small><span class="coin">&#9679;</span> ${fmt(car.price)}${save.coins >= car.price ? '' : ' &middot; you have ' + fmt(save.coins)}</small></button>`;
    else if (!chosen) action = `<button type="button" class="big primary" data-action="choose-car" data-arg="${sel}"><b>DRIVE THIS</b></button>`;
    else action = `<button type="button" class="big" data-action="title"><b>CHOSEN</b><small>back to the title</small></button>`;
    show('garage', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>GARAGE</h2></header>
      <div class="cards">${cards}</div>
      <div class="detail"><h3>${esc(car.name)}</h3><p>${esc(car.character)}</p><div class="paints">${paints}</div>${owned ? upgrades(save, sel) : ''}${action}</div>`);
  }

  /* THE TRACK LAB. L: { settings, seed, code, track, best, ghost, message,
     error, link }. The plan canvas is drawn by the host after show(),
     because it needs to be in the DOM to have a size. */
  const LABELS = { kind: { circuit: 'CIRCUIT', sprint: 'SPRINT' }, length: { short: 'SHORT', medium: 'MEDIUM', long: 'LONG' }, style: { flowing: 'FLOWING', technical: 'TECHNICAL', hairpins: 'HAIRPINS', mixed: 'MIXED' }, theme: { forest: 'FOREST', coastal: 'COAST', desert: 'DESERT', docks: 'DOCKS', mountain: 'MOUNTAIN' }, time: { dusk: 'DUSK', night: 'NIGHT', dawn: 'DAWN', rain: 'RAIN' } };
  function seg(name, s, title) {
    const field = FIELDS.find(f => f[0] === name);
    return `<div class="segrow"><small>${title}</small><div class="seg">${field[2].map(v => `<button type="button" class="${s[name] === v ? 'on' : ''}" data-action="lab-set" data-arg="${name}=${v}">${LABELS[name][v]}</button>`).join('')}</div></div>`;
  }
  function toggle(name, s, title, offered) {
    return `<button type="button" class="tog${s[name] ? ' on' : ''}" data-action="lab-set" data-arg="${name}=${s[name] ? 'off' : 'on'}" ${offered === false ? 'disabled' : ''}><span class="sw"></span><b>${title}</b><small>${offered === false ? 'needs a long circuit' : s[name] ? 'on' : 'off'}</small></button>`;
  }
  function lab(save, L) {
    const s = L.settings, t = L.track;
    const facts = t ? `${fmt(t.length)} m${t.kind === 'circuit' ? ' lap' : ''} &middot; ${t.corners.length} corners${t.corners.filter(c => c.bank > 0).length ? ' &middot; ' + t.corners.filter(c => c.bank > 0).length + ' banked' : ''}${t.bridges && t.bridges.length ? ' &middot; crossover' : ''}${t.fallback ? ' &middot; <em>plain layout</em>' : ''}` : '';
    show('lab', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>TRACK LAB</h2></header>
      <div class="labgrid">
        <div class="planbox"><canvas id="plan"></canvas><div class="planinfo">${facts}</div></div>
        <div class="labctl">
          ${seg('kind', s, 'track')}
          ${seg('length', s, 'length')}
          ${seg('style', s, 'style')}
          <div class="togs">${toggle('bank', s, 'BANKED CORNERS')}${toggle('cross', s, 'CROSSOVER', crossoverOffered(s))}</div>
          ${seg('theme', s, 'scenery')}
          ${seg('time', s, 'time of day')}
          <div class="coderow"><span class="codelabel">CODE</span><span class="code">${formatCode(L.code)}</span><button type="button" class="mini" data-action="lab-copy">COPY</button><button type="button" class="mini" data-action="lab-link">LINK</button></div>
          ${L.message ? `<p class="status${L.error ? ' bad' : ''}">${esc(L.message)}</p>` : ''}
          <div class="row2">
            <button type="button" class="big" data-action="lab-new"><b>NEW LAYOUT</b><small>same settings, another seed</small></button>
            <button type="button" class="big primary" data-action="lab-drive"><b>DRIVE</b><small>${L.best ? 'best ' + fmt(L.best.best) + (L.ghost ? ' &middot; ghost' : '') : t && t.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint'}</small></button>
          </div>
          <form class="coderow entry" data-action="lab-code"><input id="codeIn" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="have a code? type it here" maxlength="16" aria-label="track code"><button type="submit" class="mini" data-action="lab-code">GO</button></form>
        </div>
      </div>`);
  }

  /* r: { score, best, stars, targets, coins, improved, mode, name, seconds, nextIndex, laps, kind, missions, code } */
  function results(r) {
    const targets = r.targets.map((t, i) => `<span class="${r.score >= t ? 'on' : 'off'}">&#9733; ${fmt(t)}</span>`).join('');
    show('results', `
      <div class="card">
        <h2>${esc(r.name)}</h2>
        <div class="score"><span class="n">${fmt(r.score)}</span><span class="l">points${r.improved ? ' &middot; NEW BEST' : ''}</span></div>
        ${stars(r.stars)}
        <div class="targets">${targets}</div>
        ${r.parts ? `<div class="parts"><span><b>${fmt(r.parts.drift)}</b><small>drift</small></span><span><b>${fmt(r.parts.clean)}</b><small>clean${r.cleanSectors ? ' ' + r.cleanSectors : ''}</small></span><span><b>${fmt(r.parts.pace)}</b><small>pace</small></span></div>` : ''}
        <div class="facts"><span><b>${fmt(r.best)}</b><small>best chain</small></span><span><b>${r.seconds.toFixed(1)} s</b><small>run</small></span><span><b>+${fmt(r.coins)}</b><small>coins${r.newStars ? ' &middot; ' + r.newStars + ' new star' + (r.newStars > 1 ? 's' : '') : ''}</small></span></div>
        ${r.missions ? `<div class="missions">${r.missions.map(m => `<span class="${m.done ? 'done' : ''}${m.fresh ? ' fresh' : ''}">${m.done ? '&#10003;' : '&#9671;'} ${esc(m.text)}${m.fresh ? ' <b>+' + m.coins + '</b>' : ''}</span>`).join('')}</div>` : ''}
        ${r.code ? `<div class="coderow"><span class="codelabel">CODE</span><span class="code">${formatCode(r.code)}</span><button type="button" class="mini" data-action="lab-copy">COPY</button><button type="button" class="mini" data-action="lab-link">LINK</button></div>${r.message ? `<p class="status">${esc(r.message)}</p>` : ''}` : ''}
        <button type="button" class="big primary" data-action="again"><b>GO AGAIN</b><small>DRIFT / BRAKE, Enter or R</small></button>
        <div class="row2">
          ${r.nextIndex !== null && r.nextIndex !== undefined ? `<button type="button" class="big" data-action="play-career" data-arg="${r.nextIndex}"><b>NEXT</b><small>${esc(CAREER[r.nextIndex].name)}</small></button>` : ''}
          ${r.code ? `<button type="button" class="big" data-action="lab"><b>LAB</b><small>change the track</small></button>` : ''}
          <button type="button" class="big" data-action="title"><b>MENU</b></button>
        </div>
      </div>`);
  }

  return { el, show, hide, title, career, garage, lab, results, get current() { return current; } };
}

export { fmt };
