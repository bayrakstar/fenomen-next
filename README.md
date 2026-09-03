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

Kayıt siteye yüklenmez: aday videosunu WeTransfer, SwissTransfer, SendGB veya Google Drive'a
yükler, oluşan linki forma yapıştırır. Her servisin nasıl kullanılacağı formdaki kısayollarda
adım adım anlatılır.

Başvurular **Supabase**'e yazılır — `bayrakstar-site` projesi, `fenomen_next_basvurular` tablosu.
Form doğrudan PostgREST'e `POST` eder; ayrı bir sunucu yok.

Sayfadaki publishable anahtar herkese açık olacak şekilde tasarlanmıştır: tablodaki RLS kuralı
`anon` rolüne yalnızca `INSERT` izni verir. Kayıtları okumak, değiştirmek ve silmek giriş yapmış
hesaplara açıktır; dışarıdan okuma boş liste döner.

Alan doğrulaması veritabanı seviyesinde de yapılır (e-posta biçimi, uzunluk sınırları,
`kayit_turu` ve `durum` için izinli değer listesi).

### Başvuruları görmek

Supabase panelinde `fenomen_next_basvurular` tablosu. `durum` alanı değerlendirme için:
`yeni · incelendi · kisa_liste · finalist · elendi`.

## Notlar

- Jüri sayfasındaki isimler ve portreler **temsilîdir**; gerçek kadro açıklandığında değişecek.
- Fontlar Google Fonts üzerinden gelir (Archivo + Roboto). Marka yazıyüzü Gosha Sans'ın
  web lisansı olmadığı için başlıklarda Archivo kullanılıyor.
