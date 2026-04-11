/** Centered indeterminate spinner for route transitions and data fetches. */

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-slate-600"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
        aria-hidden
      />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  )
}
