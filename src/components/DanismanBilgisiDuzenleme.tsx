import { Check, Info } from "lucide-react";
import { SINIF_BIRINCIL_BUTON, SINIF_GIRDI } from "@/components/ui";

/**
 * Öğrencinin danışman öğretmen bilgisi formu (23 Ekim 2026 · istek:
 * "Öğrencinin Danışman öğretmen bilgilerini girebileceği bir alan olsun,
 * danışmanın adı soyadı branşı telefon eposta").
 *
 * Sistemdeki danışman ATAMASI değildir (o "Danışman öğretmenim" kartında);
 * burası öğrencinin yazdığı bilgidir ve hiçbir yetki doğurmaz.
 */
export function DanismanBilgisiDuzenleme({
  bilgi,
  kaydetEylemi,
}: {
  bilgi: {
    beyanDanismanAd: string | null;
    beyanDanismanSoyad: string | null;
    beyanDanismanBrans: string | null;
    beyanDanismanTelefon: string | null;
    beyanDanismanEposta: string | null;
  } | null;
  kaydetEylemi: (veri: FormData) => Promise<void>;
}) {
  return (
    <form action={kaydetEylemi} className="space-y-4">
      <p className="flex items-start gap-2 rounded-kutu bg-vurgu-zemin px-3.5 py-2.5 text-sm text-metin">
        <Info size={16} className="mt-0.5 shrink-0 text-vurgu-metin" aria-hidden />
        <span>
          Danışman öğretmeniniz yoksa boş bırakın. Danışman öğretmen, okuduğunuz
          okulda görev yapmalıdır.
        </span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-metin">Ad</span>
          <input
            name="danismanAd"
            maxLength={100}
            defaultValue={bilgi?.beyanDanismanAd ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">Soyad</span>
          <input
            name="danismanSoyad"
            maxLength={100}
            defaultValue={bilgi?.beyanDanismanSoyad ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-metin">Branş</span>
          <input
            name="danismanBrans"
            maxLength={100}
            placeholder="Bilişim Teknolojileri"
            defaultValue={bilgi?.beyanDanismanBrans ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">Telefon</span>
          <input
            type="tel"
            name="danismanTelefon"
            maxLength={20}
            placeholder="05xx xxx xx xx"
            defaultValue={bilgi?.beyanDanismanTelefon ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">E-posta</span>
          <input
            type="email"
            name="danismanEposta"
            maxLength={150}
            defaultValue={bilgi?.beyanDanismanEposta ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
      </div>
      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
        <Check size={16} aria-hidden />
        Kaydet
      </button>
    </form>
  );
}
