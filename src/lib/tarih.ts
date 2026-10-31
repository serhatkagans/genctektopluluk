/**
 * Tarih biçimleme ve form girdisi çözümleme.
 *
 * Tarihler kullanıcının saatiyle yorumlanır: "1 Ağustos" yazan kişi bunu
 * Türkiye saatiyle kastediyor. Başvuru penceresinin bitişi gün SONUNA alınır,
 * aksi halde son gün öğlen kapanırdı.
 */

/*
 * SAAT DİLİMİ AÇIKÇA YAZILIYOR (2 Eylül 2026).
 *
 * Önce yazılmıyordu ve "sunucunun yerel saati Europe/Istanbul" varsayılıyordu.
 * VARSAYIM YANLIŞ: sunucu UTC'de çalışıyor (`timedatectl` → UTC) ve servis
 * biriminde TZ tanımlı değil. Sonuç: panelde basılan HER saat 3 saat geride
 * görünüyordu. En görünür belirtisi erişim/hata kayıtları ekranlarıydı — az
 * önce yazılmış kayıt "3 saat önce" damgasıyla listelendiği için "son 2-3
 * saatin kaydı görünmüyor" diye okundu; kayıt aslında oradaydı (27 Ağustos
 * 2026'daki teşhis buradan kapandı).
 *
 * Saat dilimini süreç ortamına (TZ) bırakmak yerine burada sabitliyoruz:
 * aynı kod hem sunucuda hem tarayıcıda çalışıyor ve ikisi ayrışırsa React
 * hidrasyon uyuşmazlığı verirdi.
 */
const SAAT_DILIMI = "Europe/Istanbul";

const TARIH_BICIMI = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: SAAT_DILIMI,
});

const TARIH_SAAT_BICIMI = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SAAT_DILIMI,
});

export function tarihYaz(tarih: Date): string {
  return TARIH_BICIMI.format(tarih);
}

export function tarihSaatYaz(tarih: Date): string {
  return TARIH_SAAT_BICIMI.format(tarih);
}

/*
 * FORM TARİHLERİ DE TÜRKİYE SAATİYLE (31 Ekim 2026).
 *
 * Basma tarafı 2 Eylül'de Europe/Istanbul'a sabitlenmişti ama form tarafı
 * (aşağıdaki çözümleme ve varsayılan değer fonksiyonları) hâlâ SÜRECİN yerel
 * saatini kullanıyordu — sunucuda UTC. Canlıda görülen: etkinlik formuna
 * 09:49 yazan kişinin etkinliği detayda 12:49 görünüyor; düzenleme formu
 * kayıtlı saati 3 saat geri gösteriyor ve değiştirilmeden kaydedilen bir
 * etkinliğin başvuru bitişi ertesi güne kayıyordu. Geliştirme bilgisayarı
 * Türkiye saatinde olduğu için yerelde hiç görünmüyordu.
 *
 * Artık iki yön de SAAT_DILIMI üzerinden: girilen "gün/saat" Türkiye'deki o
 * an olarak çözülür, formun varsayılanı da o anın Türkiye'deki gün/saatidir.
 */
