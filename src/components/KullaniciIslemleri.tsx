"use client";

import { KeyRound, LockOpen, Trash2, UserCheck, UserX } from "lucide-react";
import { useActionState, useState } from "react";
import {
  kullaniciIslemiEylemi,
  type YonetimDurumu,
} from "@/app/panel/kullanici-yonetimi/eylemler";
import { BilgiKutusu, SINIF_GIRDI, SINIF_IKINCIL_BUTON } from "@/components/ui";
import { SILME_ONAY_KELIMESI } from "@/lib/kullanici-yonetimi/kurallar";

/**
 * Kullanıcı yönetimindeki bir satırın işlemleri (28 Ekim 2026).
 *
 * Geçici şifre sunucudan YALNIZCA bu bileşenin durumuna döner: sayfa yenilenince
 * kaybolur, adres çubuğunda ya da tarayıcı geçmişinde kalmaz.
 */
export function KullaniciIslemleri({
  kullaniciId,
  aktif,
  sifreliMi,
  kilitliMi,
}: {
  kullaniciId: number;
  aktif: boolean;
  sifreliMi: boolean;
  kilitliMi: boolean;
}) {
  const [durum, gonder, bekliyor] = useActionState<YonetimDurumu, FormData>(
    kullaniciIslemiEylemi,
    null,
  );
  const [silmeAcik, setSilmeAcik] = useState(false);

  const kucukButon = `${SINIF_IKINCIL_BUTON} !px-3 !py-1.5 !text-xs`;

  return (
    <div className="space-y-3">
      <form action={gonder} data-cift-gonderim="serbest" className="flex flex-wrap gap-2">
        <input type="hidden" name="kullaniciId" value={kullaniciId} />
        {sifreliMi && (
          <button
            type="submit"
            name="islem"
            value="sifre"
            disabled={bekliyor}
            className={kucukButon}
            onClick={(olay) => {
              if (!confirm("Geçici şifre oluşturulsun mu? Kişinin mevcut şifresi geçersiz olur.")) {
                olay.preventDefault();
              }
            }}
          >
            <KeyRound size={14} aria-hidden />
            Şifre yenile
          </button>
        )}
        {kilitliMi && (
          <button type="submit" name="islem" value="kilit" disabled={bekliyor} className={kucukButon}>
            <LockOpen size={14} aria-hidden />
            Kilidi aç
          </button>
        )}
        {aktif ? (
          <button type="submit" name="islem" value="pasif" disabled={bekliyor} className={kucukButon}>
            <UserX size={14} aria-hidden />
            Pasife al
          </button>
        ) : (
          <button type="submit" name="islem" value="aktif" disabled={bekliyor} className={kucukButon}>
            <UserCheck size={14} aria-hidden />
            Etkinleştir
          </button>
        )}
        <button
          type="button"
          onClick={() => setSilmeAcik((acik) => !acik)}
          className={`${kucukButon} !text-hata-metin`}
        >
          <Trash2 size={14} aria-hidden />
          Kaydı sil
        </button>
      </form>

      {silmeAcik && (
        <form action={gonder} data-cift-gonderim="serbest" className="rounded-kutu border border-hata-cizgi/50 bg-hata-zemin p-3 text-sm text-hata-metin">
          <input type="hidden" name="kullaniciId" value={kullaniciId} />
          <input type="hidden" name="islem" value="sil" />
          <p>
            Kişinin adı, T.C. numarası, iletişim bilgileri, fotoğrafı ve yazdıkları
            kalıcı olarak silinir; rolleri kapanır, giriş yapamaz.{" "}
            <strong>Geri alınamaz.</strong> Onaylamak için kutuya{" "}
            <strong>{SILME_ONAY_KELIMESI}</strong> yazın.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              name="onay"
              required
              autoComplete="off"
              aria-label="Onay kelimesi"
              className={`${SINIF_GIRDI} !mt-0 !w-32 !py-1.5`}
            />
            <button type="submit" disabled={bekliyor} className={`${kucukButon} !text-hata-metin`}>
              <Trash2 size={14} aria-hidden />
              Kalıcı olarak sil
            </button>
          </div>
        </form>
      )}

      {durum && (
        <BilgiKutusu cesit={durum.olduMu ? "olumlu" : "hata"}>
          <p>{durum.mesaj}</p>
          {durum.olduMu && durum.geciciSifre && (
            <div className="mt-2">
              <p className="text-sm">
                Geçici şifre (yalnızca şimdi görünür, kişiye iletin):
              </p>
              <code className="mt-1 inline-block select-all rounded bg-kart px-3 py-1.5 font-mono text-base text-metin">
                {durum.geciciSifre}
              </code>
              <p className="mt-1 text-xs">
                Kişinin açık oturumları kapatıldı; bu şifreyle yeniden giriş yapar.
              </p>
            </div>
          )}
        </BilgiKutusu>
      )}
    </div>
  );
}
