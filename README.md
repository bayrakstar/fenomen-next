# Radyo Fenomen Next

Radyo Fenomen'in yeni nesil yayıncı arayışı programı **Radyo Fenomen Next** için başvuru sitesi.

Yayında: https://bayrakstar.github.io/fenomen-next/

## Yapı

Site **tek sayfa**. Menüdeki her başlık `index.html` içindeki bir bölüme kaydırır;
ayrı sekme ya da ayrı sayfa açılmaz.

| Bölüm | Bağlantı | İçerik |
|---|---|---|
| Hero | `#hero` | "Fenomen kim?" sorusuyla açılıp cevaba dönen slider (3 kare) |
| Program | `#program` | Altı aşama · değerlendirme kriterleri · Challenge Day |
| Jüri | `#juri` | Beş kişilik jüri |
| Takvim | `#takvim` | Geri sayım şeridi · aşama listesi · hatırlatma |
| Ödül | `#odul` | Yayın hakkı · Creator Starter Pack · finalist kazanımları |
| Başvuru | `#basvuru` | Başvuru formu ve kayıt linki |
| Sorular | `#sorular` | Sık sorulan sorular (başvurunun hemen altında) |

| Dosya | İçerik |
|---|---|
| `index.html` | Sitenin tamamı |
| `aydinlatma.html` | KVKK aydınlatma metni (ayrı sayfa kalmaya devam ediyor) |
| `basvuru.html` · `program.html` · `juri.html` · `takvim.html` · `odul.html` | Eski adresler. Yalnızca yönlendirme: ilgili bölüme atıp kayboluyorlar. Paylaşılmış eski bir link kırılmasın diye duruyorlar. |

Statik site; derleme adımı yok. Yerelde denemek için:

```
python3 -m http.server 8000
```

## Başvuru formu

Kayıt siteye yüklenmez: aday videosunu Google Drive, YouTube ("liste dışı") veya SwissTransfer'a
yükler, oluşan linki forma yapıştırır. Her servisin nasıl kullanılacağı formdaki kısayollarda
adım adım anlatılır.

WeTransfer ve SendGB kaldırıldı: linkleri 7 gün sonra ölüyor, değerlendirme ise Kasım'a sarkıyor.
Drive ve YouTube süresiz; SwissTransfer üye olmak istemeyenler için 30 gün duruyor.

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

## Yayına gönderirken: sürüm etiketi

`index.html` ve `aydinlatma.html` içinde stil ve script bağlantıları sürüm etiketi taşır:

```
css/style.css?v=20260907b
js/app.js?v=20260907b
```

Tarayıcılar (özellikle telefonda Safari) sabit isimli dosyayı önbellekte tutuyor; etiket
değişmezse kullanıcı eski stille kalıyor. **`css/style.css` veya `js/*.js` değiştiğinde
bu etiketi de güncelle** — yoksa değişiklik yayına çıkar ama kimse göremez.
