/* RADYO FENOMEN NEXT — başvuru formu */

/* Başvurular Supabase'e yazılır. Bu anahtar herkese açık olacak şekilde tasarlanmıştır:
   tablodaki RLS kuralı anon rolüne yalnızca INSERT izni verir, hiçbir kaydı okutmaz. */
const VERI = {
  adres:    'https://bezwdlxombiirihxomnv.supabase.co',
  anahtar:  'sb_publishable_vRdeq7GR8RblkbUe60SrSw_aFkl6xhe',
  tablo:    'fenomen_next_basvurular'
};

/* ---------- TRANSFER SERVİSLERİ ---------- */
const SERVISLER = {
  swisstransfer: {
    ad:'SwissTransfer', kisa:'ST', renk:'#1E40AF', adres:'https://www.swisstransfer.com',
    not:'Üyelik gerektirmez. 50 GB\'a kadar dosya gönderilebilir, link 30 güne kadar geçerlidir.',
    adimlar:[
      'Kaydınızı sürükleyip bırakın ya da "Dosya seç" ile ekleyin.',
      '"Bağlantı oluştur" seçeneğini seçin, geçerlilik süresini 30 gün yapın.',
      'Oluşan linki kopyalayıp bu sayfadaki link alanına yapıştırın.'
    ]
  },
  youtube: {
    ad:'YouTube', kisa:'YT', renk:'#FF0000', adres:'https://www.youtube.com/upload',
    not:'Süresi dolmaz. Videoyu "Liste dışı" yüklediğinizde arama sonuçlarında çıkmaz, yalnızca linki olan görür.',
    adimlar:[
      'Kaydınızı yükleyin, başlık olarak adınızı yazın.',
      'Görünürlük adımında "Liste dışı" seçeneğini işaretleyin.',
      'Video linkini kopyalayıp bu sayfadaki link alanına yapıştırın.'
    ]
  },
  drive: {
    ad:'Google Drive', kisa:'GD', renk:'#E8A200', adres:'https://drive.google.com',
    not:'Google hesabı gerekir. Paylaşım iznini açmayı unutmayın — kapalı linkler açılmıyor.',
    adimlar:[
      'Kaydınızı Drive\'a yükleyin.',
      'Dosyaya sağ tıklayıp "Paylaş" deyin, erişimi "Bağlantıya sahip olan herkes" yapın.',
      '"Bağlantıyı kopyala" deyip linki bu sayfadaki alana yapıştırın.'
    ]
  }
};

(function servisModali(){
  const perde = document.getElementById('perde');
  if (!perde) return;
  const logo    = document.getElementById('modalLogo');
  const baslik  = document.getElementById('modalBaslik');
  const not     = document.getElementById('modalNot');
  const adimlar = document.getElementById('modalAdimlar');
  const git     = document.getElementById('modalGit');
  const linkAlan = document.getElementById('videoLink');
  let sonOdak = null;

  function ac(anahtar, tetikleyen){
    const s = SERVISLER[anahtar];
    if (!s) return;
    sonOdak = tetikleyen;
    logo.textContent = s.kisa;
    logo.style.background = s.renk;
    baslik.textContent = s.ad;
    not.textContent = s.not;
    adimlar.innerHTML = s.adimlar
      .map((a,i) => `<div class="modal-adim"><b>${i+1}</b><span>${a}</span></div>`).join('');
    git.href = s.adres;
    git.innerHTML = `${s.ad} sayfasını aç <span class="ok">→</span>`;
    perde.classList.add('acik');
    document.body.style.overflow = 'hidden';
    setTimeout(() => git.focus(), 60);
  }

  function kapa(){
    perde.classList.remove('acik');
    document.body.style.overflow = '';
    if (sonOdak) sonOdak.focus();
  }

  document.querySelectorAll('.servis').forEach(b =>
    b.addEventListener('click', () => ac(b.dataset.servis, b)));

  document.getElementById('modalKapat').addEventListener('click', kapa);
  document.getElementById('modalTamam').addEventListener('click', () => {
    kapa();
    linkAlan.focus();
    linkAlan.scrollIntoView({behavior:'smooth', block:'center'});
  });
  perde.addEventListener('click', e => { if (e.target === perde) kapa(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && perde.classList.contains('acik')) kapa();
  });
})();

/* ---------- HARF SAYACI ---------- */
document.querySelectorAll('textarea[maxlength]').forEach(alan => {
  const sayac = document.querySelector(`[data-say="${alan.id}"]`);
  if (!sayac) return;
  alan.addEventListener('input', () => sayac.textContent = alan.value.length);
});

/* ---------- ADIM ÇUBUĞU ---------- */
(function adimBar(){
  const form = document.getElementById('basvuruForm');
  if (!form) return;
  const cubuklar = document.querySelectorAll('.adim-cubuk');
  const kisisel = ['ad','dogum','sehir','telefon','eposta'];
  const sorular = ['s1','s2'];
  const dolu = a => a.every(id => (document.getElementById(id)?.value || '').trim());
  form.addEventListener('input', () => {
    cubuklar[1].classList.toggle('dolu', dolu(kisisel));
    cubuklar[2].classList.toggle('dolu', dolu(kisisel) && dolu(sorular));
  });
})();

/* ---------- ONAY ALANLARI ---------- */
/* Dört onay ayrı ayrı alınır; hiçbiri ön seçili değildir.
   Gönderim yalnızca aydınlatma teyidine (ve 18 yaş altında veli onayına) bağlanır. */

