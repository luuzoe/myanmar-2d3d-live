const YGN = 'Asia/Yangon';
const $ = id => document.getElementById(id);

function fmtDate(iso) {
  // iso "2026-10-12" -> "12/10/2026"
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function tickClock() {
  $('clock').textContent = new Date().toLocaleString('en-GB', {
    timeZone: YGN, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }) + ' (မြန်မာ)';
}
setInterval(tickClock, 1000); tickClock();

let nextDrawAt = null;
function tickCountdown() {
  if (!nextDrawAt) return;
  const diff = nextDrawAt - Date.now();
  const el = $('countdown');
  if (diff <= 0) { el.innerHTML = '⏳ မဲဖောက်ချိန် ရောက်နေပါပြီ — ရလဒ် မကြာခင်…'; return; }
  const h = Math.floor(diff / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
  const p = n => String(n).padStart(2, '0');
  el.innerHTML = `⏳ နောက်ထပ် <b>${nextDrawLabel}</b> မဲအတွက် <b>${p(h)}:${p(m)}:${p(s)}</b> ကျန်ပါတယ်`;
}
let nextDrawLabel = '';
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
    const isHoliday = rec && rec.status === 'holiday';
    subEl.innerHTML = `${cutoffLabel} မှာ ထွက်ပါမယ်<br>${badge(rec)}`;
  }
}

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

    // history table
    const tb = document.querySelector('#history-table tbody');
    tb.innerHTML = '';
    const freq = {};
    (d.history || []).forEach(h => {
      const mc = h.morning && h.morning.number ? h.morning.number : '–';
      const ec = h.evening && h.evening.number ? h.evening.number : '–';
      [h.morning, h.evening].forEach(s => {
        if (s && s.number) freq[s.number] = (freq[s.number] || 0) + 1;
      });
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${fmtDate(h.date)}</td><td class="num">${mc}</td><td class="num">${ec}</td>`;
      tb.appendChild(tr);
    });
    if (!(d.history || []).length) tb.innerHTML = '<tr><td colspan="3">မှတ်တမ်း မရှိသေးပါ</td></tr>';

    // frequency grid
    const fg = $('freqgrid');
    fg.innerHTML = '';
    const max = Math.max(1, ...Object.values(freq));
    for (let i = 0; i < 100; i++) {
      const n = String(i).padStart(2, '0');
      const c = freq[n] || 0;
      const div = document.createElement('div');
      div.className = 'fcell' + (c >= max * 0.7 && c > 0 ? ' hot' : '');
      div.innerHTML = `<b>${n}</b><span>${c} ကြိမ်</span>`;
      fg.appendChild(div);
    }

    if (d.updated_at) {
      const u = new Date(d.updated_at).toLocaleString('en-GB', { timeZone: YGN, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      $('updated').textContent = 'နောက်ဆုံး အပ်ဒိတ်: ' + u + ' (မြန်မာစံတော်ချိန်)';
    }
  } catch (e) {
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
      $('sub-3d').innerHTML = `ပထမဆု ${last.first_prize} · ${fmtDate(last.date)}<br><span class="badge final">✅ ထွက်ပြီးပါပြီ</span>`;
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
