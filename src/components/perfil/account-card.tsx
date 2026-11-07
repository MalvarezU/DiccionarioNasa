"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { PerfilProfile } from "./use-perfil-data";

interface AccountCardProps {
  profile: PerfilProfile;
  onProfileChange: (profile: PerfilProfile) => void;
}

/**
 * Cuenta y seguridad al pie de Mi espacio, COLAPSADA por defecto: lo que era
 * el cuerpo entero de /perfil (nombre editable + crear/cambiar contraseña).
 * Extraída tal cual de la página anterior; solo cambia el envoltorio.
 */
export function AccountCard({ profile, onProfileChange }: AccountCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
      onProfileChange({ ...profile, name: data.user.name });
      toast({ title: "Nombre actualizado", description: "Tu nombre se guardó correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar. Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handlePassword = async () => {
    if (profile.hasPassword && !currentPassword) {
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
      const url = profile.hasPassword ? "/api/auth/password/change" : "/api/auth/password";
      const body = profile.hasPassword
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
          title: profile.hasPassword ? "No se pudo cambiar" : "No se pudo crear",
          description: data?.message ?? "Intenta de nuevo.",
          variant: "destructive",
        });
        return;
      }
      onProfileChange({ ...profile, hasPassword: true });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: profile.hasPassword ? "Contraseña actualizada" : "Contraseña creada",
        description: profile.hasPassword
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
    <section
      aria-labelledby="perfil-cuenta-titulo"
      className="rounded-2xl border border-outline-variant/30 bg-surface-container-low"
    >
      <h2 id="perfil-cuenta-titulo" className="sr-only">
        Cuenta y seguridad
      </h2>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls="perfil-cuenta-cuerpo"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[56px] w-full items-center justify-between gap-2 rounded-2xl px-5 py-4 text-left hover:bg-surface-container-high/60"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <UserRound className="h-4 w-4 text-secondary" aria-hidden="true" />
          Cuenta y seguridad
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </Button>

      <div id="perfil-cuenta-cuerpo" className="px-5 pb-5">
        {open && (
        <div className="grid gap-6 pt-1 sm:grid-cols-2">
          <div className="grid content-start gap-4">
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

          <div className="grid content-start gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-secondary" aria-hidden="true" />
                {profile.hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.hasPassword
                  ? "Actualiza la contraseña que usas para entrar con correo."
                  : "Tu cuenta se creó con Google. Crea una contraseña si también quieres entrar con correo."}
              </p>
            </div>
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
        </div>
        )}
      </div>
    </section>
  );
}
