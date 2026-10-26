import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
// O'zbek matnida apostrof (yo'q, qo'shish) ko'p, uni &apos; qilib yozish o'qishni buzadi.
export default [...compat.extends("next/core-web-vitals", "next/typescript"), { rules: { "react/no-unescaped-entities": "off" } }];
