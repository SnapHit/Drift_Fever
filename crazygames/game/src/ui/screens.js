/* THE SCREENS. Title, career, garage and results, as plain DOM over the
   canvas, each rebuilt from the save when shown. Every button carries a
   data-action and an optional data-arg, and one click handler hands them
   to the host. Big targets for thumbs: everything is reachable in
   390x844 portrait and in landscape. No images, no fonts, system text. */
import { ROSTER, PAINTS, carById } from '../garage/roster.js';
import { CAREER, careerUnlocked, careerStars } from '../loop/modes.js';
import { LOOP } from '../tune.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stars = (n, dim) => '<span class="stars' + (dim ? ' dim' : '') + '">' + [0, 1, 2].map(i => '<span class="' + (i < n ? 'on' : 'off') + '">&#9733;</span>').join('') + '</span>';
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function createScreens(root, onAction) {
  const el = document.createElement('div');
  el.id = 'screens';
  root.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    e.preventDefault();
    onAction(b.dataset.action, b.dataset.arg);
  });
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
      <h1><span>DRIFT</span><span>FEVER</span></h1>
      <p class="sub">${info.standIn ? 'test track build' : 'CrazyGames edition'}${info.storage ? '' : ' <em>(no memory on this device)</em>'}</p>
      <div class="menu">
        <button type="button" class="big primary" data-action="daily"><b>DAILY DRIFT</b><small>${esc(info.dailyName)} ${info.dailyKind}${daily ? ' &middot; best ' + fmt(daily.best) + ' ' + stars(daily.stars, true) : ''}</small></button>
        <button type="button" class="big" data-action="career"><b>CAREER</b><small>${total} of ${CAREER.length * 3} stars</small></button>
        <button type="button" class="big" data-action="free"><b>FREE DRIFT</b><small>the car park, no timer</small></button>
        <button type="button" class="big" data-action="garage"><b>GARAGE</b><small>${esc(carById(save.car).name)}</small></button>
      </div>
      <p class="hint">Steer left and right. DRIFT throws the tail out; DRIFT with no steering stops. The car drives itself.</p>`);
  }

  function career(save) {
    const rows = CAREER.map((c, i) => {
      const e = save.career[String(i)], open = careerUnlocked(save, i);
      return `<button type="button" class="row${open ? '' : ' locked'}" data-action="play-career" data-arg="${i}" ${open ? '' : 'disabled'}>
        <span class="n">${i + 1}</span>
        <span class="name"><b>${esc(c.name)}</b><small>${c.kind === 'circuit' ? LOOP.LAPS + ' laps' : 'sprint'}${e && e.best ? ' &middot; best ' + fmt(e.best) : ''}</small></span>
        ${open ? stars(e ? e.stars : 0) : '<span class="lock">&#128274;</span>'}
      </button>`;
    }).join('');
    show('career', `${coins(save)}<header><button type="button" class="back" data-action="title">&#9664;</button><h2>CAREER</h2></header><div class="list">${rows}</div>`);
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
      <div class="detail"><h3>${esc(car.name)}</h3><p>${esc(car.character)}</p><div class="paints">${paints}</div>${action}</div>`);
  }

  /* r: { score, best, stars, targets, coins, improved, mode, name, seconds, nextIndex, laps, kind } */
  function results(r) {
    const targets = r.targets.map((t, i) => `<span class="${r.score >= t ? 'on' : 'off'}">&#9733; ${fmt(t)}</span>`).join('');
    show('results', `
      <div class="card">
        <h2>${esc(r.name)}</h2>
        <div class="score"><span class="n">${fmt(r.score)}</span><span class="l">points${r.improved ? ' &middot; NEW BEST' : ''}</span></div>
        ${stars(r.stars)}
        <div class="targets">${targets}</div>
        <div class="facts"><span><b>${fmt(r.best)}</b><small>best chain</small></span><span><b>${r.seconds.toFixed(1)} s</b><small>run</small></span><span><b>+${fmt(r.coins)}</b><small>coins</small></span></div>
        <button type="button" class="big primary" data-action="again"><b>GO AGAIN</b><small>DRIFT, Enter or R</small></button>
        <div class="row2">
          ${r.nextIndex !== null && r.nextIndex !== undefined ? `<button type="button" class="big" data-action="play-career" data-arg="${r.nextIndex}"><b>NEXT</b><small>${esc(CAREER[r.nextIndex].name)}</small></button>` : ''}
          <button type="button" class="big" data-action="title"><b>MENU</b></button>
        </div>
      </div>`);
  }

  return { el, show, hide, title, career, garage, results, get current() { return current; } };
}

export { fmt };
