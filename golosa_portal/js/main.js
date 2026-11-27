/* Голоса Нижневартовска — общая логика портала */

// Фильтр: вырезаем эмодзи-флаги из текстов
function clean(s){ return String(s == null ? '' : s)
  .replace(/[\u{1F1E6}-\u{1F1FF}]{2}\uFE0F?/gu, '')
  .replace(/\u{1F3F3}\uFE0F?\u200D\u{1F308}\uFE0F?/gu, ''); }

// 1. Анимация счётчиков на главной
const nums = document.querySelectorAll('.num');
if (nums.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.target;
      let cur = 0; const step = Math.max(1, Math.ceil(target / 40));
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur;
      }, 35);
      io.unobserve(el);
    });
  }, {threshold:.5});
  nums.forEach(n => io.observe(n));
}

// 2. Подсветка активного пункта меню
const path = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav a').forEach(a => {
  if (a.getAttribute('href') === path) a.classList.add('active');
});

// 3. Архив: данные из админки (localStorage) или демо-набор
const archGrid = document.getElementById('archGrid');
if (archGrid) {
  const DEFAULT_ITEMS = [
    {id:1, cat:'audio', title:'«Нефть и молодость»', meta:'Буровик Самотлора · 25 мин', img:'samotlor-1969.jpg', media:'demo-interview.wav',
     text:'О первом фонтане на Самотлоре, вагончиках-бытовках и том, как в шестнадцать приехал в тайгу.', soon:true},
    {id:2, cat:'audio', title:'«Первая школа города»', meta:'Учительница · 32 мин', img:'school-first.jpg',
     text:'Как открывали первую школу в посёлке нефтяников и куда ходили на каток в морозы.', soon:true},
    {id:3, cat:'audio', title:'«Обь — наш дом»', meta:'Рыбак-старожил · 18 мин', img:'fishermen.jpg',
     text:'Рыбалка по шукшине, мост через Обь и исчезнувшие улочки старого села.', soon:true},
    {id:4, cat:'photo', title:'Семейный архив Сидоровых', meta:'12 фото · 1955–1975', img:'family.jpg',
     text:'Строительство дома на новой улице, первомайская демонстрация, сплав по Оби.', soon:true},
    {id:5, cat:'photo', title:'Самотлор. Первые буровые (демо-видео)', meta:'8 фото · 1969 · тест плеера', img:'samotlor-1969.jpg', video:'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
     text:'Кадры первостроителя нефтяного месторождения из личного альбома.', soon:true},
    {id:6, cat:'doc', title:'Грамота «Ударник Самотлорстроя»', meta:'Скан · 1974', img:'gramota.jpg',
     text:'Наградной документ семьи участника строительства города.', soon:true},
    {id:7, cat:'doc', title:'Домовая книга посёлка', meta:'Скан · 1968', img:'scan-doc.jpg',
     text:'Домовая книга посёлка нефтяников — редкий документ первых лет.', soon:true}
  ];
  let ITEMS = JSON.parse(localStorage.getItem('nv_archive') || 'null') || DEFAULT_ITEMS;
  window.ARCH_ITEMS = ITEMS;
  // если запущен Node.js-сервер — берём архив из общей базы
  fetch('/api/data').then(r => r.ok ? r.json() : null).then(d => {
    if (d && d.archive){ ITEMS = d.archive; window.ARCH_ITEMS = ITEMS; renderArch('all'); }
  }).catch(() => {});
  const TYPE = {audio:'аудио', photo:'фото', doc:'документ'};

  function renderArch(cat){
    archGrid.innerHTML = '';
    ITEMS.filter(i => cat === 'all' || i.cat === cat).forEach(i => {
      const div = document.createElement('div');
      div.className = 'card arch-card';
      div.innerHTML = `<img src="assets/img/${i.img}" alt="" style="width:100%;border-radius:8px;margin-bottom:10px">
        <h3>${clean(i.title)}</h3><p class="role">${clean(i.meta)}</p>
        <div class="tags"><span class="tag">${TYPE[i.cat]}</span>${i.soon ? '<span class="tag">запись появится после съёмки</span>' : ''}</div>
        ${i.media ? '<audio controls preload="none" src="assets/media/'+i.media+'" style="width:100%;margin-top:8px"></audio>' : ''}
        ${i.video ? '<video controls preload="none" src="'+i.video+'" style="width:100%;border-radius:8px;margin-top:8px"></video>' : ''}
        <p>${clean(i.text)}</p><p class="muted" style="margin-top:8px">Нажмите, чтобы открыть просмотр</p>`;
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => openArch(i.id));
      archGrid.appendChild(div);
    });
  }
  renderArch('all');
  document.getElementById('archFilters').addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#archFilters button').forEach(b => b.classList.remove('on'));
    e.target.classList.add('on');
    renderArch(e.target.dataset.cat);
  });
}

// 4. Рабочая форма «Контакты»: Node API (если сервер запущен) или localStorage
async function sendForm(e){
  e.preventDefault();
  const name = document.getElementById('fname').value.trim();
  const topic = document.getElementById('ftopic').value;
  const text = document.getElementById('fmsg').value.trim();
  if (!name || !text) return false;

  const note = document.getElementById('formNote');
  let saved = false;
  try {
    const r = await fetch('/api/messages', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name: clean(name), topic: clean(topic), text: clean(text)})});
    saved = r.ok;
  } catch { saved = false; }

  if (!saved) { // статический режим: localStorage
    const msgs = JSON.parse(localStorage.getItem('nv_msgs') || '[]');
    msgs.push({name, topic, text, date: new Date().toLocaleString('ru-RU')});
    localStorage.setItem('nv_msgs', JSON.stringify(msgs));
  }

  const email = JSON.parse(localStorage.getItem('nv_email') || 'null') || 'project@school-nv.ru';
  const subject = encodeURIComponent('[' + topic + '] от ' + name);
  const bodyMail = encodeURIComponent(text + '\n\n— ' + name);
  note.innerHTML = 'Сообщение сохранено в панели управления (admin.html, раздел «Сообщения»). ' +
    '<a href="mailto:' + email + '?subject=' + subject + '&body=' + bodyMail + '">Открыть письмо в почтовом приложении →</a>';
  e.target.reset();
  return false;
}

// 5. Регистрация Service Worker (PWA, офлайн-режим)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
