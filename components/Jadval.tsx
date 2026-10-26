"use client";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  type Zakaz, type Sozlamalar, type QoraTuri, type QogozHolat, type Holat,
  listSoni, ustkiKg, qoraKg, qoraGramm, rulonList, haqiqiyDona, kgNarx, srokSana, srokHolati, boshZakaz, fmtSon,
} from "@/lib/hisob";
import AiPanel from "./AiPanel";

type Firma = { nomi: string; turi: "pechat" | "qogoz" };
type Filtr = "jarayonda" | "shuhafta" | "qogozyoq" | "ctpyoq" | "bitdi" | "hammasi";
const TEMALAR: [string, string][] = [["oq", "Oq"], ["qora", "Qora"], ["kok", "Ko'k"], ["yashil", "Yashil"], ["qum", "Qum"]];

export default function Jadval({ boshlangich, firmalar, sozlamalar, email }: {
  boshlangich: Zakaz[]; firmalar: Firma[]; sozlamalar: Sozlamalar; email: string;
}) {
  const [rows, setRows] = useState<Zakaz[]>(boshlangich);
  const [filtr, setFiltr] = useState<Filtr>("jarayonda");
  const [qidiruv, setQidiruv] = useState("");
  const [ai, setAi] = useState(false);
  const [saqlash, setSaqlash] = useState<"" | "..." | "ok" | "xato">("");
  const [tema, setTema] = useState("oq");
  const sb = useMemo(() => supabaseBrowser(), []);
  const pechatFirmalar = firmalar.filter((f) => f.turi === "pechat").map((f) => f.nomi);
  const qogozFirmalar = firmalar.filter((f) => f.turi === "qogoz").map((f) => f.nomi);

  // Tema brauzerda eslab qolinadi: har safar qayta tanlamaslik uchun. Serverda localStorage yo'q,
  // shuning uchun faqat mount dan keyin o'qiladi.
  useEffect(() => {
    try { const t = localStorage.getItem("zk_tema"); if (t) setTema(t); } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-tema", tema);
    try { localStorage.setItem("zk_tema", tema); } catch {}
  }, [tema]);

  // Saqlash kechiktirilgan: har harf bosilganda emas, 600ms tinchlikdan keyin.
  const navbat = useRef<Map<number, Partial<Zakaz>>>(new Map());
  const taymer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yubor = useCallback(() => {
    const items = Array.from(navbat.current.entries());
    navbat.current.clear();
    if (!items.length) return;
    setSaqlash("...");
    Promise.all(items.map(([id, patch]) => sb.from("zk_zakazlar").update(patch).eq("id", id)))
      .then((res) => setSaqlash(res.some((r) => r.error) ? "xato" : "ok"))
      .then(() => setTimeout(() => setSaqlash(""), 1500));
  }, [sb]);

  const ozgartir = useCallback((id: number, patch: Partial<Zakaz>, darhol = false) => {
    setRows((r) => r.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    navbat.current.set(id, { ...(navbat.current.get(id) ?? {}), ...patch });
    if (taymer.current) clearTimeout(taymer.current);
    if (darhol) yubor(); else taymer.current = setTimeout(yubor, 600);
  }, [yubor]);

  useEffect(() => {
    const f = () => yubor();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [yubor]);

  async function yangiZakaz(tayyor?: Partial<Zakaz>) {
    const { data } = await sb.rpc("zk_keyingi_raqam");
    const z = { ...boshZakaz(Number(data ?? 1), sozlamalar), ...tayyor };
    const { error } = await sb.from("zk_zakazlar").insert(z);
    if (error) { alert("Qo'shilmadi: " + error.message); return; }
    setRows((r) => [z, ...r]);
    setFiltr("jarayonda");
    // Yangi qatorning mijoz katagiga fokus: Exceldagi kabi darhol yozishni boshlash uchun
    setTimeout(() => (document.querySelector(`[data-r="${z.id}"][data-c="1"]`) as HTMLElement | null)?.focus(), 50);
  }

  async function ochir(id: number) {
    if (!confirm(`#${id} zakazni o'chirasizmi?`)) return;
    await sb.from("zk_zakazlar").delete().eq("id", id);
    setRows((r) => r.filter((z) => z.id !== id));
  }

  // Klaviatura: Enter = pastga, Tab = o'ngga, strelkalar = qo'shni katak. Excel odati.
  const tugma = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.dataset.r, c = Number(el.dataset.c);
    if (r == null || isNaN(c)) return;
    let dr = 0, dc = 0;
    if (e.key === "Enter" || e.key === "ArrowDown") dr = 1;
    else if (e.key === "ArrowUp") dr = -1;
    else if (e.key === "ArrowRight" && (el as HTMLInputElement).selectionStart === (el as HTMLInputElement).value?.length) dc = 1;
    else if (e.key === "ArrowLeft" && (el as HTMLInputElement).selectionStart === 0) dc = -1;
    else return;
    e.preventDefault();
    const tr = el.closest("tr") as HTMLTableRowElement | null;
    let target: HTMLTableRowElement | null = tr;
    if (dr === 1) target = tr?.nextElementSibling as HTMLTableRowElement | null;
    if (dr === -1) target = tr?.previousElementSibling as HTMLTableRowElement | null;
    const next = target?.querySelector(`[data-c="${c + dc}"]`) as HTMLElement | null;
    if (next) { next.focus(); (next as HTMLInputElement).select?.(); }
  }, []);

  const bugun = new Date();
  const haftaOxiri = new Date(bugun); haftaOxiri.setDate(bugun.getDate() + 7);
  const korinadigan = rows.filter((z) => {
    if (qidiruv) {
      const q = qidiruv.toLowerCase();
      if (!(z.mijoz.toLowerCase().includes(q) || z.fayl_nomi.toLowerCase().includes(q) || String(z.id).includes(q) || z.qogoz_firma.toLowerCase().includes(q) || z.pechat_firma.toLowerCase().includes(q))) return false;
    }
    switch (filtr) {
      case "jarayonda": return z.holat === "jarayonda";
      case "shuhafta": return z.holat === "jarayonda" && new Date(srokSana(z, sozlamalar)) <= haftaOxiri;
      case "qogozyoq": return z.holat === "jarayonda" && z.qogoz_holat !== "olindi";
      case "ctpyoq": return z.holat === "jarayonda" && !(z.fayl_tayyor && z.ctp_tayyor && z.noj_tayyor);
      case "bitdi": return z.holat !== "jarayonda";
      default: return true;
    }
  });

  const filtrlar: [Filtr, string][] = [
    ["jarayonda", `Jarayonda (${rows.filter((z) => z.holat === "jarayonda").length})`],
    ["shuhafta", "Shu hafta"],
    ["qogozyoq", "Qogoz kelmagan"],
    ["ctpyoq", "Fayl/CTP/Noj yo'q"],
    ["bitdi", "Bitganlar"],
    ["hammasi", `Hammasi (${rows.length})`],
  ];

  return (
    <div className="h-screen flex flex-col">
      <header className="flex flex-wrap items-center gap-2 px-2 py-1" style={{ background: "var(--sarlavha-fon)", borderBottom: "2px solid var(--chiziq2)" }}>
        <b className="text-base px-1" style={{ color: "var(--asosiy)" }}>NLS Zakazlar</b>
        <button className="tugma asosiy" onClick={() => yangiZakaz()}>+ Yangi</button>
        <input className="kirish" placeholder="Qidirish" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} style={{ width: 180 }} />
        <div className="flex flex-wrap gap-1">
          {filtrlar.map(([k, n]) => (
            <button key={k} className={"tugma " + (filtr === k ? "faol" : "")} onClick={() => setFiltr(k)}>{n}</button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: saqlash === "xato" ? "var(--qizil)" : "var(--matn2)" }}>
          {saqlash === "..." ? "Saqlanmoqda" : saqlash === "ok" ? "Saqlandi" : saqlash === "xato" ? "Saqlanmadi!" : ""}
        </span>
        <select className="kirish" value={tema} onChange={(e) => setTema(e.target.value)} title="Tema">
          {TEMALAR.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <button className="tugma" onClick={() => setAi(true)}>AI</button>
        <button className="tugma" title={email} onClick={async () => { await sb.auth.signOut(); location.href = "/login"; }}>Chiqish</button>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="xl">
          <thead>
            <tr>
              <th className="muz" style={{ left: 0 }} colSpan={1}></th>
              <th colSpan={6}></th>
              <th className="guruh" colSpan={11}>Ustki qogoz</th>
              <th className="guruh" colSpan={2}>Laminatsiya / Lak</th>
              <th className="guruh" colSpan={3}>Fayl CTP Noj</th>
              <th className="guruh" colSpan={2}>Pechat</th>
              <th className="guruh" colSpan={2}>Qogoz</th>
              <th className="guruh" colSpan={3}>Qora qogoz (gofra)</th>
              <th colSpan={3}></th>
            </tr>
            <tr>
              <th className="muz" style={{ left: 0 }}>№</th>
              <th>Srok</th><th>Berilgan</th>
              <th>Zakazchik</th>
              <th>Dona</th><th>Chiqish</th><th>Fayl nomi</th>
              <th>F</th><th>Kesilishi</th><th>GR</th><th>Zapas</th><th>List</th><th>obsh kg</th>
              <th>Rulon kg</th><th>Rulon list</th><th>Rulonda dona</th><th>Summa</th><th>1 kg</th>
              <th>Laminatsiya</th><th>Lak / tisn / akoshka</th>
              <th>Fayl</th><th>CTP</th><th>Noj</th>
              <th>Firma</th><th>Bo'ldi</th>
              <th>Firma</th><th>Holat</th>
              <th>Tur</th><th>gr</th><th>kg kerak</th>
              <th>Holat</th><th>Izoh</th><th></th>
            </tr>
          </thead>
          <tbody>
            {korinadigan.map((z) => <Qator key={z.id} z={z} s={sozlamalar} ozgartir={ozgartir} ochir={ochir} pechat={pechatFirmalar} qogoz={qogozFirmalar} tugma={tugma} />)}
          </tbody>
        </table>
        {!korinadigan.length && <div className="p-8 text-center" style={{ color: "var(--matn2)" }}>Hech narsa topilmadi</div>}
      </div>

      {ai && <AiPanel yop={() => setAi(false)} zakazlar={rows} sozlamalar={sozlamalar} qosh={(z) => yangiZakaz(z)} />}
    </div>
  );
}

function Qator({ z, s, ozgartir, ochir, pechat, qogoz, tugma }: {
  z: Zakaz; s: Sozlamalar; ozgartir: (id: number, p: Partial<Zakaz>, darhol?: boolean) => void; ochir: (id: number) => void;
  pechat: string[]; qogoz: string[]; tugma: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  let c = 0; // ustun indeksi: klaviatura bilan yurish uchun
  const sh = srokHolati(z, s);
  const srokKlass = sh === "qizil" ? "yoq" : sh === "sariq" ? "ora" : "";
  const nav = () => ({ "data-r": z.id, "data-c": c++, onKeyDown: tugma });

  const son = (k: keyof Zakaz, w = 60, step = "any", ph = "") => (
    <td style={{ width: w }}>
      <input {...nav()} className="k son" type="number" step={step} placeholder={ph} value={(z[k] as number | null) ?? ""} style={{ width: w }}
        onChange={(e) => ozgartir(z.id, { [k]: e.target.value === "" ? null : Number(e.target.value) } as Partial<Zakaz>)} />
    </td>
  );
  const matn = (k: keyof Zakaz, w: number) => (
    <td style={{ width: w }}><input {...nav()} className="k" value={(z[k] as string) ?? ""} style={{ width: w }} onChange={(e) => ozgartir(z.id, { [k]: e.target.value } as Partial<Zakaz>)} /></td>
  );
  // Exceldagi kabi: katak bosilsa "+" tushadi va yashil bo'ladi, bo'sh bo'lsa qizil
  const plus = (ha: boolean, k: keyof Zakaz, off = false) => (
    <td className={"bos " + (off ? "off" : ha ? "ha" : "yoq")} style={{ width: 44 }} tabIndex={0} {...nav()}
      onClick={() => !off && ozgartir(z.id, { [k]: !ha } as Partial<Zakaz>, true)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "+") { e.preventDefault(); !off && ozgartir(z.id, { [k]: !ha } as Partial<Zakaz>, true); } else tugma(e); }}>
      {off ? "" : ha ? "+" : ""}
    </td>
  );
  const firmaSelect = (k: "pechat_firma" | "qogoz_firma", list: string[]) => (
    <td style={{ width: 120 }}>
      <select {...nav()} className="k" value={z[k]} style={{ width: 120 }} onChange={(e) => ozgartir(z.id, { [k]: e.target.value }, true)}>
        <option value=""></option>
        {[...new Set([...list, z[k]].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </td>
  );
  const qogozKlass = z.qogoz_holat === "olindi" ? "ha" : z.qogoz_holat === "buyurtma" ? "ora" : "yoq";
  const qogozMatn = z.qogoz_holat === "olindi" ? "olindi" : z.qogoz_holat === "buyurtma" ? "zakaz" : "";
  const keyingiQogoz: Record<QogozHolat, QogozHolat> = { yoq: "buyurtma", buyurtma: "olindi", olindi: "yoq" };
  const yopiq = z.holat !== "jarayonda";
  const lamKlass = !z.laminatsiya_kerak ? "" : z.laminatsiya_tayyor ? "ha" : "yoq";
  const lakKlass = !z.lak_kerak ? "" : z.lak_tayyor ? "ha" : "yoq";

  return (
    <tr className={yopiq ? "yopiq" : ""}>
      <td className="muz hisob" style={{ left: 0, width: 46, textAlign: "center" }}>{z.id}</td>
      <td className={srokKlass} style={{ width: 112 }}>
        <input {...nav()} className={"k " + srokKlass} type="date" value={srokSana(z, s)} style={{ width: 112 }} onChange={(e) => ozgartir(z.id, { srok: e.target.value || null })} />
      </td>
      <td style={{ width: 112 }}><input {...nav()} className="k" type="date" value={z.berilgan} style={{ width: 112 }} onChange={(e) => ozgartir(z.id, { berilgan: e.target.value })} /></td>
      <td style={{ width: 160 }}><input {...nav()} className="k" value={z.mijoz} style={{ width: 160 }} onChange={(e) => ozgartir(z.id, { mijoz: e.target.value })} /></td>
      {son("dona", 66, "1")}
      {son("chiqish", 50)}
      {matn("fayl_nomi", 220)}
      {son("format_h", 54)}
      {son("format_i", 54)}
      {son("gramm", 54, "1")}
      {son("zapas", 50, "1")}
      {son("list_soni", 64, "1", String(listSoni({ ...z, list_soni: null }) || ""))}
      <td className="hisob">{fmtSon(ustkiKg(z))}</td>
      {son("rulon_kg", 64)}
      <td className="hisob">{rulonList(z) ? fmtSon(rulonList(z)) : ""}</td>
      <td className="hisob" style={z.rulon_kg && haqiqiyDona(z) !== z.dona ? { fontWeight: 700 } : undefined}>{z.rulon_kg ? fmtSon(haqiqiyDona(z)) : ""}</td>
      {son("qogoz_summa", 96, "1")}
      <td className="hisob">{kgNarx(z) ? fmtSon(kgNarx(z)) : ""}</td>
      {/* Laminatsiya: summa yozilsa "kerak" bo'ladi, katak bosilsa tayyor (yashil) */}
      <td className={lamKlass} style={{ width: 90 }}>
        <input {...nav()} className={"k son " + lamKlass} type="number" placeholder="summa" value={z.laminatsiya_summa ?? ""} style={{ width: 90 }}
          onChange={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); ozgartir(z.id, { laminatsiya_summa: v, laminatsiya_kerak: v != null || z.laminatsiya_kerak }); }}
          onDoubleClick={() => z.laminatsiya_kerak && ozgartir(z.id, { laminatsiya_tayyor: !z.laminatsiya_tayyor }, true)}
          title="2 marta bosing: tayyor / tayyor emas" />
      </td>
      <td className={lakKlass} style={{ width: 130 }}>
        <input {...nav()} className={"k " + lakKlass} placeholder="lak / tisn / akoshka" value={z.lak_turi} style={{ width: 130 }}
          onChange={(e) => ozgartir(z.id, { lak_turi: e.target.value, lak_kerak: e.target.value !== "" || z.lak_kerak })}
          onDoubleClick={() => z.lak_kerak && ozgartir(z.id, { lak_tayyor: !z.lak_tayyor }, true)}
          title="2 marta bosing: tayyor / tayyor emas" />
      </td>
      {plus(z.fayl_tayyor, "fayl_tayyor")}
      {plus(z.ctp_tayyor, "ctp_tayyor")}
      {plus(z.noj_tayyor, "noj_tayyor")}
      {firmaSelect("pechat_firma", pechat)}
      {plus(z.pechat_tayyor, "pechat_tayyor", z.pechat_firma === "Pechatsiz")}
      {firmaSelect("qogoz_firma", qogoz)}
      <td className={"bos " + qogozKlass} style={{ width: 60 }} tabIndex={0} {...nav()}
        onClick={() => ozgartir(z.id, { qogoz_holat: keyingiQogoz[z.qogoz_holat] }, true)}
        onKeyDown={(e) => { if (e.key === " ") { e.preventDefault(); ozgartir(z.id, { qogoz_holat: keyingiQogoz[z.qogoz_holat] }, true); } else tugma(e); }}>
        {qogozMatn}
      </td>
      <td style={{ width: 70 }}>
        <select {...nav()} className="k" value={z.qora_turi} style={{ width: 70 }} onChange={(e) => ozgartir(z.id, { qora_turi: e.target.value as QoraTuri }, true)}>
          <option value="micro">micro</option><option value="macro">macro</option><option value="5sloy">5 sloy</option><option value="yoq"></option>
        </select>
      </td>
      {son("qora_gramm", 54, "1", String(qoraGramm(z, s) || ""))}
      <td className="hisob">{z.qora_turi === "yoq" ? "" : fmtSon(qoraKg(z, s))}</td>
      <td style={{ width: 96 }}>
        <select {...nav()} className={"k " + (z.holat === "bitdi" ? "ha" : z.holat === "otmen" ? "yoq" : "")} value={z.holat} style={{ width: 96 }} onChange={(e) => ozgartir(z.id, { holat: e.target.value as Holat }, true)}>
          <option value="jarayonda">jarayonda</option><option value="bitdi">bitdi</option><option value="otmen">otmen</option>
        </select>
      </td>
      {matn("izoh", 180)}
      <td style={{ width: 28, textAlign: "center" }}><button style={{ color: "var(--matn2)", fontSize: 12 }} onClick={() => ochir(z.id)} title="O'chirish">✕</button></td>
    </tr>
  );
}
