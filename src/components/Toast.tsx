interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-enter fixed top-5 right-5 bg-slate-900 text-white px-6 py-3.5 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-slate-700 max-w-sm"
    >
      <svg
        className="w-5 h-5 text-green-400 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}
