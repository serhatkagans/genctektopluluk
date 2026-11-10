import type {
  GorevRolKodu,
  LogHedefTip,
  LogIslemi,
  RolKodu,
} from "@/generated/prisma/enums";
import type { OturumKullanicisi } from "./tipler";

export const ROL_ETIKETLERI: Record<RolKodu, string> = {
  OGRENCI: "Öğrenci",
  DANISMAN: "Danışman öğretmen",
  // Unvan, büyük harfle (10 Kasım 2026 · istek: üst bardaki rozette
  // "İl koordinatörü" yerine "İl Koordinatörü" dursun). Vitrindeki unvanla aynı.
  IL_KOORDINATOR: "İl Koordinatörü",
  PROJE_YONETICISI: "Proje yöneticisi",
  // EBA dışı roller: kimlikleri AuthProvider'dan gelmez, başvuru onayıyla
  // doğar (bkz. lib/dis-kimlik/).
  MEZUN: "Mezun",
  PAYDAS_TEMSILCISI: "Paydaş temsilcisi",
};

/**
 * Öğrenci görev rolleri. Bunlar YETKİ VERMEZ (permissions.md Bölüm 5), yalnızca
 * dönem bazlı görev etiketidir.
 */
export const GOREV_ROL_ETIKETLERI: Record<GorevRolKodu, string> = {
  IL_TEMSILCISI: "İl Temsilcisi",
  ILCE_TEMSILCISI: "İlçe Temsilcisi",
  OKUL_TEMSILCISI: "Okul Temsilcisi",
  CALISMA_GRUBU_YONETICISI: "Çalışma Grubu Yöneticisi",
};

/** Görev kaydının kapsam adları; hangisinin dolu olduğu rol koduna bağlıdır. */
export interface GorevKapsamAdlari {
  rolKodu: GorevRolKodu;
  il?: { ad: string } | null;
  ilce?: { ad: string } | null;
  kurum?: { ad: string } | null;
  /** CALISMA_GRUBU_YONETICISI rolünün kapsamı; diğerlerinde boş. */
  calismaGrubu?: { ad: string } | null;
}

/**
 * Görevi yerinin adıyla birlikte yazar: "Çankaya İlçe Temsilcisi".
 *
 * Yer adı, görev kaydının KENDİ kapsam sütunundan gelir; öğrencinin güncel
 * il/ilçe/okul kaydından değil. Öğrenci dönem içinde taşındığında görev
 * verildiği yerde kalır ve etiketin de orayı göstermesi gerekir.
 *
 * Kapsam adı çekilmediyse (ör. yalnızca rol kodu seçilen bir sorgu) sade rol
 * adına düşülür — eksik veriyle "undefined Temsilcisi" yazmaktansa etiketi
 * kısaltmak yeğdir.
 */
export function gorevRolAdi(gorev: GorevKapsamAdlari): string {
  const yer =
    gorev.rolKodu === "IL_TEMSILCISI"
      ? gorev.il?.ad
      : gorev.rolKodu === "ILCE_TEMSILCISI"
        ? gorev.ilce?.ad
        : /*
           * Çalışma grubu yöneticiliğinin "yer"i bir kurum değil GRUPTUR
           * (7 Ağustos 2026). Kurum adına düşseydi etiket "Atatürk Lisesi
           * Çalışma Grubu Yöneticisi" derdi — hangi grubun yöneticisi olduğu
           * kaybolurdu.
           */
          gorev.rolKodu === "CALISMA_GRUBU_YONETICISI"
          ? gorev.calismaGrubu?.ad
          : gorev.kurum?.ad;

  const etiket = GOREV_ROL_ETIKETLERI[gorev.rolKodu];
  return yer ? `${yer} ${etiket}` : etiket;
}

export const LOG_ISLEM_ETIKETLERI: Record<LogIslemi, string> = {
  GIRIS: "Oturum açma",
  CIKIS: "Oturum kapama",
  GORUNTULEME: "Görüntüleme",
  DEGISIKLIK: "Değişiklik",
  SILME: "Silme",
};

