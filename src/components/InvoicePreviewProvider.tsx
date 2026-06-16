import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { buildInvoiceHtml, type PrintInvoiceOptions } from "@/lib/print-invoice";
import { useI18n } from "@/lib/i18n";

type Ctx = { showInvoicePreview: (opts: PrintInvoiceOptions) => void };
const InvoicePreviewContext = createContext<Ctx | null>(null);

export function useInvoicePreview() {
  const ctx = useContext(InvoicePreviewContext);
  if (!ctx) throw new Error("useInvoicePreview must be used within InvoicePreviewProvider");
  return ctx;
}

export function InvoicePreviewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { lang } = useLang();
  const tr = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const showInvoicePreview = useCallback((opts: PrintInvoiceOptions) => {
    setHtml(buildInvoiceHtml(opts));
    setTitle(opts.doc.invoice_no || tr("ইনভয়েস প্রিভিউ", "Invoice Preview"));
    setOpen(true);
  }, [lang]);

  const doPrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.focus();
      win.print();
    } catch {
      const w = window.open("", "_blank", "width=820,height=1000");
      if (w) {
        w.document.write(html);
        w.document.write(`<script>window.onload=()=>setTimeout(()=>window.print(),200)</script>`);
        w.document.close();
      }
    }
  };

  return (
    <InvoicePreviewContext.Provider value={{ showInvoicePreview }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 py-3 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base">
              {tr("ইনভয়েস প্রিভিউ", "Invoice Preview")} — {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/30 overflow-auto">
            <iframe
              ref={iframeRef}
              title="invoice-preview"
              srcDoc={html}
              className="w-full h-full bg-white"
              style={{ border: 0, minHeight: "100%" }}
            />
          </div>
          <DialogFooter className="px-5 py-3 border-t gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              {tr("বন্ধ করুন", "Close")}
            </Button>
            <Button onClick={doPrint}>
              <Printer className="h-4 w-4 mr-2" />
              {tr("প্রিন্ট করুন", "Print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InvoicePreviewContext.Provider>
  );
}
