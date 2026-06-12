const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBnDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export const fmtMoney = (
  n: number | string | null | undefined,
  lang: "en" | "bn" = "en",
  currency?: string,
) => {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  const sym = currency ?? "৳";
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const num = (v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${num}`;
};

export const fmtDate = (d: string | Date, lang: "en" | "bn" = "en") => {
  const dt = typeof d === "string" ? new Date(d) : d;
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  return dt.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
};

export const fmtDateTime = (d: string | Date, lang: "en" | "bn" = "en") => {
  const dt = typeof d === "string" ? new Date(d) : d;
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  return dt.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtNum = (n: number | string | null | undefined, lang: "en" | "bn" = "en") => {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  const s = String(v ?? 0);
  return lang === "bn" ? toBnDigits(s) : s;
};
