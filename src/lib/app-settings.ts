import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  // Products
  productActive?: boolean;
  itemType?: "product" | "service";
  barcodeScan?: boolean;
  stockMaintenance?: boolean;
  stockValuationMethod?: "avg" | "fifo" | "lifo";
  itemUnit?: boolean;
  itemCategory?: boolean;
  showPurchasePrice?: boolean;
  discount?: boolean;
  vat?: boolean;
  manufactureDate?: boolean;
  expiryDate?: boolean;
  description?: boolean;
  showSalePrice?: boolean;
  wholesale?: boolean;
  mrpPrice?: boolean;
  batchNumber?: boolean;
  serialImei?: boolean;
  size?: boolean;
  warranty?: boolean;
  expiryAlert?: boolean;
  expiryAlertDays?: number;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  // Transactions
  showInvoiceNumber?: boolean;
  cashSaleDefault?: boolean;
  txShowPurchasePrice?: boolean;
  txShowSalePrice?: boolean;
  deliveryCharge?: boolean;
  taxPerTx?: boolean;
  discountPerTx?: boolean;
  saleProfit?: boolean;
  allowViewInvoice?: boolean;
  discountOnPayment?: boolean;
  dueSmsOnTx?: boolean;
  inactiveSupplierOnSale?: boolean;
  inactiveCustomerOnPurchase?: boolean;
  autoIncrementInvoice?: boolean;
  startingInvoiceNumber?: number;
  // Export & printing
  showHeading?: boolean;
  showCompanyName?: boolean;
  showCompanyLogo?: boolean;
  showExportDate?: boolean;
  showBusinessInfo?: boolean;
  showPreviousDue?: boolean;
  showFooter?: boolean;
  showSignature?: boolean;
  showInvoiceTerms?: boolean;
  showInvoiceDescription?: boolean;
  useRegularPrinter?: boolean;
  useThermalPrinter?: boolean;
  // Misc
  footer?: string;
  terms?: string;
  notes?: string;
  bankDetails?: string;
  paymentInstructions?: string;
  // Invoice design
  invoiceTheme?: string;
  invoiceFontSize?: "sm" | "md" | "lg" | "xl";
  invoiceTemplate?: number;
  invoiceFontFamily?: string;
  invoiceFontWeight?: number;
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return {};
      const { data } = await supabase
        .from("profiles")
        .select("invoice_settings")
        .eq("id", u.user.id)
        .single();
      return ((data?.invoice_settings ?? {}) as AppSettings) || {};
    },
  });
}
