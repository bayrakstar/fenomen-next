#!/usr/bin/env python3
"""HTML'deki css/js bağlantılarına dosya içeriğinin özetini sürüm etiketi olarak yazar.

Neden: GitHub Pages CSS/JS dosyalarını uzun süre önbellekte tutuyor. Dosya adı
sabit kaldığı sürece Safari yeni sürümü indirmiyor; iş yayına çıkıyor ama kimse
göremiyor. Adresin sonuna içerikten üretilen ?v=... eklenince dosya değişmediyse
etiket de aynı kalıyor (önbellek çalışmaya devam ediyor), değiştiyse tarayıcı
yeni adresi görüp indiriyor.

Elle çalıştırmaya gerek yok: .git/hooks/pre-commit her commit'te çağırıyor.
Elle de çalıştırılabilir:  python3 araclar/surum-yaz.py
"""
import hashlib, pathlib, re, sys

KOK = pathlib.Path(__file__).resolve().parent.parent
VARLIKLAR = ["css/style.css", "js/app.js", "js/basvuru.js", "js/panel.js"]


def ozet(yol: pathlib.Path) -> str:
    return hashlib.md5(yol.read_bytes()).hexdigest()[:10]


def main() -> int:
    etiketler = {}
    for v in VARLIKLAR:
        p = KOK / v
        if p.exists():
            etiketler[v] = ozet(p)

    degisen = []
    for html in sorted(KOK.glob("*.html")):
        metin = eski = html.read_text(encoding="utf-8")
        for varlik, imza in etiketler.items():
            # href="css/style.css?v=..." veya src="js/app.js"  → ikisini de yakalar
            metin = re.sub(
                r'(["\'])' + re.escape(varlik) + r'(\?v=[^"\']*)?\1',
                lambda m: f'{m.group(1)}{varlik}?v={imza}{m.group(1)}',
                metin,
            )
        if metin != eski:
            html.write_text(metin, encoding="utf-8")
            degisen.append(html.name)

    if degisen:
        print("sürüm etiketi güncellendi: " + ", ".join(degisen))
    for varlik, imza in etiketler.items():
        print(f"  {varlik} → ?v={imza}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
