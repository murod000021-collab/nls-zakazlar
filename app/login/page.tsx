"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [parol, setParol] = useState("");
  const [xato, setXato] = useState("");
  const [kutish, setKutish] = useState(false);

  async function kir(e: React.FormEvent) {
    e.preventDefault();
    setKutish(true); setXato("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: parol });
    setKutish(false);
    if (error) { setXato("Email yoki parol noto'g'ri"); return; }
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={kir} className="w-full max-w-sm border rounded p-6 flex flex-col gap-3" style={{ borderColor: "var(--chiziq2)", background: "var(--qog)" }}>
        <h1 className="text-xl font-bold">NLS Zakazlar</h1>
        <input className="kirish" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="kirish" type="password" placeholder="Parol" value={parol} onChange={(e) => setParol(e.target.value)} required autoComplete="current-password" />
        {xato && <div className="text-sm" style={{ color: "var(--qizil)" }}>{xato}</div>}
        <button className="tugma asosiy" disabled={kutish}>{kutish ? "..." : "Kirish"}</button>
      </form>
    </main>
  );
}
