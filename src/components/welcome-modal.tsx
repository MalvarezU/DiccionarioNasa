"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LegalTermsModal, type LegalTab } from "@/components/legal-terms-modal";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  email: string;
  image?: string | null;
  /** Se llama cuando el onboarding queda completo (guardar u omitir). */
  onCompleted: () => void;
}

/**
 * Bienvenida post-Google (Fase 2 Google-first):
 * tras el primer login con Google (User.onboardedAt IS NULL) se muestra este
 * formulario: nombre editable + contraseña opcional + aceptación de términos.
 * Al finalizar (guardar u omitir) se marca onboardedAt vía PATCH /api/user/profile.
 */
export function WelcomeModal({
  open,
  onOpenChange,
  initialName,
  email,
  image,
  onCompleted,
}: WelcomeModalProps) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const { toast } = useToast();

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalOpen(true);
  };

  const finish = () => {
    setIsLoading(false);
    onCompleted();
    onOpenChange(false);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Nombre requerido", description: "Escribe tu nombre para continuar", variant: "destructive" });
      return;
    }

    if (password) {
      if (password.length < 8) {
        toast({ title: "Contraseña muy corta", description: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Contraseñas no coinciden", description: "La contraseña y su confirmación deben ser iguales", variant: "destructive" });
        return;
      }
    }

    if (!acceptedTerms) {
      toast({
        title: "Aceptación requerida",
        description: "Debes aceptar los Términos y Condiciones y la Política de Privacidad",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // La contraseña primero: si falla, no se completa el onboarding y se
      // puede reintentar sin perder el estado pendiente.
      if (password) {
        const passRes = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!passRes.ok) {
          const data = await passRes.json().catch(() => null);
          toast({
            title: "No se pudo guardar la contraseña",
            description: data?.message ?? "Intenta de nuevo.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      const profileRes = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, completeOnboarding: true }),
      });
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => null);
        toast({
          title: "No se pudo guardar tu nombre",
          description: data?.message ?? "Intenta de nuevo.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({ title: "¡Listo!", description: "Tu cuenta está configurada" });
      finish();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo completar la bienvenida. Intenta de nuevo.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completeOnboarding: true }),
      });
      finish();
    } catch {
      // Aunque falle el marcado, se cierra: el gate lo reintentará.
      finish();
    }
  };

  const displayName = name.trim() || initialName || email.split("@")[0] || "U";
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-md"
        // Sin cierre con Escape ni clic fuera: el onboarding debe resolverse
        // con Guardar u Omitir para marcar onboardedAt de forma explícita.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bienvenido/a a Piiyaak</DialogTitle>
          <DialogDescription>
            Completa tu perfil para empezar. Puedes agregar una contraseña opcional para entrar también con correo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-3">
            {image ? (
              <img
                src={image}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary"
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-muted-foreground">Cuenta de Google</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="welcome-name">Nombre</Label>
            <Input
              id="welcome-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
              maxLength={100}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="welcome-password">
              Contraseña <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="welcome-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={isLoading}
            />
          </div>

          {password.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="welcome-confirm-password">Confirmar contraseña</Label>
              <Input
                id="welcome-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                disabled={isLoading}
                aria-invalid={passwordsMismatch}
                className={passwordsMismatch ? "border-destructive" : ""}
              />
              {passwordsMismatch && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
              disabled={isLoading}
            />
            <span>
              Acepto los{" "}
              <button
                type="button"
                onClick={() => openLegal("terms")}
                className="text-primary underline"
              >
                Términos y Condiciones
              </button>{" "}
              y la{" "}
              <button
                type="button"
                onClick={() => openLegal("privacy")}
                className="text-primary underline"
              >
                Política de Privacidad
              </button>
              .
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full min-h-[44px]"
              disabled={isLoading}
              onClick={handleSave}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar y continuar
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={isLoading}
              className="flex min-h-[44px] w-full items-center justify-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            >
              Por ahora no
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <LegalTermsModal
      open={legalOpen}
      onOpenChange={setLegalOpen}
      initialTab={legalTab}
      onAccept={() => setAcceptedTerms(true)}
    />
    </>
  );
}
