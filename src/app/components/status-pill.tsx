export function StatusPill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "lime" | "amber" | "blue" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

