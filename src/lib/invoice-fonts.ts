export type InvoiceFontKey =
  | "serif"
  | "sans"
  | "modern"
  | "hind"
  | "tiro"
  | "baloo"
  | "galada"
  | "atma"
  | "mina"
  | "anek";

export type InvoiceFontWeight = 400 | 500 | 600 | 700 | 800 | 900;

export const INVOICE_FONT_FAMILIES: {
  value: InvoiceFontKey;
  label: { bn: string; en: string };
  css: string;
}[] = [
  { value: "serif",  label: { bn: "সেরিফ",       en: "Serif" },        css: "'Playfair Display','Noto Serif Bengali',Georgia,serif" },
  { value: "sans",   label: { bn: "স্যান্স",      en: "Sans" },         css: "'Plus Jakarta Sans','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "modern", label: { bn: "মডার্ন",      en: "Modern" },       css: "'Space Grotesk','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "hind",   label: { bn: "হিন্দ",        en: "Hind" },         css: "'Hind Siliguri','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "tiro",   label: { bn: "তিরো বাংলা",  en: "Tiro Bangla" },  css: "'Tiro Bangla','Noto Serif Bengali',Georgia,serif" },
  { value: "baloo",  label: { bn: "বালু",         en: "Baloo" },        css: "'Baloo Da 2','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "galada", label: { bn: "গলাদা",       en: "Galada" },       css: "'Galada','Noto Serif Bengali',cursive" },
  { value: "atma",   label: { bn: "আত্মা",        en: "Atma" },         css: "'Atma','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "mina",   label: { bn: "মিনা",         en: "Mina" },         css: "'Mina','Noto Sans Bengali',system-ui,sans-serif" },
  { value: "anek",   label: { bn: "অনেক বাংলা", en: "Anek Bangla" },  css: "'Anek Bangla','Noto Sans Bengali',system-ui,sans-serif" },
];

export const INVOICE_FONT_WEIGHTS: { value: InvoiceFontWeight; label: { bn: string; en: string } }[] = [
  { value: 400, label: { bn: "নরমাল",       en: "Regular" } },
  { value: 500, label: { bn: "মিডিয়াম",    en: "Medium" } },
  { value: 600, label: { bn: "সেমি বোল্ড", en: "Semibold" } },
  { value: 700, label: { bn: "বোল্ড",        en: "Bold" } },
  { value: 800, label: { bn: "এক্সট্রা বোল্ড", en: "ExtraBold" } },
  { value: 900, label: { bn: "ব্ল্যাক",      en: "Black" } },
];

export function getInvoiceFontCss(key: string | undefined): string {
  return (INVOICE_FONT_FAMILIES.find((f) => f.value === key)?.css) ?? INVOICE_FONT_FAMILIES[0].css;
}
