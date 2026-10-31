"use client";

import { Megaphone } from "lucide-react";
import { useActionState } from "react";
import { BilgiKutusu, SINIF_BIRINCIL_BUTON, SINIF_GIRDI } from "@/components/ui";

/**
 * Toplu duyuru formu (12 Ağustos 2026).
 *
 * İSTEK: "onay kutusunu işaretlemeden duyuruyu gönder deyince mesaj gitmiyor —
 * bu normal, ancak yazdığı başlık ve metin siliniyor."
 *
 * ---------------------------------------------------------------------------
 * NEDEN İSTEMCİ BİLEŞENİ
 * ---------------------------------------------------------------------------
 * Form sunucu bileşeniydi ve hata durumunda eylem `?hata=...` adresine
 * yönlendiriyordu; sayfa yeniden çizilince alanlar boş geliyordu. 4000
 * karaktere kadar yazılabilen bir duyuru metnini kaybettirmek, kullanıcıyı en
 * çok emek verdiği işi baştan yapmaya zorluyordu.
 *
 * Metni geri taşımanın iki yolu vardı:
 *   · adres çubuğunda (?baslik=...&icerik=...) — 4000 karakterlik metin URL ve
 *     istek başlığı sınırlarını zorlar, uzun duyuruda yeni bir hata doğardı;
 *   · `useActionState` ile — metin tarayıcıda kalır, hiçbir sınır yok.
 * İkincisi seçildi.
 *
 * SUNUCU DOĞRULAMASI YERİNDE DURUYOR: buradaki `required` nitelikleri yalnızca
 * kullanıcıya kolaylık. Onay kutusu da sunucuda ayrıca kontrol ediliyor
 * (bkz. lib/bildirim/toplu.ts · duyuruyuCoz) — istemci kontrolü bir kural
 * değildir, kuralın kibar hâlidir.
 */

export interface DuyuruFormDurumu {
  hata: string | null;
  /** Reddedilen gönderimde kullanıcının yazdıkları — alanlara geri konur. */
  degerler: { hedef: string; baslik: string; icerik: string };
}

export const DUYURU_BOS_DURUM: DuyuruFormDurumu = {
  hata: null,
  degerler: { hedef: "", baslik: "", icerik: "" },
};

export function DuyuruFormu({
  eylem,
  hedefSecenekleri,
}: {
  eylem: (
    oncekiDurum: DuyuruFormDurumu,
    veri: FormData,
  ) => Promise<DuyuruFormDurumu>;
  hedefSecenekleri: readonly { deger: string; etiket: string }[];
}) {
  const [durum, gonder, bekliyor] = useActionState(eylem, DUYURU_BOS_DURUM);

  return (
    <form action={gonder} data-cift-gonderim="serbest" className="space-y-4">
      {durum.hata && <BilgiKutusu cesit="hata">{durum.hata}</BilgiKutusu>}

      <label className="block">
        <span className="text-sm font-medium text-metin">Alıcılar</span>
        <select
          name="hedef"
          required
          defaultValue={durum.degerler.hedef || undefined}
          className={SINIF_GIRDI}
        >
          {hedefSecenekleri.map((secenek) => (
            <option key={secenek.deger} value={secenek.deger}>
              {secenek.etiket}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-metin">Başlık</span>
        <input
          type="text"
          name="baslik"
          required
          maxLength={200}
          defaultValue={durum.degerler.baslik}
          className={SINIF_GIRDI}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-metin">Metin</span>
        <textarea
          name="icerik"
          required
          rows={8}
          maxLength={4000}
          defaultValue={durum.degerler.icerik}
          className={SINIF_GIRDI}
        />
        <span className="mt-1 block text-sm text-metin-yumusak">
          Düz metin olarak gönderilir. Bağlantı yazabilirsiniz; panelde
          tıklanabilir görünür.
        </span>
      </label>

      {/*
        KUTU `required`: tarayıcı gönderimi daha başlamadan durdurur, yani
        yazılan metin sunucuya gidip geri dönmek zorunda bile kalmaz. Sunucu
        kontrolü yine de duruyor — JavaScript kapalıysa ya da istek elle
        kurulursa tek engel odur.
      */}
      <label className="flex items-start gap-2 text-sm text-metin">
        <input
          type="checkbox"
          name="onay"
          value="evet"
          required
          className="mt-0.5 h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
        />
        <span>
          Metni okudum ve bu duyurunun geri alınamayacağını biliyorum.
        </span>
      </label>

      <button
        type="submit"
        disabled={bekliyor}
        className={`${SINIF_BIRINCIL_BUTON} disabled:opacity-60`}
      >
        <Megaphone size={16} aria-hidden />
        {/*
          Gönderim sırasında düğme kapanıyor: duyuru geri alınamaz ve iki kez
          tıklamak iki duyuru demek. Kapsam bilinçli olarak dar — çift tıklamayı
          sunucuda engellemek için ayrı bir kayıt tutmak, tek düğmenin
          çözebileceği bir sorun için fazla makine olurdu.
        */}
        {bekliyor ? "Gönderiliyor…" : "Duyuruyu gönder"}
      </button>
    </form>
  );
}
