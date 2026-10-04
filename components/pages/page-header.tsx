export function PageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-balance md:text-5xl">
        {title}
      </h1>
      <p className="max-w-2xl text-pretty text-muted-foreground">{lede}</p>
    </header>
  )
}
