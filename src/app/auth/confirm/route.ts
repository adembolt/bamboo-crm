import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/* E-posta bağlantısı (token_hash) → oturum. Hangi cihazdan tıklanırsa tıklansın çalışır. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "recovery") as EmailOtpType;
  const nextRaw = url.searchParams.get("next") ?? (type === "recovery" ? "/sifre-yenile" : "/panel");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/panel";
  if (token_hash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/sifremi-unuttum?error=" + encodeURIComponent("Bağlantı geçersiz veya süresi dolmuş, yeniden isteyin"), url.origin));
}