const PARCA_BICIMI = new Intl.DateTimeFormat("en-US", {
  timeZone: SAAT_DILIMI,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface YerelParcalar {
  yil: number;
  ay: number;
  gun: number;
  saat: number;
  dakika: number;
  saniye: number;
}

/** Bir anın Türkiye saatindeki takvim parçaları. */
function yerelParcalar(an: Date): YerelParcalar {
  const p: Record<string, number> = {};
  for (const parca of PARCA_BICIMI.formatToParts(an)) {
    if (parca.type !== "literal") p[parca.type] = Number.parseInt(parca.value, 10);
  }
  return {
    yil: p.year,
    ay: p.month,
    gun: p.day,
    saat: p.hour % 24,
    dakika: p.minute,
    saniye: p.second,
  };
}

/** Türkiye saatinde verilen gün/saatin gerçek anı. */
function yerelAn(
  yil: number,
  ay: number,
  gun: number,
  saat = 0,
  dakika = 0,
  saniye = 0,
  milisaniye = 0,
): Date {
  const duvar = Date.UTC(yil, ay - 1, gun, saat, dakika, saniye, milisaniye);
  // Önce UTC sanılıp dilim farkı ölçülür, sonra fark düşülür. Türkiye'de yaz
  // saati yok (sabit +03:00) ama hesap, kurala bağlı kalmasın diye genel.
  const p = yerelParcalar(new Date(duvar));
  const gorunen = Date.UTC(p.yil, p.ay - 1, p.gun, p.saat, p.dakika, p.saniye);
  const fark = gorunen - (duvar - milisaniye);
  return new Date(duvar - fark);
}

function parcala(deger: string): [number, number, number] | null {
  const parcalar = deger.split("-").map((parca) => Number.parseInt(parca, 10));
  if (parcalar.length !== 3 || parcalar.some((sayi) => !Number.isFinite(sayi))) {
    return null;
  }
  return parcalar as [number, number, number];
}

/** `<input type="date">` değerini o günün başlangıcına çevirir. */
export function gunBasi(deger: string | null): Date | null {
  if (!deger) return null;
  const parcalar = parcala(deger);
  if (!parcalar) return null;
  const [yil, ay, gun] = parcalar;
  return yerelAn(yil, ay, gun, 0, 0, 0, 0);
}

/**
 * Bugünün başlangıcı (yerel saatle 00:00).
 *
 * Tarih SORULMAYAN kayıtlar için (22 Ağustos 2026 · ürün formu). `gunBasi` ile
 * aynı biçimi üretiyor — saat taşıyan bir tarih, gün başına alınmış öbür
 * kayıtların yanında sıralamada farklı davranırdı.
 */
export function bugununBasi(): Date {
  const bugun = yerelParcalar(new Date());
  return yerelAn(bugun.yil, bugun.ay, bugun.gun, 0, 0, 0, 0);
}

/** `<input type="date">` değerini o günün sonuna çevirir. */
export function gunSonu(deger: string | null): Date | null {
  if (!deger) return null;
  const parcalar = parcala(deger);
  if (!parcalar) return null;
  const [yil, ay, gun] = parcalar;
  return yerelAn(yil, ay, gun, 23, 59, 59, 999);
}

/** `<input type="datetime-local">` değerini yerel saatli tarihe çevirir. */
export function yerelTarihSaat(deger: string | null): Date | null {
  if (!deger) return null;
  const eslesme = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    deger.trim(),
  );
  if (!eslesme) return null;
  const [yil, ay, gun, saat, dakika, saniye] = eslesme
    .slice(1)
    .map((parca) => Number.parseInt(parca ?? "0", 10) || 0);
  const tarih = yerelAn(yil, ay, gun, saat, dakika, saniye);
  return Number.isNaN(tarih.getTime()) ? null : tarih;
}

/** Date'i `<input type="date">` varsayılanı olarak yazar. */
export function girdiTarihi(tarih: Date): string {
  const iki = (sayi: number) => String(sayi).padStart(2, "0");
  const p = yerelParcalar(tarih);
  return `${p.yil}-${iki(p.ay)}-${iki(p.gun)}`;
}

/**
 * Date'i `<input type="datetime-local">` varsayılanı olarak yazar.
 *
 * toISOString KULLANILMAZ: o UTC'ye çevirir ve düzenleme formu kullanıcıya
 * saatini kaydırılmış gösterirdi.
 */
export function girdiTarihSaati(tarih: Date): string {
  const iki = (sayi: number) => String(sayi).padStart(2, "0");
  const p = yerelParcalar(tarih);
  return `${girdiTarihi(tarih)}T${iki(p.saat)}:${iki(p.dakika)}`;
}
