"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AlertMessage } from "@/app/components/ui/alert-message";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileWidgetId = string;

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "compact" | "flexible";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    options: TurnstileRenderOptions,
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
  remove?: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  disabled?: boolean;
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
  onError: (message: string) => void;
};

export function TurnstileWidget({
  siteKey,
  disabled = false,
  resetSignal,
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || disabled || !scriptReady || widgetIdRef.current) {
      return;
    }
    if (!containerRef.current || !window.turnstile) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      size: "flexible",
      callback: (token) => {
        onTokenChange(token);
      },
      "expired-callback": () => {
        onTokenChange(null);
        onError("Human verification expired. Please try again.");
      },
      "error-callback": () => {
        onTokenChange(null);
        onError("Human verification failed. Please retry the challenge.");
      },
      "timeout-callback": () => {
        onTokenChange(null);
        onError("Human verification timed out. Please retry the challenge.");
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [disabled, onError, onTokenChange, scriptReady, siteKey]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
  }, [resetSignal]);

  if (!siteKey) {
    return (
      <AlertMessage variant="danger">
        Human verification is not configured. Add the Turnstile site key before
        enabling registration.
      </AlertMessage>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
          setScriptFailed(false);
        }}
        onError={() => {
          setScriptFailed(true);
          onTokenChange(null);
          onError("Human verification could not load. Please try again.");
        }}
      />
      <div
        ref={containerRef}
        aria-hidden={disabled}
        className="min-h-[65px] rounded-xl border border-white/10 bg-white/[0.03] p-2"
      />
      {scriptFailed ? (
        <AlertMessage variant="danger">
          Human verification failed to load. Check your network connection and
          try again.
        </AlertMessage>
      ) : null}
    </div>
  );
}
