interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
      <p className="text-[var(--color-muted)]">{description}</p>
      <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white p-8 text-sm text-[var(--color-muted)]">
        Module scaffold ready — API and UI will be connected in the next implementation phase.
      </div>
    </div>
  );
}
