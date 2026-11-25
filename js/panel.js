/* FENOMEN NEXT — değerlendirme paneli
   ------------------------------------------------------------------
   İki rol var:
     eleyici → bütün başvuruları görür, "geçti / kararsız / elendi" der
     jüri    → eleyicinin işaretlediği adayları görür, "geçti / geçmedi" der

   Rol denetimi TARAYICIDA DEĞİL sunucuda. Buradaki gizlemeler sadece
   arayüzü sadeleştirmek için; veriyi görünümler ve RLS koruyor.
   Jüri, adayın telefonunu/e-postasını istese de çekemez — o alanlar
   jüri görünümünde yok. */

const VERI = {
  adres:   'https://bezwdlxombiirihxomnv.supabase.co',
  anahtar: 'sb_publishable_vRdeq7GR8RblkbUe60SrSw_aFkl6xhe'
};

/* Jüri puan vermez, yalnız karar verir. Eski 1-10 ölçüt sütunları tabloda duruyor, kullanılmıyor. */
const KARARLAR = [
  ['gecti',   'Geçti'],
  ['gecmedi', 'Geçmedi']
];
const KARAR_AD = Object.fromEntries(KARARLAR);

const DURUMLAR = [
  ['hepsi',    'Hepsi'],
  ['yeni',     'Bakılmadı'],
  ['gecti',    'Geçti'],
  ['kararsiz', 'Kararsız'],
  ['elendi',   'Elendi']
];

/* Jüri ekranındaki ve sonuç tablosundaki aday grupları. */
const JURI_GRUP = [
  ['gecti',    'Geçti'],
  ['kararsiz', 'Kararsız'],
  ['elendi',   'Elendi']
];

let st = {
  jeton: null, tazeleme: null, uid: null, rol: null, ad: null, eposta: null,
  sekme: null, suzgec: 'yeni', arama: '', sonucGrup: 'gecti',
  oynat: null,   /* sırayla izle: { ids: [...], i: 0 } — girerken süzgecin anlık listesi */
  basvurular: [], puanlar: [], kisiler: []
};

/* ---------- küçük yardımcılar ---------- */
const $  = s => document.querySelector(s);
const el = id => document.getElementById(id);

function kacar(m){
  return String(m == null ? '' : m)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function yas(dogum){
  if (!dogum) return null;
  const d = new Date(dogum), b = new Date();
  let y = b.getFullYear() - d.getFullYear();
  const a = b.getMonth() - d.getMonth();
  if (a < 0 || (a === 0 && b.getDate() < d.getDate())) y--;
  return y;
}

function tarih(t){
  if (!t) return '';
  return new Date(t).toLocaleDateString('tr-TR', {day:'numeric', month:'long'});
}

/* JWT'nin ortasındaki bilgi kutusunu okur — imzayı doğrulamaz,
   yalnızca "bu jeton kimin" sorusuna cevap almak için. Yetki kararı
   her zaman sunucuda veriliyor. */
function jetonCoz(jeton){
  try {
    const g = jeton.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(escape(atob(g))));
  } catch { return {}; }
}

/* ---------- sunucuyla konuşma ---------- */
async function istek(yol, secenek = {}, tekrar = true){
  const c = await fetch(VERI.adres + yol, {
    ...secenek,
    headers: {
      'apikey': VERI.anahtar,
      'Authorization': 'Bearer ' + (st.jeton || VERI.anahtar),
      'Content-Type': 'application/json',
      ...(secenek.headers || {})
    }
  });

  /* Oturum süresi dolduysa bir kez tazeleyip aynı isteği tekrarla.
     Jüri bir videoyu uzun uzun izlerken jeton ölüyordu. */
  if (c.status === 401 && tekrar && st.tazeleme){
    if (await jetonTazele()) return istek(yol, secenek, false);
  }
  return c;
}

async function jetonTazele(){
  const c = await fetch(VERI.adres + '/auth/v1/token?grant_type=refresh_token', {
    method:'POST',
    headers:{'apikey':VERI.anahtar,'Content-Type':'application/json'},
    body: JSON.stringify({ refresh_token: st.tazeleme })
  });
  if (!c.ok){ cikis(); return false; }
  const d = await c.json();
  oturumYaz(d);
  return true;
}

function oturumYaz(d){
  st.jeton    = d.access_token;
  st.tazeleme = d.refresh_token;
  st.uid      = jetonCoz(d.access_token).sub || null;
  try {
    localStorage.setItem('next_oturum', JSON.stringify({
      j: d.access_token, t: d.refresh_token
    }));
  } catch { /* gizli sekmede yazamayabilir, sorun değil */ }
}

function cikis(){
  st = { ...st, jeton:null, tazeleme:null, uid:null, rol:null, oynat:null, sonucGorur:false, yetkililer:[], basvurular:[], puanlar:[], kisiler:[] };
  kirli.clear(); clearTimeout(kayitZaman); el('icerik').onclick = null;
  try { localStorage.removeItem('next_oturum'); } catch {}
  el('panel').classList.add('gizli');
  el('girisEkran').style.display = '';
}

/* ---------- giriş ---------- */
el('girisForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const btn = el('girisBtn'), hata = el('girisHata');
  hata.classList.remove('gorunur');
  btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';

  try {
    const c = await fetch(VERI.adres + '/auth/v1/token?grant_type=password', {
      method:'POST',
      headers:{'apikey':VERI.anahtar,'Content-Type':'application/json'},
      body: JSON.stringify({ email: el('eposta').value.trim(), password: el('sifre').value })
    });
    if (!c.ok) throw new Error('giris');
    oturumYaz(await c.json());
    await baslat();
  } catch {
    hata.textContent = 'E-posta veya şifre hatalı.';
    hata.classList.add('gorunur');
  } finally {
    btn.disabled = false; btn.textContent = 'Giriş yap';
  }
});

el('cikisBtn').addEventListener('click', async () => {
  if (!(await juriKaydet()) && !confirm('Son kararlar kaydedilemedi. Yine de çıkılsın mı?')) return;
  cikis();
});

