// Barcha hisoblar bir joyda. Excelda formulalar har qatorga qo'lda nusxalangan edi,
// bittasi buzilsa sezilmasdi. Shu uchun bitta funksiya, hamma joyda shundan foydalaniladi.

export type QoraTuri = "yoq" | "micro" | "macro" | "5sloy";
export type QogozHolat = "yoq" | "buyurtma" | "olindi";
export type Holat = "jarayonda" | "bitdi" | "otmen";

export interface Zakaz {
  id: number;
  berilgan: string;
  srok: string | null;
  mijoz: string;
  dona: number;
  chiqish: number;
  fayl_nomi: string;
  format_h: number | null;
  format_i: number | null;
  gramm: number | null;
  zapas: number;
  list_soni: number | null;
  rulon_kg: number | null;
  qogoz_summa: number | null;
  laminatsiya_kerak: boolean;
  laminatsiya_tayyor: boolean;
  laminatsiya_summa: number | null;
  lak_kerak: boolean;
  lak_turi: string;
  lak_tayyor: boolean;
  lak_summa: number | null;
  fayl_tayyor: boolean;
  ctp_tayyor: boolean;
  noj_tayyor: boolean;
  pechat_firma: string;
  pechat_tayyor: boolean;
  qogoz_firma: string;
  qogoz_holat: QogozHolat;
  qora_turi: QoraTuri;
  qora_gramm: number | null;
  qora_h: number | null;
  qora_i: number | null;
  holat: Holat;
  izoh: string;
}

export interface Sozlamalar {
  zapas_default: number;
  gramm_micro: number;
  gramm_macro: number;
  gramm_5sloy: number;
  srok_kun: number;
}

export const SOZLAMA_DEFAULT: Sozlamalar = {
  zapas_default: 100,
  gramm_micro: 310,
  gramm_macro: 375,
  gramm_5sloy: 620,
  srok_kun: 10,
};

/** Exceldagi K ustun: dona / chiqish, yuqoriga yaxlitlab, zapas qo'shib.
 *  Murod qo'lda yozganda 12000 ga 12200 yozardi; endi zapas alohida maydon. */
export function listSoni(z: Pick<Zakaz, "dona" | "chiqish" | "zapas" | "list_soni">): number {
  if (z.list_soni != null && z.list_soni > 0) return z.list_soni; // qo'lda yozilgani ustun
  if (!z.chiqish || z.chiqish <= 0) return 0;
  return Math.ceil(z.dona / z.chiqish) + (z.zapas || 0);
}

/** Qogoz og'irligi kg: H(sm) * I(sm) * gramm * list / 10^7. Excel L va AD ustuni bir xil formula. */
export function qogozKg(h: number | null, i: number | null, gramm: number | null, list: number): number {
  if (!h || !i || !gramm || !list) return 0;
  return Math.round((h * i * gramm * list) / 1e7 * 10) / 10;
}

export function ustkiKg(z: Zakaz): number {
  return qogozKg(z.format_h, z.format_i, z.gramm, listSoni(z));
}

export function qoraGramm(z: Zakaz, s: Sozlamalar): number {
  if (z.qora_turi === "yoq") return 0;
  if (z.qora_gramm) return z.qora_gramm;
  if (z.qora_turi === "micro") return s.gramm_micro;
  if (z.qora_turi === "macro") return s.gramm_macro;
  return s.gramm_5sloy;
}

export function qoraKg(z: Zakaz, s: Sozlamalar): number {
  if (z.qora_turi === "yoq") return 0;
  return qogozKg(z.qora_h ?? z.format_h, z.qora_i ?? z.format_i, qoraGramm(z, s), listSoni(z));
}

/** Excel M ustuni: rulondan nechta list chiqadi. */
export function rulonList(z: Pick<Zakaz, "rulon_kg" | "format_h" | "format_i" | "gramm">): number {
  if (!z.rulon_kg || !z.format_h || !z.format_i || !z.gramm) return 0;
  return Math.floor((z.rulon_kg * 1e7) / (z.gramm * z.format_i * z.format_h));
}

/** Murod rulon ortig'ini saqlamaydi: rulondan qancha list chiqsa shuncha karobka qiladi.
 *  Shuning uchun "haqiqiy chiqadigan karobka" shu yerda hisoblanadi. */
export function haqiqiyDona(z: Zakaz): number {
  const l = rulonList(z);
  if (!l) return z.dona;
  return Math.floor(l * z.chiqish);
}

/** Excel P ustuni: 1 kg narx. */
export function kgNarx(z: Zakaz): number {
  const kg = ustkiKg(z);
  if (!kg || !z.qogoz_summa) return 0;
  return Math.round(z.qogoz_summa / kg);
}

export function srokSana(z: Pick<Zakaz, "berilgan" | "srok">, s: Sozlamalar): string {
  if (z.srok) return z.srok;
  const d = new Date(z.berilgan + "T00:00:00");
  d.setDate(d.getDate() + s.srok_kun);
  return d.toISOString().slice(0, 10);
}

/** Srok rangi: o'tgan yoki bugun = qizil, 3 kun ichida = sariq, boshqa = oddiy.
 *  Bitgan/otmen zakazda rang yo'q, chunki muddat endi ahamiyatsiz. */
export function srokHolati(z: Zakaz, s: Sozlamalar, bugun = new Date()): "qizil" | "sariq" | "ok" | "yopiq" {
  if (z.holat !== "jarayonda") return "yopiq";
  const srok = new Date(srokSana(z, s) + "T00:00:00");
  const b = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  const diff = Math.round((srok.getTime() - b.getTime()) / 86400000);
  if (diff <= 0) return "qizil";
  if (diff <= 3) return "sariq";
  return "ok";
}

/** Qaysi bosqichlar hali ochiq: AI ogohlantirishi va filtrlar uchun. */
export function ochiqBosqichlar(z: Zakaz): string[] {
  const r: string[] = [];
  if (!z.fayl_tayyor) r.push("fayl");
  if (!z.ctp_tayyor) r.push("CTP");
  if (!z.noj_tayyor) r.push("noj");
  if (z.qogoz_holat !== "olindi") r.push("qogoz");
  if (!z.pechat_tayyor) r.push("pechat");
  if (z.laminatsiya_kerak && !z.laminatsiya_tayyor) r.push("laminatsiya");
  if (z.lak_kerak && !z.lak_tayyor) r.push(z.lak_turi || "lak");
  return r;
}

export function boshZakaz(id: number, s: Sozlamalar): Zakaz {
  return {
    id,
    berilgan: new Date().toISOString().slice(0, 10),
    srok: null,
    mijoz: "",
    dona: 0,
    chiqish: 1,
    fayl_nomi: "",
    format_h: null,
    format_i: null,
    gramm: null,
    zapas: s.zapas_default,
    list_soni: null,
    rulon_kg: null,
    qogoz_summa: null,
    laminatsiya_kerak: false,
    laminatsiya_tayyor: false,
    laminatsiya_summa: null,
    lak_kerak: false,
    lak_turi: "",
    lak_tayyor: false,
    lak_summa: null,
    fayl_tayyor: false,
    ctp_tayyor: false,
    noj_tayyor: false,
    pechat_firma: "",
    pechat_tayyor: false,
    qogoz_firma: "",
    qogoz_holat: "yoq",
    qora_turi: "micro",
    qora_gramm: null,
    qora_h: null,
    qora_i: null,
    holat: "jarayonda",
    izoh: "",
  };
}

export function fmtSon(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return n.toLocaleString("ru-RU").replace(/,/g, ".");
}
