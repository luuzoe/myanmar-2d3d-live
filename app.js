const YGN = 'Asia/Yangon';
const $ = id => document.getElementById(id);

// service worker (offline shell + faster repeat loads)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function tickClock() {
  $('clock').textContent = new Date().toLocaleString('en-GB', {
    timeZone: YGN, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }) + ' (မြန်မာ)';
}
setInterval(tickClock, 1000); tickClock();

let nextDrawAt = null, nextDrawLabel = '';
function tickCountdown() {
  if (!nextDrawAt) return;
  const diff = nextDrawAt - Date.now();
  const el = $('countdown');
  if (diff <= 0) { el.innerHTML = '⏳ မဲဖောက်ချိန် ရောက်နေပါပြီ — ရလဒ် မကြာခင်…'; return; }
  const h = Math.floor(diff / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
  const p = n => String(n).padStart(2, '0');
  el.innerHTML = `⏳ နောက်ထပ် <b>${nextDrawLabel}</b> မဲအတွက် <b>${p(h)}:${p(m)}:${p(s)}</b> ကျန်ပါတယ်`;
}
setInterval(tickCountdown, 1000);

function badge(rec) {
  if (!rec) return '<span class="badge wait">⏳ မကျသေးပါ</span>';
  if (rec.status === 'holiday') return '<span class="badge holiday">ပိတ်ရက်</span>';
  if (rec.status === 'live') return '<span class="badge live">🔴 တိုက်ရိုက်</span>';
  return '<span class="badge final">✅ ထွက်ပြီးပါပြီ</span>';
}

function renderCard(prefix, rec, cutoffLabel) {
  const numEl = $('num-' + prefix), subEl = $('sub-' + prefix);
  if (rec && rec.number) {
    numEl.textContent = rec.number;
    subEl.innerHTML = `SET ${rec.set} · ${rec.time}<br>${badge(rec)}`;
  } else {
    numEl.textContent = '--';
    subEl.innerHTML = `${cutoffLabel} မှာ ထွက်ပါမယ်<br>${badge(rec)}`;
  }
}

function copyText(t, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '✅ ကူးပြီးပြီ'; setTimeout(() => btn.textContent = o, 1500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done).catch(() => fallbackCopy(t, done));
  } else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement('textarea');
  ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta); done();
}

// ---------- calendar ----------
const MM_MONTHS = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','ဩဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ'];
const MM_DOW = ['တနင်္လာ','အင်္ဂါ','ဗုဒ္ဓဟူး','ကြာသပတေး','သောကြာ','စနေ','တနင်္ဂနွေ'];
let historyData = [], calY = 0, calM = 0, minY = 0, minM = 0;

function ygnParts(d) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: YGN, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-');
  return { y: +p[0], m: +p[1] };
}
function renderCalendar() {
  const grid = $('calgrid'); grid.innerHTML = '';
  $('cal-title').textContent = `${MM_MONTHS[calM - 1]} ${calY}`;
  MM_DOW.forEach(d => { const e = document.createElement('div'); e.className = 'dow'; e.textContent = d; grid.appendChild(e); });
  const map = {};
  historyData.forEach(h => map[h.date] = h);
  const first = new Date(Date.UTC(calY, calM - 1, 1));
  let startDow = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(calY, calM, 0)).getUTCDate();
  for (let i = 0; i < startDow; i++) { const e = document.createElement('div'); e.className = 'calcell empty'; grid.appendChild(e); }
  const nowP = ygnParts(new Date());
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calY}-${String(calM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const h = map[iso];
    const cell = document.createElement('div');
    cell.className = 'calcell' + ((calY === nowP.y && calM === nowP.m && d === nowP.d) ? ' today' : '');
    const m = h && h.morning && h.morning.number ? h.morning.number : '–';
    const e = h && h.evening && h.evening.number ? h.evening.number : '–';
    cell.innerHTML = `<div class="d">${d}</div><div class="n"><small>မ</small>${m} <small>ည</small>${e}</div>`;
    grid.appendChild(cell);
  }
  $('cal-prev').disabled = (calY === minY && calM === minM);
  const cur = ygnParts(new Date());
  $('cal-next').disabled = (calY === cur.y && calM === cur.m);
}
$('cal-prev').addEventListener('click', () => { calM--; if (calM < 1) { calM = 12; calY--; } renderCalendar(); });
$('cal-next').addEventListener('click', () => { calM++; if (calM > 12) { calM = 1; calY++; } renderCalendar(); });

// ---------- digit analysis ----------
function renderDigits(history) {
  const first = Array(10).fill(0), second = Array(10).fill(0);
  history.forEach(h => {
    [h.morning, h.evening].forEach(s => {
      if (s && s.number && s.number.length === 2) {
        first[+s.number[0]]++; second[+s.number[1]]++;
      }
    });
  });
  [['digit-first', first], ['digit-second', second]].forEach(([id, arr]) => {
    const el = $(id); el.innerHTML = '';
    const mx = Math.max(1, ...arr);
    arr.forEach((c, d) => {
      const cell = document.createElement('div');
      cell.className = 'dcell';
      cell.innerHTML = `<b>${d}</b><span>${c} ကြိမ်</span><i style="width:${Math.round(c / mx * 100)}%"></i>`;
      el.appendChild(cell);
    });
  });
}

