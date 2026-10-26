import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  type Zakaz, type Sozlamalar, SOZLAMA_DEFAULT,
  listSoni, ustkiKg, qoraKg, rulonList, haqiqiyDona, kgNarx, srokSana, srokHolati, ochiqBosqichlar,
} from "@/lib/hisob";

export const runtime = "nodejs";

// Modelga jadval to'g'ridan to'g'ri berilmaydi: SQL yozib xato qilmasin va eski qatorlar bilan
// kontekst to'lib ketmasin. Buning o'rniga faqat jarayondagi zakazlar qisqa satr ko'rinishida
// beriladi, tarix uchun esa "qidir" vositasi bor.
function qisqa(z: Zakaz, s: Sozlamalar): string {
  const och = ochiqBosqichlar(z);
  return `#${z.id} | ${z.mijoz} | ${z.fayl_nomi} | ${z.dona} dona, ${z.chiqish} chiqadi, ${z.format_h}x${z.format_i} ${z.gramm}gr, list ${listSoni(z)}, ustki ${ustkiKg(z)}kg, qora ${z.qora_turi} ${qoraKg(z, s)}kg` +
    ` | berilgan ${z.berilgan}, srok ${srokSana(z, s)} (${srokHolati(z, s)})` +
    ` | pechat: ${z.pechat_firma || "?"}${z.pechat_tayyor ? " tayyor" : ""} | qogoz: ${z.qogoz_firma || "?"} ${z.qogoz_holat}` +
    (z.rulon_kg ? ` | rulon ${z.rulon_kg}kg = ${rulonList(z)} list = ${haqiqiyDona(z)} dona` : "") +
    (z.qogoz_summa ? ` | summa ${z.qogoz_summa}, 1kg ${kgNarx(z)}` : "") +
    ` | holat: ${z.holat}` + (och.length ? ` | qolgan: ${och.join(", ")}` : " | hammasi tayyor") +
    (z.izoh ? ` | izoh: ${z.izoh}` : "");
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ reply: "OPENAI_API_KEY hali kiritilmagan. .env faylga kalitni yozing." });
  }
  const { xabarlar, bugun } = (await req.json()) as { xabarlar: { role: "user" | "assistant"; content: string }[]; bugun: string };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ reply: "Avval kiring" }, { status: 401 });

  const [{ data: soz }, { data: firmalar }, { data: jarayonda }] = await Promise.all([
    sb.from("zk_sozlamalar").select("*"),
    sb.from("zk_firmalar").select("nomi,turi").eq("faol", true),
    sb.from("zk_zakazlar").select("*").eq("holat", "jarayonda").order("id", { ascending: false }),
  ]);
  const s: Sozlamalar = { ...SOZLAMA_DEFAULT };
  for (const r of soz ?? []) (s as unknown as Record<string, number>)[r.kalit] = Number(r.qiymat);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const system = `Sen NLS karobka ishlab chiqarish zakazlari bo'yicha yordamchisan. O'zbek tilida (lotin), qisqa va aniq javob ber. Em dash yoki en dash ishlatma.
Bugun: ${bugun}. Sozlamalar: zapas ${s.zapas_default} list, qora qogoz grammi micro ${s.gramm_micro}, macro ${s.gramm_macro}, 5 sloy ${s.gramm_5sloy}, srok ${s.srok_kun} kun.
Pechat firmalari: ${(firmalar ?? []).filter((f) => f.turi === "pechat").map((f) => f.nomi).join(", ")}.
Qogoz firmalari: ${(firmalar ?? []).filter((f) => f.turi === "qogoz").map((f) => f.nomi).join(", ")}.
Formulalar: list = ceil(dona/chiqish)+zapas; qogoz kg = h*i*gramm*list/10^7; rulondan list = rulon_kg*10^7/(gramm*i*h); rulon ko'p chiqsa karobka ham ko'p qilinadi.
Jarayondagi zakazlar:
${(jarayonda as Zakaz[] ?? []).map((z) => qisqa(z, s)).join("\n") || "(yo'q)"}

Foydalanuvchi yangi zakaz aytsa "yangi_zakaz" vositasini chaqir: faqat aytilgan maydonlarni to'ldir, qolganini bo'sh qoldir. Foydalanuvchi o'zi tasdiqlab qo'shadi, sen "qo'shildi" dema, "tayyorladim, tasdiqlang" de.
Eski zakazlar (bitgan) haqida so'ralsa "qidir" vositasini ishlat.`;

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "yangi_zakaz",
        description: "Jadvalga qo'shish uchun yangi zakaz tayyorlash (foydalanuvchi tasdiqlaydi)",
        parameters: {
          type: "object",
          properties: {
            mijoz: { type: "string" }, fayl_nomi: { type: "string" }, dona: { type: "integer" },
            chiqish: { type: "number", description: "1 listdan nechta chiqadi" },
            format_h: { type: "number" }, format_i: { type: "number" }, gramm: { type: "number" },
            qora_turi: { type: "string", enum: ["micro", "macro", "5sloy", "yoq"] },
            pechat_firma: { type: "string" }, qogoz_firma: { type: "string" },
            laminatsiya_kerak: { type: "boolean" }, lak_kerak: { type: "boolean" }, lak_turi: { type: "string" },
            srok: { type: "string", description: "YYYY-MM-DD, aytilgan bo'lsa" }, izoh: { type: "string" },
          },
          required: ["mijoz", "dona"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "qidir",
        description: "Barcha zakazlar (bitganlar ham) ichidan mijoz yoki fayl nomi bo'yicha qidirish",
        parameters: { type: "object", properties: { soz: { type: "string" }, oxirgi: { type: "integer", description: "nechta qaytarish, default 15" } }, required: ["soz"] },
      },
    },
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: system }, ...xabarlar.slice(-12)];
  let taklif: Partial<Zakaz> | null = null;

  // Ko'pi bilan 3 aylanish: qidir -> javob. Cheksiz tsiklga tushmasin.
  for (let i = 0; i < 3; i++) {
    const r = await openai.chat.completions.create({ model, messages, tools, temperature: 0.2 });
    const m = r.choices[0].message;
    if (!m.tool_calls?.length) return NextResponse.json({ reply: m.content ?? "", taklif });
    messages.push(m);
    for (const tc of m.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments || "{}");
      let natija = "";
      if (tc.function.name === "yangi_zakaz") {
        taklif = args;
        natija = "Taklif tayyorlandi, foydalanuvchi tasdiqlaydi.";
      } else if (tc.function.name === "qidir") {
        const { data } = await sb.from("zk_zakazlar").select("*")
          .or(`mijoz.ilike.%${args.soz}%,fayl_nomi.ilike.%${args.soz}%`)
          .order("id", { ascending: false }).limit(args.oxirgi || 15);
        natija = (data as Zakaz[] ?? []).map((z) => qisqa(z, s)).join("\n") || "topilmadi";
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: natija });
    }
  }
  return NextResponse.json({ reply: "Javob berolmadim, qayta urinib ko'ring.", taklif });
}
