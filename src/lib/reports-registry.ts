import { supabase } from "@/integrations/supabase/client";

export type ColFormat = "currency" | "number" | "date" | "datetime" | "text";

export type ReportCol = {
  key: string;
  label: string;
  labelEn: string;
  align?: "left" | "right" | "center";
  format?: ColFormat;
};

export type ReportSummary = {
  label: string;
  labelEn: string;
  value: number;
  format?: "currency" | "number";
  tone?: "default" | "positive" | "negative";
};

export type ReportResult = {
  columns: ReportCol[];
  rows: Record<string, unknown>[];
  summary: ReportSummary[];
};

export type ReportLang = "bn" | "en";

export type ReportConfig = {
  slug: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  usesDateFilter: boolean;
  fetch: (ownerId: string, from: string, to: string, lang: ReportLang) => Promise<ReportResult>;
};

// from / to are YYYY-MM-DD inclusive. For created_at (timestamptz) we expand to end-of-day.
const startISO = (from: string) => `${from}T00:00:00.000Z`;
const endISO = (to: string) => `${to}T23:59:59.999Z`;

const num = (v: unknown) => Number(v ?? 0) || 0;

async function fetchPurchase(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, invoice_no, supplier_name, total, paid, due, payment_method, created_at")
    .eq("owner_id", ownerId)
    .gte("created_at", startISO(from))
    .lte("created_at", endISO(to))
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  let total = 0, paid = 0, due = 0;
  for (const r of rows) { total += num(r.total); paid += num(r.paid); due += num(r.due); }
  return {
    columns: [
      { key: "created_at", label: "তারিখ", labelEn: "Date", format: "date" },
      { key: "invoice_no", label: "ইনভয়েস", labelEn: "Invoice" },
      { key: "supplier_name", label: "সরবরাহকারী", labelEn: "Supplier" },
      { key: "total", label: "মোট", labelEn: "Total", format: "currency", align: "right" },
      { key: "paid", label: "পরিশোধ", labelEn: "Paid", format: "currency", align: "right" },
      { key: "due", label: "বাকি", labelEn: "Due", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট ক্রয়", labelEn: "Total Purchase", value: total, format: "currency" },
      { label: "পরিশোধ", labelEn: "Paid", value: paid, format: "currency", tone: "positive" },
      { label: "বাকি", labelEn: "Due", value: due, format: "currency", tone: "negative" },
      { label: "ইনভয়েস সংখ্যা", labelEn: "Invoices", value: rows.length, format: "number" },
    ],
  };
}

async function fetchSales(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, invoice_no, customer_id, total, paid, due, payment_method, created_at, customers(name)")
    .eq("owner_id", ownerId)
    .gte("created_at", startISO(from))
    .lte("created_at", endISO(to))
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    customer_name: r.customers?.name ?? "ওয়াক-ইন",
  }));
  let total = 0, paid = 0, due = 0;
  for (const r of rows) { total += num(r.total); paid += num(r.paid); due += num(r.due); }
  return {
    columns: [
      { key: "created_at", label: "তারিখ", labelEn: "Date", format: "date" },
      { key: "invoice_no", label: "ইনভয়েস", labelEn: "Invoice" },
      { key: "customer_name", label: "কাস্টমার", labelEn: "Customer" },
      { key: "total", label: "মোট", labelEn: "Total", format: "currency", align: "right" },
      { key: "paid", label: "পরিশোধ", labelEn: "Paid", format: "currency", align: "right" },
      { key: "due", label: "বাকি", labelEn: "Due", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট বিক্রয়", labelEn: "Total Sales", value: total, format: "currency", tone: "positive" },
      { label: "পরিশোধ", labelEn: "Paid", value: paid, format: "currency" },
      { label: "বাকি", labelEn: "Due", value: due, format: "currency", tone: "negative" },
      { label: "ইনভয়েস সংখ্যা", labelEn: "Invoices", value: rows.length, format: "number" },
    ],
  };
}

