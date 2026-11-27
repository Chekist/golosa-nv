/* Панель управления порталом «Голоса Нижневартовска» (localStorage) */

const LS = {
  points: 'nv_points', arch: 'nv_archive', msgs: 'nv_msgs', pwd: 'nv_pwd', email: 'nv_email'
};
const DEFAULT_PWD = 'golosa2027';

const get = (k, d) => JSON.parse(localStorage.getItem(k) || 'null') ?? d;
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ===== Слой хранения: Node API (если сервер запущен) или localStorage ===== */
let API = false;
async function checkApi(){
  try { const r = await fetch('/api/health'); API = r.ok; } catch { API = false; }
  return API;
}
async function stPoints(){ 
  if (await checkApi()){ const r = await fetch('/api/data').then(r=>r.json()); return r.points || POINTS; }
  return get(LS.points, POINTS);
}
async function stSavePoints(p){
  if (API){ await fetch('/api/data', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({points:p})}); }
  else set(LS.points, p);
}
async function stArchive(){
  if (await checkApi()){ const r = await fetch('/api/data').then(r=>r.json()); return r.archive || DEFAULT_ARCH; }
  return get(LS.arch, DEFAULT_ARCH);
}
async function stSaveArchive(a){
  if (API){ await fetch('/api/data', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({archive:a})}); }
  else set(LS.arch, a);
}
async function stMsgs(){
  if (await checkApi()) return await fetch('/api/messages').then(r=>r.json());
  return get(LS.msgs, []);
}
async function stClearMsgs(){
  if (await checkApi()) await fetch('/api/messages', {method:'DELETE'});
  else set(LS.msgs, []);
}
async function stMarks(){
  if (await checkApi()) return await fetch('/api/marks').then(r => r.ok ? r.json() : []);
  return get('nv_marks', []);
}
async function stDeleteMark(id){
  if (API){ await fetch('/api/marks/' + id, {method:'DELETE'}); }
  else set('nv_marks', get('nv_marks', []).filter(m => m.id !== id));
}
async function stClearMarks(){
  if (API){
    const all = await fetch('/api/marks').then(r=>r.json());
    for (const m of all) await fetch('/api/marks/' + m.id, {method:'DELETE'});
  } else set('nv_marks', []);
}
const stEmail = () => get(LS.email, null) || 'project@school-nv.ru';

/* ---------- Вход ---------- */
function doLogin(e){
  e.preventDefault();
  const pwd = document.getElementById('pwd').value;
  if (pwd === (get(LS.pwd, null) || DEFAULT_PWD)){
    sessionStorage.setItem('nv_auth', '1');
    showPanel();
  } else {
    document.getElementById('loginErr').textContent = 'Неверный пароль. Попробуйте ещё раз.';
  }
  return false;
}
function showPanel(){
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  renderAll();
}
if (sessionStorage.getItem('nv_auth') === '1') showPanel();

/* ---------- Вкладки ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  document.getElementById('tab-' + b.dataset.tab).classList.add('on');
}));

/* ---------- Точки карты ---------- */
async function livePoints(){ return await stPoints(); }

async function renderPoints(){
  const box = document.getElementById('pointsList');
  box.innerHTML = '';
  (await livePoints()).forEach(p => {
    const div = document.createElement('div');
    div.className = 'row-item';
    div.innerHTML = `<b>${p.id}. ${p.title}</b><span class="muted">${p.year} · ${p.category}${p.route ? ' · маршрут ' + p.route : ''}</span>
      <button class="btn mini" onclick="editPoint(${p.id})">Изм.</button>
      <button class="btn mini danger" onclick="delPoint(${p.id})">Удал.</button>`;
    box.appendChild(div);
  });
}

