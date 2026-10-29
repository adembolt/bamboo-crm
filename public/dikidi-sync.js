/* Bamboo CRM · DIKIDI günlük eşitleme
   DIKIDI paneli açıkken yer imindeki "Bamboo'ya aktar" düğmesiyle çalışır.
   DIKIDI'de HİÇBİR ŞEYİ DEĞİŞTİRMEZ: sadece okur ve Bamboo CRM'e yazar. */
(async function () {
  "use strict";
  if (window.__bambooSyncRunning) return;
  var TOKEN = window.__BAMBOO_TOKEN;
  var FULL = !!window.__BAMBOO_FULL;
  var SITE = "https://bamboo-crm-tau.vercel.app";
  if (!/(^|\.)dikidi\.net$/.test(location.hostname)) { alert("Bu düğme DIKIDI panelinde (dikidi.net) çalışır."); return; }
  var company = (window.backend && backend.company && backend.company.id) || (location.search.match(/company=(\d+)/) || [])[1];
  if (!company) { alert("DIKIDI şirket paneli açık değil. Önce DIKIDI'de Randevular sayfasını açın."); return; }
  if (!TOKEN) { alert("Eşitleme anahtarı yok. Yer imini Bamboo panelinden (Ayarlar → DIKIDI eşitleme) yeniden ekleyin."); return; }
  window.__bambooSyncRunning = true;

  /* ---------- görünüm ---------- */
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;z-index:2147483647;right:16px;bottom:16px;width:420px;max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;background:#0f1a14;color:#e8f2ea;font:13px/1.45 -apple-system,system-ui,sans-serif;border:1px solid #2f5a3c;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);padding:14px 16px";
  box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:14px">Bamboo · DIKIDI eşitleme' + (FULL ? " (tam)" : "") + '</b><span id="bsx-st" style="margin-left:auto;color:#9fc6a8">çalışıyor…</span></div><div id="bsx-log"></div>';
  document.body.appendChild(box);
  var logEl = box.querySelector("#bsx-log"), stEl = box.querySelector("#bsx-st");
  function log(msg, kind) {
    var d = document.createElement("div");
    d.style.cssText = "padding:2px 0;border-bottom:1px dashed #22382a;color:" + (kind === "err" ? "#ff9b8f" : kind === "ok" ? "#9be3ad" : "#e8f2ea");
    d.textContent = msg; logEl.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  function done(ok) {
    stEl.textContent = ok ? "tamamlandı ✓" : "hata ile bitti";
    stEl.style.color = ok ? "#9be3ad" : "#ff9b8f";
    var b = document.createElement("button");
    b.textContent = "Kapat"; b.style.cssText = "margin-top:10px;background:#2f5a3c;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer";
    b.onclick = function () { box.remove(); }; box.appendChild(b);
    window.__bambooSyncRunning = false;
  }

  /* ---------- yardımcılar ---------- */
  var XHR = { "X-Requested-With": "XMLHttpRequest" };
  function iso(d) { return d.toISOString().slice(0, 10); }
  function dmy(s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); }
  function addDays(s, n) { var d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  var today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // İstanbul
  function num(s) { return Number(String(s || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0; }
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function latin(s) { return String(s).replace(/О/g, "O").replace(/о/g, "o").replace(/с/g, "c").replace(/С/g, "C").replace(/а/g, "a").replace(/е/g, "e").replace(/р/g, "p"); }
  function parseDate(s) { var m = latin(s).match(/(\d{1,2}) (\w{3})\w* (\d{4})/); return m ? m[3] + "-" + String(MON[m[2].toLowerCase()]).padStart(2, "0") + "-" + m[1].padStart(2, "0") : null; }
  function html(s) { return new DOMParser().parseFromString(s, "text/html"); }
  async function post(kind, data, ep) {
    var r = await fetch(SITE + "/api/import/" + (ep || "dikidi-sync"), { method: "POST", headers: { "content-type": "application/json", "x-import-token": TOKEN }, body: JSON.stringify({ kind: kind, data: data }) });
    var j = {}; try { j = await r.json(); } catch (e) { /* boş */ }
    if (!r.ok || !j.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
    return j.report || j;
  }

  /* ---------- DIKIDI okuma ---------- */
  async function appointments(from, to) {
    var out = [];
    for (var off = 0; off < 5000; off += 50) {
      var q = new URLSearchParams({ company: company, start: from, end: to, limit: "50", offset: String(off) });
      if (!off) q.set("first", "1");
      var j = await fetch("/owner/ajax/journal/appointment_list/?" + q, { headers: XHR }).then(function (r) { return r.json(); });
      var a = (j && j.appointments) || [];
      a.forEach(function (x) {
        out.push({ id: x.id, date: x.date, time: x.time, time_to: x.time_to, status_id: x.status_id, client_came_id: x.client_came_id, is_deleted: x.is_deleted,
          master_id: x.master_id, client_phone: x.client_phone, client_first_name: x.client_first_name, client_last_name: x.client_last_name, comment: x.comment,
          is_online: x.is_online, added_name: x.added_name, document_id: x.document_id,
          services: (x.services || []).map(function (s) { return { id: s.id, title: s.title, cost: s.cost, time: s.time }; }) });
      });
      if (a.length < 50) break;
    }
    return out;
  }
  async function sales(from, to) {
    var out = [];
    for (var off = 0; off < 20000; off += 50) {
      var fd = new URLSearchParams({ company: company, sort: "new", offset: String(off), limit: "50", more: off ? "1" : "0", uncollapsed: "1", start: dmy(from), end: dmy(to) });
      var j = await fetch("/" + (window.backend && backend.lang || "en") + "/owner/ajax/sales/filter/", { method: "POST", body: fd, headers: XHR }).then(function (r) { return r.json(); });
      var h = (j.script || []).filter(function (s) { return /card sale/.test(s.html || ""); }).map(function (s) { return s.html; }).join("");
      var cards = html(h).querySelectorAll(".card.sale");
      cards.forEach(function (c) {
        var a = c.querySelector(".client a.name"), lines = [], master = null;
        c.querySelectorAll(".details .line").forEach(function (l) {
          if (l.classList.contains("head") || l.classList.contains("total")) return;
          if (l.classList.contains("master")) { master = l.querySelector(".item").textContent.trim(); return; }
          lines.push({ master: master, name: ((l.querySelector(".name") || l.querySelector(".item") || {}).textContent || "").trim(), disc: num((l.querySelector(".discount") || {}).textContent),
            income: num((l.querySelector(".income") || {}).textContent), mat: num((l.querySelector(".materials") || {}).textContent), salary: num((l.querySelector(".salary") || {}).textContent) });
        });
        out.push({ id: c.id.replace("sale-", ""), date: parseDate((c.querySelector(".date") || {}).textContent || ""), time: ((c.querySelector(".time") || {}).textContent || "").trim(),
          name: a ? a.textContent.trim() : "", phone: ((c.querySelector(".phone") || {}).textContent || "").replace(/\D/g, ""), amount: num((c.querySelector(".numbers .amount") || {}).textContent), lines: lines });
      });
      if (cards.length < 50) break;
    }
    return out.filter(function (s) { return s.date; });
  }
  async function cashflow(from, to) {
    var out = [];
    for (var off = 0; off < 20000; off += 50) {
      var fd = new URLSearchParams("start=" + dmy(from) + "&end=" + dmy(to) + "&cashbox_type[]=0&company=" + company + "&limit=50&offset=" + off + "&filter=insert&order=desc&more=" + (off ? 1 : 0));
      var j = await fetch("/" + (window.backend && backend.lang || "en") + "/owner/ajax/biz_cashflow/filter/", { method: "POST", body: fd, headers: XHR }).then(function (r) { return r.json(); });
      var h = ""; (function walk(o) { if (typeof o === "string") { if (o.indexOf("<tr") >= 0) h += o; } else if (o && typeof o === "object") Object.keys(o).forEach(function (k) { walk(o[k]); }); })(j);
      var tr = html("<table>" + h + "</table>").querySelectorAll('tr[id^="item-"]');
      tr.forEach(function (t) {
        var td = Array.prototype.map.call(t.querySelectorAll("td"), function (x) { return x.innerText.replace(/\s+/g, " ").trim(); });
        out.push({ id: t.id.slice(5), doc: t.dataset.document_id, sum: t.dataset.sum_type, acc: td[1], who: td[2], type: td[3], amt: td[4], note: td[5], dt: td[6] });
      });
      if (tr.length < 50) break;
    }
    return out;
  }
  async function schedule(ym) {
    var h = await fetch("/en/owner/schedule/?company=" + company + "&date=" + ym).then(function (r) { return r.text(); });
    var el = html(h).querySelector("[data-params]");
    var p = el ? JSON.parse(el.getAttribute("data-params")) : null;
    return (p && p.schedules && p.schedules.master && p.schedules.master.data) || {};
  }
  async function clients() {
    var t = await fetch("/en/owner/ajax/clients/export/?company=" + company + "&type=csv").then(function (r) { return r.text(); });
    var ta = document.createElement("textarea");
    t = t.replace(/&(amp|quot|lt|gt|#0?39|apos|nbsp);/g, function (m) { ta.innerHTML = m; return ta.value; });
    var L = t.split(/\r?\n/), rows = [], cur = null;
    for (var i = 0; i < L.length; i++) { var l = L[i]; if (cur === null) { if (!l.trim()) continue; cur = l; } else cur = cur + " / " + l; if (cur.split(";").length >= 23) { rows.push(cur); cur = null; } }
    if (cur) rows.push(cur);
    var page = html(await fetch("/en/owner/clients/?company=" + company).then(function (r) { return r.text(); }));
    var groups = {};
    var opts = page.querySelectorAll('select[name="check[clients_groups][]"] option');
    for (var k = 0; k < opts.length; k++) {
      var id = opts[k].value, name = opts[k].textContent.trim();
      if (!/^\d{3,}$/.test(id)) continue;
      var fd = new URLSearchParams(); fd.set("data", "check[clients_groups][]=" + id);
      var g = await fetch("/en/owner/ajax/clients/export/?company=" + company + "&type=csv", { method: "POST", body: fd }).then(function (r) { return r.text(); });
      groups[name] = g.split("\n").slice(1).filter(function (x) { return x.trim(); }).map(function (x) { return x.split(";")[2]; }).filter(function (x) { return /^\d{6,}$/.test(x || ""); });
    }
    return { csv: rows.join("\n"), groups: groups };
  }
  async function reviews() {
    var d = html(await fetch("/en/owner/reviews/?company=" + company).then(function (r) { return r.text(); }));
    var out = [];
    var blocks = d.querySelectorAll(".review-block");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], a = b.querySelector(".author a");
      var cid = ((a && a.getAttribute("data-href")) || "").match(/settings\/(\d+)/);
      var ds = latin(((b.querySelector(".date") || {}).textContent || "").trim()).match(/(\d{1,2}) (\w{3})\w* (\d{4}) at (\d{2}):(\d{2})/);
      var txt = ((b.querySelector(".text .form-group") || {}).textContent || "").trim();
      var phone = "";
      if (cid) {
        try {
          var r = await fetch("/en/owner/ajax/clients/settings/" + cid[1] + "/?company=" + company, { headers: XHR }).then(function (r) { return r.text(); });
          var hh = r; try { hh = JSON.parse(r).html || r; } catch (e) { /* html */ }
          var inp = html(hh).querySelector('input[name="number"]'); phone = inp ? inp.value.replace(/\D/g, "") : "";
        } catch (e) { /* telefon yok */ }
      }
      out.push({ id: b.dataset.id, name: a ? a.textContent.trim() : "", phone: phone, text: txt === "No comment" ? "" : txt, reply: ((b.querySelector(".response-text") || {}).textContent || "").trim(),
        at: ds ? ds[3] + "-" + String(MON[ds[2].toLowerCase()]).padStart(2, "0") + "-" + ds[1].padStart(2, "0") + "T" + ds[4] + ":" + ds[5] + ":00+03:00" : null,
        rating: num((b.querySelector(".rating") || {}).textContent) || 5, public: /public/i.test(((b.querySelector('[class*="public"]') || {}).textContent) || "Public") });
    }
    return out;
  }
  async function salary() {
    var d = html(await fetch("/en/owner/salarySchemes/?company=" + company).then(function (r) { return r.text(); }));
    var links = d.querySelectorAll('tr td:first-child a[data-href*="salarySchemes/edit"]'), out = [];
    for (var i = 0; i < links.length; i++) {
      var url = links[i].getAttribute("data-href"), id = (url.match(/id=(\d+)/) || [])[1];
      var r = await fetch(url, { headers: XHR }).then(function (r) { return r.text(); });
      var hh = r; try { hh = JSON.parse(r).html || r; } catch (e) { /* html */ }
      var f = html(hh), vals = {}, masterId = "";
      f.querySelectorAll("input,select").forEach(function (el) {
        if (!el.name) return;
        if (el.type === "checkbox" || el.type === "radio") { if (el.checked) vals[el.name] = el.value; return; }
        if (el.type === "hidden" && el.name in vals) return;
        vals[el.name] = el.value;
      });
      masterId = vals.master_id || "";
      out.push({ id: id, masterId: masterId, name: links[i].textContent.trim(), vals: vals });
    }
    return out;
  }

  /* ---------- akış ---------- */
  var report = {}, ok = true;
  var apFrom = FULL ? "2026-01-01" : addDays(today, -3), apTo = addDays(today, FULL ? 90 : 60);
  var saFrom = FULL ? "2026-01-01" : addDays(today, -7);
  var runId = null;
  async function step(name, fn) {
    log("• " + name + "…");
    try { var r = await fn(); report[name] = r; logEl.lastChild.textContent = "✓ " + name + (r && r.summary ? " — " + r.summary : ""); logEl.lastChild.style.color = "#9be3ad"; return r; }
    catch (e) { ok = false; report[name] = { error: String(e && e.message || e) }; logEl.lastChild.textContent = "✗ " + name + ": " + (e && e.message || e); logEl.lastChild.style.color = "#ff9b8f"; return null; }
  }
  try { runId = (await post("run", { action: "start", from: apFrom, to: apTo })).id || null; }
  catch (e) { log("Bamboo'ya bağlanılamadı: " + (e.message || e), "err"); done(false); return; }
  // Sunucu tarafındaki run cevabı {ok,id}
  await step("Müşteriler", async function () { var c = await clients(); var r = await post("clients", c, "dikidi-catalog"); r.summary = r.matched + " eşleşti, " + r.created + " yeni, " + r.updated + " güncellendi"; return r; });
  await step("Çalışma takvimi", async function () {
    var res = [], d = new Date(today + "T12:00:00Z");
    for (var i = 0; i < 3; i++) { var ym = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)).toISOString().slice(0, 7); var r = await post("schedule", { ym: ym, data: await schedule(ym) }); res.push(ym + ": " + r.rows); }
    return { months: res, summary: res.join(", ") };
  });
  await step("Randevular", async function () {
    var tot = { appts: 0, created: 0, updated: 0, cancelled: 0, legacyLinked: 0, legacyCancelled: 0, overlap: 0, errorCount: 0, errors: [] };
    for (var f = apFrom; f <= apTo; f = addDays(f, 7)) {
      var t = addDays(f, 6); if (t > apTo) t = apTo;
      var rows = await appointments(f, t);
      var r = await post("appointments", { from: f, to: t, rows: rows });
      Object.keys(tot).forEach(function (k) { if (k === "errors") tot.errors = tot.errors.concat(r.errors || []); else tot[k] += r[k] || 0; });
      stEl.textContent = "randevular " + t;
    }
    tot.summary = tot.appts + " randevu · " + tot.created + " yeni · " + tot.updated + " güncel · " + (tot.cancelled + tot.legacyCancelled) + " iptal" + (tot.errorCount ? " · " + tot.errorCount + " hata" : "");
    tot.errors.slice(0, 5).forEach(function (e) { log("   " + e, "err"); });
    return tot;
  });
  await step("Satışlar ve ödemeler", async function () {
    var tot = { sales: 0, created: 0, replaced: 0, skipped: 0, payBalance: 0, errorCount: 0 };
    for (var f = saFrom; f <= today; f = addDays(f, 30)) {
      var t = addDays(f, 29); if (t > today) t = today;
      var s = await sales(f, t), c = await cashflow(f, t);
      var r = await post("sales", { rows: s, cash: c });
      var r2 = await post("cashflow", { rows: c });
      Object.keys(tot).forEach(function (k) { tot[k] += r[k] || 0; });
      tot.topups = (tot.topups || 0) + (r2.balanceTopups || 0); tot.payouts = (tot.payouts || 0) + (r2.payouts || 0); tot.expenses = (tot.expenses || 0) + (r2.expenses || 0);
      (r.errors || []).slice(0, 3).forEach(function (e) { log("   " + e, "err"); });
      stEl.textContent = "satışlar " + t;
    }
    tot.summary = tot.created + " yeni satış, " + tot.skipped + " zaten vardı · " + (tot.topups || 0) + " bakiye yükleme · " + (tot.payouts || 0) + " maaş ödemesi · " + (tot.expenses || 0) + " gider";
    return tot;
  });
  await step("Yorumlar", async function () { var r = await post("reviews", { rows: await reviews() }, "dikidi-catalog"); r.summary = r.rows + " yorum"; return r; });
  await step("Maaş şemaları", async function () { var r = await post("salary", { rows: await salary() }); r.summary = r.saved + " şema" + (r.unmatched.length ? " (eşleşmeyen: " + r.unmatched.join(", ") + ")" : ""); return r; });
  try { if (runId) await post("run", { action: "finish", id: runId, ok: ok, report: report }); } catch (e) { /* rapor yazılamadı */ }
  log(ok ? "Bitti. Bamboo panelini yenileyebilirsiniz." : "Bazı adımlar hata verdi; tekrar çalıştırmak güvenlidir.", ok ? "ok" : "err");
  done(ok);
})();
