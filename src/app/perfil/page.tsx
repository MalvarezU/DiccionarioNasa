"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, KeyRound, UserRound } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
}

/**
 * /perfil — Cuenta del usuario (Fase 2 Google-first):
 * ver nombre/email, editar nombre (PATCH profile), crear contraseña si no hay
 * (POST /api/auth/password) o cambiarla si ya existe (POST .../change).
 */
export default function PerfilPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.user);
      setName(data.user.name ?? "");
    } catch {
      toast({
        title: "No se pudo cargar tu perfil",
        description: "Revisa tu conexión e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === "authenticated") loadProfile();
    else if (status === "unauthenticated") setLoading(false);
  }, [status, loadProfile]);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      toast({
        title: "Nombre inválido",
        description: "El nombre debe tener entre 1 y 100 caracteres",
        variant: "destructive",
      });
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: "No se pudo guardar",
          description: data?.message ?? "Intenta de nuevo.",
          variant: "destructive",
        });
        return;
      }
      setProfile((p) => (p ? { ...p, name: data.user.name } : p));
      toast({ title: "Nombre actualizado", description: "Tu nombre se guardó correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar. Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handlePassword = async () => {
    if (profile?.hasPassword && !currentPassword) {
      toast({ title: "Falta la contraseña actual", description: "Escribe tu contraseña actual", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Contraseña muy corta", description: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Contraseñas no coinciden", description: "La contraseña nueva y su confirmación deben ser iguales", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const url = profile?.hasPassword ? "/api/auth/password/change" : "/api/auth/password";
      const body = profile?.hasPassword
        ? { currentPassword, newPassword }
        : { password: newPassword };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: profile?.hasPassword ? "No se pudo cambiar" : "No se pudo crear",
          description: data?.message ?? "Intenta de nuevo.",
          variant: "destructive",
        });
        return;
      }
      setProfile((p) => (p ? { ...p, hasPassword: true } : p));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: profile?.hasPassword ? "Contraseña actualizada" : "Contraseña creada",
        description: profile?.hasPassword
          ? "Ya puedes entrar con tu nueva contraseña"
          : "Ya puedes entrar también con correo y contraseña",
      });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar. Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-serif font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus datos y tu acceso con correo y contraseña.
        </p>

        {loading ? (
          <div className="mt-6 grid gap-4" aria-busy="true" aria-label="Cargando perfil">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : status === "unauthenticated" ? (
          <div className="mt-6 rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Inicia sesión para ver y editar tu perfil.
            </p>
            <Button className="mt-4 min-h-[44px]" onClick={() => setAuthOpen(true)}>
              Iniciar sesión
            </Button>
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
          </div>
        ) : profile ? (
          <div className="mt-6 grid gap-6">
            <section aria-labelledby="perfil-datos" className="rounded-lg border p-5">
              <h2 id="perfil-datos" className="flex items-center gap-2 text-base font-semibold">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Tus datos
              </h2>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="perfil-email">Email</Label>
                  <Input id="perfil-email" value={profile.email} disabled readOnly />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="perfil-name">Nombre</Label>
                  <Input
                    id="perfil-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    maxLength={100}
                    disabled={savingName}
                  />
                </div>
                <div>
                  <Button onClick={handleSaveName} disabled={savingName} className="gap-2 min-h-[44px]">
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-4 w-4" aria-hidden="true" />
                    )}
                    Guardar nombre
                  </Button>
                </div>
              </div>
            </section>

            <section aria-labelledby="perfil-password" className="rounded-lg border p-5">
              <h2 id="perfil-password" className="flex items-center gap-2 text-base font-semibold">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {profile.hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.hasPassword
                  ? "Actualiza la contraseña que usas para entrar con correo."
                  : "Tu cuenta se creó con Google. Crea una contraseña si también quieres entrar con correo."}
              </p>
              <div className="mt-4 grid gap-4">
                {profile.hasPassword && (
                  <div className="grid gap-2">
                    <Label htmlFor="perfil-current">Contraseña actual</Label>
                    <Input
                      id="perfil-current"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Tu contraseña actual"
                      disabled={savingPassword}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="perfil-new">
                    {profile.hasPassword ? "Contraseña nueva" : "Contraseña"}
                  </Label>
                  <Input
                    id="perfil-new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={savingPassword}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="perfil-confirm">Confirmar contraseña</Label>
                  <Input
                    id="perfil-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    disabled={savingPassword}
                    aria-invalid={confirmPassword.length > 0 && newPassword !== confirmPassword}
                    className={confirmPassword.length > 0 && newPassword !== confirmPassword ? "border-destructive" : ""}
                  />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                  )}
                </div>
                <div>
                  <Button onClick={handlePassword} disabled={savingPassword} className="gap-2 min-h-[44px]">
                    {savingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    )}
                    {profile.hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
