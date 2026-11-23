/* FENOMEN NEXT — değerlendirme paneli
   ------------------------------------------------------------------
   İki rol var:
     eleyici → bütün başvuruları görür, "geçti / kararsız / elendi" der
     jüri    → yalnızca "geçti" işaretlenenleri görür, puanlar

   Rol denetimi TARAYICIDA DEĞİL sunucuda. Buradaki gizlemeler sadece
   arayüzü sadeleştirmek için; veriyi görünümler ve RLS koruyor.
   Jüri, adayın telefonunu/e-postasını istese de çekemez — o alanlar
   jüri görünümünde yok. */

const VERI = {
  adres:   'https://bezwdlxombiirihxomnv.supabase.co',
  anahtar: 'sb_publishable_vRdeq7GR8RblkbUe60SrSw_aFkl6xhe'
};

const OLCUTLER = [
  ['ses_anlatim',  'Ses ve anlatım'],
  ['ozgunluk',     'Özgünlük'],
  ['enerji',       'Enerji'],
  ['dogaclama',    'Doğaçlama'],
  ['muzik_kultur', 'Müzik ve kültür bilgisi'],
  ['kamera',       'Kamera performansı']
];

const DURUMLAR = [
  ['hepsi',    'Hepsi'],
  ['yeni',     'Bakılmadı'],
  ['gecti',    'Geçti'],
  ['kararsiz', 'Kararsız'],
  ['elendi',   'Elendi']
];

let st = {
  jeton: null, tazeleme: null, uid: null, rol: null, ad: null, eposta: null,
  sekme: null, suzgec: 'yeni', arama: '',
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
  st = { ...st, jeton:null, tazeleme:null, uid:null, rol:null, oynat:null, basvurular:[], puanlar:[], kisiler:[] };
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
  if (!(await juriKaydet()) && !confirm('Son puanlar kaydedilemedi. Yine de çıkılsın mı?')) return;
  cikis();
});

/* ---------- açılış ---------- */
async function baslat(){
  const c = await istek('/rest/v1/fenomen_next_yetkililer?select=uid,rol,ad,eposta,aktif');
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
    ? [['eleme','Eleme'], ['sonuc','Jüri sonuçları'], ['kisiler','Kişiler']]
    : [['degerlendir','Değerlendirme']];
  st.sekme = liste[0][0];
  el('sekmeler').innerHTML = liste
    .map(([id,ad]) => `<button class="sekme" data-sekme="${id}">${ad}</button>`).join('');
  el('sekmeler').querySelectorAll('.sekme').forEach(b =>
    b.addEventListener('click', () => { st.sekme = b.dataset.sekme; st.oynat = null; ciz(); }));
}

async function veriYukle(){
  el('icerik').innerHTML = '<div class="yukleniyor">Yükleniyor…</div>';
  const gorunum = st.rol === 'eleyici' ? 'next_eleme' : 'next_juri';

  const [b, p] = await Promise.all([
    istek(`/rest/v1/${gorunum}?select=*&order=sira_no`),
    istek('/rest/v1/fenomen_next_puanlar?select=*')
  ]);
  st.basvurular = b.ok ? await b.json() : [];
  st.puanlar    = p.ok ? await p.json() : [];
  ciz();
}