export const LOG_HEDEF_ETIKETLERI: Record<LogHedefTip, string> = {
  OTURUM: "Oturum",
  OGRENCI: "Öğrenci kaydı",
  OGRETMEN: "Öğretmen kaydı",
  FAALIYET: "Etkinlik",
  YORUM: "Yorum",
  FAALIYET_EK: "Dosya/görsel",
  BASVURU: "Başvuru",
  ROL: "Rol ataması",
  DANISMAN_ATAMA: "Danışman ataması",
  PROFIL: "Profil",
  ERISIM_LOGU: "Erişim kayıtları",
  SISTEM_AYARI: "Sistem ayarı",
  CALISMA_GRUBU: "Çalışma grubu",
  ETKINLIK_PROGRAMI: "Etkinlik programı",
  PAYDAS: "Paydaş kaydı",
  BILDIRIM_SABLONU: "Bildirim şablonu",
  DIS_BASVURU: "Dış giriş başvurusu",
  HATA_KAYDI: "Hata kayıtları",
  KVKK_BASVURUSU: "KVKK başvurusu",
};

/**
 * Kullanıcının rol etiketi. Rolsüz öğretmen de sistemde görünür; 27 Ağustos
 * 2026'dan beri rol ilk girişte kendiliğinden verildiği için bu etiket
 * yalnızca okul kaydı eksik olan ya da görevini bırakmış öğretmene çıkar
 * (bkz. lib/kullanici/sagla.ts).
 */
export function kullaniciRolEtiketi(kullanici: OturumKullanicisi): string {
  if (kullanici.roller.length === 0) {
    return "Öğretmen (danışmanlık görevi alınmadı)";
  }
  return kullanici.roller
    .map((rol) => ROL_ETIKETLERI[rol.rolKodu])
    .join(" · ");
}

/**
 * VİTRİNDEKİ (banner) KURUMSAL UNVAN — 27 Ağustos 2026 · istekler: "proje
 * yöneticisi bunu genç bilişim ekosistemi koordinatörlüğü olsun / yeğitek …
 * bannera" · "koordinatör için bannera da yazalım / il koordinatörü diye".
 *
 * NİYE `ROL_ETIKETLERI`'NİN ÜSTÜNE AYRI BİR SÖZLÜK: rol etiketi bir TABLO
 * HÜCRESİ ve bir CSV sütunudur — öğretmen listesinde, görev rolleri ekranında,
 * dışa aktarmalarda, rol rozetinde hep aynı iki kelimeyle geçiyor. Oraya
 * "Genç Bilişim Ekosistemi Koordinatörlüğü · YEĞİTEK" yazılsaydı sütun taşar
 * ve rozet satır boyu bir şeride dönerdi. Vitrin ise kişinin kendi panelinde
 * kimlik cümlesini kurduğu tek yer; uzun unvanın yeri orası.
 *
 * İL ADI UNVANIN ÖNÜNE GEÇER ("Manisa İl Koordinatörü"): kapsamsız bir
 * "İl koordinatörü" satırı, hangi ilin koordinatörü olduğunu söylemiyordu —
 * aynı düzeltme 26 Ağustos'ta üst bardaki rol rozetinde de yapılmıştı (bkz.
 * panel/layout.tsx · ilAdlari). Ad bulunamazsa unvan yalın basılır; il kodu
 * (plaka) ekrana YAZILMAZ, o bir veritabanı anahtarıdır.
 *
 * Sözlükte karşılığı olmayan rol `ROL_ETIKETLERI`'ne düşer: öğrenci, danışman,
 * mezun ve paydaş için vitrinde de aynı kısa ad doğru.
 */
export const VITRIN_ROL_UNVANLARI: Partial<Record<RolKodu, string>> = {
  PROJE_YONETICISI: "Genç Bilişim Ekosistemi Koordinatörlüğü · YEĞİTEK",
  IL_KOORDINATOR: "İl Koordinatörü",
};

export function vitrinRolUnvani(
  kullanici: OturumKullanicisi,
  ilAdlari?: ReadonlyMap<string, string>,
): string {
  if (kullanici.roller.length === 0) {
    return "Öğretmen (danışmanlık görevi alınmadı)";
  }
  return kullanici.roller
    .map((rol) => {
      const unvan =
        VITRIN_ROL_UNVANLARI[rol.rolKodu] ?? ROL_ETIKETLERI[rol.rolKodu];
      const ilAdi = rol.ilKodu === null ? null : ilAdlari?.get(rol.ilKodu);
      return ilAdi ? `${ilAdi} ${unvan}` : unvan;
    })
    .join(" · ");
}
