/* THE SCREENS. Title, career, garage and results, as plain DOM over the
   canvas, each rebuilt from the save when shown. Every button carries a
   data-action and an optional data-arg, and one click handler hands them
   to the host. Big targets for thumbs: everything is reachable in
   390x844 portrait and in landscape. No images, no fonts, system text. */
import { ROSTER, PAINTS, carById, upgradeLevels, UPGRADE_STATS, UPGRADE_NAMES } from '../garage/roster.js';
import { CAREER, CHAPTERS, careerUnlocked, careerStars, chapterStars, chapterOpen, chapterNeeds } from '../loop/modes.js';
import { missionTally } from '../loop/missions.js';
import { LOOP, TANDEM } from '../tune.js';
import { fullscreenSupported, isFullscreen, fullscreenIcon } from './fullscreen.js';
import { soundIcon } from '../audio/sound.js';
import { FIELDS } from '../lab/code.js';
import { crossoverOffered, format as formatCode } from '../lab/lab.js';
import { FX_ON } from '../fx.js';
import { ITEMS, STANDARD, KINDS, lookOf, priceOf, owns } from '../garage/cosmetics.js';
import { wheelDesign, wheelIcon, standardIcon } from '../cars/wheels.js';
import { carSpec } from '../cars/index.js';
import { CHALLENGES, LEVELS, parkTally, coinsOf } from '../park/challenges.js';
import { RIVALS, rivalOpen, rivalsLive, rivalNeeds, rivalState, ladderSummary, rivalPaint } from '../rivals/roster.js';

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
    el.classList.toggle('bare', name === 'garage');   // the garage shows the showroom through, not the menus' backdrop
  }
  function hide() { current = null; el.classList.remove('on', 'bare'); el.innerHTML = ''; }

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
        ${rivalsButton(save)}
        <button type="button" class="big parkbtn" data-action="park"><b>STUNT PARK</b><small>free drift &middot; ${parkTally(save.park && save.park.won).won} of ${parkTally(save.park && save.park.won).of}</small></button>
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

  /* THE RIVALS BUTTON on the title (briefs/RIVALS-LADDER.md): how many
     are beaten, and a mark while a rival is earned and not yet beaten, so
     there is always a reason to tap it; before the first is earned, what
     earns him. */
  function rivalsButton(save) {
    const L = ladderSummary(save);
    let line;
    if (!L.earned) line = esc((L.first[0] || { text: 'Win a star' }).text) + ' to race ' + esc(RIVALS[0].name);
    else if (L.ready.length) line = L.beaten + '/' + L.live + ' beaten &middot; ' + esc(RIVALS.find(r => r.id === L.ready[0]).name) + ' is waiting';
    else line = L.beaten + '/' + L.live + ' beaten' + (L.beaten === L.live ? ' &middot; every one' : '');
    return `<button type="button" class="big rivalsbtn${L.ready.length ? ' ready' : ''}" data-action="rivals"><b>RIVALS${L.ready.length ? '<i class="mark" aria-label="a race is waiting">RACE</i>' : ''}</b><small>${line}</small></button>`;
  }

  /* A rival's portrait (his car in his paint) or, until it is drawn, a swatch of his paint */
  function portraitOf(d, playerPaint, info) {
    const paint = rivalPaint(d, playerPaint), url = info && info.portrait ? info.portrait(d.car, paint, d.look) : '';
    const hex = (PAINTS.find(p => p.id === paint) || PAINTS[0]).hex.toString(16).padStart(6, '0');
    return url ? `<img class="pic" src="${url}" alt="${esc(carById(d.car).name)} in ${esc(paint)}">` : `<span class="pic sw" style="--p:#${hex}"></span>`;
  }
  /* THE RIVALS SCREEN: all six in ladder order from the first visit, each
     a card with his portrait, his name, how he drives, his track, his car
     and his prize, and his state: locked with what earns him (ticked when
     done), open to race, or beaten with the best margin and still open.
     A card not yet earned is still a button, so the keyboard reaches it,
     but it does nothing. The list scrolls in its own box under the
     header, as the career's does. info: { portrait(car, paint) } */
  function rivals(save, info) {
    const L = ladderSummary(save), mine = save.cars[save.car] ? save.cars[save.car].paint : 'cyan';
    const cards = RIVALS.map((d, k) => {
      const st = rivalState(save, k), e = save.rivals && save.rivals[d.id], c = CAREER[d.track];
      const where = esc(c.name) + ' &middot; ' + (c.kind === 'circuit' ? (d.laps || TANDEM.LAPS) + ' laps' : 'sprint') + ' &middot; ' + esc(carById(d.car).name);
      let state;
      if (st === 'beaten') state = `<span class="st won"><b>BEATEN</b><small>best +${fmt(Math.max(0, e.best))}</small><small>race again</small></span>`;
      else if (st === 'open') state = `<span class="st go"><b>RACE</b><small>${e ? 'best ' + (e.best >= 0 ? '+' : '') + fmt(e.best) : 'earned, not yet raced'}</small></span>`;
      else if (st === 'off') state = `<span class="st off"><b>SOON</b><small>not in the game yet</small></span>`;
      else state = `<span class="st lockd"><b>&#128274; TO EARN HIM</b>${rivalNeeds(save, k).map(n => `<small class="${n.done ? 'done' : ''}">${n.done ? '&#10003;' : '&#9675;'} ${esc(n.text + (n.note || ''))}</small>`).join('')}</span>`;
      const go = st === 'open' || st === 'beaten';
      return `<button type="button" class="rcard ${st}" data-rival="${esc(d.id)}" ${go ? `data-action="battle" data-arg="${esc(d.id)}"` : 'aria-disabled="true"'} style="--rp:#${(PAINTS.find(p => p.id === rivalPaint(d, mine)) || PAINTS[0]).hex.toString(16).padStart(6, '0')}">
        <span class="rung">${k + 1}</span>
        ${portraitOf(d, mine, info)}
        <span class="who"><b>${esc(d.name.toUpperCase())}</b><small class="style">${esc(d.style)}</small><small class="where">${where}</small><small class="prize"><span class="coin">&#9679;</span> ${fmt(d.prize)} first win</small></span>
        ${state}
      </button>`;
    }).join('');
    show('rivals', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>RIVALS</h2><span class="tally">${L.beaten}/${L.live} beaten</span></header><p class="rule">Earn each one with a star on his track and a win over the one before. Race him again whenever you like.</p><div class="list">${cards}</div>`);
  }

  /* A rival's card on the career screen, after his track (briefs/RIVALS.md
     3): locked (and what earns him, in the player's words), open, or
     beaten with the best margin. */
  function rivalCard(save, index) {
    const k = RIVALS.findIndex(r => r.track === index);
    if (k < 0 || k >= rivalsLive()) return '';
    const d = RIVALS[k], open = rivalOpen(save, d.id), e = save.rivals && save.rivals[d.id];
    const beaten = !!(e && e.won);
    let what;
    if (beaten) what = `<span class="state won">BEATEN<small>best +${fmt(Math.max(0, e.best))}</small></span>`;
    else if (open) what = `<span class="state go">RACE<small>${e ? 'best ' + (e.best >= 0 ? '+' : '') + fmt(e.best) : 'prize ' + fmt(d.prize)}</small></span>`;
    else what = `<span class="state lockd">&#128274;<small>${rivalNeeds(save, k).filter(n => !n.done).map(n => esc(n.text)).join(' &middot; ')}</small></span>`;
    return `<button type="button" class="rivalcard${open ? '' : ' locked'}${beaten ? ' beaten' : ''}" data-action="battle" data-arg="${esc(d.id)}" ${open ? '' : 'disabled'}>
        <span class="vs">VS</span>
        <span class="name"><b>${esc(d.name.toUpperCase())}</b><small>${esc(d.style)} &middot; drift race</small></span>
        ${what}
      </button>`;
  }

  /* THE CAREER: three chapters of eight, each a header (its stars and
     missions, or how many more stars open it) over its tracks. The list
     scrolls in its own box under the screen's header, and opens scrolled
     to the player's current chapter: the furthest one open. */
  /* THE STUNT PARK'S LIST (briefs/PLAYGROUND.md 3): every challenge with
     its place, one line of what to do, its three targets, which are won
     and what each pays. Each card is a button that does nothing, so a
     gamepad's focus can walk the list and scroll it. info.inPark: opened
     from the park's HUD, so the way out is back to the park; otherwise
     from the title, and DRIVE starts the park. The way on sits above
     the list, not under it: a gamepad's focus then walks the cards
     straight down, with nothing between a card and the next one below
     the fold. */
  function park(save, info) {
    const won = (save.park && save.park.won) || {}, T = parkTally(won), inPark = !!(info && info.inPark);
    const unit = (c, v) => c.unit === 'm' ? fmt(v) + ' m' : c.unit === 'km/h' ? v + ' km/h' : c.unit === 'points' ? fmt(v) + ' pts' : c.unit === 'places' ? v + ' places' : v + ' ' + (v === 1 ? c.unit.replace(/s$/, '') : c.unit);
    const cards = CHALLENGES.map(c => {
      const had = won[c.id] || 0;
      const levels = LEVELS.map((name, i) => `<span class="lv ${name}${i < had ? ' got' : ''}"><i>${i < had ? '&#10003;' : '&#9670;'}</i><b>${unit(c, LOOP.PARK.TARGETS[c.id][i])}</b><small><span class="coin">&#9679;</span> ${i < had ? 'won' : fmt(coinsOf(c.id, i + 1))}</small></span>`).join('');
      return `<button type="button" class="pcard${had >= 3 ? ' gold' : ''}" data-action="park-info" data-arg="${c.id}"><span class="who"><b>${esc(c.name.toUpperCase())}</b><small class="place">${esc(c.place)}</small><small class="what">${esc(c.what)}</small></span><span class="lvs">${levels}</span></button>`;
    }).join('');
    show('park', `${coins(save)}<header><button type="button" class="back" data-action="${inPark ? 'park-back' : 'title'}">&#9664;</button><h2>STUNT PARK</h2><span class="tally">${T.won}/${T.of} won</span></header><div class="drive"><button type="button" class="big primary" data-action="${inPark ? 'park-back' : 'free'}"><b>${inPark ? 'BACK TO THE PARK' : 'DRIVE'}</b></button></div><p class="rule">No timer. Drive to a place and try it: the game counts as you go. Each level pays once.</p><div class="list">${cards}</div>`);
  }
  function career(save) {
    const chapters = CHAPTERS.map((ch, c) => {
      const open = chapterOpen(save, c), size = ch.to - ch.from;
      let done = 0;
      for (let i = ch.from; i < ch.to; i++) { const e = save.missions && save.missions['career:' + i]; if (e) for (const v of e) if (v) done++; }
      const rows = CAREER.slice(ch.from, ch.to).map((t, k) => {
        const i = ch.from + k, e = save.career[String(i)], playable = careerUnlocked(save, i);
        return `<button type="button" class="row${playable ? '' : ' locked'}" data-action="play-career" data-arg="${i}" ${playable ? '' : 'disabled'}>
        <span class="n">${k + 1}</span>
        <span class="name"><b>${esc(t.name)}</b><small>${t.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint'}${e && e.best ? ' &middot; best ' + fmt(e.best) : ''}</small></span>
        ${playable ? '<span class="col">' + stars(e ? e.stars : 0) + pips(save.missions && save.missions['career:' + i]) + '</span>' : '<span class="lock">&#128274;</span>'}
      </button>` + rivalCard(save, i);
      }).join('');
      const sub = open ? `${chapterStars(save, c)}/${size * 3} &#9733; &middot; ${done}/${size * 3} missions` : esc(chapterNeeds(save, c));
      return `<section class="chapter${open ? '' : ' locked'}" data-chapter="${c}"><div class="chead"><b>${esc(ch.name.toUpperCase())}</b><small>${sub}</small></div>${rows}</section>`;
    }).join('');
    const tally = missionTally(save, CAREER.length);
    show('career', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>CAREER</h2><span class="tally">${careerStars(save)}/${CAREER.length * 3} &#9733; &middot; ${tally}/${CAREER.length * 3} missions</span></header><div class="list">${chapters}</div>`);
    /* the current chapter at the top of the list */
    let current = 0;
    for (let c = 0; c < CHAPTERS.length; c++) if (chapterOpen(save, c)) current = c;
    const list = el.querySelector('.career .list'), sec = el.querySelector('.career .chapter[data-chapter="' + current + '"]');
    if (list && sec) list.scrollTop = Math.max(0, sec.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop);
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

  /* THE GARAGE (briefs/GARAGE.md): one screen with the car on show. The
     stage is an empty rectangle the showroom draws the car into
     (garage/showroom.js), and the controls sit beside it or under it:
     six sections (cars, paint, wheels, glow, smoke, upgrades), the
     section's items, and one action. A press on an item not owned shows
     it on the car, a preview; the action then buys it. A press on one
     already owned fits it. Every item says what it is: worn, owned, or
     its price, and how many coins short the player is of one out of
     reach.
     G: { picked (the car looked at, or null for the chosen one), tab,
     preview: { paint, wheels, glow, smoke } (ids shown but not bought) } */
  const TABS = [['cars', 'CARS'], ['paint', 'PAINT'], ['wheels', 'WHEELS'], ['glow', 'GLOW'], ['smoke', 'SMOKE'], ['upgrades', 'UPGRADES']];
  const hexOf = n => '#' + n.toString(16).padStart(6, '0');
  const coin = n => '<span class="coin">&#9679;</span> ' + fmt(n);
  const needed = n => fmt(n) + ' more coin' + (n === 1 ? '' : 's') + ' needed';
  /* an item's picture: the wheel drawn from its own numbers, the glow as a lit pad, the smoke as a puff */
  function itemPic(kind, item, carId) {
    if (kind === 'wheels') { const d = wheelDesign(item.id); return d ? wheelIcon(d, 44) : standardIcon(carSpec(carId).wheel, 44); }
    if (kind === 'glow') return item.hex === null ? '<span class="gpic off"></span>' : `<span class="gpic" style="--c:${hexOf(item.hex)}"></span>`;
    return item.hex === null ? '<span class="spic"></span>' : `<span class="spic" style="--c:${hexOf(item.hex)}"></span>`;
  }
  function garage(save, G) {
    const g = G && typeof G === 'object' ? G : { picked: G || null };
    const sel = g.picked || save.car, tab = TABS.some(t => t[0] === g.tab) ? g.tab : 'cars', pre = g.preview || {};
    const car = carById(sel), mine = save.cars[sel], owned = !!mine, chosen = save.car === sel;
    const worn = lookOf(mine);
    const tabs = TABS.map(([id, label]) => `<button type="button" class="tab${id === tab ? ' on' : ''}" data-action="garage-tab" data-arg="${id}">${label}</button>`).join('');
    let pane = '', action = '';
    if (tab === 'cars') {
      pane = '<div class="cards">' + ROSTER.map(c => {
        const own = !!save.cars[c.id];
        return `<button type="button" class="card${c.id === sel ? ' sel' : ''}${own ? ' owned' : ''}" data-action="pick-car" data-arg="${c.id}">
        <span class="swatch" style="background:#${(PAINTS.find(p => p.id === (own ? save.cars[c.id].paint : c.paint)) || PAINTS[0]).hex.toString(16).padStart(6, '0')}"></span>
        <b>${esc(c.name)}</b><small>${own ? (save.car === c.id ? 'chosen' : 'owned') : coin(c.price)}</small>${!own && save.coins < c.price ? `<small class="need">${fmt(c.price - save.coins)} more</small>` : ''}</button>`;
      }).join('') + '</div>';
      if (!owned) action = `<button type="button" class="big primary" data-action="buy-car" data-arg="${sel}" ${save.coins >= car.price ? '' : 'disabled'}><b>BUY</b><small>${coin(car.price)}${save.coins >= car.price ? '' : ' &middot; ' + needed(car.price - save.coins)}</small></button>`;
      else if (!chosen) action = `<button type="button" class="big primary" data-action="choose-car" data-arg="${sel}"><b>DRIVE THIS</b></button>`;
      else action = `<button type="button" class="big" data-action="title"><b>CHOSEN</b><small>back to the title</small></button>`;
    } else if (tab === 'paint') {
      const myPaint = owned ? mine.paint : car.paint, shown = pre.paint || myPaint;
      pane = '<div class="paints">' + PAINTS.map(p => {
        const free = p.id === car.paint || p.id === myPaint;
        return `<button type="button" class="paint${p.id === shown ? ' sel' : ''}${p.id === myPaint ? ' worn' : ''}" data-action="paint" data-arg="${p.id}" style="background:${hexOf(p.hex)}" aria-label="${p.name}">${p.id === myPaint ? '<small>&#10003;</small>' : free ? '' : '<small>' + LOOP.PAINT_PRICE + '</small>'}</button>`;
      }).join('') + '</div>';
      const p = PAINTS.find(q => q.id === shown) || PAINTS[0];
      if (!owned) action = notYours(car);
      else if (shown === myPaint) action = `<div class="note"><b>${esc(p.name.toUpperCase())}</b><small>on the car</small></div>`;
      else action = `<button type="button" class="big primary" data-action="buy-paint" data-arg="${p.id}" ${save.coins >= LOOP.PAINT_PRICE ? '' : 'disabled'}><b>PAINT IT ${esc(p.name.toUpperCase())}</b><small>${coin(LOOP.PAINT_PRICE)}${save.coins >= LOOP.PAINT_PRICE ? '' : ' &middot; ' + needed(LOOP.PAINT_PRICE - save.coins)}</small></button>`;
    } else if (KINDS.includes(tab)) {
      const shown = pre[tab] || worn[tab];
      pane = `<div class="items ${tab}">` + ITEMS[tab].map(it => {
        const have = owned && owns(mine, tab, it.id), on = worn[tab] === it.id && (owned || it.id === STANDARD[tab]), price = priceOf(tab, it.id);
        const state = on ? '<small class="st on">&#10003; WORN</small>' : have ? '<small class="st">OWNED</small>' : it.id === STANDARD[tab] ? '<small class="st">STANDARD</small>' : `<small class="st price">${coin(price)}</small>${save.coins < price ? `<small class="need">${fmt(price - save.coins)} more</small>` : ''}`;
        return `<button type="button" class="item${it.id === shown ? ' sel' : ''}${on ? ' worn' : ''}${have ? ' owned' : ''}" data-action="look" data-arg="${tab}:${it.id}">${itemPic(tab, it, sel)}<b>${esc(it.name)}</b>${state}</button>`;
      }).join('') + '</div>';
      const it = ITEMS[tab].find(i => i.id === shown) || ITEMS[tab][0], price = priceOf(tab, it.id);
      if (!owned) action = notYours(car);
      else if (shown === worn[tab]) action = `<div class="note"><b>${esc(it.name.toUpperCase())}</b><small>on the car</small></div>`;
      else action = `<button type="button" class="big primary" data-action="buy-look" data-arg="${tab}:${it.id}" ${save.coins >= price ? '' : 'disabled'}><b>BUY ${esc(it.name.toUpperCase())}</b><small>${coin(price)}${save.coins >= price ? '' : ' &middot; ' + needed(price - save.coins)}</small></button>`;
    } else {
      pane = owned ? upgrades(save, sel) : '<p class="hintline">Upgrades are bought for a car you own.</p>';
      action = owned ? '' : notYours(car);
    }
    const keep = el.querySelector('.garage .pane'), keepTab = keep ? keep.dataset.tab : null, keepTop = keep ? keep.scrollTop : 0;
    show('garage', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>GARAGE</h2></header>
      <div class="stage"><small class="draghint">drag to turn</small></div>
      <div class="tabs">${tabs}</div>
      <div class="who"><b>${esc(car.name)}</b><small>${esc(car.character)}</small></div>
      <div class="pane" data-tab="${tab}">${pane}</div>
      <div class="act">${action}</div>`);
    if (keepTab === tab) { const now = el.querySelector('.garage .pane'); if (now) now.scrollTop = keepTop; }
  }
  /* a car not owned can be dressed to look at, and bought on the cars section */
  function notYours(car) { return `<button type="button" class="big" data-action="garage-tab" data-arg="cars"><b>NOT YOURS YET</b><small>buy the ${esc(car.name.toLowerCase())} to fit this</small></button>`; }

  /* THE TRACK LAB. L: { settings, seed, code, track, best, ghost, message,
     error, link }. The plan canvas is drawn by the host after show(),
     because it needs to be in the DOM to have a size. */
  const LABELS = { kind: { circuit: 'CIRCUIT', sprint: 'SPRINT' }, length: { short: 'SHORT', medium: 'MEDIUM', long: 'LONG' }, style: { flowing: 'FLOWING', technical: 'TECHNICAL', hairpins: 'HAIRPINS', mixed: 'MIXED' }, theme: { forest: 'FOREST', coastal: 'COAST', desert: 'DESERT', docks: 'DOCKS', mountain: 'ALPINE' }, time: { dusk: 'DUSK', night: 'NIGHT', dawn: 'DAWN', rain: 'RAIN' } };
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
          <div class="coderow"><span class="codelabel">CODE</span><span class="code">${formatCode(L.code)}</span><button type="button" class="mini" data-action="lab-copy">COPY</button><button type="button" class="mini" data-action="lab-link">LINK</button></div>
          ${L.message ? `<p class="status${L.error ? ' bad' : ''}">${esc(L.message)}</p>` : ''}
          ${seg('kind', s, 'track')}
          ${seg('length', s, 'length')}
          ${seg('style', s, 'style')}
          <div class="togs">${toggle('bank', s, 'BANKED CORNERS')}${toggle('cross', s, 'CROSSOVER', crossoverOffered(s))}</div>
          ${seg('theme', s, 'scenery')}
          ${seg('time', s, 'time of day')}
          <form class="coderow entry" data-action="lab-code"><input id="codeIn" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="have a code? type it here" maxlength="16" aria-label="track code"><button type="submit" class="mini" data-action="lab-code">GO</button></form>
        </div>
      </div>
      <div class="row2">
        <button type="button" class="big" data-action="lab-new"><b>NEW LAYOUT</b><small>same settings, another seed</small></button>
        <button type="button" class="big primary" data-action="lab-drive"><b>DRIVE</b><small>${L.best ? 'best ' + fmt(L.best.best) + (L.ghost ? ' &middot; ghost' : '') : t && t.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint'}</small></button>
      </div>`);
  }

  /* A drift race's results (briefs/DRIFT-RACE.md 3; the code says
     battle): who won, both totals, what each part was worth for each car
     (drift, clean, pace, leads, the line, close), the coins, and REMATCH
     and the next thing to do. r: { won, score, rival: { name, total },
     margin, parts, rivalParts, gates, leadGates, rivalGates, lineTo,
     coins, prize, offer, label, name, seconds, best2 } */
  function battleResults(r) {
    const a = '<div class="col a">', b = '</div><div class="col b">', z = '</div>';
    const who = r.won ? 'YOU WIN' : esc(r.rival.name.toUpperCase()) + ' WINS';
    const top = Math.max(1, r.score, r.rival.total), bar = n => Math.max(2, Math.round(n / top * 100));
    const coinsN = FX_ON ? `<b class="coinsN" data-to="${Math.round(r.coins)}">+${fmt(r.coins)}</b>` : `<b>+${fmt(r.coins)}</b>`;
    /* the next rival (briefs/RIVALS-LADDER.md): offered when he is earned, else what still earns him; the rivals screen always */
    const N = r.next, goNext = !!(N && N.id && N.open);
    const next = goNext ? `<button type="button" class="big${r.won ? ' primary' : ''}" data-action="battle" data-arg="${esc(N.id)}"><b>${esc(N.name.toUpperCase())}</b><small>${N.beaten ? 'next, beaten' : 'next rival'}</small></button>` : '';
    const nextLine = !N ? '' : N.last ? `<p class="unlock done">${r.won ? 'The whole ladder is yours' : 'The last rival on the ladder'}</p>`
      : N.open ? (r.offer ? `<p class="unlock done">&#128275; Next rival earned: ${esc(N.name)}</p>` : '')
      : `<p class="unlock nextr">Next, ${esc(N.name)}: ${N.needs.map(n => `<span class="${n.done ? 'done' : ''}">${n.done ? '&#10003;' : '&#9675;'} ${esc(n.text)}</span>`).join(' ')}</p>`;
    /* back into the career from a race (the author, 14 November 2026: he had to go by MENU and CAREER). After a win with no new rival to race, the next track is the main button; otherwise it sits in the row under REMATCH */
    const C = r.career, careerMain = !!(C && r.won && !goNext);
    const rematch = cls => `<button type="button" class="big${cls}" data-action="again"><b>REMATCH</b>${cls === ' primary' || !C ? '<small>DRIFT / BRAKE, Enter or R</small>' : ''}</button>`;
    const careerBtn = cls => C ? `<button type="button" class="big${cls}" data-action="play-career" data-arg="${C.index}"><b>${cls ? 'NEXT TRACK' : 'CAREER'}</b><small>${cls ? esc(C.where) + ' &middot; ' : ''}${esc(C.name)}</small></button>` : '';
    const rivalsBtn = '<button type="button" class="big" data-action="rivals"><b>RIVALS</b></button>', menuBtn = '<button type="button" class="big" data-action="title"><b>MENU</b></button>';
    /* a lost race points at the garage (main.js garageTip): its line takes the next rival's place, and GARAGE takes RIVALS' button, or the main one once it is pushed */
    const T = r.tip, garageBtn = cls => `<button type="button" class="big${cls}" data-action="garage"><b>GARAGE</b>${cls ? '<small>a faster car</small>' : ''}</button>`;
    const main = T && T.push ? garageBtn(' primary') : careerMain ? careerBtn(' primary') : rematch(r.won && goNext ? '' : ' primary');
    const row2 = T && T.push ? rematch('') + careerBtn('') + menuBtn : T ? (C ? careerBtn('') : rivalsBtn) + garageBtn('') + menuBtn : !C ? next + rivalsBtn + menuBtn : careerMain ? rematch('') + rivalsBtn + menuBtn : goNext ? next + careerBtn('') + menuBtn : careerBtn('') + rivalsBtn + menuBtn;
    const P = r.parts || {}, Q = r.rivalParts || {}, gates = Math.max(0, (r.gates || 1) - 1);
    const row = (label, x, y, hint) => `<tr><th>${label}${hint ? ` <small>${hint}</small>` : ''}</th><td>${x}</td><td>${y}</td></tr>`;
    const n = v => fmt(v || 0);
    const table = `<table class="race"><thead><tr><th></th><th class="you">YOU</th><th class="him">${esc(r.rival.name.toUpperCase())}</th></tr></thead><tbody>
      ${row('Drift', n(P.drift), n(Q.drift))}${row('Clean', n(P.clean), n(Q.clean))}${row('Pace', n(P.pace), n(Q.pace))}
      ${row('Led at gates', n(P.leads) + ` <small>${r.leadGates || 0}/${gates}</small>`, n(Q.leads) + ` <small>${r.rivalGates || 0}/${gates}</small>`)}
      ${row('First home', r.lineTo === 'player' ? '+' + n((P.line || 0) + (P.clear || 0)) + (P.clear ? ` <small>${(P.clearS || 0).toFixed(1)} s clear</small>` : '') : '', r.lineTo === 'rival' ? '+' + n(Q.line) : '')}
      ${row('Close', n(P.close), '')}</tbody></table>`;
    show('results', `
      <div class="card split battle${r.won ? ' won' : ' lost'}">${a}
        <p class="runlabel">${esc(r.label)}</p><h2 class="who">${who}</h2><p class="trackname">${esc(r.name)} &middot; most points wins</p>
        <div class="duel">
          <div class="side you"><span class="nm">YOU</span><span class="n">${fmt(r.score)}</span><i style="width:${bar(r.score)}%"></i></div>
          <div class="side him"><span class="nm">${esc(r.rival.name.toUpperCase())}</span><span class="n">${fmt(r.rival.total)}</span><i style="width:${bar(r.rival.total)}%"></i></div>
        </div>
        <p class="margin">${r.won ? (r.margin ? 'by ' + fmt(r.margin) : 'a tie is yours') : fmt(-r.margin) + ' short'}</p>${b}
        ${table}
        <div class="facts"><span>${coinsN}<small>coins${r.prize ? ' &middot; first win +' + fmt(r.prize) : ''}</small></span><span><b>${r.seconds.toFixed(1)} s</b><small>race</small></span><span><b>${r.best2 !== undefined && r.best2 > -1e9 ? (r.best2 >= 0 ? '+' : '') + fmt(r.best2) : ''}</b><small>best margin</small></span></div>
        ${T ? `<p class="unlock tip">${esc(T.text)}</p>` : nextLine}
        ${main}
        <div class="row2">${row2}</div>${z}
      </div>`);
  }

  /* r: { score, best, stars, targets, coins, improved, mode, name, label, seconds, nextIndex, unlock, note, laps, kind, missions, code } */
  function results(r) {
    if (r.battle) return battleResults(r);
    const targets = r.targets.map((t, i) => `<span class="${r.score >= t ? 'on' : 'off'}">&#9733; ${fmt(t)}</span>`).join('');
    /* with the spectacle round on, the card is two columns that sit side
       by side on a short landscape screen (the score on the left, the
       missions and the buttons on the right) and stack as before
       anywhere else; the stars land one at a time and the coins count
       up (main.js starts them, in time with the sounds) */
    const a = FX_ON ? '<div class="col a">' : '', b = FX_ON ? '</div><div class="col b">' : '', z = FX_ON ? '</div>' : '';
    const coinsN = FX_ON ? `<b class="coinsN" data-to="${Math.round(r.coins)}">+${fmt(r.coins)}</b>` : `<b>+${fmt(r.coins)}</b>`;
    show('results', `
      <div class="card${FX_ON ? ' split' : ''}">${a}
        ${r.label ? `<p class="runlabel">${esc(r.label)}</p>` : ''}<h2>${esc(r.name)}</h2>
        <div class="score"><span class="n">${fmt(r.score)}</span><span class="l">points${r.improved ? ' &middot; NEW BEST' : ''}</span></div>
        ${stars(r.stars)}
        <div class="targets">${targets}</div>
        ${r.parts ? `<div class="parts"><span><b>${fmt(r.parts.drift)}</b><small>drift</small></span><span><b>${fmt(r.parts.clean)}</b><small>clean${r.cleanSectors ? ' ' + r.cleanSectors : ''}</small></span><span><b>${fmt(r.parts.pace)}</b><small>pace</small></span></div>` : ''}
        <div class="facts"><span><b>${fmt(r.best)}</b><small>best chain</small></span><span><b>${r.seconds.toFixed(1)} s</b><small>run</small></span><span>${coinsN}<small>coins${r.newStars ? ' &middot; ' + r.newStars + ' new star' + (r.newStars > 1 ? 's' : '') : ''}</small></span></div>${b}
        ${r.missions ? `<div class="missions">${r.missions.map(m => `<span class="${m.done ? 'done' : ''}${m.fresh ? ' fresh' : ''}">${m.done ? '&#10003;' : '&#9671;'} ${esc(m.text)}${m.fresh ? ' <b>+' + m.coins + '</b>' : ''}</span>`).join('')}</div>` : ''}
        ${r.code ? `<div class="coderow"><span class="codelabel">CODE</span><span class="code">${formatCode(r.code)}</span><button type="button" class="mini" data-action="lab-copy">COPY</button><button type="button" class="mini" data-action="lab-link">LINK</button></div>${r.message ? `<p class="status">${esc(r.message)}</p>` : ''}` : ''}
        ${r.unlock ? `<p class="unlock${r.unlock.done ? ' done' : ''}">${r.unlock.done ? '&#128275; ' : ''}${esc(r.unlock.text)}</p>` : ''}
        ${r.note ? `<p class="chapnote">${esc(r.note.text)}</p>` : ''}
        <button type="button" class="big${r.unlock && r.unlock.done ? '' : ' primary'}" data-action="again"><b>GO AGAIN</b><small>DRIFT / BRAKE, Enter or R</small></button>
        <div class="row2">
          ${r.nextIndex !== null && r.nextIndex !== undefined ? `<button type="button" class="big${r.unlock && r.unlock.done ? ' primary' : ''}" data-action="play-career" data-arg="${r.nextIndex}"><b>NEXT</b><small>${esc(CAREER[r.nextIndex].name)}</small></button>` : ''}
          ${r.offer ? `<button type="button" class="big rivalgo" data-action="battle" data-arg="${esc(r.offer.id)}"><b>${esc(r.offer.name.toUpperCase())}</b><small>${r.offer.fresh ? 'race him, just earned' : 'race him'}</small></button>` : ''}
          ${r.code ? `<button type="button" class="big" data-action="lab"><b>LAB</b><small>change the track</small></button>` : ''}
          <button type="button" class="big" data-action="title"><b>MENU</b></button>
        </div>${z}
      </div>`);
  }

  return { el, show, hide, title, career, rivals, park, garage, lab, results, get current() { return current; } };
}

export { fmt };
