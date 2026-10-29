"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

/* E-postadaki şifre sıfırlama bağlantısı buraya döner (#access_token… veya ?code=…) */
export default function RecoverPage() {
  const t = useT();
  const [msg, setMsg] = useState(t("Bağlantı doğrulanıyor…"));
  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const errText = hash.get("error_description") || query.get("error_description");
      if (errText) { setMsg(""); window.location.replace("/sifremi-unuttum?error=" + encodeURIComponent(t("Bağlantı geçersiz veya süresi dolmuş, yeniden isteyin"))); return; }
      const at = hash.get("access_token"), rt = hash.get("refresh_token"), code = query.get("code");
      let ok = false;
      if (at && rt) ok = !(await supabase.auth.setSession({ access_token: at, refresh_token: rt })).error;
      else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
      window.location.replace(ok ? "/sifre-yenile" : "/sifremi-unuttum?error=" + encodeURIComponent(t("Bağlantı geçersiz veya süresi dolmuş, yeniden isteyin")));
    };
    run().catch(() => setMsg(t("Bir hata oldu. Lütfen yeniden bağlantı isteyin.")));
  }, [t]);
  return <main className="flex-1 grid place-items-center px-4 py-10"><p className="panel text-sm">{msg}</p></main>;
}
