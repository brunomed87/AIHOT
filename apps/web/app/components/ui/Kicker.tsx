import type { ReactNode } from "react";

/** Rótulo de destaque com espaçamento e barra curta, como manchetes e apresentação. */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[12px] font-semibold tracking-[0.3em] text-accent ${className}`}>
      <span className="h-[2px] w-6 rounded-full bg-accent" aria-hidden="true" />
      {children}
    </div>
  );
}
