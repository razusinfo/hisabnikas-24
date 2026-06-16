import { fmtMoney, fmtInvoiceDate } from "@/lib/format";
import { getInvoiceFontCss } from "@/lib/invoice-fonts";

export type PrintInvoiceItem = {
  name: string;
  qty: number | string;
  price: number | string;
  total: number | string;
};

export type PrintInvoiceLabels = {
  invoice: string;
  customer: string; // or "Supplier"
  phone: string;
  method: string;
  item: string;
  price: string; // or "Unit Cost"
  qty: string;
  total: string;
  subtotal: string;
  paid: string;
  due: string;
  note: string;
  statusPaid: string;
  statusDue: string;
  statusPartial: string;
  bankDetails?: string;
  paymentInstructions?: string;
  terms?: string;
  notes?: string;
};

export type PrintInvoiceOptions = {
  doc: {
    invoice_no: string;
    created_at: string;
    partyName: string;
    partyPhone?: string;
    method?: string;
    note?: string;
    subtotal: number | string;
    total: number | string;
    paid: number | string;
    due: number | string;
    items: PrintInvoiceItem[];
  };
  business: { name: string; owner?: string; logoUrl?: string | null };
  settings: any;
  lang: string;
  labels: PrintInvoiceLabels;
  hideMethod?: boolean;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

export function printStyledInvoice({ doc, business, settings, lang, labels, hideMethod }: PrintInvoiceOptions) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  const inv = (settings ?? {}) as any;
  const theme: string = inv.invoiceTheme || "#0f172a";
  const fontSizeKey: "sm" | "md" | "lg" | "xl" = inv.invoiceFontSize || "md";
  const template: number = Number(inv.invoiceTemplate) || 1;
  const fontFamilyCss = getInvoiceFontCss(inv.invoiceFontFamily || "serif");
  const fontWeight: number = Number(inv.invoiceFontWeight) || 700;
  const baseFs = { sm: 17, md: 20, lg: 23, xl: 26 }[fontSizeKey];

  const headerStyles: Record<number, string> = {
    1: `padding-bottom:18px;border-bottom:3px solid ${theme}`,
    2: `background:${theme};color:#fff;padding:16px;border-radius:8px`,
    3: `border-top:5px solid ${theme};padding-top:14px`,
    4: `background:${theme}1f;padding:16px;border-left:5px solid ${theme}`,
    5: `border-bottom:3px dashed ${theme};padding-bottom:14px`,
    6: `background:${theme};color:#fff;padding:16px;clip-path:polygon(0 0,100% 0,100% 85%,0 100%)`,
    7: `padding:12px;border:3px solid ${theme}`,
    8: `background:linear-gradient(135deg,${theme},${theme}aa);color:#fff;padding:16px;border-radius:8px`,
    9: `border-bottom:4px double ${theme};padding-bottom:12px`,
  };
  const topStyle = headerStyles[template] || headerStyles[1];
  const invertHeader = [2, 6, 8].includes(template);
  const titleClr = invertHeader ? "#fff" : theme;
  const subClr = invertHeader ? "rgba(255,255,255,0.85)" : "#64748b";

  const rows = doc.items
    .map(
      (l, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${esc(l.name)}</td>
      <td class="right">${typeof l.price === "number" ? fmtMoney(l.price, lang) : esc(l.price)}</td>
      <td class="num">${lang === "bn" && typeof l.qty === "number" ? Number(l.qty).toLocaleString("bn-BD") : esc(l.qty)}</td>
      <td class="right">${typeof l.total === "number" ? fmtMoney(l.total, lang) : esc(l.total)}</td>
    </tr>`,
    )
    .join("");

  const dueNum = Number(doc.due) || 0;
  const paidNum = Number(doc.paid) || 0;
  const dueBadge =
    dueNum > 0
      ? `<span class="badge badge-due">${esc(paidNum > 0 ? labels.statusPartial : labels.statusDue)}</span>`
      : `<span class="badge badge-paid">${esc(labels.statusPaid)}</span>`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.invoice_no)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800;900&family=Noto+Serif+Bengali:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=Tiro+Bangla&family=Baloo+Da+2:wght@400;500;600;700;800&family=Galada&family=Atma:wght@400;500;600;700&family=Mina:wght@400;700&family=Anek+Bangla:wght@400;500;600;700;800&display=swap">
    <style>
      @page{size:8in 6in landscape;margin:0.12in}
      *{box-sizing:border-box}
      html,body{width:8in}
      body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#0f172a;margin:0;padding:0.12in;background:#fff;font-size:${baseFs}px}
      .sheet{width:100%;max-width:7.76in;margin:0 auto}
      .top{display:flex;justify-content:space-between;align-items:flex-start;gap:28px;${topStyle}}
      .brand{display:flex;gap:18px;align-items:center}
      .brand img{height:76px;width:76px;object-fit:contain;border-radius:10px;border:1px solid #e2e8f0;background:#fff}
      .brand .biz{font-size:${baseFs + 9}px;font-weight:${fontWeight};letter-spacing:-0.01em;font-family:${fontFamilyCss};color:${titleClr}}
      .brand .owner{font-size:${baseFs - 2}px;color:${subClr};margin-top:2px}
      .meta{text-align:right}
      .meta .no{font-family:ui-monospace,Menlo,monospace;font-size:${baseFs}px;color:${invertHeader ? "#fff" : "#334155"};margin-top:4px}
      .meta .date{font-size:${baseFs - 2}px;color:${subClr};margin-top:2px}
      .row{display:flex;justify-content:space-between;gap:22px;margin-top:18px}
      .card{flex:1;background:${theme}0d;border:1px solid ${theme}33;border-radius:10px;padding:10px 18px}
      .card .lbl{font-size:${baseFs - 4}px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
      .card .val{font-size:${baseFs + 2}px;font-weight:600}
      table.items{width:100%;border-collapse:collapse;margin-top:18px;font-size:${baseFs}px}
      table.items thead th{background:${theme};color:#fff;text-align:left;padding:6px 12px;font-weight:600;font-size:${baseFs - 2}px;letter-spacing:0.05em;text-transform:uppercase}
      table.items thead th.right{text-align:right}
      table.items tbody td{padding:5px 12px;border-bottom:1px solid #e2e8f0}
      table.items tbody tr:nth-child(even) td{background:${theme}0a}
      .right{text-align:right}.num{font-family:ui-monospace,Menlo,monospace}
      .totals{margin-top:14px;margin-left:auto;width:420px;font-size:${baseFs}px}
      .totals .line{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #e2e8f0}
      .totals .line.grand{border-top:3px solid ${theme};border-bottom:3px solid ${theme};margin-top:4px;padding:8px 0;font-size:${baseFs + 3}px;font-weight:700;color:${theme}}
      .totals .line.paid{color:#16a34a}
      .badge{display:inline-block;padding:3px 14px;border-radius:999px;font-size:${baseFs - 2}px;font-weight:600;letter-spacing:0.04em}
      .badge-paid{background:#dcfce7;color:#15803d}
      .badge-due{background:#fee2e2;color:#b91c1c}
      .footer{margin-top:22px;padding-top:14px;border-top:1px solid ${theme}55;font-size:${baseFs - 2}px;color:#475569;display:grid;gap:10px}
      .footer h4{margin:0 0 4px;font-size:${baseFs - 2}px;letter-spacing:0.06em;text-transform:uppercase;color:${theme}}
      .footer p{margin:0;white-space:pre-wrap;line-height:1.4}
      .thanks{margin-top:18px;text-align:center;font-size:${baseFs}px;color:${theme};font-weight:600}
      @media print{body{padding:0.1in}.sheet{max-width:none}}
    </style></head><body><div class="sheet">
    <div class="top">
      <div class="brand">
        ${business.logoUrl ? `<img src="${esc(business.logoUrl)}" alt="">` : ""}
        <div>
          <div class="biz">${esc(business.name || labels.invoice)}</div>
          ${business.owner ? `<div class="owner">${esc(business.owner)}</div>` : ""}
        </div>
      </div>
      <div class="meta">
        <div class="no">${esc(doc.invoice_no)}</div>
        <div class="date">${esc(fmtInvoiceDate(doc.created_at, lang))}</div>
        <div style="margin-top:10px">${dueBadge}</div>
      </div>
    </div>
    <div class="row">
      <div class="card">
        <div class="lbl">${esc(labels.customer)}</div>
        <div class="val">${esc(doc.partyName || "—")}</div>
      </div>
      <div class="card">
        <div class="lbl">${esc(labels.phone)}</div>
        <div class="val">${esc(doc.partyPhone || "—")}</div>
      </div>
      ${hideMethod ? "" : `<div class="card">
        <div class="lbl">${esc(labels.method)}</div>
        <div class="val">${esc(doc.method || "—")}</div>
      </div>`}
    </div>
    <table class="items">
      <thead><tr>
        <th style="width:58px">#</th>
        <th>${esc(labels.item)}</th>
        <th class="right" style="width:198px">${esc(labels.price)}</th>
        <th class="right" style="width:126px">${esc(labels.qty)}</th>
        <th class="right" style="width:234px">${esc(labels.total)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="line"><span>${esc(labels.subtotal)}</span><span class="num">${fmtMoney(doc.subtotal, lang)}</span></div>
      <div class="line grand"><span>${esc(labels.total)}</span><span class="num">${fmtMoney(doc.total, lang)}</span></div>
      <div class="line paid"><span>${esc(labels.paid)}</span><span class="num">${fmtMoney(doc.paid, lang)}</span></div>
      <div class="line due"><span>${esc(labels.due)}</span><span class="num">${fmtMoney(doc.due, lang)}</span></div>
    </div>
    ${doc.note ? `<div class="footer"><div><h4>${esc(labels.note)}</h4><p>${esc(doc.note)}</p></div></div>` : ""}
    <div class="footer">
      ${inv.bankDetails && labels.bankDetails ? `<div><h4>${esc(labels.bankDetails)}</h4><p>${esc(inv.bankDetails)}</p></div>` : ""}
      ${inv.paymentInstructions && labels.paymentInstructions ? `<div><h4>${esc(labels.paymentInstructions)}</h4><p>${esc(inv.paymentInstructions)}</p></div>` : ""}
      ${inv.terms && labels.terms ? `<div><h4>${esc(labels.terms)}</h4><p>${esc(inv.terms)}</p></div>` : ""}
      ${inv.notes && labels.notes ? `<div><h4>${esc(labels.notes)}</h4><p>${esc(inv.notes)}</p></div>` : ""}
    </div>
    ${inv.footer ? `<div class="thanks">${esc(inv.footer)}</div>` : ""}
    </div><script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
  w.document.close();
}
