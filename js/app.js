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

  bekleyen.forEach(o => gozcu.observe(o));
  window.addEventListener('scroll', kuyruk, {passive:true});
  window.addEventListener('resize', kuyruk, {passive:true});
  requestAnimationFrame(tara);
})();

/* ---------- SLIDER ---------- */
const SLAYTLAR = [
  {
    baslik: 'Yeni neslin<br>sesini <em>arıyoruz</em>',
    alt: "Radyo Fenomen Next, yeni nesil yayıncıları keşfetmek için başlatılan talent programıdır. Başvurular 31 Ekim'e kadar açıktır."
  },
  {
    baslik: 'Sıradaki ses<br><em>seninki</em> olabilir',
    alt: 'Başvuru için deneyim aranmıyor. 60 saniyelik bir kayıt ve dört soruluk kısa bir form yeterli.'
  },
  {
    baslik: 'Bir sonraki<br>Fenomen <em>kim?</em>',
    alt: "Dört yeni yayıncı, Ocak ayında Radyo Fenomen Next'te kendi programıyla yayına başlıyor."
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

  function git(yeni){
    if (yeni === i) return;
    slaytlar[i].classList.remove('aktif');
    noktalar[i].classList.remove('aktif');
    i = yeni;
    slaytlar[i].classList.add('aktif');
    noktalar[i].classList.add('aktif');

    // yazı: aşağı kaybol → içerik değiş → yukarı gel
    ic.style.transition = 'transform .5s cubic-bezier(.4,0,1,1)';
    ic.style.transform = 'translateY(-108%)';
    alt.style.transition = 'opacity .4s ease, transform .4s ease';
    alt.style.opacity = 0;
    alt.style.transform = 'translateY(-10px)';

    setTimeout(() => {
      ic.innerHTML = SLAYTLAR[i].baslik;
      alt.textContent = SLAYTLAR[i].alt;
      ic.style.transition = 'none';
      ic.style.transform = 'translateY(108%)';
      alt.style.transform = 'translateY(10px)';
      requestAnimationFrame(() => {
        ic.style.transition = 'transform .9s cubic-bezier(.22,1,.36,1)';
        ic.style.transform = 'none';
        alt.style.opacity = 1;
        alt.style.transform = 'none';
      });
    }, 480);
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

  otomatik();
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