async function savePoint(e){
  e.preventDefault();
  const pts = await livePoints();
  const id = document.getElementById('p_id').value;
  const obj = {
    id: id ? +id : (pts.length ? Math.max(...pts.map(p => p.id)) + 1 : 1),
    title: document.getElementById('p_title').value,
    year: document.getElementById('p_year').value,
    coords: [+document.getElementById('p_lat').value, +document.getElementById('p_lon').value],
    category: document.getElementById('p_cat').value,
    img: document.getElementById('p_img').value || 'pier-1909.jpg',
    route: document.getElementById('p_route').value ? +document.getElementById('p_route').value : null,
    text: document.getElementById('p_text').value
  };
  const i = pts.findIndex(p => p.id === obj.id);
  if (i >= 0) pts[i] = obj; else pts.push(obj);
  await stSavePoints(pts);
  resetPointForm(); renderPoints();
  alert('Точка сохранена. Изменения видны на map.html.');
  return false;
}
async function editPoint(id){
  const p = (await livePoints()).find(x => x.id === id);
  if (!p) return;
  document.getElementById('p_id').value = p.id;
  document.getElementById('p_title').value = p.title;
  document.getElementById('p_year').value = p.year;
  document.getElementById('p_lat').value = p.coords[0];
  document.getElementById('p_lon').value = p.coords[1];
  document.getElementById('p_cat').value = p.category;
  document.getElementById('p_img').value = p.img;
  document.getElementById('p_route').value = p.route || '';
  document.getElementById('p_text').value = p.text;
  document.getElementById('pointFormTitle').textContent = 'Изменить точку №' + p.id;
  window.scrollTo(0, 0);
}
async function delPoint(id){
  if (!confirm('Удалить точку №' + id + '?')) return;
  await stSavePoints((await livePoints()).filter(p => p.id !== id));
  renderPoints();
}
function resetPointForm(){
  document.getElementById('pointFormTitle').textContent = 'Добавить точку';
  ['p_id','p_title','p_year','p_lat','p_lon','p_img','p_route','p_text'].forEach(i => document.getElementById(i).value = '');
}

/* ---------- Архив ---------- */
const DEFAULT_ARCH = [
  {id:1, cat:'audio', title:'«Нефть и молодость»', meta:'Буровик Самотлора · 25 мин', img:'samotlor-1969.jpg', text:'О первом фонтане на Самотлоре, вагончиках-бытовках и том, как в шестнадцать приехал в тайгу.', soon:true},
  {id:2, cat:'audio', title:'«Первая школа города»', meta:'Учительница · 32 мин', img:'school-first.jpg', text:'Как открывали первую школу в посёлке нефтяников и куда ходили на каток в морозы.', soon:true},
  {id:3, cat:'audio', title:'«Обь — наш дом»', meta:'Рыбак-старожил · 18 мин', img:'fishermen.jpg', text:'Рыбалка по шукшине, мост через Обь и исчезнувшие улочки старого села.', soon:true},
  {id:4, cat:'photo', title:'Семейный архив Сидоровых', meta:'12 фото · 1955–1975', img:'family.jpg', text:'Строительство дома на новой улице, первомайская демонстрация, сплав по Оби.', soon:true},
  {id:5, cat:'photo', title:'Самотлор. Первые буровые', meta:'8 фото · 1969', img:'samotlor-1969.jpg', text:'Кадры первостроителя нефтяного месторождения из личного альбома.', soon:true},
  {id:6, cat:'doc', title:'Грамота «Ударник Самотлорстроя»', meta:'Скан · 1974', img:'gramota.jpg', text:'Наградной документ семьи участника строительства города.', soon:true},
  {id:7, cat:'doc', title:'Домовая книга посёлка', meta:'Скан · 1968', img:'scan-doc.jpg', text:'Домовая книга посёлка нефтяников — редкий документ первых лет.', soon:true}
];
async function liveArch(){ return await stArchive(); }

