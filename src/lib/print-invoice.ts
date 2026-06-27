import { fmtMoney, fmtInvoiceDate } from "@/lib/format";
import { getInvoiceFontCss } from "@/lib/invoice-fonts";

export type PrintInvoiceItem = {
  name: string;
  qty: number | string;
  price: number | string;
  total: number | string;
  warranty?: string | null;
  serial_no?: string | null;
};

export type PrintInvoiceLabels = {
  invoice: string;
  date: string;
  customer: string;
  phone: string;
  method: string;
  item: string;
  price: string;
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
  previousDue?: string;
  signature?: string;
  deliveryCharge?: string;
  tax?: string;
  discount?: string;
  warranty?: string;
  serialNo?: string;
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
    previousDue?: number | string;
    discount?: number | string;
    tax?: number | string;
    deliveryCharge?: number | string;
  };
  business: { name: string; owner?: string; address?: string; phone?: string | null; email?: string | null; logoUrl?: string | null };
  settings: any;
  lang: "bn" | "en";
  labels: PrintInvoiceLabels;
  hideMethod?: boolean;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

export function buildInvoiceHtml({ doc, business, settings, lang, labels, hideMethod }: PrintInvoiceOptions): string {
  const inv = (settings ?? {}) as any;

  const theme: string = inv.invoiceTheme || "#0f172a";
  const fontSizeKey: "sm" | "md" | "lg" | "xl" = inv.invoiceFontSize || "md";
  const template: number = Number(inv.invoiceTemplate) || 1;
  const fontFamilyCss = getInvoiceFontCss(inv.invoiceFontFamily || "serif");
  const fontWeight: number = Number(inv.invoiceFontWeight) || 700;
  const baseFs = { sm: 17, md: 20, lg: 23, xl: 26 }[fontSizeKey];

  // Toggles — default to ON unless explicitly false
  const on = (k: string, def = true) => (inv[k] === undefined ? def : !!inv[k]);
  const showHeading = on("showHeading");
  const showCompanyName = on("showCompanyName");
  const showCompanyLogo = on("showCompanyLogo");
  const showExportDate = on("showExportDate");
  const showBusinessInfo = on("showBusinessInfo");
  const showInvoiceNumber = on("showInvoiceNumber");
  const showPreviousDue = on("showPreviousDue", false);
  const showFooter = on("showFooter");
  const showSignature = on("showSignature");
  const showInvoiceTerms = on("showInvoiceTerms");
  const showInvoiceDescription = on("showInvoiceDescription");
  const thermal = !!inv.useThermalPrinter;

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
  const topStyle = thermal ? "padding-bottom:6px;border-bottom:2px solid #000" : (headerStyles[template] || headerStyles[1]);
  const invertHeader = !thermal && [2, 6, 8].includes(template);
  const titleClr = invertHeader ? "#fff" : (thermal ? "#000" : theme);
  const subClr = invertHeader ? "rgba(255,255,255,0.85)" : "#64748b";

  const warrantyLabel = labels.warranty || (lang === "bn" ? "ওয়ারেন্টি" : "Warranty");
  const serialLabel = labels.serialNo || (lang === "bn" ? "সিরিয়াল/IMEI" : "Serial/IMEI");
  const naLabel = lang === "bn" ? "নেই" : "N/A";
  const hasAnyMeta = doc.items.some((l) => (l.warranty && String(l.warranty).trim()) || (l.serial_no && String(l.serial_no).trim()));
  const rows = doc.items
    .map(
      (l, i) => {
        const w = l.warranty && String(l.warranty).trim() ? esc(l.warranty) : `<span style="color:#94a3b8">${esc(naLabel)}</span>`;
        const s = l.serial_no && String(l.serial_no).trim() ? esc(l.serial_no) : `<span style="color:#94a3b8">${esc(naLabel)}</span>`;
        const metaLine = hasAnyMeta
          ? `<div style="font-size:${thermal ? 9 : baseFs - 5}px;color:#475569;margin-top:2px;line-height:1.3"><b>${esc(warrantyLabel)}:</b> ${w} &nbsp;·&nbsp; <b>${esc(serialLabel)}:</b> ${s}</div>`
          : "";
        return `<tr>
      <td class="num">${i + 1}</td>
      <td>${esc(l.name)}${metaLine}</td>
      <td class="right">${typeof l.price === "number" ? fmtMoney(l.price, lang) : esc(l.price)}</td>
      <td class="right num">${lang === "bn" && typeof l.qty === "number" ? Number(l.qty).toLocaleString("bn-BD") : esc(l.qty)}</td>
      <td class="right">${typeof l.total === "number" ? fmtMoney(l.total, lang) : esc(l.total)}</td>
    </tr>`;
      },
    )
    .join("");

  const dueNum = Number(doc.due) || 0;
  const paidNum = Number(doc.paid) || 0;
  const dueBadge =
    dueNum > 0
      ? `<span class="badge badge-due">${esc(paidNum > 0 ? labels.statusPartial : labels.statusDue)}</span>`
      : `<span class="badge badge-paid">${esc(labels.statusPaid)}</span>`;

  const discountNum = Number(doc.discount) || 0;
  const taxNum = Number(doc.tax) || 0;
  const deliveryNum = Number(doc.deliveryCharge) || 0;
  const prevDueNum = Number(doc.previousDue) || 0;

  // Page styles vary for thermal
  const pageStyle = thermal
    ? `@page{size:80mm auto;margin:2mm}html,body{width:76mm}body{font-family:${fontFamilyCss};color:#000;margin:0;padding:2mm;background:#fff;font-size:12px}.sheet{width:100%}`
    : `@page{size:8in 6in landscape;margin:0.12in}html,body{width:8in}body{font-family:${fontFamilyCss};color:#0f172a;margin:0;padding:0.12in;background:#fff;font-size:${baseFs}px;font-weight:${Math.max(400, fontWeight - 200)}}.sheet{width:100%;max-width:7.76in;margin:0 auto}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.invoice_no)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800;900&family=Noto+Serif+Bengali:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=Tiro+Bangla&family=Baloo+Da+2:wght@400;500;600;700;800&family=Galada&family=Atma:wght@400;500;600;700&family=Mina:wght@400;700&family=Anek+Bangla:wght@400;500;600;700;800&display=swap">
    <style>
      *{box-sizing:border-box}
      ${pageStyle}
      .top{display:flex;justify-content:center;align-items:center;gap:${thermal ? 8 : 28}px;position:relative;${topStyle}}
      .brand{display:flex;gap:${thermal ? 8 : 18}px;align-items:center;flex-direction:column;text-align:center}
      .logo-left{position:absolute;left:0;top:0}
      .logo-left img{height:${thermal ? 40 : 76}px;width:${thermal ? 40 : 76}px;object-fit:contain;border-radius:${thermal ? 4 : 10}px;${thermal ? "" : "border:1px solid #e2e8f0;"}background:#fff}
      .brand .biz{font-size:${thermal ? 16 : baseFs + 9}px;font-weight:${fontWeight};letter-spacing:-0.01em;font-family:${fontFamilyCss};color:${titleClr}}
      .brand .owner{font-size:${thermal ? 11 : baseFs - 2}px;color:${subClr};margin-top:2px}
      .brand .addr{font-size:${thermal ? 10 : baseFs - 4}px;color:${subClr};margin-top:2px;text-align:center;max-width:${thermal ? "70mm" : "420px"};line-height:1.3}
      .meta{position:absolute;right:0;top:0;text-align:right}

      .meta .no{font-family:ui-monospace,Menlo,monospace;font-size:${thermal ? 11 : baseFs}px;color:${invertHeader ? "#fff" : (thermal ? "#000" : "#334155")};margin-top:4px}
      .meta .date{font-size:${thermal ? 10 : baseFs - 2}px;color:${subClr};margin-top:2px}
      .info-row{display:flex;justify-content:space-between;align-items:center;margin-top:${thermal ? 6 : 14}px;font-size:${thermal ? 11 : baseFs}px;color:${thermal ? "#000" : "#334155"}}
      .row{display:${thermal ? "block" : "flex"};justify-content:space-between;gap:22px;margin-top:${thermal ? 6 : 18}px}
      .card{flex:1;background:${thermal ? "transparent" : `${theme}0d`};border:${thermal ? "none" : `1px solid ${theme}33`};border-radius:10px;padding:${thermal ? "2px 0" : "10px 18px"}}
      .info-line{display:flex;align-items:center;gap:${thermal ? "8px" : "14px"};margin-top:${thermal ? "6px" : "14px"};padding:${thermal ? "2px 0" : "10px 14px"};background:${thermal ? "transparent" : `${theme}0d`};border:${thermal ? "none" : `1px solid ${theme}33`};border-radius:8px;font-size:${thermal ? 10 : baseFs - 3}px;color:${thermal ? "#000" : "#334155"};flex-wrap:wrap}
      .info-line .sep{color:${thermal ? "#666" : "#94a3b8"};font-weight:300}
      .info-line .itm{display:flex;align-items:center;gap:${thermal ? "3px" : "4px"}}
      .info-line .itm b{font-weight:600;color:${thermal ? "#000" : "#0f172a"}}
      table.items{width:100%;border-collapse:collapse;margin-top:${thermal ? 8 : 18}px;font-size:${thermal ? 11 : baseFs}px}
      table.items thead th{background:${thermal ? "transparent" : theme};color:${thermal ? "#000" : "#fff"};text-align:left;padding:${thermal ? "3px 4px" : "6px 12px"};font-weight:600;font-size:${thermal ? 10 : baseFs - 2}px;letter-spacing:0.05em;text-transform:uppercase;border-bottom:${thermal ? "1px solid #000" : "none"}}
      table.items thead th.right{text-align:right}
      table.items tbody td{padding:${thermal ? "3px 4px" : "5px 12px"};border-bottom:${thermal ? "1px dashed #999" : "1px solid #e2e8f0"}}
      ${thermal ? "" : `table.items tbody tr:nth-child(even) td{background:${theme}0a}`}
      .right{text-align:right}.num{font-family:ui-monospace,Menlo,monospace}
      .totals{margin-top:${thermal ? 6 : 14}px;margin-left:auto;width:${thermal ? "100%" : "420px"};font-size:${thermal ? 11 : baseFs}px}
      .totals .line{display:flex;justify-content:space-between;padding:${thermal ? "2px 0" : "4px 0"};border-bottom:1px dashed ${thermal ? "#999" : "#e2e8f0"}}
      .totals .line.grand{border-top:${thermal ? "1px solid #000" : `3px solid ${theme}`};border-bottom:${thermal ? "1px solid #000" : `3px solid ${theme}`};margin-top:4px;padding:${thermal ? "4px 0" : "8px 0"};font-size:${thermal ? 13 : baseFs + 3}px;font-weight:700;color:${thermal ? "#000" : theme}}
      .totals .line.paid{color:${thermal ? "#000" : "#16a34a"}}
      .badge{display:inline-block;padding:${thermal ? "1px 6px" : "3px 14px"};border-radius:999px;font-size:${thermal ? 10 : baseFs - 2}px;font-weight:600;letter-spacing:0.04em;border:${thermal ? "1px solid #000" : "none"}}
      .badge-paid{background:${thermal ? "#fff" : "#dcfce7"};color:${thermal ? "#000" : "#15803d"}}
      .badge-due{background:${thermal ? "#fff" : "#fee2e2"};color:${thermal ? "#000" : "#b91c1c"}}
      .footer{margin-top:${thermal ? 8 : 22}px;padding-top:${thermal ? 6 : 14}px;border-top:1px solid ${thermal ? "#000" : `${theme}55`};font-size:${thermal ? 10 : baseFs - 2}px;color:${thermal ? "#000" : "#475569"};display:grid;gap:${thermal ? 4 : 10}px}
      .footer h4{margin:0 0 2px;font-size:${thermal ? 10 : baseFs - 2}px;letter-spacing:0.06em;text-transform:uppercase;color:${thermal ? "#000" : theme}}
      .footer p{margin:0;white-space:pre-wrap;line-height:1.4}
      .thanks{margin-top:${thermal ? 8 : 18}px;text-align:center;font-size:${thermal ? 12 : baseFs}px;color:${thermal ? "#000" : theme};font-weight:600}
      .signature{margin-top:${thermal ? 18 : 40}px;display:flex;justify-content:space-between;gap:30px;font-size:${thermal ? 10 : baseFs - 2}px}
      .signature .sig{flex:1;border-top:1px solid #000;padding-top:4px;text-align:center;color:#475569}
      @media print{body{padding:${thermal ? "1mm" : "0.1in"}}.sheet{max-width:none}}
    </style></head><body><div class="sheet">
    <div class="top">
      ${showCompanyLogo && business.logoUrl ? `<div class="logo-left"><img src="${esc(business.logoUrl)}" alt=""></div>` : ""}
      <div class="brand">
        <div>
          ${showHeading && showCompanyName ? `<div class="biz">${esc(business.name || labels.invoice)}</div>` : ""}
          ${showBusinessInfo && business.owner ? `<div class="owner">${lang === "bn" ? "প্রোঃ" : "Prop:"} ${esc(business.owner)}</div>` : ""}
          ${business.address ? `<div class="addr">${esc(business.address)}</div>` : ""}
          ${business.phone || business.email ? `<div class="addr" style="margin-top:2px;font-size:${baseFs - 2}px">${business.phone ? `${lang === "bn" ? "মোবাইল" : "Phone"}: ${esc(business.phone)}` : ""}${business.phone && business.email ? " | " : ""}${business.email ? `Email: ${esc(business.email)}` : ""}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="info-row">
      ${showInvoiceNumber ? `<span><b>${esc(labels.invoice)} ${lang === "bn" ? "নং" : "No"}:</b> ${esc(doc.invoice_no)}</span>` : ""}
      ${showExportDate ? `<span><b>${esc(labels.date)}:</b> ${esc(fmtInvoiceDate(doc.created_at, lang))}</span>` : ""}
    </div>
    <div class="info-line">
      <span class="itm"><b>${esc(labels.customer)}</b> ${esc(doc.partyName || "—")}</span>
      <span class="sep">|</span>
      <span class="itm"><b>${esc(labels.phone)}</b> ${esc(doc.partyPhone || "—")}</span>
      ${hideMethod ? "" : `<span class="sep">|</span>
      <span class="itm"><b>${esc(labels.method)}</b> ${esc(doc.method || "—")}</span>`}
    </div>
    <table class="items">
      <thead><tr>
        <th style="width:${thermal ? 24 : 58}px">#</th>
        <th>${esc(labels.item)}</th>
        <th class="right" style="width:${thermal ? 60 : 198}px">${esc(labels.price)}</th>
        <th class="right" style="width:${thermal ? 40 : 126}px">${esc(labels.qty)}</th>
        <th class="right" style="width:${thermal ? 70 : 234}px">${esc(labels.total)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="line"><span>${esc(labels.subtotal)}</span><span class="num">${fmtMoney(doc.subtotal, lang)}</span></div>
      ${discountNum > 0 ? `<div class="line"><span>${esc(labels.discount || "Discount")}</span><span class="num">-${fmtMoney(discountNum, lang)}</span></div>` : ""}
      ${taxNum > 0 ? `<div class="line"><span>${esc(labels.tax || "Tax")}</span><span class="num">${fmtMoney(taxNum, lang)}</span></div>` : ""}
      ${deliveryNum > 0 ? `<div class="line"><span>${esc(labels.deliveryCharge || "Delivery")}</span><span class="num">${fmtMoney(deliveryNum, lang)}</span></div>` : ""}
      ${showPreviousDue && prevDueNum > 0 ? `<div class="line"><span>${esc(labels.previousDue || "Previous Due")}</span><span class="num">${fmtMoney(prevDueNum, lang)}</span></div>` : ""}
      <div class="line grand"><span>${esc(labels.total)}</span><span class="num">${fmtMoney(doc.total, lang)}</span></div>
      <div class="line paid"><span>${esc(labels.paid)}</span><span class="num">${fmtMoney(doc.paid, lang)}</span></div>
      <div class="line due"><span>${esc(labels.due)}</span><span class="num">${fmtMoney(doc.due, lang)}</span></div>
    </div>
    ${showInvoiceDescription && doc.note ? `<div class="footer"><div><h4>${esc(labels.note)}</h4><p>${esc(doc.note)}</p></div></div>` : ""}
    <div class="footer">
      ${inv.bankDetails && labels.bankDetails ? `<div><h4>${esc(labels.bankDetails)}</h4><p>${esc(inv.bankDetails)}</p></div>` : ""}
      ${inv.paymentInstructions && labels.paymentInstructions ? `<div><h4>${esc(labels.paymentInstructions)}</h4><p>${esc(inv.paymentInstructions)}</p></div>` : ""}
      ${showInvoiceTerms && inv.terms && labels.terms ? `<div><h4>${esc(labels.terms)}</h4><p>${esc(inv.terms)}</p></div>` : ""}
      ${showInvoiceDescription && inv.notes && labels.notes ? `<div><h4>${esc(labels.notes)}</h4><p>${esc(inv.notes)}</p></div>` : ""}
    </div>
    ${showSignature ? `<div class="signature">
      <div class="sig">${esc(labels.signature || "Customer Signature")}</div>
      <div class="sig">${esc(labels.signature ? "" : "Authorized Signature")}${labels.signature ? esc(business.owner || business.name || "Authorized Signature") : ""}</div>
    </div>` : ""}
    ${showFooter && inv.footer ? `<div class="thanks">${esc(inv.footer)}</div>` : ""}
    </div></body></html>`;
}

export function printStyledInvoice(opts: PrintInvoiceOptions) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  const html = buildInvoiceHtml(opts);
  w.document.write(html);
  w.document.write(`<script>window.onload=()=>setTimeout(()=>window.print(),200)</script>`);
  w.document.close();
}

