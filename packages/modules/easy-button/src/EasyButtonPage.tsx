import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  Play,
  Save,
  Square,
  UploadCloud,
} from "lucide-react";
import {
  Button,
  Card,
  MuteButton,
  ShareButton,
  consumeShareSnapshot,
  isMuted,
  trackStat,
} from "@scroll-goblin/ui";
import type { EasyButtonShareState } from "@scroll-goblin/shared";
import { ClipNotFoundError, fetchClip, uploadClip } from "./api";
import defaultClipUrl from "./assets/that-was-easy.m4a?url";

const MODULE_ID = "easy-button";
const SHARE_VERSION = 1;
const MAX_RECORDING_MS = 10_000;
const MAX_BYTES = 500 * 1024;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
];

type UploadStatus = "idle" | "saving" | "saved" | "error";

interface ActiveClip {
  url: string;
  key: string;
  custom: boolean;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

function clipInstanceId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID?.() ?? `${Date.now()}:${Math.random()}`}`;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`;
}

export default function EasyButtonPage() {
  const snapshot = useRef(
    consumeShareSnapshot<EasyButtonShareState>(MODULE_ID, SHARE_VERSION)
  ).current;

  const [activeClip, setActiveClip] = useState<ActiveClip>({
    url: defaultClipUrl,
    key: "default",
    custom: false,
  });
  const [localClip, setLocalClip] = useState<Blob | null>(null);
  const [uploadedClipId, setUploadedClipId] = useState<string | null>(
    snapshot?.clipId ?? null
  );
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState(
    snapshot?.clipId
      ? "Summoning a shared custom button..."
      : "Press the button. Receive wisdom."
  );
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const objectUrl = useRef<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordedBytes = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playedRecordings = useRef(new Set<string>());

  const replaceWithCustomClip = (blob: Blob, key: string) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(blob);
    objectUrl.current = url;
    setActiveClip({ url, key, custom: true });
  };

  const restoreDefault = () => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setActiveClip({ url: defaultClipUrl, key: "default", custom: false });
    setLocalClip(null);
    setUploadedClipId(null);
    setUploadStatus("idle");
    setMessage("Default button restored.");
  };

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  const clearRecordingTimers = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    stopTimer.current = null;
    tickTimer.current = null;
  };

  useEffect(() => {
    if (!snapshot?.clipId) return;
    let cancelled = false;
    fetchClip(snapshot.clipId)
      .then((blob) => {
        if (cancelled) return;
        replaceWithCustomClip(blob, `clip:${snapshot.clipId}`);
        setUploadedClipId(snapshot.clipId);
        setMessage("Shared custom button loaded. Smash it.");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ClipNotFoundError) {
          setExpired(true);
          setMessage("The shared custom clip expired, so the default is back.");
        } else {
          setError(err instanceof Error ? err.message : "Could not load clip");
          setMessage("Could not load the shared clip. Default button restored.");
        }
        restoreDefault();
      });

    return () => {
      cancelled = true;
    };
    // This intentionally runs once for the consumed share snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      clearRecordingTimers();
      stopTracks();
    };
  }, []);

  const playUrl = async (url: string) => {
    if (isMuted()) {
      setMessage("Sound is muted. The button is judging silently.");
      return false;
    }
    const audio = new Audio(url);
    await audio.play();
    return true;
  };

  const pressButton = async () => {
    trackStat(MODULE_ID, "presses");
    setError(null);
    try {
      const played = await playUrl(activeClip.url);
      if (played && activeClip.custom && !playedRecordings.current.has(activeClip.key)) {
        playedRecordings.current.add(activeClip.key);
        trackStat(MODULE_ID, "recordings");
      }
      if (played) {
        setMessage(
          activeClip.custom
            ? "Custom affirmation deployed."
            : "A timeless truth echoes through the browser."
        );
      }
    } catch {
      setError("Your browser blocked playback. Tap once more.");
    }
  };

  const previewRecording = async () => {
    if (!localClip) return;
    setError(null);
    try {
      await playUrl(activeClip.url);
      setMessage("Previewing your custom button.");
    } catch {
      setError("Preview failed. Try recording again.");
    }
  };

  const stopRecording = () => {
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
  };

  const startRecording = async () => {
    setError(null);
    setExpired(false);
    if (typeof MediaRecorder === "undefined") {
      setError("This browser does not support recording.");
      return;
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = micStream;
      chunks.current = [];
      recordedBytes.current = 0;
      setRecordingSeconds(0);

      const mimeType = pickMimeType();
      const r = new MediaRecorder(
        micStream,
        mimeType ? { mimeType } : undefined
      );
      recorder.current = r;

      r.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        recordedBytes.current += event.data.size;
        chunks.current.push(event.data);
        if (recordedBytes.current > MAX_BYTES) {
          setError(`Recording is too large. Keep it under ${formatBytes(MAX_BYTES)}.`);
          stopRecording();
        }
      };

      r.onstop = () => {
        clearRecordingTimers();
        setRecording(false);
        stopTracks();

        const type = r.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];

        if (blob.size === 0) {
          setError("No audio was captured. Try again.");
          return;
        }
        if (blob.size > MAX_BYTES) {
          setError(`Recording is ${formatBytes(blob.size)}. Limit is ${formatBytes(MAX_BYTES)}.`);
          return;
        }

        setLocalClip(blob);
        setUploadedClipId(null);
        setUploadStatus("idle");
        replaceWithCustomClip(blob, clipInstanceId("local"));
        setMessage("Custom button armed. Preview it, save it, or smash it now.");
      };

      r.start(250);
      setRecording(true);
      setMessage("Recording... say it like the universe owes you money.");
      stopTimer.current = setTimeout(stopRecording, MAX_RECORDING_MS);
      tickTimer.current = setInterval(
        () => setRecordingSeconds((seconds) => Math.min(seconds + 1, 10)),
        1000
      );
    } catch (err) {
      stopTracks();
      setRecording(false);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Mic blocked. Allow microphone access, then try again."
          : "Could not start recording."
      );
    }
  };

  const saveRecording = async () => {
    if (!localClip) return;
    setError(null);
    setUploadStatus("saving");
    try {
      const result = await uploadClip(localClip);
      setUploadedClipId(result.clipId);
      setUploadStatus("saved");
      setMessage("Recording saved. Share link is ready.");
    } catch (err) {
      setUploadStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const canRecord = typeof MediaRecorder !== "undefined";
  const recordingProgress = Math.min((recordingSeconds / 10) * 100, 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-bento grid gap-bento sm:grid-cols-[1fr_1fr]">
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-primary p-5 shadow-neo-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs font-bold uppercase shadow-neo-sm">
            🔴 Easy Button
          </div>
          <h1 className="font-heading text-4xl uppercase leading-none text-brand-text sm:text-5xl">
            That was easy
          </h1>
        </div>
        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-5 text-sm font-bold leading-relaxed shadow-neo-lg">
          Record your own button voice, save it, and share a spell that expires
          before it gets too powerful.
        </div>
      </header>

      {expired && (
        <div className="easy-expired-alert mb-bento flex flex-col gap-3 rounded-neobrutal border-thick border-brand-border bg-brand-warning p-4 font-bold shadow-neo-lg sm:flex-row sm:items-center sm:justify-between">
          <span>CUSTOM SPELL EXPIRED. DEFAULT BUTTON RESTORED.</span>
          <button
            onClick={() => setExpired(false)}
            className="rounded-neobrutal border-thin border-brand-border bg-brand-background px-3 py-1 text-xs shadow-neo-sm transition-[transform,box-shadow] duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-pressed"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card className="grid gap-bento bg-brand-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-neobrutal border-thin border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold shadow-neo-sm">
            {activeClip.custom ? "CUSTOM VOICE ACTIVE" : "DEFAULT VOICE ACTIVE"}
          </div>
          <MuteButton />
        </div>

        <div className="flex justify-center py-4 sm:py-6">
          <button
            onClick={pressButton}
            aria-label="That was easy"
            className="group relative aspect-square w-[min(76vw,360px)] rounded-full border-massive border-brand-border bg-brand-border shadow-neo-lg transition-[transform,box-shadow] duration-100 active:translate-x-2 active:translate-y-2 active:shadow-neo-pressed"
          >
            <span className="absolute inset-2 rounded-full border-thick border-brand-border bg-[#7A001A]" />
            <span className="absolute inset-5 rounded-full border-thick border-brand-border bg-[radial-gradient(circle_at_35%_24%,#ff6f7f_0%,#ff003c_34%,#b8002b_70%,#780018_100%)] shadow-[inset_-10px_-14px_0_rgba(0,0,0,0.22),inset_8px_10px_0_rgba(255,255,255,0.2)] transition-[inset] duration-100 group-active:inset-7" />
            <span className="absolute left-[24%] top-[16%] h-[12%] w-[34%] rotate-[-20deg] rounded-full bg-white/35 blur-[1px]" />
            <span className="relative z-10 mx-auto flex h-full max-w-[68%] items-center justify-center text-center font-heading text-4xl uppercase leading-[0.9] text-brand-background drop-shadow-[3px_3px_0_#000] sm:text-5xl">
              That was easy
            </span>
          </button>
        </div>

        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-secondary p-4 text-sm font-bold shadow-neo-md">
          {message}
        </div>

        {error && (
          <div className="rounded-neobrutal border-thick border-brand-border bg-brand-alert p-4 text-sm font-bold text-brand-background shadow-neo-md">
            {error}
          </div>
        )}

        <div className="rounded-neobrutal border-thick border-brand-border bg-brand-surface p-4 shadow-neo-md">
          <h2 className="mb-3 font-heading text-2xl uppercase leading-none">
            Custom voice
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {recording ? (
              <Button
                onClick={stopRecording}
                className="min-h-12 w-full !bg-brand-warning sm:min-h-0 sm:w-auto"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={startRecording}
                disabled={!canRecord}
                className="min-h-12 w-full bg-brand-primary sm:min-h-0 sm:w-auto"
              >
                <Mic className="h-4 w-4" />
                Record
              </Button>
            )}
            <Button
              onClick={previewRecording}
              disabled={!localClip || recording}
              className="min-h-12 w-full !bg-brand-orange sm:min-h-0 sm:w-auto"
            >
              <Play className="h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={saveRecording}
              disabled={!localClip || recording || uploadStatus === "saving"}
              className="min-h-12 w-full !bg-brand-warning sm:min-h-0 sm:w-auto"
            >
              {uploadStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : uploadStatus === "saved" ? (
                <Save className="h-4 w-4" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {uploadStatus === "saved" ? "Saved" : "Save"}
            </Button>
            <ShareButton
              moduleId={MODULE_ID}
              version={SHARE_VERSION}
              getState={() => ({ clipId: uploadedClipId })}
              disabled={!uploadedClipId}
              className="min-h-12 w-full justify-center bg-brand-secondary px-5 text-base sm:min-h-0 sm:w-auto"
            />
          </div>

          <div className="mt-4 h-5 rounded-neobrutal border-thin border-brand-border bg-brand-background">
            <div
              className="h-full bg-brand-alert transition-[width] duration-100"
              style={{ width: `${recording ? recordingProgress : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold">
            {recording
              ? `${recordingSeconds}s / 10s`
              : uploadedClipId
                ? `Clip ${uploadedClipId.slice(0, 8)} is ready to share.`
                : localClip
                  ? `${formatBytes(localClip.size)} captured`
                  : canRecord
                    ? "10 seconds max. 500KB max."
                    : "Recording is not supported in this browser."}
          </p>
        </div>
      </Card>
    </div>
  );
}
