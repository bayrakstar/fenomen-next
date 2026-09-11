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
  st = { ...st, jeton:null, tazeleme:null, uid:null, rol:null, basvurular:[], puanlar:[], kisiler:[] };
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

el('cikisBtn').addEventListener('click', cikis);

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
    b.addEventListener('click', () => { st.sekme = b.dataset.sekme; ciz(); }));
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

  if (st.sekme === 'eleme')       cizEleme();
  if (st.sekme === 'degerlendir') cizDegerlendirme();
  if (st.sekme === 'sonuc')       cizSonuc();
  if (st.sekme === 'kisiler')     cizKisiler();
}

function videoKutu(k){
  if (k.video_dosya){
    return `<iframe class="video" src="https://drive.google.com/file/d/${kacar(k.video_dosya)}/preview" allow="autoplay" referrerpolicy="no-referrer"></iframe>`;
  }
  const a = k.kayit_adresi || '';
  const yt = a.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt){
    return `<iframe class="video" src="https://www.youtube-nocookie.com/embed/${kacar(yt[1])}" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  }
  if (!a) return `<div class="video-yok">Kayıt bağlantısı yok.</div>`;
  return `<div class="video-yok">
      Bu kayıt panelde oynatılamıyor.<br>
      <a href="${kacar(a)}" target="_blank" rel="noopener" style="text-decoration:underline">Bağlantıyı yeni sekmede aç →</a>
    </div>`;
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
  </div>`;

  const liste = suzulmus();
  const kartlar = liste.length
    ? liste.map(kartEleme).join('')
    : '<div class="bos">Bu süzgeçte başvuru yok.</div>';

  el('icerik').innerHTML = suzgec + kartlar;
  suzgecBagla();

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
  ciz();
}

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

  const benim = st.puanlar.filter(p => p.juri_uid === st.uid);
  const kalan = st.basvurular.filter(k => !benim.some(p => p.basvuru_id === k.id)).length;

  el('icerik').innerHTML =
    `<div class="uyari">Toplam <b>${st.basvurular.length}</b> aday · puan verdikleriniz: <b>${st.basvurular.length - kalan}</b> · kalan: <b>${kalan}</b></div>` +
    st.basvurular.map(kartJuri).join('');

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
      <div class="kart-sag">${verildi ? '<span class="durum gecti">Puanladınız</span>' : ''}</div>
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
  kart.querySelector('.kart-sag').innerHTML = '<span class="durum gecti">Puanladınız</span>';
}

/* ---------- JÜRİ SONUÇLARI (eleyici) ---------- */
function cizSonuc(){
  const gecenler = st.basvurular.filter(k => k.durum === 'gecti');
  if (!gecenler.length){
    el('icerik').innerHTML = '<div class="bos">Henüz jüriye gönderilmiş aday yok.<br><span style="font-size:13.5px">Eleme sekmesinden "Geçti" dediğiniz adaylar buraya düşer.</span></div>';
    return;
  }

  const satirlar = gecenler.map(k => {
    const p = st.puanlar.filter(x => x.basvuru_id === k.id);
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
