import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" role="presentation" className={`motion-safe:animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-700/50 ${className}`} />;
}
