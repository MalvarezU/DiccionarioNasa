"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { WelcomeModal } from "@/components/welcome-modal";

interface PendingProfile {
  name: string;
  email: string;
}

/**
 * Puerta de onboarding post-Google: cuando hay sesión y el perfil indica
 * onboardedAt null, abre el WelcomeModal. Montado junto al AuthModal.
 */
export function WelcomeGate() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [done, setDone] = useState(false);
  const checkedEmail = useRef<string | null>(null);

  const email = session?.user?.email ?? null;
  const sessionName = session?.user?.name ?? "";

  useEffect(() => {
    if (status !== "authenticated" || !email) return;
    if (done || checkedEmail.current === email) return;
    checkedEmail.current = email;

    let cancelled = false;
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user && !data.user.onboardedAt) {
          setProfile({
            name: data.user.name ?? sessionName ?? "",
            email: data.user.email ?? email,
          });
          setOpen(true);
        } else {
          setDone(true);
        }
      })
      .catch(() => {
        // Sin red no se puede decidir: se reintenta en la próxima sesión.
        checkedEmail.current = null;
      });
    return () => {
      cancelled = true;
    };
    // Intencionalmente solo ante cambio de sesión: una consulta por login.
  }, [status, email]);

  if (!open || !profile) return null;

  return (
    <WelcomeModal
      open={open}
      onOpenChange={setOpen}
      initialName={profile.name || sessionName}
      email={profile.email}
      onCompleted={() => {
        setDone(true);
        setOpen(false);
      }}
    />
  );
}
