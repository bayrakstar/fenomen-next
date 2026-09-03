/* FENOMEN NEXT — başvuru formu */

/* ===== AYAR =====
   API_TABAN boşken form demo modda çalışır: yükleme canlandırılır,
   gönderim konsola yazılır. Depolama seçilince buraya adres girilir. */
const AYAR = {
  API_TABAN: '',
  MAKS_BOYUT: 500 * 1024 * 1024
};

/* ---------- TRANSFER SERVİSLERİ ---------- */
const SERVISLER = {
  wetransfer: {
    ad:'WeTransfer', kisa:'WT', renk:'#409FFF', adres:'https://wetransfer.com',
    not:'Üyelik gerektirmez. 2 GB\'a kadar dosya gönderilebilir, link 7 gün geçerlidir.',
    adimlar:[
      'Açılan sayfada "Dosya ekle" ile kaydınızı seçin.',
      'E-posta yerine "Link oluştur" seçeneğini işaretleyin.',
      'Oluşan linki kopyalayıp bu sayfadaki link alanına yapıştırın.'
    ]
  },
  swisstransfer: {
    ad:'SwissTransfer', kisa:'ST', renk:'#1E40AF', adres:'https://www.swisstransfer.com',
    not:'Üyelik gerektirmez. 50 GB\'a kadar dosya gönderilebilir, link 30 güne kadar geçerlidir.',
    adimlar:[
      'Kaydınızı sürükleyip bırakın ya da "Dosya seç" ile ekleyin.',
      '"Bağlantı oluştur" seçeneğini seçin, geçerlilik süresini 30 gün yapın.',
      'Oluşan linki kopyalayıp bu sayfadaki link alanına yapıştırın.'
    ]
  },
  sendgb: {
    ad:'SendGB', kisa:'SG', renk:'#2FA84F', adres:'https://www.sendgb.com',
    not:'Üyelik gerektirmez. 5 GB\'a kadar dosya gönderilebilir.',
    adimlar:[
      'Kaydınızı yükleyin.',
      '"Get a link" seçeneğini seçip yüklemeyi tamamlayın.',
      'Oluşan linki kopyalayıp bu sayfadaki link alanına yapıştırın.'
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
  const logo = document.getElementById('modalLogo');
  const baslik = document.getElementById('modalBaslik');
  const not = document.getElementById('modalNot');
  const adimlar = document.getElementById('modalAdimlar');
  const git = document.getElementById('modalGit');
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

/* ---------- KAYIT: LİNK / DOSYA ---------- */
const kayit = { dosya:null, url:null, yukleniyor:false };

(function yolSecimi(){
  document.querySelectorAll('#yolSec button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#yolSec button').forEach(x => x.classList.remove('aktif'));
      b.classList.add('aktif');
      const linkMi = b.dataset.yol === 'link';
      document.getElementById('linkYolu').style.display = linkMi ? '' : 'none';
      document.getElementById('dosyaYolu').style.display = linkMi ? 'none' : '';
    });
  });
})();

function boyutYaz(b){
  if (b < 1024*1024) return (b/1024).toFixed(0) + ' KB';
  return (b/1024/1024).toFixed(1) + ' MB';
}

