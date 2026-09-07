/* FENOMEN NEXT — tüm sayfalarda ortak davranış */

/* ---------- ÜST BAR ---------- */
(function ustbar(){
  const bar = document.getElementById('ustbar');
  if (!bar || document.body.classList.contains('ic-sayfa')) return;
  const hero = document.getElementById('hero');
  const esik = () => (hero ? hero.offsetHeight - 90 : 60);
  const kontrol = () => bar.classList.toggle('sabit', window.scrollY > esik());
  window.addEventListener('scroll', kontrol, {passive:true});
  kontrol();
})();

/* ---------- MOBİL MENÜ ---------- */
(function mobilMenu(){
  const tus = document.getElementById('menuTus');
  const menu = document.getElementById('mobilMenu');
  if (!tus || !menu) return;
  const degistir = () => document.body.classList.toggle('menu-acik');
  tus.addEventListener('click', degistir);
  menu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => document.body.classList.remove('menu-acik')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.body.classList.remove('menu-acik');
  });
})();

/* ---------- LİSTELERDE SIRALI GİRİŞ ----------
   Liste öğeleri tek blok hâlinde belirdiğinde hareket toplu ve sert duruyor.
   Burada her öğeye sırasına göre gecikme veriliyor; gözcü onları tek tek açıyor.
   Kaydırma animasyonu bloğundan ÖNCE çalışmalı — .belir sınıflarını o topluyor. */
(function siraliGiris(){
  const GRUPLAR = [
    ['.faz-liste',     ':scope > .faz',       70],
    ['.yol-liste',     ':scope > .yol-satir', 60],
    ['.rozetler',      ':scope > .rozet',     35],
    ['.gerisayim',     ':scope > div',        90],
    ['.juri-bekleyen', ':scope > .juri-yer',  70],
    ['.sss-liste',     ':scope > .sss-oge',   45],
    ['.kutu-izgara',   ':scope > .kutu',      90]
  ];
  GRUPLAR.forEach(([kap, secici, adim]) => {
    document.querySelectorAll(kap).forEach(k => {
      k.querySelectorAll(secici).forEach((o, i) => {
        o.classList.add('belir');
        // elle verilmiş gecikme varsa ona dokunma
        if (!o.style.getPropertyValue('--gec')) o.style.setProperty('--gec', (i * adim) + 'ms');
      });
    });
  });
})();

/* ---------- BÖLÜM BAŞLIKLARI SIRALI ----------
   Etiket → başlık → açıklama aynı anda geliyordu; araya küçük aralık konuyor. */
(function baslikSirasi(){
  document.querySelectorAll('.bolum-bas').forEach(b => {
    const et = b.querySelector('.etiket');
    const rz = b.querySelector('.durum-rozet');
    const h  = b.querySelector('.yaz');
    const p  = b.querySelector('p');
    if (et && !et.style.getPropertyValue('--gec')) et.style.setProperty('--gec','0ms');
    if (rz && !rz.style.getPropertyValue('--gec')) rz.style.setProperty('--gec','90ms');
    if (h  && !h.style.getPropertyValue('--gec'))  h.style.setProperty('--gec','120ms');
    if (p  && !p.style.getPropertyValue('--gec'))  p.style.setProperty('--gec','300ms');
  });
})();

/* ---------- KAYDIRMA ANİMASYONLARI ---------- */
(function animasyon(){
  const bekleyen = new Set(document.querySelectorAll('.belir, .yaz, .cizgi-ciz'));
  if (!bekleyen.size) return;

  const ac = o => { o.classList.add('gorunur'); bekleyen.delete(o); gozcu.unobserve(o); };

  const gozcu = new IntersectionObserver(giren => {
    giren.forEach(g => { if (g.isIntersecting) ac(g.target); });
  }, {threshold:.1, rootMargin:'0px 0px -70px 0px'});

  // hızlı kaydırmada gözcü küçük öğeleri atlayabiliyor; eşiği geçen ne varsa açılır
  let planli = false;
  function tara(){
    planli = false;
    const esik = window.innerHeight * .92;
    bekleyen.forEach(o => { if (o.getBoundingClientRect().top < esik) ac(o); });
    if (!bekleyen.size) window.removeEventListener('scroll', kuyruk);
  }
  function kuyruk(){
    if (planli) return;
    planli = true;
    requestAnimationFrame(tara);
  }

  /* Hero zaten ekranda: gözcünün alt kırpma payına takılan sayaç şeridi hiç açılmıyordu.
     Hero içindekiler kendi --gec sıralarıyla, yükleme anında açılır. */
  document.querySelectorAll('#hero .belir, #hero .yaz').forEach(o => {
    bekleyen.delete(o);
    requestAnimationFrame(() => o.classList.add('gorunur'));
  });

  bekleyen.forEach(o => gozcu.observe(o));
  window.addEventListener('scroll', kuyruk, {passive:true});
  window.addEventListener('resize', kuyruk, {passive:true});
  requestAnimationFrame(tara);
})();

/* ---------- SLIDER ---------- */
/* Açılışta "Fenomen kim?" sorusu duruyor; kısa bir bekleme sonrası cevaba dönüyor.
   Sonrasında normal slayt döngüsü başlıyor — soru bir daha sorulmuyor. */
const SLAYTLAR = [
  {
    baslik: 'Belki <em>sen</em>.',
    alt: "Telefonuna aldığın 60 saniyelik kayıt, tam da o Fenomen anı olabilir."
  },
  {
    baslik: 'Sıradaki ses<br><em>seninki</em> olabilir',
    alt: 'Deneyim aranmıyor. Bir kayıt, iki soru, birkaç dakika yeterli.'
  },
  {
    baslik: 'Yeni neslin sesini<br><em>arıyoruz</em>',
    alt: "Dört yeni yayıncı, Ocak ayında kendi programıyla yayına başlıyor."
  }
];

