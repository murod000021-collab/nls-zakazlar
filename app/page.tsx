import { supabaseServer } from "@/lib/supabase/server";
import Jadval from "@/components/Jadval";
import { SOZLAMA_DEFAULT, type Sozlamalar, type Zakaz } from "@/lib/hisob";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sb = await supabaseServer();
  // Hamma zakaz bir martada yuklanadi (863 qator, ~300KB): filtr va qidiruv brauzerda tezroq,
  // har bosishda serverga bormaydi.
  const [{ data: zakazlar }, { data: firmalar }, { data: soz }, { data: { user } }] = await Promise.all([
    sb.from("zk_zakazlar").select("*").order("id", { ascending: false }),
    sb.from("zk_firmalar").select("*").eq("faol", true).order("nomi"),
    sb.from("zk_sozlamalar").select("*"),
    sb.auth.getUser(),
  ]);
  const sozlamalar: Sozlamalar = { ...SOZLAMA_DEFAULT };
  for (const r of soz ?? []) (sozlamalar as unknown as Record<string, number>)[r.kalit] = Number(r.qiymat);

  return (
    <Jadval
      boshlangich={(zakazlar ?? []) as Zakaz[]}
      firmalar={(firmalar ?? []) as { nomi: string; turi: "pechat" | "qogoz" }[]}
      sozlamalar={sozlamalar}
      email={user?.email ?? ""}
    />
  );
}
