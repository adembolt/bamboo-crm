import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* E-postadaki bağlantı buraya döner: kodu oturuma çevirip yönlendirir */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/panel";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/panel";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/sifremi-unuttum?error=" + encodeURIComponent("Bağlantı geçersiz veya süresi dolmuş"), url.origin));
}
