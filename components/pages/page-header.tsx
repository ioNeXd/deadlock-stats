export function PageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <header className="flex flex-col gap-2.5">
      <p className="font-display text-sm sm:text-base font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase leading-tight tracking-wide text-balance">
        {title}
      </h1>
      <p className="max-w-3xl text-pretty text-sm sm:text-base leading-relaxed text-muted-foreground">{lede}</p>
    </header>
  )
}
