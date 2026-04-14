"use client";

import { useEffect, useState } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "error" | "success";
}

let toastHandlers: ((toast: Toast) => void)[] = [];

export function toast(t: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  toastHandlers.forEach((h) => h({ ...t, id }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== t.id));
      }, 4000);
    };
    toastHandlers.push(handler);
    return () => {
      toastHandlers = toastHandlers.filter((h) => h !== handler);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 shadow-lg min-w-64 max-w-sm"
        >
          <p className={`text-sm font-medium ${
            t.variant === "error" ? "text-status-error" :
            t.variant === "success" ? "text-status-success" :
            "text-text-primary"
          }`}>{t.title}</p>
          {t.description && (
            <p className="text-xs text-text-secondary mt-0.5">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
