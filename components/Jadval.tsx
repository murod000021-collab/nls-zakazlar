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

export default function Jadval({ boshlangich, firmalar, sozlamalar, email }: {
  boshlangich: Zakaz[]; firmalar: Firma[]; sozlamalar: Sozlamalar; email: string;
}) {
  const [rows, setRows] = useState<Zakaz[]>(boshlangich);
  const [filtr, setFiltr] = useState<Filtr>("jarayonda");
  const [qidiruv, setQidiruv] = useState("");
  const [ai, setAi] = useState(false);
  const [saqlash, setSaqlash] = useState<"" | "..." | "ok" | "xato">("");
  const sb = useMemo(() => supabaseBrowser(), []);
  const pechatFirmalar = firmalar.filter((f) => f.turi === "pechat").map((f) => f.nomi);
  const qogozFirmalar = firmalar.filter((f) => f.turi === "qogoz").map((f) => f.nomi);

  // Saqlash kechiktirilgan: har harf bosilganda emas, 600ms tinchlikdan keyin.
  // Aks holda telefonda yozayotganda har harfga so'rov ketib, sekinlashardi.
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
  }

  async function ochir(id: number) {
    if (!confirm(`#${id} zakazni o'chirasizmi?`)) return;
    await sb.from("zk_zakazlar").delete().eq("id", id);
    setRows((r) => r.filter((z) => z.id !== id));
  }

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
    ["shuhafta", "Shu hafta srok"],
    ["qogozyoq", "Qogoz kelmagan"],
    ["ctpyoq", "Fayl/CTP/Noj yo'q"],
    ["bitdi", "Bitganlar"],
    ["hammasi", `Hammasi (${rows.length})`],
  ];

  return (
    <div className="h-screen flex flex-col">
      <header className="flex flex-wrap items-center gap-2 p-2 border-b bg-white" style={{ borderColor: "var(--chiziq)" }}>
        <b className="text-base px-1">NLS Zakazlar</b>
        <button className="tugma asosiy" onClick={() => yangiZakaz()}>+ Yangi zakaz</button>
        <input className="kirish" placeholder="Qidirish: mijoz, fayl, №" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} style={{ minWidth: 200 }} />
        <div className="flex flex-wrap gap-1">
          {filtrlar.map(([k, n]) => (
            <button key={k} className={"tugma " + (filtr === k ? "faol" : "")} onClick={() => setFiltr(k)}>{n}</button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: saqlash === "xato" ? "var(--qizil)" : "var(--matn2)" }}>
          {saqlash === "..." ? "Saqlanmoqda" : saqlash === "ok" ? "Saqlandi" : saqlash === "xato" ? "Saqlanmadi!" : ""}
        </span>
        <button className="tugma" onClick={() => setAi(true)}>AI yordamchi</button>
        <button className="tugma" title={email} onClick={async () => { await sb.auth.signOut(); location.href = "/login"; }}>Chiqish</button>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="jadval text-sm">
          <thead>
            <tr>
              <th className="muz" style={{ left: 0 }}>№</th>
              <th>Srok</th><th>Berilgan</th>
              <th className="muz" style={{ left: 50 }}>Mijoz</th>
              <th>Dona</th><th>Chiq</th><th>Fayl / karobka nomi</th>
              <th>F h</th><th>F i</th><th>Gr</th><th>Zapas</th><th>List</th><th>Ustki kg</th>
              <th>Rulon kg</th><th>Rulon list</th><th>Haqiqiy dona</th><th>Summa</th><th>1 kg</th>
              <th>Lam.</th><th>Lak/tisn/akoshka</th>
              <th>Fayl</th><th>CTP</th><th>Noj</th>
              <th>Pechat firma</th><th>Pechat</th><th>Qogoz firma</th><th>Qogoz</th>
              <th>Qora</th><th>Q gr</th><th>Qora kg</th>
              <th>Holat</th><th>Izoh</th><th></th>
            </tr>
          </thead>
          <tbody>
            {korinadigan.map((z) => <Qator key={z.id} z={z} s={sozlamalar} ozgartir={ozgartir} ochir={ochir} pechat={pechatFirmalar} qogoz={qogozFirmalar} />)}
          </tbody>
        </table>
        {!korinadigan.length && <div className="p-8 text-center" style={{ color: "var(--matn2)" }}>Hech narsa topilmadi</div>}
      </div>

      {ai && <AiPanel yop={() => setAi(false)} zakazlar={rows} sozlamalar={sozlamalar} qosh={(z) => yangiZakaz(z)} />}
    </div>
  );
}

