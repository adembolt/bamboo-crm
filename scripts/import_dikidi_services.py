#!/usr/bin/env python3
"""
DIKIDI hizmet listesini (supabase/seed/dikidi_services.csv) Bamboo CRM şemasına çevirir
ve supabase/seed/0002_services.sql dosyasını üretir.

- Kategori: hizmet kodunun aralığına göre (DIKIDI'deki kategori yapısı korunur, adlar sadeleştirilir)
- Ad: "EN / RU / TR" biçimindeki adlar dillere ayrılır (Kiril → RU, Türkçe karakter/kelime → TR, kalan → EN)
- Süre: "1 hour 30 minutes" → 90 dk;  Fiyat: "6 000.00" → 6000
- online_visible: hepsi KAPALI başlar; Adem panelden seçer.
"""
import csv, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "supabase/seed/dikidi_services.csv"
OUT = ROOT / "supabase/seed/0002_services.sql"

# (key, name_tr, name_en, sort, color)
CATS = [
    ("kozmetoloji",     "Kozmetoloji · Yüz Cilt Bakımı",        "Cosmetology · Facial Skin Care",            10, "#0A7A1E"),
    ("dermatokozmetoloji","Dermatokozmetoloji",                  "Dermatocosmetology",                        20, "#1E6E8A"),
    ("yuz-cihaz",       "Yüz, Boyun, Dekolte · Cihazlı",        "Face, Neck & Décolleté · Device Procedures",30, "#3B6FB6"),
    ("ekspres-guzellik","Ekspres Güzellik",                     "Express Beauty",                            40, "#8A3B9A"),
    ("lezyon",          "Cilt Görünümü Düzeltme",               "Skin Imperfection Removal",                 50, "#A8854A"),
    ("konsultasyon",    "Uzman Danışmanlığı",                   "Specialist Consultation",                   60, "#5B6B5F"),
    ("lab",             "Laboratuvar Tanı",                     "Laboratory Diagnostics",                    70, "#5B6B5F"),
    ("lazer-kadin",     "Lazer Epilasyon · Kadın",              "Laser Hair Removal · Women",                80, "#C0392B"),
    ("lazer-erkek",     "Lazer Epilasyon · Erkek",              "Laser Hair Removal · Men",                  90, "#B7790B"),
    ("agda",            "Ağda",                                  "Waxing",                                   100, "#D2AE6F"),
    ("kas-kirpik",      "Kaş & Kirpik",                         "Brows & Lashes",                           110, "#9A5B8A"),
    ("manikur",         "Manikür",                               "Manicure",                                 120, "#E07A8A"),
    ("pedikur",         "Pedikür",                               "Pedicure",                                 130, "#E0A07A"),
    ("ayak-bakimi",     "Akıllı Ayak Bakımı · Podoloji",        "Smart Foot Care · Podology",               140, "#1E8A3A"),
    ("vucut-cihaz",     "Cihazlı İnceltme & Antiselülit",       "Device Body Slimming & Anti-cellulite",    150, "#2E8B8B"),
    ("vucut-bakim",     "Vücut Bakımı · Wellness",              "Wellness Body Care",                       160, "#5E9E6C"),
    ("masaj",           "Masaj",                                 "Massage",                                  170, "#46B862"),
    ("spa-rituel",      "SPA Ritüelleri · Yüz & Vücut",         "SPA Rituals · Face & Body",                180, "#8DBA93"),
    ("enerji",          "Enerjisel Uygulamalar",                 "Energy Practices",                         190, "#9AA69C"),
    ("akademi",         "Akademi · Eğitimler",                   "Academy · Courses",                        200, "#14261A"),
    ("diger",           "Diğer",                                 "Other",                                    900, "#9AA69C"),
]

def cat_for(code: str, name: str) -> str:
    n = name.upper()
    if code:
        c = float(code) if "." in code else int(code)
        ci = int(c)
        if 1 <= ci <= 42:    return "vucut-bakim" if ci == 20 else "masaj"
        if 51 <= ci <= 71:   return "enerji"
        if 101 <= ci <= 122: return "vucut-bakim"
        if 123 <= ci <= 134: return "spa-rituel"
        if 1001 <= ci <= 1099: return "vucut-cihaz"
        if 2000 <= ci <= 2003: return "konsultasyon"
        if ci == 2004 and "CONSULT" in n: return "konsultasyon"
        if 2004 <= ci <= 2099: return "dermatokozmetoloji"
        if 2100 <= ci <= 2199: return "yuz-cihaz"
        if 2200 <= ci <= 2299: return "lezyon"
        if 3000 <= ci <= 3099: return "ekspres-guzellik"
        if 4100 <= ci <= 4199: return "vucut-bakim"
        if 4000 <= ci <= 4099:
            if 4018 <= ci <= 4021 or "BROW" in n or "LASH" in n or "KAŞ" in n or "KİRPİK" in n: return "kas-kirpik"
            return "kozmetoloji"
        if 5000 <= ci <= 5099:
            if ci == 5031: return "lazer-erkek"
            if "BTX" in n: return "ekspres-guzellik"
            return "ayak-bakimi"
        if 5100 <= ci <= 5199:
            if "PEDICURE" in n or "PEDİKÜR" in n or "FOOT" in n: return "pedikur"
            return "manikur"
        if 5300 <= ci <= 5329: return "agda"
        if 5330 <= ci <= 5399: return "lazer-kadin"
        if 5400 <= ci <= 5499: return "lazer-erkek"
        if 6000 <= ci <= 6099: return "lab"
        if 8000 <= ci <= 8099: return "akademi"
    if "THREADING" in n or "İPLE" in n: return "kas-kirpik"
    if "İĞNE" in n: return "lezyon"
    if "ВЕБИНАР" in n: return "konsultasyon"
    return "diger"