// ---------- share ----------
function setupShare(today) {
  const url = 'https://luuzoe.github.io/myanmar-2d3d-live/';
  const m = today.morning && today.morning.number ? today.morning.number : '–';
  const e = today.evening && today.evening.number ? today.evening.number : '–';
  const text = `🇲🇲 မြန်မာ 2D ရလဒ် (${fmtDate(today.date)})\n🌅 မနက်: ${m} | 🌇 ညနေ: ${e}\n👇 အသေးစိတ်`;
  const eu = encodeURIComponent(url), et = encodeURIComponent(text);
  $('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${eu}`;
  $('share-tg').href = `https://t.me/share/url?url=${eu}&text=${et}`;
  $('share-viber').href = `viber://forward?text=${et}%0A${eu}`;
  $('share-copy').addEventListener('click', ev => copyText(url, ev.target));
  const cardText = s => `🇲🇲 2D (${fmtDate(today.date)}) ${s === 'morning' ? 'မနက် 12:01' : 'ညနေ 16:30'}: ${today[s] && today[s].number ? today[s].number : 'မထွက်သေးပါ'}`;
  $('copy-morning').addEventListener('click', ev => copyText(cardText('morning'), ev.target));
  $('copy-evening').addEventListener('click', ev => copyText(cardText('evening'), ev.target));
}

// ---------- main load ----------
async function load2d() {
  try {
    const r = await fetch('data/2d.json?t=' + Date.now());
    const d = await r.json();
    const m = d.market || {};
    $('market-status').innerHTML = m.open
      ? '🟢 <b style="color:#3fb950">စျေးကွက်ဖွင့်နေသည်</b>'
      : '🔴 စျေးကွက်ပိတ်ထားသည်';
    $('set-now').textContent = m.set_now != null ? `SET ${m.set_now}` : '';

    const t = d.today || {};
    $('today-date').textContent = t.date ? '(' + fmtDate(t.date) + ')' : '';
    renderCard('morning', t.morning, '12:01');
    renderCard('evening', t.evening, '16:30');

    if (d.next_draw) {
      nextDrawAt = new Date(d.next_draw.at).getTime();
      nextDrawLabel = d.next_draw.label;
      tickCountdown();
    }

    historyData = d.history || [];
    const tb = document.querySelector('#history-table tbody');
    tb.innerHTML = '';
    const freq = {};
    historyData.forEach(h => {
      const mc = h.morning && h.morning.number ? h.morning.number : '–';
      const ec = h.evening && h.evening.number ? h.evening.number : '–';
      [h.morning, h.evening].forEach(s => { if (s && s.number) freq[s.number] = (freq[s.number] || 0) + 1; });
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${fmtDate(h.date)}</td><td class="num">${mc}</td><td class="num">${ec}</td>`;
      tb.appendChild(tr);
    });
    if (!historyData.length) tb.innerHTML = '<tr><td colspan="3">မှတ်တမ်း မရှိသေးပါ</td></tr>';

    const fg = $('freqgrid'); fg.innerHTML = '';
    const max = Math.max(1, ...Object.values(freq));
    for (let i = 0; i < 100; i++) {
      const n = String(i).padStart(2, '0');
      const c = freq[n] || 0;
      const div = document.createElement('div');
      div.className = 'fcell' + (c >= max * 0.7 && c > 0 ? ' hot' : '');
      div.innerHTML = `<b>${n}</b><span>${c} ကြိမ်</span>`;
      fg.appendChild(div);
    }

    renderDigits(historyData);

    // calendar init
    const cur = ygnParts(new Date());
    calY = cur.y; calM = cur.m;
    if (historyData.length) {
      const first = historyData[historyData.length - 1].date.split('-');
      minY = +first[0]; minM = +first[1];
    } else { minY = calY; minM = calM; }
    renderCalendar();

    setupShare(t);

    if (d.updated_at) {
      const u = new Date(d.updated_at).toLocaleString('en-GB', { timeZone: YGN, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      $('updated').textContent = 'နောက်ဆုံး အပ်ဒိတ်: ' + u + ' (မြန်မာစံတော်ချိန်)';
    }
  } catch (err) {
    $('statusbar').innerHTML = '<span>⚠️ ဒေတာ ရယူမရပါ — ခဏနေပြန်စမ်းပါ</span>';
  }
}

async function load3d() {
  try {
    const r = await fetch('data/3d.json?t=' + Date.now());
    const d = await r.json();
    const last = (d.draws || [])[0];
    if (last) {
      $('num-3d').textContent = last.three_d;
      $('sub-3d').innerHTML = `ပထမဆု ${last.first_prize}${last.last_two ? ` · နောက်ဆုံး ၂ လုံး ${last.last_two}` : ''} · ${fmtDate(last.date)}<br><span class="badge final">✅ ထွက်ပြီးပါပြီ</span>`;
    }
    if (d.next_draw) {
      const nd = new Date(d.next_draw + 'T15:00:00+06:30').getTime();
      const diff = nd - Date.now();
      const el = $('countdown-3d');
      if (diff > 0) {
        const days = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000);
        el.innerHTML = `⏳ နောက်ထပ် 3D မဲ (<b>${fmtDate(d.next_draw)}</b>) အတွက် <b>${days}</b> ရက် <b>${h}</b> နာရီ ကျန်ပါတယ်`;
      } else {
        el.innerHTML = `⏳ 3D မဲ (<b>${fmtDate(d.next_draw)}</b>) ရလဒ် မကြာခင်…`;
      }
    }
  } catch (e) { /* keep placeholder */ }
}

load2d(); load3d();
setInterval(load2d, 60000);
