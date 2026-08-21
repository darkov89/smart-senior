"use client";

import { useEffect, useState } from "react";
import { listRecordings } from "@/lib/offline/voice-queue";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    function refreshOnline() {
      setOnline(navigator.onLine);
    }
    async function refreshQueue() {
      const items = await listRecordings();
      setQueueCount(items.length);
    }
    refreshOnline();
    void refreshQueue();
    window.addEventListener("online", refreshOnline);
    window.addEventListener("offline", refreshOnline);
    window.addEventListener("pakiet-spokoju-queue", refreshQueue);
    return () => {
      window.removeEventListener("online", refreshOnline);
      window.removeEventListener("offline", refreshOnline);
      window.removeEventListener("pakiet-spokoju-queue", refreshQueue);
    };
  }, []);

  if (online && queueCount === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {!online ? (
        <p className="font-medium">Tryb offline — nagrania zostaną wysłane po odzyskaniu połączenia.</p>
      ) : (
        <p className="font-medium">
          W kolejce czeka {queueCount}{" "}
          {queueCount === 1 ? "nagranie" : "nagrań"} do wysłania.
        </p>
      )}
    </div>
  );
}

export function notifyQueueChanged() {
  window.dispatchEvent(new Event("pakiet-spokoju-queue"));
}
