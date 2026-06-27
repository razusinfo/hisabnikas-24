import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // ISO yyyy-mm-dd (or "")
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
};

const toDate = (v: string): Date | undefined => {
  if (!v) return undefined;
  const d = parse(v, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
};

const toISO = (d: Date | undefined): string => (d ? format(d, "yyyy-MM-dd") : "");

export function DateInput({ value, onChange, className, placeholder, clearable = true, disabled }: Props) {
  const { lang } = useI18n();
  const effectivePlaceholder = placeholder ?? (lang === "bn" ? "দিন/মাস/সাল" : "Day/Month/Year");
  const date = toDate(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal w-full",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{date ? format(date, "dd/MM/yyyy") : effectivePlaceholder}</span>
          {clearable && date && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="clear"
              className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }
              }}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(toISO(d))}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export default DateInput;
