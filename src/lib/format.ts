export const fmtMoney = (n: number | string | null | undefined, currency = "৳") => {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return `${currency} ${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtDate = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const fmtDateTime = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
