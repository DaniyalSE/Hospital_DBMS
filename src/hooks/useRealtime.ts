import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePayload, RealtimeStatus } from "@/types/realtime";

interface UseRealtimeOptions {
  collections?: string[];
  enabled?: boolean;
  onEvent?: (event: RealtimePayload) => void;
  reconnectDelayMs?: number;
}

const DEFAULT_WS_PATH = (import.meta.env.VITE_WS_URL as string | undefined) || "/ws";

function resolveWsUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_WS_PATH;
  }

  if (DEFAULT_WS_PATH.startsWith("ws")) {
    return DEFAULT_WS_PATH;
  }

  if (DEFAULT_WS_PATH.startsWith("http")) {
    return DEFAULT_WS_PATH.replace(/^http/, "ws");
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = DEFAULT_WS_PATH.startsWith("/") ? DEFAULT_WS_PATH : `/${DEFAULT_WS_PATH}`;
  return `${protocol}//${window.location.host}${path}`;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { collections, enabled = true, onEvent, reconnectDelayMs = 3_000 } = options;
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [lastEvent, setLastEvent] = useState<RealtimePayload | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetCollections = useMemo(() => {
    if (!collections || collections.length === 0) {
      return null;
    }
    return new Set(collections);
  }, [collections]);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    } else {
      socketRef.current?.close();
    }
    socketRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return () => undefined;
    }

    let cancelled = false;

    const connect = () => {
      cleanup();
      setStatus("connecting");
      try {
        const url = resolveWsUrl();
        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
          if (cancelled) return;
          setStatus("open");
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as RealtimePayload;
            if (targetCollections && !targetCollections.has(payload.collection)) {
              return;
            }
            setLastEvent(payload);
            onEvent?.(payload);
          } catch (error) {
            console.error("Failed to parse realtime payload", error);
          }
        };

        socket.onerror = () => {
          if (cancelled) return;
          setStatus("error");
          socket.close();
        };

        socket.onclose = () => {
          if (cancelled) return;
          setStatus("closed");
          reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
        };
      } catch (error) {
        console.error("Failed to connect to realtime endpoint", error);
        setStatus("error");
        reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
      }
    };

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, cleanup, onEvent, reconnectDelayMs, targetCollections]);

  return { status, lastEvent };
}
