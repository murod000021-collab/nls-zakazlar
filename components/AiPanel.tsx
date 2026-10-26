"use client";
import { useState, useRef, useEffect } from "react";
import type { Zakaz, Sozlamalar } from "@/lib/hisob";

type Xabar = { role: "user" | "assistant"; content: string; taklif?: Partial<Zakaz> | null };

export default function AiPanel({ yop, qosh }: {
  yop: () => void; zakazlar: Zakaz[]; sozlamalar: Sozlamalar; qosh: (z: Partial<Zakaz>) => Promise<void>;
}) {
  const [xabarlar, setXabarlar] = useState<Xabar[]>([
    { role: "assistant", content: "Salom. Misollar:\n• Gafurov 5000 ta Xorazm baliq 102x71 140 gr 1 chiqadi micro\n• Bu hafta kimga topshirishim kerak?\n• Qaysi zakazlarda qogoz hali kelmagan?\n• 350 kg rulon 102x71 140 gr dan nechta list chiqadi?" },
  ]);
  const [matn, setMatn] = useState("");
  const [kutish, setKutish] = useState(false);
  const oxiri = useRef<HTMLDivElement>(null);
  useEffect(() => oxiri.current?.scrollIntoView({ behavior: "smooth" }), [xabarlar]);

  async function yubor() {
    const t = matn.trim();
    if (!t || kutish) return;
    const yangi: Xabar[] = [...xabarlar, { role: "user", content: t }];
    setXabarlar(yangi); setMatn(""); setKutish(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xabarlar: yangi.map(({ role, content }) => ({ role, content })), bugun: new Date().toISOString().slice(0, 10) }),
      });
      const d = await r.json();
      setXabarlar((x) => [...x, { role: "assistant", content: d.reply, taklif: d.taklif }]);
    } catch {
      setXabarlar((x) => [...x, { role: "assistant", content: "Ulanishda xato." }]);
    } finally { setKutish(false); }
  }

  return (
    <aside className="ai-panel">
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--chiziq)" }}>
        <b>AI yordamchi</b>
        <button className="tugma" onClick={yop}>Yopish</button>
      </div>
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
        {xabarlar.map((x, i) => (
          <div key={i} className="flex flex-col gap-1" style={{ alignItems: x.role === "user" ? "flex-end" : "flex-start" }}>
            <div className={"xabar " + (x.role === "user" ? "men" : "ai")}>{x.content}</div>
            {x.taklif && <Taklif t={x.taklif} qosh={async () => { await qosh(x.taklif!); setXabarlar((xs) => xs.map((y, j) => (j === i ? { ...y, taklif: null, content: y.content + "\n\n✅ Jadvalga qo'shildi" } : y))); }} />}
          </div>
        ))}
        {kutish && <div className="xabar ai">...</div>}
        <div ref={oxiri} />
      </div>
      <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--chiziq)" }}>
        <input className="kirish flex-1" value={matn} onChange={(e) => setMatn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && yubor()} placeholder="Yozing..." />
        <button className="tugma asosiy" onClick={yubor} disabled={kutish}>Yubor</button>
      </div>
    </aside>
  );
}

// AI qo'shishdan oldin ko'rsatiladi: model noto'g'ri tushungan bo'lsa jadvalga xato tushmasin.
function Taklif({ t, qosh }: { t: Partial<Zakaz>; qosh: () => Promise<void> }) {
  const satr = Object.entries(t).filter(([, v]) => v !== "" && v != null && v !== false).map(([k, v]) => `${k}: ${v}`).join("\n");
  return (
    <div className="border rounded-lg p-3 text-xs flex flex-col gap-2" style={{ borderColor: "var(--chiziq)", background: "var(--yashil-fon)", maxWidth: "92%" }}>
      <pre className="whitespace-pre-wrap font-mono">{satr}</pre>
      <button className="tugma asosiy self-start" onClick={qosh}>Jadvalga qo'shish</button>
    </div>
  );
}
