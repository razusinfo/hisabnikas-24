import logoAsset from "@/assets/hisab-nikash-24-logo-v8.png.asset.json";

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with pulse animation */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          <img
            src={logoAsset.url}
            alt="হিসাব নিকাশ-২৪"
            className="relative h-28 w-28 rounded-full object-cover shadow-lg animate-pulse"
          />
        </div>

        {/* App name */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">
            হিসাব নিকাশ-২৪
          </h1>
          <p className="text-xs font-medium text-muted-foreground tracking-wide">
            লোড হচ্ছে…
          </p>
        </div>

        {/* Bouncing dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
