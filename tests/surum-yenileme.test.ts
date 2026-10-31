import { surumHatasiMi } from "@/lib/surum-yenileme";

describe("güncelleme sonrası sürüm hatası", () => {
  it("eski parça ve eski sunucu eylemi hatalarını tanır", () => {
    expect(
      surumHatasiMi({
        message:
          "Failed to load chunk /genctektopluluk/_next/static/chunks/1oan1nll-8xmf.js from module 648",
      }),
    ).toBe(true);
    expect(surumHatasiMi({ name: "ChunkLoadError", message: "x" })).toBe(true);
    expect(
      surumHatasiMi({
        message: 'Server Action "abc123" was not found on the server.',
      }),
    ).toBe(true);
  });

  it("olağan hataları yenileme sebebi saymaz", () => {
    expect(surumHatasiMi({ message: "Failed to fetch" })).toBe(false);
    expect(surumHatasiMi({ name: "TypeError", message: "x is undefined" })).toBe(
      false,
    );
  });
});
