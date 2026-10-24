import { ArrowRight, BadgeCheck, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { KatkiGorevBolumu, KatkiGrupBolumu } from "@/components/KatkiKarti";
import { OgretmenKatkiKarti } from "@/components/OgretmenKatkiKarti";
import {
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { katkiVerisiGetir } from "@/lib/ogrenci/katki";
import { ogretmenKatkiVerisiGetir } from "@/lib/ogretmen/katki";
import { tarihYaz } from "@/lib/tarih";
import { ogrenciMi } from "@/lib/yetki/izinler";

export const dynamic = "force-dynamic";

/**
 * GÖREVLERİM — kişinin GençTek içinde aldığı görevler (21 Ağustos 2026).
 *
 * İstek: "Şu bölüm kalkacak: GençTek Yolculuğum. Ancak yaptığı görevler
 * Görevlerim kart olarak yukarı taşınacak."
 *
 * SADECE GÖREV (22 Ağustos 2026 · istek: "burada temsilcilikleri vb. ve
 * GençTek görevleri gösterilecek sadece … eba asistan, değerlendirme ekibi
 * vb.'de görev alıyorsa onlar"). Ekran önce "GençTek Yolculuğum" kartının
 * tamamını basıyordu: akran eğitimleri, katıldığı etkinlikler ve çalışma
 * grupları da oradaydı. Üçü de görev DEĞİL — ikisi katılım kaydı, biri kendi
 * seçimi; hepsi Bilişim Yolculuğum ekranında duruyor. "Görevlerim" adını
 * taşıyan ekranda görev olmayan üç liste, sayının neyi saydığını da
 * belirsizleştiriyordu.
 *
 * İKİ KAYNAK: atama kaydından düşen temsilcilik/organizasyon (KatkiGorevBolumu)
 * ve merkezin açtığı GençTek görevlerinden ONAYLANMIŞ olanlar. İkincisi
 * başvuruyla alınır (bkz. /panel/talepler/genctek-gorevleri) ama kişi görevi
 * aldıktan sonra o ekrana bir daha uğramıyor; "hangi ekipteyim" sorusunun
 * cevabı burada olmalı.
 *
 * ÖĞRENCİ VE ÖĞRETMEN AYNI ADRESİ kullanır ama farklı kart görür: temsilcilik
 * ile öğretmen görev geçmişi farklı tablolardan doğuyor. GençTek görevleri
 * bölümü ikisinde de aynı — başvuru rolden bağımsızdır.
 */
export default async function GorevlerimSayfasi() {
  const kullanici = await oturumKullanicisiZorunlu();

  /*
   * YALNIZCA ONAYLANMIŞ başvurular: bekleyen bir başvuru henüz görev değildir,
   * reddedilen hiç değildir. İkisinin durumu başvuru ekranında yazıyor; burası
   * "şu an neyin sorumlusuyum" listesi.
   */
  const [gencTekGorevleri, acikGorevSayisi, bekleyenBasvurular] =
    await Promise.all([
      prisma.gencTekGorevBasvurusu.findMany({
        where: { kullaniciId: kullanici.id, onayDurumu: "ONAYLANDI" },
        orderBy: { kararTarihi: "desc" },
        select: {
          id: true,
          kararTarihi: true,
          gorev: { select: { ad: true, aciklama: true, aktif: true } },
        },
      }),
      /*
       * AÇIK GÖREVLERE GİDEN YOL (24 Ekim 2026 · istek: "gençtek görevlerim
       * boş çıkıyor, açık görev mi yok, neden göremiyor"). Liste yalnızca
       * onaylanmış görevleri gösterdiği için başvurmamış kişi boş bir sayfa
       * görüyor ve görevlerin Pano'da olduğunu bilmiyordu.
       */
      prisma.gencTekGorevi.count({ where: { aktif: true } }),
      prisma.gencTekGorevBasvurusu.findMany({
        where: { kullaniciId: kullanici.id, onayDurumu: "BEKLIYOR" },
        select: { id: true, gorev: { select: { ad: true } } },
      }),
    ]);

  /*
   * KART BAŞLIKLARINDA AÇIKLAMA YOK (25 Ağustos 2026 · istek: "buradaki
   * açıklamaları silelim"). Üç satır da listenin kendisinden fazlasını
   * söylemiyordu: temsilciliğin atamadan düştüğünü, grubun panelden
   * seçildiğini ve görevin panodan alındığını kişi zaten o ekranlardan
   * biliyor. Başlık + liste, sayfayı bir okumada bitiriyor.
   */
  const gencTekBolumu = (
    <Kart>
      <KartBasligi baslik="GençTek görevlerim" Ikon={BadgeCheck} />
      {gencTekGorevleri.length === 0 ? (
        <p className="text-sm text-metin-yumusak">
          Henüz bir GençTek görevinde yer almıyorsunuz.
          {acikGorevSayisi > 0 &&
            ` Şu an başvuruya açık ${acikGorevSayisi} görev var.`}
        </p>
      ) : (
        <ul className="divide-y divide-cizgi">
          {gencTekGorevleri.map((basvuru) => (
            <li key={basvuru.id} className="py-3 first:pt-0 last:pb-0">
              <p className="font-medium text-metin">
                {basvuru.gorev.ad}
                {/*
                  Kapatılan görev listeden DÜŞMÜYOR: kişi o ekipte görev aldı ve
                  bu bir katkıdır. İşaret, ekibin artık çalışmadığını söylüyor.
                */}
                {!basvuru.gorev.aktif && (
                  <span className="ml-2 rounded-full bg-uyari-zemin px-2 py-0.5 text-xs font-normal text-uyari-metin">
                    kapatıldı
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-metin-yumusak">
                {basvuru.gorev.aciklama}
              </p>
              {basvuru.kararTarihi && (
                <p className="mt-1 text-xs text-metin-yumusak">
                  {tarihYaz(basvuru.kararTarihi)} tarihinde görevlendirildiniz.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {bekleyenBasvurular.length > 0 && (
        <p className="mt-4 text-sm text-metin-yumusak">
          Onay bekleyen başvurunuz:{" "}
          {bekleyenBasvurular.map((basvuru) => basvuru.gorev.ad).join(", ")}
        </p>
      )}
      {acikGorevSayisi > 0 && (
        <div className="mt-4">
          <Link
            href="/panel/talepler/genctek-gorevleri"
            className={SINIF_IKINCIL_BUTON}
          >
            Açık görevlere göz at ve başvur
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      )}
    </Kart>
  );

  if (ogrenciMi(kullanici)) {
    const katki = await katkiVerisiGetir(kullanici.id);

    return (
      <div className="space-y-6">
        <SayfaBasligi
          baslik="Görevlerim"
          aciklama={`${katki.gorevler.length} temsilcilik · ${katki.gruplar.length} çalışma grubu · ${gencTekGorevleri.length} GençTek görevi`}
        />
        <Kart>
          <KartBasligi baslik="Temsilcilikler" Ikon={Sparkles} />
          {/*
            ORGANİZASYON LİSTESİ BASILMIYOR (22 Ağustos 2026 · istek: "Görev
            aldığı GençTek organizasyonları bunu kaldır"). Kişinin düzenlediği
            etkinlikler Etkinlikler ekranında ve profildeki yolculuk kartında
            duruyor; burada bir görev listesinin ortasında ikinci bir etkinlik
            listesi açıyordu.
          */}
          <KatkiGorevBolumu
            kendiMi
            gorevler={katki.gorevler}
            faaliyetler={katki.faaliyetler}
            egitimOgretimYili={kullanici.egitimOgretimYili}
            organizasyonlarGorunsun={false}
          />
        </Kart>
        {/*
          ÇALIŞMA GRUPLARI DA BURADA (22 Ağustos 2026 · istek: "burada
          temsilcilikler, çalışma grupları ve panodaki GençTek görevlerini
          görecek").

          Grup seçimi bir görev değil bir tercihtir ve seçimin YAPILDIĞI yer
          panel; burası onun okunduğu yer. Düzenleme bağlantısı da oraya
          iniyor — aynı seçimi iki ekrandan yapmak, hangisinin güncel olduğunu
          belirsizleştirirdi.
        */}
        <Kart>
          <KartBasligi baslik="Çalışma gruplarım" Ikon={Layers} />
          <KatkiGrupBolumu kendiMi gruplar={katki.gruplar} />
        </Kart>
        {gencTekBolumu}
      </div>
    );
  }

  const katki = await ogretmenKatkiVerisiGetir(kullanici.id);

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Görevlerim"
        aciklama={`${katki.gorevler.length} görev · ${katki.faaliyetler.length} etkinlik · ${gencTekGorevleri.length} GençTek görevi`}
      />
      <OgretmenKatkiKarti
        kendiMi
        gorevler={katki.gorevler}
        aktifDanismanlik={katki.aktifDanismanlik}
        faaliyetler={katki.faaliyetler}
      />
      {gencTekBolumu}
    </div>
  );
}
