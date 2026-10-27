"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setStaffPhoto } from "@/app/panel/personel/actions";

/** Görseli kare kırpıp 320px JPEG'e küçültür (hızlı yükleme, az yer) */
async function squareJpeg(file: File, size = 320): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Görsel işlenemedi"))), "image/jpeg", 0.85));
}

export function StaffAvatar({ staff, size = 36, editable = false }: { staff: { id: string; full_name: string; color: string; photo_url: string | null }; size?: number; editable?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const initials = staff.full_name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  async function onFile(f: File) {
    setErr(""); setBusy(true);
    try {
      if (!/^image\//.test(f.type)) throw new Error("Lütfen bir fotoğraf seçin.");
      const blob = await squareJpeg(f);
      const sb = createClient();
      const path = `${staff.id}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from("staff-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(error.message);
      const url = sb.storage.from("staff-photos").getPublicUrl(path).data.publicUrl;
      const r = await setStaffPhoto(staff.id, url);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Yüklenemedi"); }
    finally { setBusy(false); }
  }
  const face = staff.photo_url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={staff.photo_url} alt={staff.full_name} width={size} height={size} className="rounded-full object-cover w-full h-full" />
    : <span className="w-full h-full rounded-full grid place-items-center font-bold text-white" style={{ background: staff.color, fontSize: size * 0.36 }}>{initials}</span>;
  if (!editable) return <span className="relative flex-none rounded-full" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${staff.color}` }}>{face}</span>;
  return (
    <span className="relative flex-none" style={{ width: size, height: size }}>
      <button type="button" title={err || (staff.photo_url ? "Fotoğrafı değiştir" : "Fotoğraf yükle")} aria-label={`${staff.full_name} fotoğrafı`} disabled={busy}
        onClick={(e) => { e.stopPropagation(); input.current?.click(); }}
        className="group relative block w-full h-full rounded-full" style={{ boxShadow: `0 0 0 2px ${err ? "var(--bad)" : staff.color}` }}>
        {face}
        <span className={`absolute inset-0 rounded-full grid place-items-center bg-black/45 text-white text-[10px] font-semibold ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>{busy ? "…" : "📷"}</span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </span>
  );
}
