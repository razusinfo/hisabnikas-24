export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-5">
        {/* Animated ring */}
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <span className="text-2xl font-bold text-gradient">হ</span>
          </div>
        </div>

        {/* App name */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">
            হিসাব নিকাশ-২৪
          </h1>
          <p className="text-xs font-medium text-muted-foreground tracking-wide">
            Loading…
          </p>
        </div>

        {/* Pulse dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