(function dosyaYukleme(){
  const alan = document.getElementById('birakAlan');
  if (!alan) return;
  const giris = document.getElementById('dosyaGiris');
  const kart = document.getElementById('dosyaKart');
  const adEl = document.getElementById('dosyaAd');
  const boyutEl = document.getElementById('dosyaBoyut');
  const cubuk = document.getElementById('ilerlemeCubuk');
  const hata = document.getElementById('kayitHata');

  alan.addEventListener('click', () => giris.click());
  ['dragenter','dragover'].forEach(e => alan.addEventListener(e, ev => {
    ev.preventDefault(); alan.classList.add('uzerinde');
  }));
  ['dragleave','drop'].forEach(e => alan.addEventListener(e, ev => {
    ev.preventDefault(); alan.classList.remove('uzerinde');
  }));
  alan.addEventListener('drop', ev => { if (ev.dataTransfer.files[0]) sec(ev.dataTransfer.files[0]); });
  giris.addEventListener('change', () => { if (giris.files[0]) sec(giris.files[0]); });

  document.getElementById('dosyaSil').addEventListener('click', () => {
    kayit.dosya = null; kayit.url = null; kayit.yukleniyor = false;
    giris.value = ''; kart.classList.remove('gorunur');
    alan.style.display = ''; cubuk.style.width = 0;
  });

  function sec(dosya){
    if (dosya.size > AYAR.MAKS_BOYUT){
      hata.textContent = `Dosya ${boyutYaz(dosya.size)} boyutunda. Yükleme sınırı 500 MB — "Link gönder" seçeneğini kullanabilirsiniz.`;
      hata.classList.add('gorunur');
      return;
    }
    hata.classList.remove('gorunur');
    kayit.dosya = dosya;
    adEl.textContent = dosya.name;
    boyutEl.textContent = boyutYaz(dosya.size);
    kart.classList.add('gorunur');
    alan.style.display = 'none';
    yukle(dosya);
  }

  async function yukle(dosya){
    kayit.yukleniyor = true;
    if (!AYAR.API_TABAN){
      let p = 0;
      const t = setInterval(() => {
        p = Math.min(100, p + Math.random()*11);
        cubuk.style.width = p + '%';
        boyutEl.textContent = boyutYaz(dosya.size) + (p < 100 ? ` · yükleniyor %${p|0}` : ' · yüklendi');
        if (p >= 100){ clearInterval(t); kayit.yukleniyor = false; kayit.url = 'demo://' + dosya.name; }
      }, 260);
      return;
    }
    try {
      const izin = await fetch(AYAR.API_TABAN + '/yukleme-izni', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ad:dosya.name, tur:dosya.type, boyut:dosya.size})
      }).then(r => r.json());

      await new Promise((tamam, olmadi) => {
        const x = new XMLHttpRequest();
        x.open('PUT', izin.yuklemeAdresi);
        x.setRequestHeader('Content-Type', dosya.type);
        x.upload.onprogress = e => {
          const p = e.loaded / e.total * 100;
          cubuk.style.width = p + '%';
          boyutEl.textContent = boyutYaz(dosya.size) + ` · yükleniyor %${p|0}`;
        };
        x.onload = () => x.status < 300 ? tamam() : olmadi(new Error(x.status));
        x.onerror = () => olmadi(new Error('ağ'));
        x.send(dosya);
      });

      kayit.url = izin.dosyaAdresi;
      kayit.yukleniyor = false;
      boyutEl.textContent = boyutYaz(dosya.size) + ' · yüklendi';
    } catch(e){
      kayit.yukleniyor = false;
      hata.textContent = 'Yükleme tamamlanamadı. Tekrar deneyebilir ya da "Link gönder" seçeneğini kullanabilirsiniz.';
      hata.classList.add('gorunur');
    }
  }
})();

/* ---------- GÖNDERİM ---------- */
(function gonder(){
  const form = document.getElementById('basvuruForm');
  if (!form) return;

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const hata = document.getElementById('kayitHata');
    const btn = document.getElementById('gonderBtn');
    const link = document.getElementById('videoLink').value.trim();

    if (!form.checkValidity()){ hata.classList.remove('gorunur'); form.reportValidity(); return; }

    if (!kayit.url && !link){
      hata.textContent = kayit.yukleniyor
        ? 'Kaydınız hâlâ yükleniyor, birkaç saniye bekleyin.'
        : 'Bir kayıt yüklemeniz veya link göndermeniz gerekiyor.';
      hata.classList.add('gorunur');
      hata.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
    if (link && !/^https?:\/\/.+\..+/.test(link)){
      hata.textContent = 'Link geçerli görünmüyor. Adresin "https://" ile başladığından emin olun.';
      hata.classList.add('gorunur');
      return;
    }
    hata.classList.remove('gorunur');

    const veri = Object.fromEntries(new FormData(form).entries());
    veri.kayitAdresi = kayit.url || link;
    veri.kayitTuru = kayit.url ? 'yukleme' : 'link';

    btn.disabled = true;
    btn.innerHTML = 'Gönderiliyor…';

    try {
      if (AYAR.API_TABAN){
        const c = await fetch(AYAR.API_TABAN + '/basvuru', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(veri)
        });
        if (!c.ok) throw new Error('sunucu');
      } else {
        console.log('DEMO — gönderilecek başvuru:', veri);
        await new Promise(r => setTimeout(r, 900));
      }
      form.style.display = 'none';
      const tesekkur = document.getElementById('tesekkur');
      tesekkur.classList.add('gorunur');
      tesekkur.scrollIntoView({behavior:'smooth', block:'center'});
    } catch(e){
      btn.disabled = false;
      btn.innerHTML = 'Başvuruyu gönder <span class="ok">→</span>';
      hata.textContent = 'Başvuru gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.';
      hata.classList.add('gorunur');
    }
  });
})();
