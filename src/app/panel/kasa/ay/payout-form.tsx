"use client";
import { useActionState } from "react";
import { addPayout } from "../actions";
import type { Staff } from "@/lib/database.types";

export function PayoutForm({ staff, start, end }: { staff: Staff[]; start: string; end: string }) {
  const [state, action, pending] = useActionState(addPayout, { error: "" });
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_auto] gap-2 items-end border-t border-line pt-3">
      <input type="hidden" name="period_start" value={start} /><input type="hidden" name="period_end" value={end} />
      <label className="f">Personel<span className="inp"><select name="staff_id" required>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></span></label>
      <label className="f">Tutar<span className="inp"><input name="amount" inputMode="decimal" required /></span></label>
      <label className="f">Ödeme<span className="inp"><select name="method" defaultValue="cash"><option value="cash">Nakit</option><option value="transfer">Havale</option></select></span></label>
      <label className="f">Tarih<span className="inp"><input name="paid_at" type="date" defaultValue={end} /></span></label>
      <label className="f">Not<span className="inp"><input name="notes" placeholder="ay sonu ödemesi" /></span></label>
      <button className="btn sm" disabled={pending}>Ödeme kaydet</button>
      {state.error && <p className="pill bad col-span-full">{state.error}</p>}
    </form>
  );
}