async function fetchProducts(ownerId: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, unit, cost_price, sell_price, stock, low_stock_threshold, is_active, categories(name)")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    category_name: r.categories?.name ?? "-",
    value: num(r.stock) * num(r.cost_price),
  }));
  let totalStock = 0, totalValue = 0;
  for (const r of rows) { totalStock += num(r.stock); totalValue += num((r as any).value); }
  return {
    columns: [
      { key: "name", label: "নাম", labelEn: "Name" },
      { key: "sku", label: "এসকেইউ", labelEn: "SKU" },
      { key: "category_name", label: "ক্যাটাগরি", labelEn: "Category" },
      { key: "unit", label: "একক", labelEn: "Unit" },
      { key: "stock", label: "স্টক", labelEn: "Stock", format: "number", align: "right" },
      { key: "cost_price", label: "ক্রয়মূল্য", labelEn: "Cost", format: "currency", align: "right" },
      { key: "sell_price", label: "বিক্রয়মূল্য", labelEn: "Sell", format: "currency", align: "right" },
      { key: "value", label: "মূল্যমান", labelEn: "Value", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট পণ্য", labelEn: "Total Products", value: rows.length, format: "number" },
      { label: "মোট স্টক", labelEn: "Total Stock", value: totalStock, format: "number" },
      { label: "মোট মূল্যমান", labelEn: "Total Value", value: totalValue, format: "currency" },
    ],
  };
}

