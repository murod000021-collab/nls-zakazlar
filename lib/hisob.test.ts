// Testlar Exceldagi haqiqiy qatorlar asosida: natija Excel bilan bir xil bo'lishi shart.
// Ishga tushirish: npm test
import { listSoni, qogozKg, rulonList, haqiqiyDona, kgNarx, srokHolati, boshZakaz, SOZLAMA_DEFAULT, qoraKg } from "./hisob";

let otdi = 0, yiqildi = 0;
function tekshir(nom: string, kutilgan: unknown, haqiqiy: unknown) {
  const ok = JSON.stringify(kutilgan) === JSON.stringify(haqiqiy);
  if (ok) otdi++; else yiqildi++;
  console.log(`${ok ? "✅" : "❌"} ${nom}` + (ok ? "" : `   kutilgan=${JSON.stringify(kutilgan)} keldi=${JSON.stringify(haqiqiy)}`));
}

const s = SOZLAMA_DEFAULT;

// Excel 853-qator: Gafurov, 5000 dona, 1 chiqadi, 102x71, 140 gr, K=5100, O=6940080
const g = { ...boshZakaz(1302, s), dona: 5000, chiqish: 1, format_h: 102, format_i: 71, gramm: 140, zapas: 100, qogoz_summa: 6940080 };
tekshir("List soni: 5000/1 + 100 zapas = 5100", 5100, listSoni(g));
tekshir("Ustki qogoz kg: 102*71*140*5100/10^7 = 517.1", 517.1, qogozKg(102, 71, 140, 5100));
tekshir("1 kg narx: 6940080 / 517.1 = 13421", 13421, kgNarx(g));
tekshir("Qora qogoz micro 310 gr kg", qogozKg(102, 71, 310, 5100), qoraKg(g, s));

// Excel 8-qator: 10000 dona, 2 chiqadi, K=5000 (zapas 0)
tekshir("List soni: 10000/2, zapas 0 = 5000", 5000, listSoni({ dona: 10000, chiqish: 2, zapas: 0, list_soni: null }));
tekshir("List soni: 3000/0.5 = 6000", 6000, listSoni({ dona: 3000, chiqish: 0.5, zapas: 0, list_soni: null }));
tekshir("Qo'lda yozilgan list soni ustun turadi", 12200, listSoni({ dona: 12000, chiqish: 1, zapas: 100, list_soni: 12200 }));

// Excel M ustuni: rulon 426 kg, 60x100, 145 gr
tekshir("Rulondan list: 426kg 60x100 145gr = 4896", 4896, rulonList({ rulon_kg: 426, format_h: 60, format_i: 100, gramm: 145 }));
tekshir("Rulon ko'p chiqsa karobka ham ko'p", 4896, haqiqiyDona({ ...g, dona: 5000, format_h: 60, format_i: 100, gramm: 145, rulon_kg: 426 }));
tekshir("Rulon yozilmasa dona o'zgarmaydi", 5000, haqiqiyDona(g));

// Srok ranglari
const bugun = new Date(2026, 9, 24);
tekshir("Srok o'tgan = qizil", "qizil", srokHolati({ ...g, berilgan: "2026-10-01" }, s, bugun));
tekshir("Srok 2 kun qolgan = sariq", "sariq", srokHolati({ ...g, berilgan: "2026-10-16" }, s, bugun));
tekshir("Srok 10 kun = ok", "ok", srokHolati({ ...g, berilgan: "2026-10-24" }, s, bugun));
tekshir("Bitgan zakazda rang yo'q", "yopiq", srokHolati({ ...g, berilgan: "2026-10-01", holat: "bitdi" }, s, bugun));
tekshir("Qo'lda srok yozilsa shu olinadi", "qizil", srokHolati({ ...g, berilgan: "2026-10-24", srok: "2026-10-20" }, s, bugun));

console.log(`\nJami: ${otdi} ✅  ${yiqildi} ❌`);
if (yiqildi) process.exit(1);
