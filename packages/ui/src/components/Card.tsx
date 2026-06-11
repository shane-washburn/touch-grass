import type { HTMLAttributes } from "react";

/** Standard surface used across the suite (landing cards, module panels). */
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-xl ring-1 ring-slate-100 ${className}`}
      {...props}
    />
  );
}
