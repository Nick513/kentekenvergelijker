"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: number;
  message: string;
  action?: ToastAction;
};

type ToastOptions = {
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, action: options?.action }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-[19rem] flex-col gap-2.5"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="pointer-events-auto relative overflow-hidden rounded-xl border border-[rgb(248_113_113)] bg-[rgb(254_235_235)] px-3.5 py-3 text-[rgb(127_29_29)] shadow-[0_10px_28px_rgb(127_29_29_/_18%)] dark:border-[rgb(190_60_60)] dark:bg-[rgb(66_24_24)] dark:text-[rgb(254_220_220)] dark:shadow-[0_10px_28px_rgb(0_0_0_/_44%)]"
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-sm leading-none text-current/70 transition-colors hover:text-current"
        aria-label="Melding sluiten"
      >
        ×
      </button>
      <div className="flex items-start gap-2.5 pr-5">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-base leading-none">
          ⚠
        </span>
        <p className="text-sm font-medium leading-5 text-current">{toast.message}</p>
      </div>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="mt-2 text-sm font-semibold text-current underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
