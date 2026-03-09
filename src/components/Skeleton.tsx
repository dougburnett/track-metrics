export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-s)] bg-[var(--secondary)] ${className}`}
    />
  );
}