/* ---------- çizim ---------- */
function ciz(){
  el('sekmeler').querySelectorAll('.sekme').forEach(b =>
    b.classList.toggle('aktif', b.dataset.sekme === st.sekme));

  if (st.sekme === 'eleme')       st.oynat ? cizOynat() : cizEleme();
  if (st.sekme === 'degerlendir') st.oynat ? cizJuriOynat() : cizDegerlendirme();
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
        ${puanli ? `<span class="durum">${k.puan_sayisi} jüri puanı</span>` : ''}
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
  if (durum !== 'gecti' && k && k.puan_sayisi > 0){
    if (!confirm(`${k.ad} için ${k.puan_sayisi} jüri puanı girilmiş. Listeden çıkarırsanız jüri bu adayı göremeyecek. Devam edilsin mi?`)) return;
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
  const juri = st.sekme === 'degerlendir';
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
  if (st.oynat && st.sekme === 'degerlendir') return juriTus(ev);
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
  if (!st.basvurular.length){
    el('icerik').innerHTML = `<div class="bos">
      Değerlendirilecek aday henüz yok.<br>
      <span style="font-size:13.5px">Ön eleme tamamlandığında adaylar burada görünecek.</span>
    </div>`;
    return;
  }

  const biten = st.basvurular.filter(k => puanTamam(benimPuan(k.id))).length;
  const kalan = st.basvurular.length - biten;
  const basla = !biten ? 'Sırayla izle ve puanla' : kalan ? 'Kaldığın yerden devam et' : 'Baştan gözden geçir';

  el('icerik').innerHTML =
    `<div class="uyari jo-bas"><span>Toplam <b>${st.basvurular.length}</b> aday · puanı tamamlanan: <b>${biten}</b> · kalan: <b>${kalan}</b></span>
      <button class="btn btn-sm btn-kirmizi" id="juriBasla">▶ ${basla}</button></div>` +
    st.basvurular.map(kartJuri).join('');

  el('juriBasla').addEventListener('click', () => {
    const ids = st.basvurular.map(k => k.id);
    st.oynat = { ids, i: Math.max(0, ids.findIndex(id => !puanTamam(benimPuan(id)))), olcut: 0 };
    ciz(); scrollTo(0, 0);
  });

  el('icerik').querySelectorAll('.pt').forEach(b =>
    b.addEventListener('click', () => {
      const sar = b.closest('.puan-satir');
      sar.querySelectorAll('.pt').forEach(x => x.classList.toggle('secili', x === b));
      sar.dataset.deger = b.dataset.p;
    }));

  el('icerik').querySelectorAll('[data-kaydet]').forEach(b =>
    b.addEventListener('click', () => puanKaydet(b.dataset.kaydet, b)));
}

function kartJuri(k){
  const p = st.puanlar.find(x => x.basvuru_id === k.id && x.juri_uid === st.uid) || {};
  const verildi = OLCUTLER.some(([a]) => p[a] != null);

  const satirlar = OLCUTLER.map(([anahtar, ad]) => `
    <div class="puan-satir" data-olcut="${anahtar}" data-deger="${p[anahtar] ?? ''}">
      <span class="puan-ad">${ad}</span>
      <span class="puan-tus">${[...Array(10)].map((_,i) =>
        `<button type="button" class="pt ${p[anahtar]==i+1?'secili':''}" data-p="${i+1}">${i+1}</button>`).join('')}</span>
    </div>`).join('');

  return `<div class="kart" data-kart="${k.id}">
    <div class="kart-bas">
      <div class="no">${String(k.sira_no).padStart(3,'0')}</div>
      <div>
        <div class="kart-ad">${kacar(k.ad)}</div>
        <div class="kart-alt">${kacar(k.sehir)} · ${kacar(k.program_adi)}</div>
      </div>
      <div class="kart-sag">${puanTamam(p) ? '<span class="durum gecti">Puanladınız</span>' : verildi ? '<span class="durum kararsiz">Eksik puan</span>' : ''}</div>
    </div>

    <div class="kart-govde">
      <div>
        <div class="soru">
          <div class="etkt">Kendini nasıl anlatıyor</div>
          <p>${kacar(k.tanitim)}</p>
        </div>
        <div class="puan-izgara">${satirlar}</div>
        <div class="alan" style="margin-bottom:0">
          <label>Notunuz <span style="text-transform:none;letter-spacing:0;font-weight:400">— isteğe bağlı</span></label>
          <textarea rows="2" data-not>${kacar(p.notlar || '')}</textarea>
        </div>
      </div>
      <div>${videoKutu(k)}</div>
    </div>

    <div class="kart-ayak">
      <button class="btn btn-sm btn-kirmizi" data-kaydet="${k.id}">${verildi ? 'Güncelle' : 'Puanı kaydet'}</button>
      <span class="onay-iz" data-iz="${k.id}"></span>
    </div>
  </div>`;
}

async function puanKaydet(id, btn){
  const kart = el('icerik').querySelector(`[data-kart="${id}"]`);
  const iz   = kart.querySelector('[data-iz]');
  const kayit = { basvuru_id: id, juri_uid: st.uid,
                  notlar: kart.querySelector('[data-not]').value.trim() || null };

  let eksik = 0;
  kart.querySelectorAll('.puan-satir').forEach(s => {
    const d = s.dataset.deger;
    if (d === '' || d == null) eksik++;
    kayit[s.dataset.olcut] = d === '' || d == null ? null : Number(d);
  });

  if (eksik === OLCUTLER.length){
    iz.textContent = 'Önce puan verin.'; return;
  }

  btn.disabled = true; iz.textContent = 'Kaydediliyor…';
  /* on_conflict şart: PostgREST birleştirmeyi varsayılan olarak birincil anahtara
     göre yapıyor, o da her seferinde yeni satır demek. Aday+jüri çifti üzerinden
     birleştirilmezse jüri puanını her güncelleyişinde çakışma hatası alıyor. */
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

  iz.textContent = eksik ? `Kaydedildi — ${eksik} ölçüt boş.` : 'Kaydedildi ✓';
  btn.textContent = 'Güncelle';
  kart.querySelector('.kart-sag').innerHTML = eksik
    ? '<span class="durum kararsiz">Eksik puan</span>'
    : '<span class="durum gecti">Puanladınız</span>';
}

/* ---------- SIRAYLA İZLE VE PUANLA (jüri) ----------
   Video çalarken puan verilir, her puan kendiliğinden kaydedilir.
   Kayıtlar tek sırayla gider: yavaş kalan eski istek yeni puanı ezmesin. */
const kirli = new Set();
let kayitSuruyor = null, kayitHata = false, kayitZaman = null;

const benimPuan = id => st.puanlar.find(p => p.basvuru_id === id && p.juri_uid === st.uid);
const puanTamam = p => !!p && OLCUTLER.every(([a]) => p[a] != null);

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
        const kayit = { basvuru_id: id, juri_uid: st.uid, notlar: (p.notlar || '').trim() || null };
        OLCUTLER.forEach(([a]) => { kayit[a] = p[a] ?? null; });

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
    : p ? 'Kaydedildi ✓' : 'Puanlar otomatik kaydedilir.';
  const s = el('joSonraki');
  if (s) s.classList.toggle('btn-kirmizi', tamam);
  const say = el('joTamam');
  if (say) say.textContent = st.oynat.ids.filter(x => puanTamam(benimPuan(x))).length;
}