function yasHesapla(tarihMetni){
  const d = new Date(tarihMetni);
  if (isNaN(d)) return null;
  const bugun = new Date();
  let y = bugun.getFullYear() - d.getFullYear();
  const ayFark = bugun.getMonth() - d.getMonth();
  if (ayFark < 0 || (ayFark === 0 && bugun.getDate() < d.getDate())) y--;
  return y;
}

(function onayAlanlari(){
  const form = document.getElementById('basvuruForm');
  if (!form) return;

  const dogum     = document.getElementById('dogum');
  const veliBlok  = document.getElementById('veliBlok');
  const onayVeli  = document.getElementById('onayVeli');
  const yasHata   = document.getElementById('yasHata');
  const onayIleti = document.getElementById('onayIleti');
  const kanalSar  = document.getElementById('iletiKanal');
  const kanalSms  = document.getElementById('kanalSms');
  const kanalEp   = document.getElementById('kanalEposta');
  const kanalHata = document.getElementById('kanalHata');

  function yasiUygula(){
    const yas = yasHesapla(dogum.value);
    const kucuk = yas !== null && yas >= 16 && yas < 18;

    veliBlok.hidden = !kucuk;
    onayVeli.required = kucuk;
    if (!kucuk) onayVeli.checked = false;

    const cokKucuk = yas !== null && yas < 16;
    yasHata.classList.toggle('gorunur', cokKucuk);
    dogum.setCustomValidity(cokKucuk ? 'On altı yaşını doldurmamış adayların başvurusu kabul edilmemektedir.' : '');
  }

  function kanaliUygula(){
    kanalSar.hidden = !onayIleti.checked;
    if (!onayIleti.checked){
      kanalSms.checked = false;
      kanalEp.checked  = false;
      kanalHata.classList.remove('gorunur');
    }
  }

  dogum.addEventListener('change', yasiUygula);
  dogum.addEventListener('input', yasiUygula);
  onayIleti.addEventListener('change', kanaliUygula);
  [kanalSms, kanalEp].forEach(k => k.addEventListener('change', () => {
    if (kanalSms.checked || kanalEp.checked) kanalHata.classList.remove('gorunur');
  }));

  yasiUygula();
  kanaliUygula();
})();

/* ---------- GÖNDERİM ---------- */
(function gonder(){
  const form = document.getElementById('basvuruForm');
  if (!form) return;

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const hata = document.getElementById('kayitHata');
    const btn  = document.getElementById('gonderBtn');
    const link = document.getElementById('videoLink').value.trim();

    const kanalHata = document.getElementById('kanalHata');
    const onayIleti = document.getElementById('onayIleti');
    const kanalSms  = document.getElementById('kanalSms');
    const kanalEp   = document.getElementById('kanalEposta');

    hata.classList.remove('gorunur');
    kanalHata.classList.remove('gorunur');
    if (!form.checkValidity()){ form.reportValidity(); return; }

    if (onayIleti.checked && !kanalSms.checked && !kanalEp.checked){
      kanalHata.classList.add('gorunur');
      kanalHata.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }

    if (!/^https?:\/\/.+\..+/.test(link)){
      hata.textContent = 'Link geçerli görünmüyor. Adresin "https://" ile başladığından emin olun.';
      hata.classList.add('gorunur');
      return;
    }

    const d = new FormData(form);
    const kayit = {
      ad:           d.get('ad').trim(),
      dogum:        d.get('dogum'),
      sehir:        d.get('sehir').trim(),
      telefon:      d.get('telefon').trim(),
      eposta:       d.get('eposta').trim(),
      sosyal:       (d.get('sosyal') || '').trim() || null,
      tanitim:      d.get('s1').trim(),
      program_adi:  d.get('s2').trim(),
      kayit_adresi: link,
      kayit_turu:   'link',

      /* Onaylar ayrı ayrı kaydedilir. Tarih-saat ile IP sunucu tarafında yazılır. */
      onay_aydinlatma: document.getElementById('onayAydinlatma').checked,
      onay_tanitim:    document.getElementById('onayTanitim').checked,
      onay_ileti:      onayIleti.checked,
      ileti_sms:       onayIleti.checked && kanalSms.checked,
      ileti_eposta:    onayIleti.checked && kanalEp.checked,
      onay_veli:       document.getElementById('onayVeli').checked
    };

    btn.disabled = true;
    btn.innerHTML = 'Gönderiliyor…';

    try {
      const c = await fetch(`${VERI.adres}/rest/v1/${VERI.tablo}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': VERI.anahtar,
          'Authorization': 'Bearer ' + VERI.anahtar,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(kayit)
      });
      if (!c.ok) throw new Error('HTTP ' + c.status + ' ' + await c.text());

      form.style.display = 'none';
      const tesekkur = document.getElementById('tesekkur');
      tesekkur.classList.add('gorunur');
      tesekkur.scrollIntoView({behavior:'smooth', block:'center'});
    } catch(e){
      console.error('Başvuru gönderilemedi:', e);
      btn.disabled = false;
      btn.innerHTML = 'Başvuruyu gönder <span class="ok">→</span>';
      hata.textContent = 'Başvuru gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse next@radyofenomen.com adresine yazın.';
      hata.classList.add('gorunur');
    }
  });
})();
