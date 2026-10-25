import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { money, fmtDate } from "@/lib/format";
import { GiftCardForm } from "./gift-form";

export const metadata = { title: "Hediye çekleri" };

export default async function GiftCardsPage() {
  const { supabase, profile } = await requireSession();
  const canWrite = !!profile && ["owner", "manager", "reception"].includes(profile.role);
  const { data: cards } = await supabase.from("gift_cards").select("*, customer:customers(first_name, last_name), uses:gift_card_uses(amount, created_at)").order("created_at", { ascending: false }).limit(200);
  const list = cards ?? [];
  const open = list.filter((c) => Number(c.balance) > 0);
  const outstanding = open.reduce((a, c) => a + Number(c.balance), 0);
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link className="btn ghost sm" href="/panel/kasa">‹</Link>
        <h1 className="text-xl font-bold">Hediye çekleri</h1>
        <span className="text-sm text-muted">{open.length} açık çek · bakiye toplamı <b className="text-ink">{money(outstanding)}</b></span>
      </header>
      {canWrite && <GiftCardForm />}
      <section className="panel overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted bg-sunk"><tr><th className="text-left px-3 py-2">Kod</th><th className="text-left px-3 py-2">Alan / müşteri</th><th className="text-right px-3 py-2">Tutar</th><th className="text-right px-3 py-2">Bakiye</th><th className="text-left px-3 py-2">Satış</th><th className="text-left px-3 py-2">Son kullanma</th><th className="text-left px-3 py-2">Kullanım</th></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((c) => (
              <tr key={c.id} className={Number(c.balance) > 0 ? "" : "opacity-50"}>
                <td className="px-3 py-2 font-mono font-semibold">{c.code}</td>
                <td className="px-3 py-2">{c.buyer_name || "—"}{c.customer ? <span className="text-muted"> · {c.customer.first_name} {c.customer.last_name}</span> : null}</td>
                <td className="px-3 py-2 text-right num">{money(c.initial_amount)}</td>
                <td className="px-3 py-2 text-right num font-bold">{money(c.balance)}</td>
                <td className="px-3 py-2">{fmtDate(c.created_at)}</td>
                <td className="px-3 py-2">{c.expires_at ? fmtDate(c.expires_at) : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted">{(c.uses ?? []).map((u) => `${fmtDate(u.created_at)} ${money(u.amount)}`).join(", ") || "—"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="px-3 py-4 text-muted">Henüz hediye çeki satılmadı.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">Çek, kasada “Ödeme al” ekranında ödeme yöntemi olarak <b>Hediye çeki</b> seçilip kod girilerek kullanılır; kalan bakiye çekte durur.</p>
    </div>
  );
}