async function fetchCustomers(ownerId: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, address, due_balance")
    .eq("owner_id", ownerId)
    .order("due_balance", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const totalDue = rows.reduce((s, r) => s + num(r.due_balance), 0);
  return {
    columns: [
      { key: "name", label: "নাম", labelEn: "Name" },
      { key: "phone", label: "ফোন", labelEn: "Phone" },
      { key: "address", label: "ঠিকানা", labelEn: "Address" },
      { key: "due_balance", label: "বাকি", labelEn: "Due", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট কাস্টমার", labelEn: "Total Customers", value: rows.length, format: "number" },
      { label: "মোট বাকি", labelEn: "Total Due", value: totalDue, format: "currency", tone: "negative" },
    ],
  };
}

async function fetchDues(ownerId: string): Promise<ReportResult> {
  const [cust, exp] = await Promise.all([
    supabase.from("customers").select("name, phone, due_balance").eq("owner_id", ownerId).gt("due_balance", 0),
    supabase.from("expenses").select("party_name, party_type, amount, paid_amount, due_date").eq("owner_id", ownerId),
  ]);
  if (cust.error) throw cust.error;
  if (exp.error) throw exp.error;
  const rows: any[] = [];
  for (const c of cust.data ?? []) {
    rows.push({ party: c.name, phone: c.phone ?? "-", type: "কাস্টমার", due: num(c.due_balance), due_date: null });
  }
  for (const e of exp.data ?? []) {
    const d = num(e.amount) - num(e.paid_amount);
    if (d > 0 && e.party_name) rows.push({ party: e.party_name, phone: "-", type: e.party_type ?? "সরবরাহকারী", due: d, due_date: e.due_date });
  }
  rows.sort((a, b) => b.due - a.due);
  const total = rows.reduce((s, r) => s + r.due, 0);
  return {
    columns: [
      { key: "party", label: "পক্ষ", labelEn: "Party" },
      { key: "type", label: "ধরন", labelEn: "Type" },
      { key: "phone", label: "ফোন", labelEn: "Phone" },
      { key: "due_date", label: "মেয়াদ", labelEn: "Due Date", format: "date" },
      { key: "due", label: "বাকি", labelEn: "Due", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট পক্ষ", labelEn: "Total Parties", value: rows.length, format: "number" },
      { label: "মোট বাকি", labelEn: "Total Due", value: total, format: "currency", tone: "negative" },
    ],
  };
}

async function fetchSalesProfit(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const { data: sales, error } = await supabase
    .from("sales")
    .select("id, invoice_no, total, created_at, sale_items(qty, line_total, unit_price, product_id)")
    .eq("owner_id", ownerId)
    .gte("created_at", startISO(from))
    .lte("created_at", endISO(to))
    .order("created_at", { ascending: false });
  if (error) throw error;
  const productIds = new Set<string>();
  for (const s of sales ?? []) for (const i of (s as any).sale_items ?? []) if (i.product_id) productIds.add(i.product_id);
  const idList = Array.from(productIds);
  const costMap = new Map<string, number>();
  if (idList.length) {
    const { data: prods } = await supabase.from("products").select("id, cost_price").in("id", idList);
    for (const p of prods ?? []) costMap.set(p.id as string, num(p.cost_price));
  }
  const rows = (sales ?? []).map((s: any) => {
    let revenue = 0, cost = 0;
    for (const i of s.sale_items ?? []) {
      revenue += num(i.line_total);
      cost += num(i.qty) * (i.product_id ? (costMap.get(i.product_id) ?? 0) : 0);
    }
    return {
      created_at: s.created_at,
      invoice_no: s.invoice_no,
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
  let r = 0, c = 0;
  for (const x of rows) { r += x.revenue; c += x.cost; }
  return {
    columns: [
      { key: "created_at", label: "তারিখ", labelEn: "Date", format: "date" },
      { key: "invoice_no", label: "ইনভয়েস", labelEn: "Invoice" },
      { key: "revenue", label: "বিক্রয়", labelEn: "Revenue", format: "currency", align: "right" },
      { key: "cost", label: "ক্রয়মূল্য", labelEn: "Cost", format: "currency", align: "right" },
      { key: "profit", label: "লাভ", labelEn: "Profit", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট বিক্রয়", labelEn: "Revenue", value: r, format: "currency" },
      { label: "মোট ক্রয়মূল্য", labelEn: "Cost", value: c, format: "currency" },
      { label: "মোট লাভ", labelEn: "Profit", value: r - c, format: "currency", tone: r - c >= 0 ? "positive" : "negative" },
    ],
  };
}

async function fetchProfitLoss(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const [salesRes, purchRes, expRes] = await Promise.all([
    supabase.from("sales").select("total").eq("owner_id", ownerId).gte("created_at", startISO(from)).lte("created_at", endISO(to)),
    supabase.from("purchases").select("total").eq("owner_id", ownerId).gte("created_at", startISO(from)).lte("created_at", endISO(to)),
    supabase.from("expenses").select("amount").eq("owner_id", ownerId).gte("expense_date", from).lte("expense_date", to),
  ]);
  if (salesRes.error) throw salesRes.error;
  if (purchRes.error) throw purchRes.error;
  if (expRes.error) throw expRes.error;
  const sales = (salesRes.data ?? []).reduce((s, r) => s + num(r.total), 0);
  const purch = (purchRes.data ?? []).reduce((s, r) => s + num(r.total), 0);
  const exp = (expRes.data ?? []).reduce((s, r) => s + num(r.amount), 0);
  const gross = sales - purch;
  const net = gross - exp;
  const rows = [
    { item: "মোট বিক্রয়", itemEn: "Total Sales", amount: sales },
    { item: "মোট ক্রয়", itemEn: "Total Purchase", amount: purch },
    { item: "গ্রস লাভ", itemEn: "Gross Profit", amount: gross },
    { item: "মোট খরচ", itemEn: "Total Expenses", amount: exp },
    { item: "নিট লাভ", itemEn: "Net Profit", amount: net },
  ];
  return {
    columns: [
      { key: "item", label: "বিবরণ", labelEn: "Description" },
      { key: "amount", label: "পরিমাণ", labelEn: "Amount", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "বিক্রয়", labelEn: "Sales", value: sales, format: "currency" },
      { label: "ক্রয়", labelEn: "Purchase", value: purch, format: "currency" },
      { label: "খরচ", labelEn: "Expenses", value: exp, format: "currency" },
      { label: "নিট লাভ", labelEn: "Net Profit", value: net, format: "currency", tone: net >= 0 ? "positive" : "negative" },
    ],
  };
}

async function fetchCashbookByMethods(ownerId: string, from: string, to: string, methods: string[]): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("cashbook")
    .select("entry_date, type, category, description, amount, method")
    .eq("owner_id", ownerId)
    .in("method", methods)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  let inAmt = 0, outAmt = 0;
  for (const r of rows) {
    if (r.type === "in") inAmt += num(r.amount); else outAmt += num(r.amount);
  }
  return {
    columns: [
      { key: "entry_date", label: "তারিখ", labelEn: "Date", format: "date" },
      { key: "method", label: "মাধ্যম", labelEn: "Method" },
      { key: "category", label: "ক্যাটাগরি", labelEn: "Category" },
      { key: "description", label: "বিবরণ", labelEn: "Description" },
      { key: "type", label: "ধরন", labelEn: "Type" },
      { key: "amount", label: "পরিমাণ", labelEn: "Amount", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "জমা", labelEn: "Cash In", value: inAmt, format: "currency", tone: "positive" },
      { label: "উত্তোলন", labelEn: "Cash Out", value: outAmt, format: "currency", tone: "negative" },
      { label: "নিট", labelEn: "Net", value: inAmt - outAmt, format: "currency" },
    ],
  };
}

const MOBILE_METHODS = ["bkash", "nagad", "rocket", "upay", "tap", "mobile_banking", "বিকাশ", "নগদ", "রকেট"];
const BANK_METHODS = ["bank", "bank_transfer", "cheque", "ব্যাংক"];

async function fetchExpenses(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("expenses")
    .select("expense_date, description, amount, paid_amount, method, party_name")
    .eq("owner_id", ownerId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({ ...r, due: num(r.amount) - num(r.paid_amount) }));
  let total = 0, paid = 0, due = 0;
  for (const r of rows) { total += num(r.amount); paid += num(r.paid_amount); due += (r as any).due; }
  return {
    columns: [
      { key: "expense_date", label: "তারিখ", labelEn: "Date", format: "date" },
      { key: "description", label: "বিবরণ", labelEn: "Description" },
      { key: "party_name", label: "পক্ষ", labelEn: "Party" },
      { key: "method", label: "মাধ্যম", labelEn: "Method" },
      { key: "amount", label: "পরিমাণ", labelEn: "Amount", format: "currency", align: "right" },
      { key: "paid_amount", label: "পরিশোধ", labelEn: "Paid", format: "currency", align: "right" },
      { key: "due", label: "বাকি", labelEn: "Due", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট খরচ", labelEn: "Total", value: total, format: "currency" },
      { label: "পরিশোধ", labelEn: "Paid", value: paid, format: "currency" },
      { label: "বাকি", labelEn: "Due", value: due, format: "currency", tone: "negative" },
    ],
  };
}

async function fetchExpensesGroup(ownerId: string, from: string, to: string, key: "method" | "category"): Promise<ReportResult> {
  if (key === "method") {
    const { data, error } = await supabase
      .from("expenses")
      .select("method, amount")
      .eq("owner_id", ownerId)
      .gte("expense_date", from)
      .lte("expense_date", to);
    if (error) throw error;
    const map = new Map<string, { count: number; total: number }>();
    for (const r of data ?? []) {
      const k = (r.method as string) || "অন্যান্য";
      const e = map.get(k) ?? { count: 0, total: 0 };
      e.count += 1; e.total += num(r.amount);
      map.set(k, e);
    }
    const rows = Array.from(map.entries()).map(([k, v]) => ({ method: k, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);
    const total = rows.reduce((s, r) => s + r.total, 0);
    return {
      columns: [
        { key: "method", label: "ধরন", labelEn: "Type" },
        { key: "count", label: "সংখ্যা", labelEn: "Count", format: "number", align: "right" },
        { key: "total", label: "মোট", labelEn: "Total", format: "currency", align: "right" },
      ],
      rows,
      summary: [
        { label: "ধরন সংখ্যা", labelEn: "Types", value: rows.length, format: "number" },
        { label: "মোট খরচ", labelEn: "Total Expense", value: total, format: "currency" },
      ],
    };
  }
  // category — use cashbook out entries grouped by category
  const { data, error } = await supabase
    .from("cashbook")
    .select("category, amount")
    .eq("owner_id", ownerId)
    .eq("type", "out")
    .gte("entry_date", from)
    .lte("entry_date", to);
  if (error) throw error;
  const map = new Map<string, { count: number; total: number }>();
  for (const r of data ?? []) {
    const k = (r.category as string) || "অন্যান্য";
    const e = map.get(k) ?? { count: 0, total: 0 };
    e.count += 1; e.total += num(r.amount);
    map.set(k, e);
  }
  const rows = Array.from(map.entries()).map(([k, v]) => ({ category: k, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return {
    columns: [
      { key: "category", label: "ক্যাটাগরি", labelEn: "Category" },
      { key: "count", label: "সংখ্যা", labelEn: "Count", format: "number", align: "right" },
      { key: "total", label: "মোট", labelEn: "Total", format: "currency", align: "right" },
    ],
    rows,
    summary: [
      { label: "ক্যাটাগরি সংখ্যা", labelEn: "Categories", value: rows.length, format: "number" },
      { label: "মোট খরচ", labelEn: "Total Expense", value: total, format: "currency" },
    ],
  };
}

async function fetchStockSummary(ownerId: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("name, unit, stock, cost_price, sell_price, low_stock_threshold")
    .eq("owner_id", ownerId)
    .order("stock", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    cost_value: num(r.stock) * num(r.cost_price),
    sell_value: num(r.stock) * num(r.sell_price),
    status: num(r.stock) <= 0 ? "স্টক নেই" : num(r.stock) <= num(r.low_stock_threshold) ? "কম স্টক" : "ঠিক আছে",
  }));
  const totalStock = rows.reduce((s, r) => s + num(r.stock), 0);
  const totalCost = rows.reduce((s, r) => s + (r as any).cost_value, 0);
  const totalSell = rows.reduce((s, r) => s + (r as any).sell_value, 0);
  return {
    columns: [
      { key: "name", label: "পণ্য", labelEn: "Product" },
      { key: "unit", label: "একক", labelEn: "Unit" },
      { key: "stock", label: "স্টক", labelEn: "Stock", format: "number", align: "right" },
      { key: "cost_value", label: "ক্রয় মূল্যমান", labelEn: "Cost Value", format: "currency", align: "right" },
      { key: "sell_value", label: "বিক্রয় মূল্যমান", labelEn: "Sell Value", format: "currency", align: "right" },
      { key: "status", label: "অবস্থা", labelEn: "Status" },
    ],
    rows,
    summary: [
      { label: "পণ্য সংখ্যা", labelEn: "Products", value: rows.length, format: "number" },
      { label: "মোট স্টক", labelEn: "Total Stock", value: totalStock, format: "number" },
      { label: "ক্রয় মূল্যমান", labelEn: "Cost Value", value: totalCost, format: "currency" },
      { label: "বিক্রয় মূল্যমান", labelEn: "Sell Value", value: totalSell, format: "currency" },
    ],
  };
}

async function fetchStockMovement(ownerId: string, from: string, to: string): Promise<ReportResult> {
  const [pi, si] = await Promise.all([
    supabase.from("purchase_items").select("product_id, product_name, qty, purchases!inner(created_at, owner_id)")
      .eq("owner_id", ownerId)
      .gte("purchases.created_at", startISO(from))
      .lte("purchases.created_at", endISO(to)),
    supabase.from("sale_items").select("product_id, product_name, qty, sales!inner(created_at, owner_id)")
      .eq("owner_id", ownerId)
      .gte("sales.created_at", startISO(from))
      .lte("sales.created_at", endISO(to)),
  ]);
  if (pi.error) throw pi.error;
  if (si.error) throw si.error;
  const map = new Map<string, { product: string; in_qty: number; out_qty: number }>();
  for (const r of pi.data ?? []) {
    const k = (r.product_id as string) || (r.product_name as string);
    const e = map.get(k) ?? { product: r.product_name as string, in_qty: 0, out_qty: 0 };
    e.in_qty += num(r.qty);
    map.set(k, e);
  }
  for (const r of si.data ?? []) {
    const k = (r.product_id as string) || (r.product_name as string);
    const e = map.get(k) ?? { product: r.product_name as string, in_qty: 0, out_qty: 0 };
    e.out_qty += num(r.qty);
    map.set(k, e);
  }
  const rows = Array.from(map.values()).map((v) => ({ ...v, net: v.in_qty - v.out_qty }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const totIn = rows.reduce((s, r) => s + r.in_qty, 0);
  const totOut = rows.reduce((s, r) => s + r.out_qty, 0);
  return {
    columns: [
      { key: "product", label: "পণ্য", labelEn: "Product" },
      { key: "in_qty", label: "ক্রয় (+)", labelEn: "In", format: "number", align: "right" },
      { key: "out_qty", label: "বিক্রয় (-)", labelEn: "Out", format: "number", align: "right" },
      { key: "net", label: "নিট পরিবর্তন", labelEn: "Net", format: "number", align: "right" },
    ],
    rows,
    summary: [
      { label: "মোট ক্রয়", labelEn: "Total In", value: totIn, format: "number", tone: "positive" },
      { label: "মোট বিক্রয়", labelEn: "Total Out", value: totOut, format: "number", tone: "negative" },
      { label: "নিট", labelEn: "Net", value: totIn - totOut, format: "number" },
    ],
  };
}

async function fetchItemDetail(ownerId: string): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("name, sku, barcode, unit, size, cost_price, sell_price, mrp, stock, expiry_date, batch_no, categories(name)")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({ ...r, category_name: r.categories?.name ?? "-" }));
  return {
    columns: [
      { key: "name", label: "নাম", labelEn: "Name" },
      { key: "sku", label: "এসকেইউ", labelEn: "SKU" },
      { key: "barcode", label: "বারকোড", labelEn: "Barcode" },
      { key: "category_name", label: "ক্যাটাগরি", labelEn: "Category" },
      { key: "unit", label: "একক", labelEn: "Unit" },
      { key: "size", label: "সাইজ", labelEn: "Size" },
      { key: "cost_price", label: "ক্রয়মূল্য", labelEn: "Cost", format: "currency", align: "right" },
      { key: "sell_price", label: "বিক্রয়মূল্য", labelEn: "Sell", format: "currency", align: "right" },
      { key: "mrp", label: "এমআরপি", labelEn: "MRP", format: "currency", align: "right" },
      { key: "stock", label: "স্টক", labelEn: "Stock", format: "number", align: "right" },
      { key: "batch_no", label: "ব্যাচ", labelEn: "Batch" },
      { key: "expiry_date", label: "মেয়াদ", labelEn: "Expiry", format: "date" },
    ],
    rows,
    summary: [
      { label: "মোট আইটেম", labelEn: "Total Items", value: rows.length, format: "number" },
    ],
  };
}

export const REPORTS: Record<string, ReportConfig> = {
  "purchase": {
    slug: "purchase", title: "ক্রয় রিপোর্ট", titleEn: "Purchase Report",
    description: "সরবরাহকারী ও তারিখ অনুযায়ী ক্রয়ের বিবরণ।",
    descriptionEn: "Purchases by supplier and date.",
    usesDateFilter: true, fetch: fetchPurchase,
  },
  "sales": {
    slug: "sales", title: "বিক্রয় রিপোর্ট", titleEn: "Sales Report",
    description: "দৈনিক, সাপ্তাহিক ও মাসিক বিক্রয়ের বিবরণ।",
    descriptionEn: "Daily, weekly and monthly sales.",
    usesDateFilter: true, fetch: fetchSales,
  },
  "products": {
    slug: "products", title: "পণ্যের রিপোর্ট", titleEn: "Products Report",
    description: "স্টক, ক্যাটাগরি ও মূল্য অনুযায়ী পণ্যের তালিকা।",
    descriptionEn: "Products by stock, category and price.",
    usesDateFilter: false, fetch: (o) => fetchProducts(o),
  },
  "customers": {
    slug: "customers", title: "কাস্টমার রিপোর্ট", titleEn: "Customer Report",
    description: "ক্রেতাদের বাকি ও তথ্য।",
    descriptionEn: "Customer due and information.",
    usesDateFilter: false, fetch: (o) => fetchCustomers(o),
  },
  "dues": {
    slug: "dues", title: "বাকির রিপোর্ট", titleEn: "Due Report",
    description: "পরিশোধযোগ্য ও আদায়যোগ্য বাকির তালিকা।",
    descriptionEn: "Payable and receivable dues.",
    usesDateFilter: false, fetch: (o) => fetchDues(o),
  },
  "sales-profit": {
    slug: "sales-profit", title: "বিক্রয় অনুযায়ী লাভ ক্ষতি", titleEn: "Sales-wise Profit & Loss",
    description: "প্রতিটি বিক্রয় অনুযায়ী লাভ ও ক্ষতি।",
    descriptionEn: "Profit and loss per sale.",
    usesDateFilter: true, fetch: fetchSalesProfit,
  },
  "profit-loss": {
    slug: "profit-loss", title: "লাভ ক্ষতি", titleEn: "Profit & Loss",
    description: "বিক্রয়, ক্রয় ও খরচের ভিত্তিতে লাভ-ক্ষতির বিস্তারিত।",
    descriptionEn: "P&L based on sales, purchase and expenses.",
    usesDateFilter: true, fetch: fetchProfitLoss,
  },
  "mobile-banking": {
    slug: "mobile-banking", title: "মোবাইল ব্যাংকিং রিপোর্ট", titleEn: "Mobile Banking Report",
    description: "বিকাশ, নগদ, রকেট ইত্যাদি মোবাইল ব্যাংকিং লেনদেন।",
    descriptionEn: "bKash, Nagad, Rocket etc. transactions.",
    usesDateFilter: true, fetch: (o, f, t) => fetchCashbookByMethods(o, f, t, MOBILE_METHODS),
  },
  "bank": {
    slug: "bank", title: "ব্যাংক লেনদেন রিপোর্ট", titleEn: "Bank Transaction Report",
    description: "ব্যাংক অ্যাকাউন্টের জমা ও উত্তোলন।",
    descriptionEn: "Bank account deposits and withdrawals.",
    usesDateFilter: true, fetch: (o, f, t) => fetchCashbookByMethods(o, f, t, BANK_METHODS),
  },
  "expenses": {
    slug: "expenses", title: "খরচ", titleEn: "Expenses",
    description: "সকল খরচের বিস্তারিত বিবরণ।",
    descriptionEn: "All expense details.",
    usesDateFilter: true, fetch: fetchExpenses,
  },
  "expense-type": {
    slug: "expense-type", title: "খরচের ধরন", titleEn: "Expense Type",
    description: "ধরন অনুযায়ী খরচের বিশ্লেষণ।",
    descriptionEn: "Expenses grouped by type.",
    usesDateFilter: true, fetch: (o, f, t) => fetchExpensesGroup(o, f, t, "method"),
  },
  "expense-category": {
    slug: "expense-category", title: "খরচের ক্যাটাগরি", titleEn: "Expense Category",
    description: "ক্যাটাগরি অনুযায়ী খরচের সংক্ষিপ্ত বিবরণ।",
    descriptionEn: "Expenses grouped by category.",
    usesDateFilter: true, fetch: (o, f, t) => fetchExpensesGroup(o, f, t, "category"),
  },
  "stock-summary": {
    slug: "stock-summary", title: "স্টক সামারী", titleEn: "Stock Summary",
    description: "বর্তমান স্টকের সংক্ষিপ্ত বিবরণ ও মূল্যমান।",
    descriptionEn: "Current stock summary and valuation.",
    usesDateFilter: false, fetch: (o) => fetchStockSummary(o),
  },
  "stock-movement": {
    slug: "stock-movement", title: "স্টক পরিবর্তনের রিপোর্ট", titleEn: "Stock Movement Report",
    description: "পণ্যের স্টক বৃদ্ধি ও হ্রাসের বিবরণ।",
    descriptionEn: "Product stock in/out details.",
    usesDateFilter: true, fetch: fetchStockMovement,
  },
  "item-detail": {
    slug: "item-detail", title: "আইটেমের বিস্তারিত রিপোর্ট", titleEn: "Item Detail Report",
    description: "প্রতিটি আইটেমের বিস্তারিত তথ্য।",
    descriptionEn: "Detailed information per item.",
    usesDateFilter: false, fetch: (o) => fetchItemDetail(o),
  },
};

export const REPORT_ORDER = [
  "purchase", "sales", "products", "customers", "dues",
  "sales-profit", "profit-loss", "mobile-banking", "bank",
  "expenses", "expense-type", "expense-category",
  "stock-summary", "stock-movement", "item-detail",
];