/* ---------- açılış ---------- */
async function baslat(){
  const c = await istek('/rest/v1/fenomen_next_yetkililer?select=uid,rol,ad,eposta,aktif,sonuc_gorur');
  const satirlar = c.ok ? await c.json() : [];
  const ben = satirlar.find(s => s.uid === st.uid);

  if (!ben || !ben.aktif){
    cikis();
    const hata = el('girisHata');
    hata.textContent = 'Bu hesabın panele erişim yetkisi yok.';
    hata.classList.add('gorunur');
    return;
  }

  st.rol = ben.rol; st.ad = ben.ad; st.eposta = ben.eposta;
  st.sonucGorur = !!ben.sonuc_gorur;
  st.suzgec = st.rol === 'eleyici' ? 'yeni' : 'hepsi';

  el('girisEkran').style.display = 'none';
  el('panel').classList.remove('gizli');
  el('rolRozet').textContent = st.rol === 'eleyici' ? 'Eleyici' : 'Jüri';
  el('kimYazi').textContent  = ben.ad || ben.eposta;

  sekmeleriKur();
  await veriYukle();
}

function sekmeleriKur(){
  const liste = st.rol === 'eleyici'
    ? [['eleme','Eleme'], ...(st.sonucGorur ? [['sonuc','Jüri sonuçları']] : []), ['kisiler','Kişiler']]
    : JURI_GRUP;
  st.sekme = liste[0][0];
  el('sekmeler').innerHTML = liste
    .map(([id,ad]) => `<button class="sekme" data-sekme="${id}">${ad}</button>`).join('');
  el('sekmeler').querySelectorAll('.sekme').forEach(b =>
    b.addEventListener('click', () => {
      if (juriSekmede()) juriKaydet();
      st.sekme = b.dataset.sekme; st.oynat = null;
      el('icerik').onclick = null;
      /* Jüriler puan verdikçe sıralama değişir; sekme her açılışta taze veri çeker. */
      if (st.sekme === 'sonuc') veriYukle(); else ciz();
    }));
}

async function veriYukle(){
  el('icerik').innerHTML = '<div class="yukleniyor">Yükleniyor…</div>';
  const gorunum = st.rol === 'eleyici' ? 'next_eleme' : 'next_juri';

  const [b, p, y] = await Promise.all([
    istek(`/rest/v1/${gorunum}?select=*&order=sira_no`),
    istek('/rest/v1/fenomen_next_puanlar?select=*'),
    st.sonucGorur ? istek('/rest/v1/fenomen_next_yetkililer?select=uid,rol,ad,eposta') : null
  ]);
  st.basvurular = b.ok ? await b.json() : [];
  st.puanlar    = p.ok ? await p.json() : [];
  if (y && y.ok) st.yetkililer = await y.json();
  ciz();
}

const juriSekmede = () => JURI_GRUP.some(([id]) => id === st.sekme);
const grupListe = g => st.basvurular.filter(k => k.durum === g);

/* ---------- çizim ---------- */
function ciz(){
  el('sekmeler').querySelectorAll('.sekme').forEach(b => {
    b.classList.toggle('aktif', b.dataset.sekme === st.sekme);
    const g = st.rol === 'juri' && JURI_GRUP.find(([id]) => id === b.dataset.sekme);
    if (g) b.textContent = `${g[1]} · ${grupListe(g[0]).length}`;
  });

  if (st.sekme === 'eleme')       st.oynat ? cizOynat() : cizEleme();
  if (juriSekmede())              st.oynat ? cizJuriOynat() : cizDegerlendirme();
  if (st.sekme === 'sonuc')       cizSonuc();
  if (st.sekme === 'kisiler')     cizKisiler();
}

/* Adayın gönderdiği linkten Drive dosya kimliğini çıkarır.
   Drive üç ayrı biçim üretiyor; üçünü de karşılıyoruz. Sunum/doküman
   bağlantıları bilerek dışarıda — onlar kayıt değil. */