CYR = re.compile(r"[Ѐ-ӿ]")
TRC = re.compile(r"[ğüşıöçĞÜŞİÖÇ]")
TR_WORDS = re.compile(r"\b(VE|İÇİN|İLE|BAKIM|BAKIMI|MASAJ|MASAJI|TÜM|VÜCUT|YÜZ|CİLT|TIRNAK|AYAK|KADIN|ERKEK|BÖLGE|SEANS|KOLLAR|BACAK|KALÇA|TERAPİ|TERAPİSİ|TEMİZLİĞİ|DÜZELTME|ÇIKARMA|KURU|LAZER|AĞDA|TAM)\b", re.I)

def split_names(raw: str):
    s = re.sub(r"^\s*(No:?\s*\d+|\d{4}(?:\.\d)?\.?|\d)\s*[/.\-–]?\s*", "", raw).strip()
    parts = [p.strip(" /·") for p in re.split(r"\s*/\s*", s) if p.strip(" /·")]
    en = ru = tr = ""
    for p in parts:
        if CYR.search(p):
            if not ru: ru = p
        elif TRC.search(p) or TR_WORDS.search(p):
            if not tr: tr = p
        else:
            if not en: en = p
            elif not tr: tr = p
    if not tr: tr = en or ru or s
    if not en: en = tr
    return tr, en, ru

def parse_duration(d: str) -> int:
    d = d.strip()
    if re.fullmatch(r"\d+", d): return int(d) * 60 if int(d) <= 12 else int(d)
    h = re.search(r"(\d+)\s*hour", d); m = re.search(r"(\d+)\s*minute", d)
    return (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0) or 60

def parse_price(p: str) -> float:
    return float(re.sub(r"[^\d.]", "", p.replace(",", ".")) or 0)

def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"

def main():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    out = ["-- Üretildi: scripts/import_dikidi_services.py — DIKIDI hizmet listesi", "begin;", ""]
    out.append("insert into public.service_categories (code, name_tr, name_en, sort_order, color, online_visible) values")
    out.append(",\n".join(f"  ({q(k)}, {q(tr)}, {q(en)}, {so}, {q(col)}, false)" for k, tr, en, so, col in CATS))
    out.append("on conflict (code) do update set name_tr = excluded.name_tr, name_en = excluded.name_en, sort_order = excluded.sort_order, color = excluded.color;")
    out.append("")
    seen = set(); vals = []; stats = {}
    for r in rows:
        name = r["name"].strip()
        if not name or name.lower() in ("show more", "loading...", "nothing found"): continue
        m = re.match(r"^\s*(\d{4}(?:\.\d)?)", name)
        code = m.group(1) if m else ""
        tr, en, ru = split_names(name)
        key = (code, tr.lower())
        if key in seen: continue
        seen.add(key)
        cat = cat_for(code, name)
        stats[cat] = stats.get(cat, 0) + 1
        dur = parse_duration(r["duration"]); price = parse_price(r["price"])
        sessions = 1
        sm = re.search(r"(\d+)\s*(?:sessions?|seans)", name, re.I)
        if sm: sessions = int(sm.group(1))
        kind = "consultation" if cat == "konsultasyon" else ("package" if sessions > 1 else "service")
        if re.search(r"SATIŞ|CREAM|KREM|STUD EARRINGS|ÇİVİ KÜPE", name, re.I): kind = "product_like"
        sort = int(float(code) * 10) if code else 99999
        vals.append(f"  ((select id from public.service_categories where code = {q(cat)}), {q(code) if code else 'null'}, {q(tr)}, {q(en)}, {q(ru)}, {dur}, {price:.2f}, {sessions}, {q(kind)}, false, true, {sort}, {q(name)})")
    out.append("insert into public.services (category_id, code, name_tr, name_en, name_ru, duration_min, price, session_count, kind, online_visible, is_active, sort_order, dikidi_id) values")
    out.append(",\n".join(vals) + ";")
    out.append(""); out.append("commit;")
    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"{len(vals)} hizmet → {OUT.relative_to(ROOT)}")
    for k, v in sorted(stats.items(), key=lambda x: -x[1]): print(f"  {k:22s} {v}")

if __name__ == "__main__":
    main()