function juriSatirlar(k){
  const p = benimPuan(k.id) || {};
  return OLCUTLER.map(([a, ad], j) => `
    <div class="jo-satir ${j === st.oynat.olcut ? 'aktif' : ''}" data-olcutno="${j}">
      <div class="jo-ad"><span>${ad}</span><b>${p[a] ?? '—'}</b></div>
      <div class="jo-tus">${[...Array(10)].map((_, n) =>
        `<button type="button" class="pt ${p[a] === n + 1 ? 'secili' : ''}" data-jp="${n + 1}" data-j="${j}">${n + 1}</button>`).join('')}</div>
    </div>`).join('');
}

function cizJuriOynat(){
  const o = st.oynat, n = o.ids.length;
  const biten = o.ids.filter(id => puanTamam(benimPuan(id))).length;
  const ust = sayac => `<div class="oyn-ust">
      <button class="btn btn-sm" data-oyn="kapat">← Listeye dön</button>
      <span class="oyn-sayac">${sayac} <small>· tamamlanan <span id="joTamam">${biten}</span></small></span>
      <span class="oyn-ipucu"><kbd>1</kbd>–<kbd>9</kbd> puan · <kbd>0</kbd> = 10 · <kbd>↑</kbd> <kbd>↓</kbd> ölçüt · <kbd>←</kbd> <kbd>→</kbd> aday · <kbd>Esc</kbd> liste</span>
    </div>`;

  if (o.i >= n){
    const ilkEksik = o.ids.findIndex(id => !puanTamam(benimPuan(id)));
    el('icerik').innerHTML = ust(`${n} / ${n}`) + `<div class="bos">
        ${ilkEksik < 0 ? 'Bütün adayları puanladın, teşekkürler.' : 'Listenin sonuna geldin.'}<br>
        <span style="font-size:13.5px">Tamamlanan ${biten} · Eksik ${n - biten}</span><br>
        <span id="joKayit" style="font-size:13px"></span><br><br>
        <button class="btn btn-sm" data-oyn="onceki">← Son adaya dön</button>
        ${ilkEksik >= 0 ? `<button class="btn btn-sm btn-kirmizi" data-oyn="eksik">İlk eksik adaya git</button>` : ''}
        <button class="btn btn-sm btn-koyu" data-oyn="kapat">Listeye dön</button>
      </div>`;
    juriBagla(null);
    juriDurum();
    return;
  }

  const k = st.basvurular.find(x => x.id === o.ids[o.i]);
  const p = benimPuan(k.id) || {};
  o.olcut = Math.max(0, OLCUTLER.findIndex(([a]) => p[a] == null));

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
        <div id="joPuan">${juriSatirlar(k)}</div>
      </div>
    </div>`;
  juriBagla(k);
  juriDurum();
}

function juriBagla(k){
  el('icerik').onclick = ev => {
    const b = ev.target.closest('[data-jp],[data-oyn],[data-olcutno]');
    if (!b || !st.oynat) return;
    if (b.tagName === 'A') ev.preventDefault();
    if (b.dataset.jp && k) puanVer(k, +b.dataset.j, +b.dataset.jp);
    else if (b.dataset.oyn === 'kaydet') juriKaydet();
    else if (b.dataset.oyn === 'eksik'){
      st.oynat.i = st.oynat.ids.findIndex(id => !puanTamam(benimPuan(id)));
      ciz();
    }
    else if (b.dataset.oyn) oynatGit(b.dataset.oyn);
    else if (k){ st.oynat.olcut = +b.dataset.olcutno; el('joPuan').innerHTML = juriSatirlar(k); }
  };
  const not = el('joNot');
  if (not && k) not.addEventListener('input', () => {
    benimSatir(k.id).notlar = not.value;
    puanKirlet(k.id, 700);
  });
}

/* Puan verince imleç sıradaki boş ölçüte geçer; video yeniden yüklenmez. */
function puanVer(k, j, deger){
  const p = benimSatir(k.id);
  p[OLCUTLER[j][0]] = deger;
  const bos = s => OLCUTLER.findIndex(([a], i) => i >= s && p[a] == null);
  const sonraki = bos(j + 1) >= 0 ? bos(j + 1) : bos(0);
  st.oynat.olcut = sonraki >= 0 ? sonraki : j;
  el('joPuan').innerHTML = juriSatirlar(k);
  puanKirlet(k.id, 300);
}

function juriTus(ev){
  if (ev.key === 'Escape' && ev.target.tagName === 'TEXTAREA'){ ev.target.blur(); ev.preventDefault(); return; }
  if (ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;

  const o = st.oynat;
  const k = st.basvurular.find(x => x.id === o.ids[o.i]);
  const deger = ev.key === '0' ? 10 : /^[1-9]$/.test(ev.key) ? +ev.key : 0;

  if (ev.key === 'ArrowRight')     oynatGit('sonraki');
  else if (ev.key === 'ArrowLeft') oynatGit('onceki');
  else if (ev.key === 'Escape')    oynatGit('kapat');
  else if (!k) return;
  else if (deger){ if (!ev.repeat) puanVer(k, o.olcut, deger); }
  else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
    o.olcut = Math.min(OLCUTLER.length - 1, Math.max(0, o.olcut + (ev.key === 'ArrowDown' ? 1 : -1)));
    el('joPuan').innerHTML = juriSatirlar(k);
  }
  else return;
  ev.preventDefault();
}

window.addEventListener('beforeunload', ev => {
  if (kirli.size || kayitSuruyor) ev.preventDefault();
});

/* ---------- JÜRİ SONUÇLARI (eleyici) ---------- */
function cizSonuc(){
  const gecenler = st.basvurular.filter(k => k.durum === 'gecti');
  if (!gecenler.length){
    el('icerik').innerHTML = '<div class="bos">Henüz jüriye gönderilmiş aday yok.<br><span style="font-size:13.5px">Eleme sekmesinden "Geçti" dediğiniz adaylar buraya düşer.</span></div>';
    return;
  }

  const satirlar = gecenler.map(k => {
    /* Puanlar otomatik kaydedildiği için yarım kalan oylama sıralamaya girmez. */
    const p = st.puanlar.filter(x => x.basvuru_id === k.id && puanTamam(x));
    const ortalamalar = p.map(x => {
      const d = OLCUTLER.map(([a]) => x[a]).filter(v => v != null);
      return d.length ? d.reduce((t,v) => t+v, 0) / d.length : null;
    }).filter(v => v != null);

    const ort = ortalamalar.length
      ? ortalamalar.reduce((t,v) => t+v, 0) / ortalamalar.length : null;
    const fark = ortalamalar.length > 1
      ? Math.max(...ortalamalar) - Math.min(...ortalamalar) : 0;

    return { k, adet: ortalamalar.length, ort, fark };
  }).sort((a,b) => (b.ort ?? -1) - (a.ort ?? -1));

  el('icerik').innerHTML = `
    <div class="uyari">Ortalamaya göre sıralı. <b>Ayrışma</b> sütunu jürinin en yüksek ve en düşük puanı arasındaki farktır — büyükse o aday tartışmalı demektir.</div>
    <div class="tablo-sar"><table>
      <thead><tr>
        <th class="sayi">No</th><th>Aday</th><th>Şehir</th><th>Program</th>
        <th class="sayi">Puanlayan</th><th class="sayi">Ortalama</th><th class="sayi">Ayrışma</th>
      </tr></thead>
      <tbody>${satirlar.map(s => `<tr>
        <td class="sayi">${String(s.k.sira_no).padStart(3,'0')}</td>
        <td>${kacar(s.k.ad)}</td>
        <td>${kacar(s.k.sehir)}</td>
        <td>${kacar(s.k.program_adi)}</td>
        <td class="sayi">${s.adet}</td>
        <td class="sayi"><b>${s.ort != null ? s.ort.toFixed(1) : '—'}</b></td>
        <td class="sayi">${s.adet > 1 ? s.fark.toFixed(1) : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
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
  if (!confirm(`${ad} silinsin mi? Bu kişi panele giremeyecek. Verdiği puanlar da silinir.`)) return;
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
