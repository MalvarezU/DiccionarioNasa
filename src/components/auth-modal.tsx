"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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
import { Loader2, LogIn, Chrome, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LegalTermsModal, type LegalTab } from "@/components/legal-terms-modal";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Acceso Google-first (Fase 2):
 * - Vía principal: botón Google (única forma de crear cuenta).
 * - Vía secundaria: correo + contraseña, colapsada por defecto, solo para
 *   quienes ya crearon una contraseña desde su perfil. Sin registro por correo.
 */
export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const { toast } = useToast();

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalOpen(true);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setAcceptedTerms(false);
    setShowCredentials(false);
    setIsLoading(false);
    setLegalOpen(false);
  };

  const requireTerms = () => {
    if (!acceptedTerms) {
      toast({
        title: "Aceptación requerida",
        description: "Debes aceptar los Términos y Condiciones y la Política de Privacidad",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleGoogle = () => {
    if (!requireTerms()) return;
    signIn("google", { callbackUrl: "/" });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: "Campos requeridos", description: "Ingresa email y contraseña", variant: "destructive" });
      return;
    }

    if (!requireTerms()) return;

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: "Error al iniciar sesión",
          description: "Email o contraseña incorrectos",
          variant: "destructive",
        });
      } else {
        toast({
          title: "¡Bienvenido/a!",
          description: "Has iniciado sesión correctamente",
        });
        resetForm();
        onOpenChange(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar sesión</DialogTitle>
          <DialogDescription>
            Entra con tu cuenta de Google para guardar palabras favoritas y acceder a ellas desde cualquier dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Button
            type="button"
            variant="cta"
            className="w-full gap-2 min-h-[44px]"
            disabled={isLoading}
            onClick={handleGoogle}
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Continuar con Google
          </Button>

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

          <div className="border-t pt-2">
            <button
              type="button"
              aria-expanded={showCredentials}
              aria-controls="auth-credentials"
              onClick={() => setShowCredentials((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-center gap-1 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Usar correo y contraseña
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showCredentials ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {showCredentials && (
              <form id="auth-credentials" onSubmit={handleSubmit} className="grid gap-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  Solo si ya creaste una contraseña desde tu perfil. Las cuentas nuevas se crean con Google.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="auth-password">Contraseña</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    required
                    minLength={1}
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" variant="outline" className="w-full gap-2 min-h-[44px]" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  )}
                  Iniciar sesión con correo
                </Button>
              </form>
            )}
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
