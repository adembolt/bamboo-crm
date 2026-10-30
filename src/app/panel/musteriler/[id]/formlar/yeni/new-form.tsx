"use client";
import { useRouter } from "next/navigation";
import { FormFiller } from "@/components/forms/form-filler";
import { useT } from "@/lib/i18n/client";
import type { FormKey, FormData } from "@/lib/forms/schemas";
import { saveClientForm } from "../actions";

export function NewForm({ customerId, visitId, formKey, initialData, staffNames, me }: { customerId: string; visitId: string | null; formKey: FormKey; initialData: FormData; staffNames: string[]; me: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <FormFiller formKey={formKey} initialData={initialData} initialStaff={me} staffNames={staffNames}
      footer={<button type="button" className="btn ghost" onClick={() => router.push(`/panel/musteriler/${customerId}`)}>{t("Vazgeç")}</button>}
      onSubmit={async (p) => {
        const r = await saveClientForm({ customerId, visitId, formKey, ...p });
        if (!r.ok) return r.error;
        router.push(`/panel/musteriler/${customerId}/formlar/${r.id}?kaydedildi=1`);
        return null;
      }} />
  );
}
