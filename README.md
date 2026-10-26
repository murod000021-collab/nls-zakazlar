# NLS Zakazlar

Excel "zakazlar" jadvali o'rniga: Next.js 15 + Supabase (DastuR-NLS loyihasi, `zk_` jadvallar) + OpenAI yordamchi.

## Ishga tushirish
1. `supabase/001_zk_init.sql` ni Supabase SQL Editor da ishga tushiring (agar MCP orqali allaqachon qo'llanmagan bo'lsa).
2. Supabase > Authentication > Users da o'zingiz va menedjerlar uchun email + parol yarating.
3. `.env.local` ga `OPENAI_API_KEY` yozing.
4. Eski Excel import: `SUPABASE_SERVICE_KEY=... python scripts/import_excel.py zakazlar.xlsx`
5. `npm install && npm run dev` yoki Vercel ga deploy (env o'zgaruvchilarni Vercel ga ham qo'shing).

## Testlar
`npm test` (hisoblar Excel qatorlari bilan solishtiriladi)
