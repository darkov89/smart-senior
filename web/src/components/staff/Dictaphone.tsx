"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyQueueChanged } from "@/components/staff/OfflineBanner";
import { useToast } from "@/components/ui/ToastProvider";
import {
  enqueueRecording,
  listRecordings,
  removeRecording,
} from "@/lib/offline/voice-queue";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { secondaryButtonClass } from "@/lib/styles";

interface VoiceAssistantResponse {
  mode?: string;
  follow_up_question?: string | null;
}

export function Dictaphone({ patientId }: { patientId: string }) {
  const { showToast } = useToast();
  const [recording, setRecording] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const items = await listRecordings();
    for (const item of items) {
      const body = new FormData();
      body.append("patient_id", item.patientId);
      body.append("audio", item.blob, `notatka-${item.id}.webm`);
      const { data, error } = await supabase.functions.invoke("voice-assistant", {
        body,
      });
      if (error) {
        return;
      }
      await removeRecording(item.id);
      notifyQueueChanged();
      const payload = data as VoiceAssistantResponse | null;
      if (payload?.mode === "follow_up" && payload.follow_up_question) {
        setFollowUp(payload.follow_up_question);
      }
      showToast("Wysłano nagranie z kolejki.");
    }
  }, [showToast]);

  useEffect(() => {
    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    void flushQueue();
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue]);

  async function startRecording() {
    setFollowUp(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      void saveRecording(blob, recorder.mimeType || "audio/webm");
    };
    mediaRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  async function saveRecording(blob: Blob, mimeType: string) {
    setBusy(true);
    await enqueueRecording({
      id: crypto.randomUUID(),
      patientId,
      createdAt: new Date().toISOString(),
      mimeType,
      blob,
    });
    notifyQueueChanged();
    showToast("Nagranie zapisane na tym urządzeniu.");
    setBusy(false);
    await flushQueue();
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold">Dyktafon</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Nagranie trafia do kolejki na tym telefonie. Transkrypcja głosowa jest w
        przygotowaniu — do tego czasu dopisz ręczny szkic relacji poniżej.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {recording ? (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={stopRecording}
          >
            Zatrzymaj nagranie
          </button>
        ) : (
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={busy}
            onClick={() => {
              void startRecording().catch(() => {
                showToast("Nie udało się włączyć mikrofonu.", "error");
              });
            }}
          >
            Rozpocznij nagranie
          </button>
        )}
      </div>
      {followUp ? (
        <p className="mt-4 rounded-xl bg-brand-50 px-3 py-3 text-sm text-slate-800">
          {followUp}
        </p>
      ) : null}
    </section>
  );
}
