"use client";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteCampaign } from "../actions";

export function DeleteCampaign({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return <button type="button" className="btn ghost sm text-bad" disabled={pending} onClick={() => { if (confirm(t("Kampanya silinsin mi?"))) start(() => deleteCampaign(id)); }}>{t("Sil")}</button>;
}
