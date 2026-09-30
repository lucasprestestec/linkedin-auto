"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

type Status = "loading" | "unsupported" | "ios-install" | "no-keys" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return registration ? registration.pushManager.getSubscription() : null;
}

export function NotificationsCard({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Checagem de suporte só existe no navegador; o efeito roda uma vez no cliente.
    const detect = async (): Promise<Status> => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (ios && !standalone) return "ios-install";
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (!publicKey) return "no-keys";
      if (Notification.permission === "denied") return "denied";
      return (await currentSubscription()) ? "on" : "off";
    };
    detect().then(setStatus);
  }, [publicKey]);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey!),
        });
        await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        setStatus("on");
        await sendTestPush();
        setMessage("Pronto! Enviamos uma notificação de teste.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Não foi possível ativar.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const sub = await currentSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage(null);
    });
  }

  function test() {
    startTransition(async () => {
      const { delivered } = await sendTestPush();
      setMessage(delivered ? "Notificação de teste enviada." : "Nenhum aparelho recebeu — tente desativar e ativar de novo.");
    });
  }

  const hint: Partial<Record<Status, string>> = {
    unsupported: "Este navegador não suporta notificações.",
    "ios-install": "No iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o app por lá e ative aqui.",
    "no-keys": "Falta configurar as chaves VAPID no servidor (VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).",
    denied: "As notificações foram bloqueadas neste navegador. Libere nas configurações do site e volte aqui.",
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="setting" style={{ padding: 0 }}>
        <p className="grow">
          {status === "on" ? "Ativado neste aparelho." : "Aviso no celular ou no computador quando uma conversa passar para você."}
        </p>
        {status === "off" && (
          <button type="button" className="btn-solid btn-sm" onClick={enable} disabled={pending}>
            {pending ? "Ativando…" : "Ativar"}
          </button>
        )}
        {status === "on" && <span className="ok-text">Ativo</span>}
      </div>
      {status === "on" && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-line btn-sm" onClick={test} disabled={pending}>
            Enviar teste
          </button>
          <button type="button" className="btn-text" onClick={disable} disabled={pending}>
            Desativar
          </button>
        </div>
      )}
      {(hint[status] || message) && <p className="note note-warn">{hint[status] ?? message}</p>}
    </div>
  );
}