function Qator({ z, s, ozgartir, ochir, pechat, qogoz }: {
  z: Zakaz; s: Sozlamalar; ozgartir: (id: number, p: Partial<Zakaz>, darhol?: boolean) => void; ochir: (id: number) => void; pechat: string[]; qogoz: string[];
}) {
  const sh = srokHolati(z, s);
  const srokKlass = sh === "qizil" ? "fon-qizil" : sh === "sariq" ? "fon-sariq" : "";
  const son = (k: keyof Zakaz, w = 64, step = "any") => (
    <td style={{ width: w }}>
      <input className="katak son" type="number" step={step} value={(z[k] as number | null) ?? ""} style={{ width: w }}
        onChange={(e) => ozgartir(z.id, { [k]: e.target.value === "" ? null : Number(e.target.value) } as Partial<Zakaz>)} />
    </td>
  );
  const matn = (k: keyof Zakaz, w: number) => (
    <td style={{ width: w }}><input className="katak" value={(z[k] as string) ?? ""} style={{ width: w }} onChange={(e) => ozgartir(z.id, { [k]: e.target.value } as Partial<Zakaz>)} /></td>
  );
  const chip = (ha: boolean, k: keyof Zakaz, off = false) => (
    <td className="text-center px-1">
      <span className={"chip " + (off ? "off" : ha ? "ha" : "yoq")} onClick={() => !off && ozgartir(z.id, { [k]: !ha } as Partial<Zakaz>, true)}>{off ? "yo'q" : ha ? "+" : "yo'q"}</span>
    </td>
  );
  const firmaSelect = (k: "pechat_firma" | "qogoz_firma", list: string[]) => (
    <td>
      <select className="katak" value={z[k]} style={{ width: 130 }} onChange={(e) => ozgartir(z.id, { [k]: e.target.value }, true)}>
        <option value="">...</option>
        {[...new Set([...list, z[k]].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </td>
  );
  const qogozKlass = z.qogoz_holat === "olindi" ? "ha" : z.qogoz_holat === "buyurtma" ? "ora" : "yoq";
  const qogozMatn = z.qogoz_holat === "olindi" ? "olindi" : z.qogoz_holat === "buyurtma" ? "zakaz" : "yo'q";
  const keyingiQogoz: Record<QogozHolat, QogozHolat> = { yoq: "buyurtma", buyurtma: "olindi", olindi: "yoq" };
  const yopiq = z.holat !== "jarayonda";

  return (
    <tr style={yopiq ? { opacity: 0.55 } : undefined}>
      <td className="muz hisob" style={{ left: 0, width: 50 }}>{z.id}</td>
      <td className={srokKlass} style={{ width: 110 }}>
        <input className={"katak " + srokKlass} type="date" value={srokSana(z, s)} style={{ width: 110 }} onChange={(e) => ozgartir(z.id, { srok: e.target.value || null })} />
      </td>
      <td style={{ width: 110 }}><input className="katak" type="date" value={z.berilgan} style={{ width: 110 }} onChange={(e) => ozgartir(z.id, { berilgan: e.target.value })} /></td>
      <td className="muz" style={{ left: 50, width: 170 }}><input className="katak" value={z.mijoz} style={{ width: 170 }} onChange={(e) => ozgartir(z.id, { mijoz: e.target.value })} /></td>
      {son("dona", 72, "1")}
      {son("chiqish", 52)}
      {matn("fayl_nomi", 220)}
      {son("format_h", 56)}
      {son("format_i", 56)}
      {son("gramm", 56, "1")}
      {son("zapas", 56, "1")}
      <td style={{ width: 70 }}>
        <input className="katak son" type="number" step="1" placeholder={String(listSoni({ ...z, list_soni: null }))} value={z.list_soni ?? ""} style={{ width: 70 }}
          onChange={(e) => ozgartir(z.id, { list_soni: e.target.value === "" ? null : Number(e.target.value) })} />
      </td>
      <td className="hisob">{fmtSon(ustkiKg(z))}</td>
      {son("rulon_kg", 70)}
      <td className="hisob">{rulonList(z) ? fmtSon(rulonList(z)) : ""}</td>
      <td className="hisob" style={z.rulon_kg && haqiqiyDona(z) !== z.dona ? { color: "var(--sariq)", fontWeight: 600 } : undefined}>{z.rulon_kg ? fmtSon(haqiqiyDona(z)) : ""}</td>
      {son("qogoz_summa", 100, "1")}
      <td className="hisob">{kgNarx(z) ? fmtSon(kgNarx(z)) : ""}</td>
      <td className="px-1">
        <div className="flex items-center gap-1">
          <span className={"chip " + (!z.laminatsiya_kerak ? "off" : z.laminatsiya_tayyor ? "ha" : "yoq")}
            onClick={() => ozgartir(z.id, !z.laminatsiya_kerak ? { laminatsiya_kerak: true } : !z.laminatsiya_tayyor ? { laminatsiya_tayyor: true } : { laminatsiya_kerak: false, laminatsiya_tayyor: false }, true)}>
            {!z.laminatsiya_kerak ? "yo'q" : z.laminatsiya_tayyor ? "+" : "kutish"}
          </span>
          {z.laminatsiya_kerak && <input className="katak son" type="number" placeholder="summa" value={z.laminatsiya_summa ?? ""} style={{ width: 90 }} onChange={(e) => ozgartir(z.id, { laminatsiya_summa: e.target.value === "" ? null : Number(e.target.value) })} />}
        </div>
      </td>
      <td className="px-1">
        <div className="flex items-center gap-1">
          <span className={"chip " + (!z.lak_kerak ? "off" : z.lak_tayyor ? "ha" : "yoq")}
            onClick={() => ozgartir(z.id, !z.lak_kerak ? { lak_kerak: true } : !z.lak_tayyor ? { lak_tayyor: true } : { lak_kerak: false, lak_tayyor: false }, true)}>
            {!z.lak_kerak ? "yo'q" : z.lak_tayyor ? "+" : "kutish"}
          </span>
          {z.lak_kerak && <>
            <input className="katak" placeholder="lak / tisn / akoshka" value={z.lak_turi} style={{ width: 120 }} onChange={(e) => ozgartir(z.id, { lak_turi: e.target.value })} />
            <input className="katak son" type="number" placeholder="summa" value={z.lak_summa ?? ""} style={{ width: 90 }} onChange={(e) => ozgartir(z.id, { lak_summa: e.target.value === "" ? null : Number(e.target.value) })} />
          </>}
        </div>
      </td>
      {chip(z.fayl_tayyor, "fayl_tayyor")}
      {chip(z.ctp_tayyor, "ctp_tayyor")}
      {chip(z.noj_tayyor, "noj_tayyor")}
      {firmaSelect("pechat_firma", pechat)}
      {chip(z.pechat_tayyor, "pechat_tayyor", z.pechat_firma === "Pechatsiz")}
      {firmaSelect("qogoz_firma", qogoz)}
      <td className="text-center px-1"><span className={"chip " + qogozKlass} onClick={() => ozgartir(z.id, { qogoz_holat: keyingiQogoz[z.qogoz_holat] }, true)}>{qogozMatn}</span></td>
      <td>
        <select className="katak" value={z.qora_turi} style={{ width: 80 }} onChange={(e) => ozgartir(z.id, { qora_turi: e.target.value as QoraTuri }, true)}>
          <option value="micro">micro</option><option value="macro">macro</option><option value="5sloy">5 sloy</option><option value="yoq">yo'q</option>
        </select>
      </td>
      <td style={{ width: 56 }}>
        <input className="katak son" type="number" placeholder={String(qoraGramm(z, s) || "")} value={z.qora_gramm ?? ""} style={{ width: 56 }} onChange={(e) => ozgartir(z.id, { qora_gramm: e.target.value === "" ? null : Number(e.target.value) })} />
      </td>
      <td className="hisob">{z.qora_turi === "yoq" ? "" : fmtSon(qoraKg(z, s))}</td>
      <td>
        <select className={"katak " + (z.holat === "bitdi" ? "fon-yashil" : z.holat === "otmen" ? "fon-qizil" : "")} value={z.holat} style={{ width: 100 }} onChange={(e) => ozgartir(z.id, { holat: e.target.value as Holat }, true)}>
          <option value="jarayonda">jarayonda</option><option value="bitdi">bitdi</option><option value="otmen">otmen</option>
        </select>
      </td>
      {matn("izoh", 180)}
      <td className="px-1 text-center"><button className="text-xs" style={{ color: "var(--matn2)" }} onClick={() => ochir(z.id)} title="O'chirish">✕</button></td>
    </tr>
  );
}
