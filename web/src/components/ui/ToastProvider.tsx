"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <p
            key={item.id}
            role="status"
            className={
              item.tone === "error"
                ? "pointer-events-auto max-w-md rounded-xl bg-red-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
                : item.tone === "info"
                  ? "pointer-events-auto max-w-md rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
                  : "pointer-events-auto max-w-md rounded-xl bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
            }
          >
            {item.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast requires ToastProvider");
  }
  return context;
}