async function renderArch(){
  const box = document.getElementById('archList');
  box.innerHTML = '';
  (await liveArch()).forEach(a => {
    const div = document.createElement('div');
    div.className = 'row-item';
    div.innerHTML = `<b>${a.title}</b><span class="muted">${a.cat} · ${a.meta}</span>
      <button class="btn mini" onclick="editArch(${a.id})">Изм.</button>
      <button class="btn mini danger" onclick="delArch(${a.id})">Удал.</button>`;
    box.appendChild(div);
  });
}
async function saveArch(e){
  e.preventDefault();
  const arr = await liveArch();
  const editId = +document.getElementById('a_id').value;
  if (editId){
    const i = arr.findIndex(a => a.id === editId);
    if (i >= 0){
      arr[i] = {...arr[i], cat: document.getElementById('a_cat').value, title: document.getElementById('a_title').value,
                meta: document.getElementById('a_meta').value, img: document.getElementById('a_img').value || arr[i].img,
                media: document.getElementById('a_media').value || null,
                video: document.getElementById('a_video').value || null,
                text: document.getElementById('a_text').value};
      await stSaveArchive(arr);
      ['a_id','a_title','a_meta','a_img','a_media','a_video','a_text'].forEach(x => document.getElementById(x).value = '');
      document.getElementById('archFormTitle').textContent = 'Добавить запись';
      renderArch();
      return false;
    }
  }
  arr.push({
    id: arr.length ? Math.max(...arr.map(a => a.id)) + 1 : 1,
    cat: document.getElementById('a_cat').value,
    title: document.getElementById('a_title').value,
    meta: document.getElementById('a_meta').value,
    img: document.getElementById('a_img').value || 'family.jpg',
    media: document.getElementById('a_media').value || null,
    video: document.getElementById('a_video').value || null,
    text: document.getElementById('a_text').value,
    soon: true
  });
  await stSaveArchive(arr);
  ['a_title','a_meta','a_img','a_media','a_video','a_text'].forEach(i => document.getElementById(i).value = '');
  renderArch();
  return false;
}
async function editArch(id){
  const a = (await liveArch()).find(x => x.id === id);
  if (!a) return;
  document.getElementById('a_id').value = a.id;
  document.getElementById('a_title').value = a.title;
  document.getElementById('a_meta').value = a.meta;
  document.getElementById('a_cat').value = a.cat;
  document.getElementById('a_img').value = a.img;
  document.getElementById('a_media').value = a.media || '';
  document.getElementById('a_video').value = a.video || '';
  document.getElementById('a_text').value = a.text;
  document.getElementById('archFormTitle').textContent = 'Изменить запись №' + a.id;
  window.scrollTo(0, document.body.scrollHeight);
}
function resetArchForm(){
  document.getElementById('archFormTitle').textContent = 'Добавить запись';
  ['a_id','a_title','a_meta','a_img','a_media','a_video','a_text'].forEach(x => document.getElementById(x).value = '');
}
async function delArch(id){
  if (!confirm('Удалить запись?')) return;
  await stSaveArchive((await liveArch()).filter(a => a.id !== id));
  renderArch();
}

/* ---------- Сообщения ---------- */
async function renderMsgs(){
  const msgs = await stMsgs();
  document.getElementById('msgCount').textContent = msgs.length ? '(' + msgs.length + ')' : '';
  const box = document.getElementById('msgsList');
  box.innerHTML = msgs.length ? '' : '<p class="muted">Пока нет сообщений. Они появятся после отправки формы на странице «Контакты».</p>';
  [...msgs].reverse().forEach(m => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom = '10px';
    div.innerHTML = `<b>${m.name}</b> <span class="muted">· ${m.topic} · ${m.date}</span><p style="margin-top:6px">${m.text}</p>`;
    box.appendChild(div);
  });
}
async function clearMsgs(){
  if (!confirm('Удалить все сообщения?')) return;
  await stClearMsgs(); renderMsgs();
}

/* ---------- Настройки ---------- */
function saveSettings(e){
  e.preventDefault();
  const p = document.getElementById('s_pwd').value;
  const em = document.getElementById('s_email').value;
  if (p) set(LS.pwd, p);
  if (em) set(LS.email, em);
  alert('Настройки сохранены.');
  return false;
}
function resetAll(){
  if (!confirm('Все изменения (точки, архив, сообщения, настройки) будут удалены. Продолжить?')) return;
  Object.values(LS).forEach(k => localStorage.removeItem(k));
  location.reload();
}

async function renderMarksAdmin(){
  const marks = await stMarks();
  document.getElementById('marksCount').textContent = marks.length ? '(' + marks.length + ')' : '';
  const box = document.getElementById('marksAdmin');
  box.innerHTML = marks.length ? '' : '<p class="muted">Отметок нет.</p>';
  [...marks].reverse().forEach(m => {
    const div = document.createElement('div');
    div.className = 'row-item';
    div.innerHTML = `<b>${m.title}</b><span class="muted">${m.author || 'аноним'} · ${m.date || ''} · [${(m.coords||[]).map(n=>n.toFixed(4)).join(', ')}]</span>
      <button class="btn mini danger" onclick="delMarkAdmin(${m.id})">Удал.</button>`;
    box.appendChild(div);
  });
}
async function delMarkAdmin(id){ if (confirm('Удалить отметку?')){ await stDeleteMark(id); renderMarksAdmin(); } }
async function clearMarksAdmin(){ if (confirm('Удалить ВСЕ отметки?')){ await stClearMarks(); renderMarksAdmin(); } }
function renderAll(){ renderPoints(); renderArch(); renderMsgs(); renderMarksAdmin(); }
// индикатор режима хранения
checkApi().then(on => {
  const el = document.querySelector('#adminPanel .tabs');
  if (el){ const s = document.createElement('span'); s.className='stat';
    s.style.marginLeft='10px'; s.textContent = on ? 'режим: Node.js сервер (общая база)' : 'режим: локальное хранилище браузера';
    el.appendChild(s); }
});
