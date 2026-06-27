import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, Phone, MessageCircle } from "lucide-react";

const CONTACT_NUMBER = "01719220711";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PaymentSuccessDialog({ open, onOpenChange }: Props) {
  const { lang } = useI18n();
  const isBn = lang === "bn";
  const waNumber = "880" + CONTACT_NUMBER.replace(/^0/, "");
  const waMsg = encodeURIComponent(
    isBn
      ? "আসসালামু আলাইকুম, আমি পেমেন্ট জমা দিয়েছি। অনুগ্রহ করে আমার অ্যাকাউন্ট একটিভ করুন।"
      : "Assalamu Alaikum, I have submitted my payment. Please activate my account.",
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-center">
            {isBn ? "আপনার পেমেন্ট সম্পন্ন হয়েছে" : "Your payment has been submitted"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isBn
              ? "পেমেন্টটি একটিভ করতে কল করুন অথবা হোয়াটসঅ্যাপে যোগাযোগ করুন।"
              : "Call or contact us on WhatsApp to activate the payment."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 mt-2">
          <Button asChild className="w-full" size="lg">
            <a href={`tel:${CONTACT_NUMBER}`}>
              <Phone className="h-4 w-4 mr-2" />
              {isBn ? "কল করুন" : "Call"} ({CONTACT_NUMBER})
            </a>
          </Button>
          <Button
            asChild
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white"
            size="lg"
          >
            <a
              href={`https://wa.me/${waNumber}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {isBn ? "হোয়াটসঅ্যাপে যোগাযোগ" : "Contact on WhatsApp"}
            </a>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isBn ? "বন্ধ করুন" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