function driveKimlik(a){
  if (/\/(presentation|document|spreadsheets|forms)\//.test(a)) return null;
  const m = a.match(/\/file\/d\/([\w-]{10,})/)
        || a.match(/[?&]id=([\w-]{10,})/)
        || a.match(/\/d\/([\w-]{25,})/);
  return m ? m[1] : null;
}

function youtubeKimlik(a){
  const m = a.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function videoKutu(k, otomatik){
  const a  = k.kayit_adresi || '';
  const ac = a ? `<a class="video-ac" href="${kacar(a)}" target="_blank" rel="noopener">Kaynağı yeni sekmede aç →</a>` : '';

  /* Kendi arşivimize aldığımız kopya varsa önce o oynar. Birden çok dosya
     gönderenlerin kopyası Drive klasörü: video_dosya = 'klasor:<kimlik>'. */
  const arsiv = k.video_dosya || '';
  if (arsiv.startsWith('klasor:')) return klasorKutu(arsiv.slice(7), ac);
  const drive = arsiv || driveKimlik(a);
  if (drive){
    return `<iframe class="video" src="https://drive.google.com/file/d/${kacar(drive)}/preview" allow="autoplay" referrerpolicy="no-referrer"></iframe>
      <div class="video-not">Oynatıcı boş kalıyorsa dosyanın paylaşım izni kapalı demektir.</div>${ac}`;
  }

  const yt = youtubeKimlik(a);
  if (yt){
    return `<iframe class="video" src="https://www.youtube-nocookie.com/embed/${kacar(yt)}${otomatik ? '?autoplay=1' : ''}" allow="autoplay" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>${ac}`;
  }

  /* Klasör gönderenler: Drive'ın gömülebilir klasör görünümü. Dosyaya
     tıklayınca Drive yeni sekmede açar. */
  const klasor = a.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/);
  if (klasor) return klasorKutu(klasor[1], ac);

  const sp = a.match(/open\.spotify\.com\/(episode|track)\/(\w+)/);
  if (sp){
    return `<iframe class="video" style="aspect-ratio:auto;height:232px" src="https://open.spotify.com/embed/${sp[1]}/${sp[2]}" allow="autoplay; encrypted-media"></iframe>${ac}`;
  }

  const ig = a.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
  if (ig){
    return `<iframe class="video" style="aspect-ratio:9/15;max-height:72vh;width:auto;display:block;margin:0 auto" src="https://www.instagram.com/${ig[1]}/${ig[2]}/embed"></iframe>${ac}`;
  }

  if (!a) return `<div class="video-yok">Kayıt bağlantısı yok.</div>`;

  const sunum = /\/(presentation|document|spreadsheets|forms)\//.test(a);
  return `<div class="video-yok">
      ${sunum ? 'Aday kayıt yerine bir sunum/doküman göndermiş.' : 'Bu kayıt panelde oynatılamıyor.'}<br>
      <a href="${kacar(a)}" target="_blank" rel="noopener" style="text-decoration:underline">Bağlantıyı yeni sekmede aç →</a>
    </div>`;
}

function klasorKutu(id, ac){
  return `<iframe class="video" style="background:#fff" src="https://drive.google.com/embeddedfolderview?id=${kacar(id)}#list"></iframe>
    <div class="video-not">Aday birden çok dosya göndermiş — dosyaya tıklayınca yeni sekmede açılır. Liste boşsa klasörün izni kapalı.</div>${ac}`;
}

function suzulmus(){
  let l = st.basvurular;
  if (st.suzgec !== 'hepsi') l = l.filter(k => (k.durum || 'yeni') === st.suzgec);
  if (st.arama){
    const a = st.arama.toLocaleLowerCase('tr');
    l = l.filter(k => (k.ad + ' ' + k.sehir + ' ' + (k.program_adi || ''))
      .toLocaleLowerCase('tr').includes(a));
  }
  return l;
}

/* ---------- ELEME (eleyici) ---------- */
function cizEleme(){
  const say = d => st.basvurular.filter(k => d === 'hepsi' || (k.durum || 'yeni') === d).length;

  const suzgec = `<div class="suzgec">
    ${DURUMLAR.map(([id,ad]) =>
      `<button class="sz ${st.suzgec===id?'aktif':''}" data-sz="${id}">${ad}<b>${say(id)}</b></button>`).join('')}
    <div class="ara"><input type="text" id="araKutu" placeholder="Ad, şehir, program…" value="${kacar(st.arama)}"></div>
    <button class="btn btn-sm btn-kirmizi" id="oynatBtn">▶ Sırayla izle</button>
  </div>`;

  const liste = suzulmus();
  const kartlar = liste.length
    ? liste.map(kartEleme).join('')
    : '<div class="bos">Bu süzgeçte başvuru yok.</div>';

  el('icerik').innerHTML = suzgec + kartlar;
  suzgecBagla();

  const ob = el('oynatBtn');
  ob.disabled = !liste.length;
  ob.addEventListener('click', () => { st.oynat = { ids: liste.map(k => k.id), i: 0 }; ciz(); scrollTo(0, 0); });

  el('icerik').querySelectorAll('[data-durum]').forEach(b =>
    b.addEventListener('click', () => durumVer(b.dataset.id, b.dataset.durum)));
}

function kartEleme(k){
  const d = k.durum || 'yeni';
  const y = yas(k.dogum);
  const puanli = k.puan_sayisi > 0;

  return `<div class="kart">
    <div class="kart-bas">
      <div class="no">${String(k.sira_no).padStart(3,'0')}</div>
      <div>
        <div class="kart-ad">${kacar(k.ad)}</div>
        <div class="kart-alt">${kacar(k.sehir)}${y!=null?` · ${y} yaşında`:''} · ${tarih(k.olusturuldu)} · ${kacar(k.eposta)}</div>
      </div>
      <div class="kart-sag">
        ${puanli ? `<span class="durum">${k.puan_sayisi} jüri oyu</span>` : ''}
        <span class="durum ${d}">${({yeni:'Bakılmadı',gecti:'Geçti',kararsiz:'Kararsız',elendi:'Elendi'})[d]}</span>
      </div>
    </div>

    <div class="kart-govde">
      <div>
        <div class="soru">
          <div class="etkt">Kendini nasıl anlatıyor</div>
          <p>${kacar(k.tanitim)}</p>
        </div>
        <div class="soru">
          <div class="etkt">Program adı</div>
          <p>${kacar(k.program_adi)}</p>
        </div>
        ${k.sosyal ? `<div class="soru"><div class="etkt">Sosyal medya</div><p>${kacar(k.sosyal)}</p></div>` : ''}
      </div>
      <div>${videoKutu(k)}</div>
    </div>

    <div class="kart-ayak">
      <button class="btn btn-sm ${d==='gecti'?'btn-koyu':''}"    data-durum="gecti"    data-id="${k.id}">Geçti</button>
      <button class="btn btn-sm ${d==='kararsiz'?'btn-koyu':''}" data-durum="kararsiz" data-id="${k.id}">Kararsız</button>
      <button class="btn btn-sm ${d==='elendi'?'btn-koyu':''}"   data-durum="elendi"   data-id="${k.id}">Elendi</button>
      ${d!=='yeni' ? `<button class="btn btn-sm" data-durum="yeni" data-id="${k.id}">Geri al</button>` : ''}
      <div class="onay-iz">
        Onaylar:
        <span class="${k.onay_tanitim?'var':''}">tanıtım ${k.onay_tanitim?'✓':'—'}</span>
        <span class="${k.onay_ileti?'var':''}">ileti ${k.onay_ileti?'✓':'—'}</span>
        ${k.onay_veli ? '<span class="var">veli ✓</span>' : ''}
      </div>
    </div>
  </div>`;
}

async function durumVer(id, durum){
  const k = st.basvurular.find(x => x.id === id);
  if (durum === 'yeni' && k && k.puan_sayisi > 0){
    if (!confirm(`${k.ad} için ${k.puan_sayisi} jüri oyu verilmiş. Listeden çıkarırsanız jüri bu adayı göremeyecek. Devam edilsin mi?`)) return;
  }

  const c = await istek('/rest/v1/rpc/next_durum_ver', {
    method:'POST', body: JSON.stringify({ p_id: id, p_durum: durum })
  });
  if (!c.ok){ alert('Durum değiştirilemedi. Sayfayı yenileyip tekrar deneyin.'); return; }
  if (k) k.durum = durum;
  /* Sırayla izlerken yalnız oy düğmeleri yenilenir; video baştan başlamasın. */
  if (st.oynat && el('oynOy')) el('oynOy').innerHTML = oyAlani(k);
  else ciz();
}

/* ---------- SIRAYLA İZLE (eleyici) ----------
   Süzgeçteki adaylar tek tek, büyük oynatıcıyla. Liste girişte
   sabitlenir: "Bakılmadı"da oy verilen aday listeden kaybolmaz,
   geri dönüp kararı değiştirmek mümkün. */
const DURUM_AD = { yeni:'Bakılmadı', gecti:'Geçti', kararsiz:'Kararsız', elendi:'Elendi' };

function cizOynat(){
  const o = st.oynat, n = o.ids.length;
  const ust = (sayac) => `<div class="oyn-ust">
      <button class="btn btn-sm" data-oyn="kapat">← Listeye dön</button>
      <span class="oyn-sayac">${sayac}</span>
      <span class="oyn-ipucu"><kbd>←</kbd> <kbd>→</kbd> gezin · <kbd>1</kbd> Geçti · <kbd>2</kbd> Kararsız · <kbd>3</kbd> Elendi · <kbd>0</kbd> Geri al · <kbd>Esc</kbd> liste</span>
    </div>`;

  if (o.i >= n){
    const say = d => o.ids.filter(id => (st.basvurular.find(x => x.id === id)?.durum || 'yeni') === d).length;
    el('icerik').innerHTML = ust(`${n} / ${n}`) + `<div class="bos">
        Bu listenin sonuna geldin.<br>
        <span style="font-size:13.5px">Geçti ${say('gecti')} · Kararsız ${say('kararsiz')} · Elendi ${say('elendi')} · Bakılmadı ${say('yeni')}</span><br><br>
        <button class="btn btn-sm" data-oyn="onceki">← Son adaya dön</button>
        <button class="btn btn-sm btn-koyu" data-oyn="kapat">Listeye dön</button>
      </div>`;
    oynatBagla();
    return;
  }

  const k = st.basvurular.find(x => x.id === o.ids[o.i]);
  const y = yas(k.dogum);

  el('icerik').innerHTML = ust(`${o.i + 1} <small>/ ${n}</small>`) + `
    <div class="oyn">
      <div>${videoKutu(k, true)}</div>
      <div class="oyn-bilgi">
        <div class="no">${String(k.sira_no).padStart(3,'0')}</div>
        <div class="kart-ad">${kacar(k.ad)}</div>
        <div class="kart-alt">${kacar(k.sehir)}${y!=null?` · ${y} yaşında`:''} · ${tarih(k.olusturuldu)}</div>
        <div class="oyn-metin">
          <div class="soru"><div class="etkt">Program adı</div><p>${kacar(k.program_adi)}</p></div>
          <div class="soru"><div class="etkt">Kendini nasıl anlatıyor</div><p>${kacar(k.tanitim)}</p></div>
          ${k.sosyal ? `<div class="soru"><div class="etkt">Sosyal medya</div><p>${kacar(k.sosyal)}</p></div>` : ''}
        </div>
        <div id="oynOy">${oyAlani(k)}</div>
        <div class="oyn-gez">
          <button class="btn btn-sm" data-oyn="onceki" ${o.i === 0 ? 'disabled' : ''}>← Önceki</button>
          <button class="btn btn-sm" data-oyn="sonraki">Sonraki →</button>
        </div>
      </div>
    </div>`;
  oynatBagla();
}

function oyAlani(k){
  const d = k.durum || 'yeni';
  const tus = (id, ad, kisa) =>
    `<button class="btn ${id} ${d===id?'secili':''}" data-durum="${id}" data-id="${k.id}">${ad}<kbd>${kisa}</kbd></button>`;
  return `<div class="oyn-oy">${tus('gecti','Geçti',1)}${tus('kararsiz','Kararsız',2)}${tus('elendi','Elendi',3)}</div>
    <div style="font-size:12.5px;color:var(--gri);margin-top:8px">Şu an: <b>${DURUM_AD[d]}</b>
      ${d!=='yeni' ? ` · <a href="#" data-durum="yeni" data-id="${k.id}">geri al</a>` : ''}</div>`;
}

function oynatBagla(){
  /* Oy düğmeleri yeniden çizildiği için tıklama üst kapta dinleniyor. */
  el('icerik').onclick = ev => {
    const b = ev.target.closest('[data-oyn],[data-durum]');
    if (!b || !st.oynat) return;
    ev.preventDefault();
    if (b.dataset.durum) durumVer(b.dataset.id, b.dataset.durum);
    else oynatGit(b.dataset.oyn);
  };
}

async function oynatGit(ne){
  const juri = juriSekmede();
  if (juri){ clearTimeout(kayitZaman); }
  if (ne === 'kapat'){
    /* Kaydedilemeyen puan varken listeye dönülmez; ekranda hata kalır. */
    if (juri && !(await juriKaydet())) return;
    if (!st.oynat) return;
    st.oynat = null; el('icerik').onclick = null; ciz(); return;
  }
  if (juri) juriKaydet();
  const o = st.oynat;
  const yeni = ne === 'sonraki' ? Math.min(o.i + 1, o.ids.length) : Math.max(o.i - 1, 0);
  if (yeni === o.i) return;
  o.i = yeni; ciz();
}

document.addEventListener('keydown', ev => {
  if (st.oynat && juriSekmede()) return juriTus(ev);
  if (!st.oynat || st.sekme !== 'eleme') return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  const k = st.basvurular.find(x => x.id === st.oynat.ids[st.oynat.i]);
  const oy = { '1':'gecti', '2':'kararsiz', '3':'elendi', '0':'yeni' }[ev.key];
  if (ev.key === 'ArrowRight')     oynatGit('sonraki');
  else if (ev.key === 'ArrowLeft') oynatGit('onceki');
  else if (ev.key === 'Escape')    oynatGit('kapat');
  else if (oy && k)                durumVer(k.id, oy);
  else return;
  ev.preventDefault();
});

/* Videoya tıklayınca klavye odağı oynatıcıya (başka siteye) geçiyor ve
   ok tuşları bize ulaşmıyor. Tıklama oynatıcıya iletildikten sonra odağı geri al. */
window.addEventListener('blur', () => {
  if (!st.oynat) return;
  setTimeout(() => {
    const a = document.activeElement;
    if (a && a.tagName === 'IFRAME') a.blur();
  }, 0);
});

function suzgecBagla(){
  el('icerik').querySelectorAll('[data-sz]').forEach(b =>
    b.addEventListener('click', () => { st.suzgec = b.dataset.sz; ciz(); }));
  const a = el('araKutu');
  if (a){
    a.addEventListener('input', () => {
      st.arama = a.value;
      clearTimeout(a._z);
      a._z = setTimeout(() => { ciz(); const y = el('araKutu'); if (y){ y.focus(); y.selectionStart = y.value.length; } }, 250);
    });
  }
}

/* ---------- DEĞERLENDİRME (jüri) ---------- */
function cizDegerlendirme(){
  const liste = grupListe(st.sekme);
  if (!liste.length){
    el('icerik').innerHTML = `<div class="bos">Bu sekmede aday yok.</div>`;
    return;
  }

  const biten = liste.filter(k => puanTamam(benimPuan(k.id))).length;
  const kalan = liste.length - biten;
  const basla = !biten ? 'Sırayla izle ve karar ver' : kalan ? 'Kaldığın yerden devam et' : 'Baştan gözden geçir';

  el('icerik').innerHTML =
    `<div class="uyari jo-bas"><span>Toplam <b>${liste.length}</b> aday · karar verilen: <b>${biten}</b> · kalan: <b>${kalan}</b></span>
      <button class="btn btn-sm btn-kirmizi" id="juriBasla">▶ ${basla}</button></div>` +
    liste.map(kartJuri).join('');

  el('juriBasla').addEventListener('click', () => {
    const ids = liste.map(k => k.id);
    st.oynat = { ids, i: Math.max(0, ids.findIndex(id => !puanTamam(benimPuan(id)))) };
    ciz(); scrollTo(0, 0);
  });

  el('icerik').querySelectorAll('[data-karar]').forEach(b =>
    b.addEventListener('click', () => {
      const kart = b.closest('.kart');
      kart.querySelectorAll('[data-karar]').forEach(x => x.classList.toggle('secili', x === b));
      kart.dataset.karar = b.dataset.karar;
    }));

  el('icerik').querySelectorAll('[data-kaydet]').forEach(b =>
    b.addEventListener('click', () => puanKaydet(b.dataset.kaydet, b)));
}

const kararRozet = karar => karar
  ? `<span class="durum ${karar === 'gecti' ? 'gecti' : 'elendi'}">${KARAR_AD[karar]}</span>` : '';

const kararTuslari = (p, kisayol) => `<div class="oyn-oy iki">${KARARLAR.map(([id, ad], j) =>
  `<button type="button" class="btn ${id} ${p.karar === id ? 'secili' : ''}" data-karar="${id}">${ad}${kisayol ? `<kbd>${j + 1}</kbd>` : ''}</button>`).join('')}</div>`;

function kartJuri(k){
  const p = benimPuan(k.id) || {};

  return `<div class="kart" data-kart="${k.id}" data-karar="${p.karar || ''}">
    <div class="kart-bas">
      <div class="no">${String(k.sira_no).padStart(3,'0')}</div>
      <div>
        <div class="kart-ad">${kacar(k.ad)}</div>
        <div class="kart-alt">${kacar(k.sehir)} · ${kacar(k.program_adi)}</div>
      </div>
      <div class="kart-sag">${kararRozet(p.karar)}</div>
    </div>

    <div class="kart-govde">
      <div>
        <div class="soru">
          <div class="etkt">Kendini nasıl anlatıyor</div>
          <p>${kacar(k.tanitim)}</p>
        </div>
        <div style="margin-bottom:14px">${kararTuslari(p, false)}</div>
        <div class="alan" style="margin-bottom:0">
          <label>Notunuz <span style="text-transform:none;letter-spacing:0;font-weight:400">— isteğe bağlı</span></label>
          <textarea rows="2" data-not>${kacar(p.notlar || '')}</textarea>
        </div>
      </div>
      <div>${videoKutu(k)}</div>
    </div>

    <div class="kart-ayak">
      <button class="btn btn-sm btn-kirmizi" data-kaydet="${k.id}">${p.karar ? 'Güncelle' : 'Kararı kaydet'}</button>
      <span class="onay-iz" data-iz="${k.id}"></span>
    </div>
  </div>`;
}

async function puanKaydet(id, btn){
  const kart = el('icerik').querySelector(`[data-kart="${id}"]`);
  const iz   = kart.querySelector('[data-iz]');
  const karar = kart.dataset.karar;
  if (!karar){ iz.textContent = 'Önce Geçti ya da Geçmedi seçin.'; return; }

  const kayit = { basvuru_id: id, juri_uid: st.uid, karar,
                  notlar: kart.querySelector('[data-not]').value.trim() || null };

  btn.disabled = true; iz.textContent = 'Kaydediliyor…';
  /* on_conflict şart: PostgREST birleştirmeyi varsayılan olarak birincil anahtara
     göre yapıyor, o da her seferinde yeni satır demek. Aday+jüri çifti üzerinden
     birleştirilmezse jüri kararını her güncelleyişinde çakışma hatası alıyor. */
  const c = await istek('/rest/v1/fenomen_next_puanlar?on_conflict=basvuru_id,juri_uid', {
    method:'POST',
    headers:{ 'Prefer':'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(kayit)
  });
  btn.disabled = false;

  if (!c.ok){ iz.textContent = 'Kaydedilemedi, tekrar deneyin.'; return; }
  const [yeni] = await c.json();
  const i = st.puanlar.findIndex(p => p.basvuru_id === id && p.juri_uid === st.uid);
  if (i >= 0) st.puanlar[i] = yeni; else st.puanlar.push(yeni);

  iz.textContent = 'Kaydedildi ✓';
  btn.textContent = 'Güncelle';
  kart.querySelector('.kart-sag').innerHTML = kararRozet(karar);
}

/* ---------- SIRAYLA İZLE VE KARAR VER (jüri) ----------
   Video çalarken karar verilir, her karar kendiliğinden kaydedilir.
   Kayıtlar tek sırayla gider: yavaş kalan eski istek yeni kararı ezmesin. */
const kirli = new Set();
let kayitSuruyor = null, kayitHata = false, kayitZaman = null;

const benimPuan = id => st.puanlar.find(p => p.basvuru_id === id && p.juri_uid === st.uid);
const puanTamam = p => !!p && !!p.karar;

function juriKaydet(){
  clearTimeout(kayitZaman);
  if (!kayitSuruyor){
    kayitHata = false;
    kayitSuruyor = (async () => {
      while (kirli.size){
        const id = kirli.values().next().value;
        kirli.delete(id);
        const p = benimPuan(id);
        if (!p) continue;
        const kayit = { basvuru_id: id, juri_uid: st.uid, karar: p.karar || null,
                        notlar: (p.notlar || '').trim() || null };

        let tamam = false;
        try {
          const c = await istek('/rest/v1/fenomen_next_puanlar?on_conflict=basvuru_id,juri_uid', {
            method:'POST',
            headers:{ 'Prefer':'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(kayit)
          });
          tamam = c.ok;
        } catch { /* bağlantı koptu; aşağıda sıraya geri alınıyor */ }

        if (!st.uid) { kirli.clear(); break; }
        if (!tamam){ kirli.add(id); kayitHata = true; break; }
      }
      return !kirli.size;
    })().finally(() => { kayitSuruyor = null; juriDurum(); });
  }
  juriDurum();
  return kayitSuruyor;
}

function puanKirlet(id, ms){
  kirli.add(id);
  juriDurum();
  clearTimeout(kayitZaman);
  kayitZaman = setTimeout(juriKaydet, ms);
}

function benimSatir(id){
  let p = benimPuan(id);
  if (!p){ p = { basvuru_id: id, juri_uid: st.uid }; st.puanlar.push(p); }
  return p;
}

function juriDurum(){
  const d = el('joKayit');
  if (!d || !st.oynat) return;
  const id = st.oynat.ids[st.oynat.i], p = benimPuan(id), tamam = puanTamam(p);
  d.innerHTML = kayitHata
    ? `<span class="jo-hata">Kaydedilemedi.</span> <a href="#" data-oyn="kaydet">Tekrar dene</a>`
    : kirli.size || kayitSuruyor ? 'Kaydediliyor…'
    : tamam ? 'Kaydedildi ✓ · <kbd>→</kbd> sonraki aday'
    : p ? 'Kaydedildi ✓' : 'Kararın otomatik kaydedilir.';
  const s = el('joSonraki');
  if (s) s.classList.toggle('btn-kirmizi', tamam);
  const say = el('joTamam');
  if (say) say.textContent = st.oynat.ids.filter(x => puanTamam(benimPuan(x))).length;
}

function cizJuriOynat(){
  const o = st.oynat, n = o.ids.length;
  const biten = o.ids.filter(id => puanTamam(benimPuan(id))).length;
  const ust = sayac => `<div class="oyn-ust">
      <button class="btn btn-sm" data-oyn="kapat">← Listeye dön</button>
      <span class="oyn-sayac">${sayac} <small>· karar verilen <span id="joTamam">${biten}</span></small></span>
      <span class="oyn-ipucu"><kbd>1</kbd> geçti · <kbd>2</kbd> geçmedi · <kbd>←</kbd> <kbd>→</kbd> aday · <kbd>Esc</kbd> liste</span>
    </div>`;

  if (o.i >= n){
    const ilkEksik = o.ids.findIndex(id => !puanTamam(benimPuan(id)));
    el('icerik').innerHTML = ust(`${n} / ${n}`) + `<div class="bos">
        ${ilkEksik < 0 ? 'Bütün adaylara karar verdin, teşekkürler.' : 'Listenin sonuna geldin.'}<br>
        <span style="font-size:13.5px">Karar verilen ${biten} · Bekleyen ${n - biten}</span><br>
        <span id="joKayit" style="font-size:13px"></span><br><br>
        <button class="btn btn-sm" data-oyn="onceki">← Son adaya dön</button>
        ${ilkEksik >= 0 ? `<button class="btn btn-sm btn-kirmizi" data-oyn="eksik">Karar verilmemiş ilk adaya git</button>` : ''}
        <button class="btn btn-sm btn-koyu" data-oyn="kapat">Listeye dön</button>
      </div>`;
    juriBagla(null);
    juriDurum();
    return;
  }

  const k = st.basvurular.find(x => x.id === o.ids[o.i]);
  const p = benimPuan(k.id) || {};

  el('icerik').innerHTML = ust(`${o.i + 1} <small>/ ${n}</small>`) + `
    <div class="oyn oyn-juri">
      <div class="jo-sol">
        <div class="jo-video">${videoKutu(k, true)}</div>
        <div class="jo-alt">
          <div class="alan jo-not">
            <label for="joNot">Notunuz <span style="text-transform:none;letter-spacing:0;font-weight:400">— isteğe bağlı</span></label>
            <textarea id="joNot" rows="2">${kacar(p.notlar || '')}</textarea>
          </div>
          <div>
            <div class="jo-kayit" id="joKayit"></div>
            <div class="oyn-gez">
              <button class="btn btn-sm" data-oyn="onceki" ${o.i === 0 ? 'disabled' : ''}>← Önceki</button>
              <button class="btn btn-sm" id="joSonraki" data-oyn="sonraki">Sonraki →</button>
            </div>
          </div>
        </div>
      </div>
      <div class="oyn-bilgi">
        <div class="jo-kim">
          <div class="no">${String(k.sira_no).padStart(3,'0')}</div>
          <div>
            <div class="kart-ad">${kacar(k.ad)}</div>
            <div class="kart-alt">${kacar(k.sehir)} · ${kacar(k.program_adi)}</div>
          </div>
        </div>
        <details class="jo-tanitim"><summary>Kendini nasıl anlatıyor</summary><p>${kacar(k.tanitim)}</p></details>
        <div id="joPuan">${kararTuslari(p, true)}</div>
      </div>
    </div>`;
  juriBagla(k);
  juriDurum();
}

function juriBagla(k){
  el('icerik').onclick = ev => {
    const b = ev.target.closest('[data-karar],[data-oyn]');
    if (!b || !st.oynat) return;
    if (b.tagName === 'A') ev.preventDefault();
    if (b.dataset.karar && k) kararVer(k, b.dataset.karar);
    else if (b.dataset.oyn === 'kaydet') juriKaydet();
    else if (b.dataset.oyn === 'eksik'){
      st.oynat.i = st.oynat.ids.findIndex(id => !puanTamam(benimPuan(id)));
      ciz();
    }
    else if (b.dataset.oyn) oynatGit(b.dataset.oyn);
  };
  const not = el('joNot');
  if (not && k) not.addEventListener('input', () => {
    benimSatir(k.id).notlar = not.value;
    puanKirlet(k.id, 700);
  });
}

/* Karar verince yalnız düğmeler yenilenir; video yeniden yüklenmez. */
function kararVer(k, karar){
  benimSatir(k.id).karar = karar;
  el('joPuan').innerHTML = kararTuslari(benimPuan(k.id), true);
  puanKirlet(k.id, 300);
}

function juriTus(ev){
  if (ev.key === 'Escape' && ev.target.tagName === 'TEXTAREA'){ ev.target.blur(); ev.preventDefault(); return; }
  if (ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;

  const o = st.oynat;
  const k = st.basvurular.find(x => x.id === o.ids[o.i]);
  const karar = { '1':'gecti', '2':'gecmedi' }[ev.key];

  if (ev.key === 'ArrowRight')     oynatGit('sonraki');
  else if (ev.key === 'ArrowLeft') oynatGit('onceki');
  else if (ev.key === 'Escape')    oynatGit('kapat');
  else if (!k) return;
  else if (karar){ if (!ev.repeat) kararVer(k, karar); }
  else return;
  ev.preventDefault();
}

window.addEventListener('beforeunload', ev => {
  if (kirli.size || kayitSuruyor) ev.preventDefault();
});

/* ---------- JÜRİ SONUÇLARI (eleyici) ---------- */
function cizSonuc(){
  const adaylar = grupListe(st.sonucGrup);
  const grupTus = `<div class="suzgec">${JURI_GRUP.map(([id, ad]) =>
    `<button class="sz ${st.sonucGrup === id ? 'aktif' : ''}" data-grup="${id}">${ad}<b>${grupListe(id).length}</b></button>`).join('')}</div>`;
  const grupBagla = () => el('icerik').querySelectorAll('[data-grup]').forEach(b =>
    b.addEventListener('click', () => { st.sonucGrup = b.dataset.grup; cizSonuc(); }));

  if (!adaylar.length){
    el('icerik').innerHTML = grupTus + '<div class="bos">Bu grupta aday yok.</div>';
    grupBagla();
    return;
  }

  const juriler = st.yetkililer.filter(y => y.rol === 'juri')
    .sort((a,b) => (a.ad || a.eposta).localeCompare(b.ad || b.eposta, 'tr'));
  const juriAd = j => kacar(j.ad || j.eposta);

  const satirlar = adaylar.map(k => {
    const p = st.puanlar.filter(x => x.basvuru_id === k.id && juriler.some(j => j.uid === x.juri_uid));
    const gecti   = p.filter(x => x.karar === 'gecti').length;
    const gecmedi = p.filter(x => x.karar === 'gecmedi').length;
    return { k, p, gecti, gecmedi, adet: gecti + gecmedi };
  });
  /* Çok "Geçti" alan üstte; eşitlikte oy almış olan, sonra az "Geçmedi" alan önde. */
  satirlar.sort((a,b) => b.gecti - a.gecti || (b.adet > 0) - (a.adet > 0) || a.gecmedi - b.gecmedi || a.k.sira_no - b.k.sira_no);

  /* Oyları aynı olanlar aynı sırayı paylaşır. */
  satirlar.forEach((s, i) => {
    const o = satirlar[i - 1];
    s.sira = !s.adet ? null : o && o.gecti === s.gecti && o.gecmedi === s.gecmedi ? o.sira : i + 1;
  });

  const hucre = (s, j) => {
    const x = s.p.find(v => v.juri_uid === j.uid);
    return x && x.karar ? `<b class="sn-${x.karar}">${KARAR_AD[x.karar]}</b>` : '<span class="sn-yok">—</span>';
  };

  const detay = s => `<table class="sn-detay">
      <thead><tr><th>Jüri</th><th>Karar</th><th>Not</th></tr></thead>
      <tbody>${juriler.map(j => {
        const x = s.p.find(v => v.juri_uid === j.uid) || {};
        return `<tr><td>${juriAd(j)}</td>
          <td>${x.karar ? `<b class="sn-${x.karar}">${KARAR_AD[x.karar]}</b>` : '—'}</td>
          <td class="sn-not">${kacar(x.notlar || '')}</td></tr>`;
      }).join('')}</tbody>
    </table>`;

  el('icerik').innerHTML = grupTus + `
    <div class="uyari jo-bas"><span>"Geçti" oyu sayısına göre sıralı. Eşitlikte daha az "Geçmedi" alan üstte.</span>
      <button class="btn btn-sm" id="sonucYenile">↻ Yenile</button></div>
    <div class="tablo-sar"><table class="sn-tablo">
      <thead>
        <tr>
          <th class="sn-aday">Sıra · Aday</th>
          ${juriler.map(j => `<th class="sayi sn-juri">${juriAd(j)}</th>`).join('')}
          <th class="sayi">Geçti</th><th class="sayi">Geçmedi</th><th class="sayi">Oy veren</th><th></th>
        </tr>
        <tr class="sn-ilerleme">
          <td class="sn-aday">Karar verdiği aday</td>
          ${juriler.map(j => `<td class="sayi">${adaylar.filter(k => puanTamam(st.puanlar.find(x => x.basvuru_id === k.id && x.juri_uid === j.uid))).length}/${adaylar.length}</td>`).join('')}
          <td colspan="4"></td>
        </tr>
      </thead>
      <tbody>${satirlar.map(s => `<tr>
        <td class="sn-aday"><span class="sn-sira">${s.sira ?? '—'}</span><b>${kacar(s.k.ad)}</b>
          <small>${String(s.k.sira_no).padStart(3,'0')} · ${kacar(s.k.program_adi)}</small></td>
        ${juriler.map(j => `<td class="sayi">${hucre(s, j)}</td>`).join('')}
        <td class="sayi"><b class="sn-gecti">${s.gecti}</b></td>
        <td class="sayi">${s.gecmedi}</td>
        <td class="sayi">${s.adet}/${juriler.length}</td>
        <td><button class="btn btn-sm btn-koyu" data-detay="${s.k.id}">Notlar</button></td>
      </tr>
      <tr class="gizli" id="det-${s.k.id}"><td colspan="${juriler.length + 5}">${detay(s)}</td></tr>`).join('')}</tbody>
    </table></div>`;

  grupBagla();
  el('sonucYenile').addEventListener('click', veriYukle);
  el('icerik').querySelectorAll('[data-detay]').forEach(b =>
    b.addEventListener('click', () => el('det-' + b.dataset.detay).classList.toggle('gizli')));
}

/* ---------- KİŞİLER (eleyici) ---------- */
async function cizKisiler(){
  el('icerik').innerHTML = '<div class="yukleniyor">Yükleniyor…</div>';
  const c = await istek('/functions/v1/next-yetkili', {
    method:'POST', body: JSON.stringify({ islem:'liste' })
  });
  const d = c.ok ? await c.json() : { kisiler: [] };
  st.kisiler = d.kisiler || [];

  el('icerik').innerHTML = `
    <div class="uyari">
      Jüri üyesi eklediğinizde şifre <b>bir kez</b> gösterilir; kaydedip kişiye kendiniz iletin.
      Şirket dışından jüri varsa gizlilik taahhütnamesi imzalatılması gerekiyor.
    </div>

    <div class="kart">
      <div class="etkt" style="margin-bottom:14px">Yeni kişi</div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:12px;align-items:end">
        <div class="alan" style="margin:0"><label for="yAd">Ad soyad</label><input type="text" id="yAd"></div>
        <div class="alan" style="margin:0"><label for="yEposta">E-posta</label><input type="email" id="yEposta"></div>
        <div class="alan" style="margin:0"><label for="yRol">Rol</label>
          <select id="yRol"><option value="juri">Jüri</option><option value="eleyici">Eleyici</option></select>
        </div>
        <button class="btn btn-kirmizi" id="yEkle">Hesap aç</button>
      </div>
      <div class="hata" id="yHata"></div>
      <div id="ySifre"></div>
    </div>

    <div class="tablo-sar"><table>
      <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th></th></tr></thead>
      <tbody>${st.kisiler.map(k => `<tr>
        <td>${kacar(k.ad || '—')}</td>
        <td>${kacar(k.eposta)}</td>
        <td>${k.rol === 'eleyici' ? 'Eleyici' : 'Jüri'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-sifre="${k.uid}">Şifre yenile</button>
          ${k.uid !== st.uid ? `<button class="btn btn-sm" data-sil="${k.uid}" data-ad="${kacar(k.ad || k.eposta)}">Sil</button>` : ''}
        </td></tr>`).join('')}</tbody>
    </table></div>`;

  el('yEkle').addEventListener('click', kisiEkle);
  el('icerik').querySelectorAll('[data-sifre]').forEach(b =>
    b.addEventListener('click', () => sifreYenile(b.dataset.sifre)));
  el('icerik').querySelectorAll('[data-sil]').forEach(b =>
    b.addEventListener('click', () => kisiSil(b.dataset.sil, b.dataset.ad)));
}

function sifreGoster(eposta, sifre){
  el('ySifre').innerHTML = `<div class="sifre-kutu">
    <small>${kacar(eposta)} — bu şifre bir daha gösterilmeyecek</small>${kacar(sifre)}</div>`;
}

async function kisiEkle(){
  const hata = el('yHata'); hata.classList.remove('gorunur');
  const c = await istek('/functions/v1/next-yetkili', {
    method:'POST',
    body: JSON.stringify({ islem:'ekle', ad: el('yAd').value, eposta: el('yEposta').value, rol: el('yRol').value })
  });
  const d = await c.json();
  if (!c.ok){ hata.textContent = d.hata || 'Hesap açılamadı.'; hata.classList.add('gorunur'); return; }
  const kutu = d; await cizKisiler(); sifreGoster(kutu.eposta, kutu.sifre);
}

async function sifreYenile(uid){
  const kisi = st.kisiler.find(k => k.uid === uid);
  if (!confirm(`${kisi ? (kisi.ad || kisi.eposta) : 'Bu kişi'} için yeni şifre üretilsin mi? Eski şifre çalışmayacak.`)) return;
  const c = await istek('/functions/v1/next-yetkili', {
    method:'POST', body: JSON.stringify({ islem:'sifre', uid })
  });
  const d = await c.json();
  if (!c.ok){ alert(d.hata || 'Şifre yenilenemedi.'); return; }
  sifreGoster(kisi ? kisi.eposta : '', d.sifre);
}

async function kisiSil(uid, ad){
  if (!confirm(`${ad} silinsin mi? Bu kişi panele giremeyecek. Verdiği oylar da silinir.`)) return;
  const c = await istek('/functions/v1/next-yetkili', {
    method:'POST', body: JSON.stringify({ islem:'sil', uid })
  });
  if (!c.ok){ const d = await c.json(); alert(d.hata || 'Silinemedi.'); return; }
  cizKisiler();
}

/* ---------- açılışta oturumu geri yükle ---------- */
(async function(){
  let kayit = null;
  try { kayit = JSON.parse(localStorage.getItem('next_oturum') || 'null'); } catch {}
  if (kayit && kayit.j){
    st.jeton = kayit.j; st.tazeleme = kayit.t; st.uid = jetonCoz(kayit.j).sub || null;
    const c = await istek('/rest/v1/fenomen_next_yetkililer?select=uid');
    if (c.ok) { await baslat(); return; }
  }
  el('girisEkran').style.display = '';
})();
