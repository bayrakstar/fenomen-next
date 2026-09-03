# Radyo Fenomen Next

Radyo Fenomen'in yeni nesil yayıncı arayışı programı **Radyo Fenomen Next** için başvuru sitesi.

Yayında: https://bayrakstar.github.io/fenomen-next/

## Sayfalar

| Dosya | İçerik |
|---|---|
| `index.html` | Slider · başvuru çağrısı · dört başlık kartı · sık sorulan sorular |
| `basvuru.html` | Başvuru formu, kayıt yükleme ve transfer linki seçenekleri |
| `program.html` | Altı aşamalık süreç, değerlendirme kriterleri, Challenge Day |
| `juri.html` | Beş kişilik jüri |
| `takvim.html` | Program takvimi |
| `odul.html` | Kazananlara sunulanlar |
| `aydinlatma.html` | KVKK aydınlatma metni |

Statik site; derleme adımı yok. Yerelde denemek için:

```
python3 -m http.server 8000
```

## Başvuru formu

Form iki yolla kayıt kabul eder: dosya yükleme (500 MB'a kadar) veya transfer linki
(WeTransfer, SwissTransfer, SendGB, Google Drive).

**Depolama henüz bağlı değil.** `js/basvuru.js` içindeki `AYAR.API_TABAN` boş olduğu sürece
form demo modda çalışır: yükleme canlandırılır, gönderilen veri yalnızca konsola yazılır.
Adres tanımlandığında gerçek akış devreye girer:

1. `POST /yukleme-izni` → imzalı yükleme adresi döner
2. Dosya tarayıcıdan doğrudan depolamaya `PUT` edilir (sunucudan geçmez)
3. `POST /basvuru` → form verisi ve kaydın adresi gönderilir

## Notlar

- Jüri sayfasındaki isimler ve portreler **temsilîdir**; gerçek kadro açıklandığında değişecek.
- Fontlar Google Fonts üzerinden gelir (Archivo + Roboto). Marka yazıyüzü Gosha Sans'ın
  web lisansı olmadığı için başlıklarda Archivo kullanılıyor.