(function slider(){
  const slaytlar = document.querySelectorAll('.slayt');
  const noktalar = document.querySelectorAll('#heroNokta button');
  const baslik = document.getElementById('heroBaslik');
  const alt = document.getElementById('heroAlt');
  if (slaytlar.length < 2 || !baslik) return;

  let i = 0, zaman;
  const ic = baslik.querySelector('span');

  /* yazı: aşağı kaybol → içerik değiş → yukarı gel */
  function yaziDegistir(yeniBaslik, yeniAlt){
    ic.style.transition = 'transform .58s cubic-bezier(.55,0,.75,.35), filter .5s ease';
    ic.style.transform = 'translateY(-108%)';
    ic.style.filter = 'blur(5px)';
    alt.style.transition = 'opacity .45s ease, transform .45s ease, filter .45s ease';
    alt.style.opacity = 0;
    alt.style.transform = 'translateY(-12px)';
    alt.style.filter = 'blur(5px)';

    setTimeout(() => {
      ic.innerHTML = yeniBaslik;
      alt.textContent = yeniAlt;
      ic.style.transition = 'none';
      ic.style.transform = 'translateY(108%)';
      alt.style.transform = 'translateY(12px)';
      requestAnimationFrame(() => {
        ic.style.transition = 'transform 1.05s cubic-bezier(.16,.84,.28,1), filter .7s ease';
        ic.style.transform = 'none';
        ic.style.filter = 'blur(0)';
        alt.style.transition = 'opacity .7s ease .12s, transform .8s cubic-bezier(.16,.84,.28,1) .12s, filter .7s ease .12s';
        alt.style.opacity = 1;
        alt.style.transform = 'none';
        alt.style.filter = 'blur(0)';
      });
    }, 560);
  }

  function git(yeni){
    if (yeni === i) return;
    slaytlar[i].classList.remove('aktif');
    noktalar[i].classList.remove('aktif');
    i = yeni;
    slaytlar[i].classList.add('aktif');
    noktalar[i].classList.add('aktif');
    yaziDegistir(SLAYTLAR[i].baslik, SLAYTLAR[i].alt);
  }

  function otomatik(){
    clearInterval(zaman);
    zaman = setInterval(() => git((i + 1) % slaytlar.length), 7000);
  }

  noktalar.forEach(n => n.addEventListener('click', () => { git(+n.dataset.git); otomatik(); }));

  // mobilde kaydırarak geçiş
  let bas = null;
  const hero = document.getElementById('hero');
  hero.addEventListener('touchstart', e => bas = e.changedTouches[0].clientX, {passive:true});
  hero.addEventListener('touchend', e => {
    if (bas === null) return;
    const fark = e.changedTouches[0].clientX - bas;
    if (Math.abs(fark) > 60){
      git(fark < 0 ? (i + 1) % slaytlar.length : (i - 1 + slaytlar.length) % slaytlar.length);
      otomatik();
    }
    bas = null;
  }, {passive:true});

  /* açılış: soru → cevap. Hareket azaltma açıksa soru beklemeden cevaba döner. */
  const azalt = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (azalt){
    ic.innerHTML = SLAYTLAR[0].baslik;
    alt.textContent = SLAYTLAR[0].alt;
    otomatik();
  } else {
    setTimeout(() => { yaziDegistir(SLAYTLAR[0].baslik, SLAYTLAR[0].alt); otomatik(); }, 2900);
  }
})();

/* ---------- MENÜDE AKTİF BÖLÜM ---------- */
(function menuTakip(){
  const baglar = [...document.querySelectorAll('.ustbar-menu a[href^="#"], .mobil-menu a[href^="#"]')];
  if (!baglar.length) return;

  const hedefler = baglar
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!hedefler.length) return;

  const isaretle = id => baglar.forEach(a =>
    a.classList.toggle('bu-sayfa', a.getAttribute('href') === '#' + id));

  const gozcu = new IntersectionObserver(giren => {
    // ekranın üst yarısına en yakın bölüm aktif sayılır
    const gorunen = giren.filter(g => g.isIntersecting);
    if (gorunen.length) isaretle(gorunen[0].target.id);
  }, {rootMargin:'-45% 0px -50% 0px'});

  hedefler.forEach(h => gozcu.observe(h));
})();

/* ---------- SSS ---------- */
(function sss(){
  const ogeler = document.querySelectorAll('.sss-oge');
  if (!ogeler.length) return;

  const ac = oge => {
    const govde = oge.querySelector('.sss-govde');
    oge.classList.add('acik');
    govde.style.maxHeight = govde.scrollHeight + 'px';
  };
  const kapa = oge => {
    oge.classList.remove('acik');
    oge.querySelector('.sss-govde').style.maxHeight = 0;
  };

  ogeler.forEach(oge => {
    oge.querySelector('.sss-bas').addEventListener('click', () => {
      const acikMi = oge.classList.contains('acik');
      ogeler.forEach(kapa);
      if (!acikMi) ac(oge);
    });
  });

  const ilk = document.querySelector('.sss-oge.acik');
  if (ilk) ac(ilk);

  window.addEventListener('resize', () => {
    const a = document.querySelector('.sss-oge.acik');
    if (a){
      const g = a.querySelector('.sss-govde');
      g.style.maxHeight = 'none';
      const y = g.scrollHeight;
      g.style.maxHeight = y + 'px';
    }
  });
})();
