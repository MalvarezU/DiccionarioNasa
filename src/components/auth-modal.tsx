"use client";

import { useEffect, useState } from "react";
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

export type AuthModalMode = "register" | "login";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo inicial al abrirse. Default "login". */
  initialMode?: AuthModalMode;
}

/**
 * Acceso Google-first (Fase 2 + corrección UX registro):
 * - Modo "register": crear cuenta solo con Google (una cuenta nueva se crea
 *   al instante, sin formulario ni correo de verificación). Exige aceptar
 *   Términos y Privacidad aquí, en el punto de creación de la cuenta.
 * - Modo "login": entrar con Google o, colapsado por defecto, con correo +
 *   contraseña (solo para quienes ya crearon una contraseña desde su perfil).
 *   Iniciar sesión nunca exige términos: la aceptación ya ocurrió al crear
 *   la cuenta (register) y el welcome-modal post-Google la refuerza.
 * Sin registro por correo: ningún camino llama a /api/auth/register.
 */
export function AuthModal({ open, onOpenChange, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const { toast } = useToast();

  // El Dialog persiste montado: sincroniza el modo pedido cada vez que se abre.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEmail("");
      setPassword("");
      setAcceptedTerms(false);
      setShowCredentials(false);
      setIsLoading(false);
      setLegalOpen(false);
    }
  }, [open, initialMode]);

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
    // Los términos solo se exigen al crear cuenta. Iniciar sesión entra directo.
    if (mode === "register" && !requireTerms()) return;
    signIn("google", { callbackUrl: "/" });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: "Campos requeridos", description: "Ingresa email y contraseña", variant: "destructive" });
      return;
    }

    // handleLogin solo existe en modo login: nunca exige términos.

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

  const isRegister = mode === "register";

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRegister ? "Creá tu cuenta" : "Iniciar sesión"}</DialogTitle>
          <DialogDescription>
            {isRegister
              ? "Entrá con Google y tu cuenta se crea al instante, sin formulario ni correo de verificación."
              : "Entra con tu cuenta de Google para guardar palabras favoritas y acceder a ellas desde cualquier dispositivo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Button
            type="button"
            variant="cta"
            size={isRegister ? "lg" : "default"}
            className="w-full gap-2 min-h-[44px]"
            disabled={isLoading}
            onClick={handleGoogle}
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Continuar con Google
          </Button>
          {!isRegister && (
            <p className="text-center text-xs text-muted-foreground -mt-2">
              También sirve si ya tenés cuenta.
            </p>
          )}

          {isRegister && (
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
          )}

          {!isRegister && (
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
          )}

          <p className="border-t pt-3 text-center text-sm text-foreground">
            {isRegister ? (
              <>
                ¿Ya tenés contraseña?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="min-h-[44px] px-1 font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                ¿No tenés cuenta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="min-h-[44px] px-1 font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Crear una
                </button>
              </>
            )}
          </p>
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
