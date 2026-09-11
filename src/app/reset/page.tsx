"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NavBar } from "@/components/navbar"

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setStatus("error")
      setMessage("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (password !== confirm) {
      setStatus("error")
      setMessage("Las contraseñas no coinciden")
      return
    }
    setStatus("sending")
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setMessage("Contraseña actualizada. Ya puedes entrar.")
      } else {
        setStatus("error")
        setMessage(data.message || "No se pudo actualizar")
      }
    } catch {
      setStatus("error")
      setMessage("Error de conexión con el servidor")
    }
  }

  if (!token) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Enlace inválido</CardTitle>
          <CardDescription>
            Falta el token. Pide un nuevo enlace desde{" "}
            <Link href="/" className="underline">el inicio</Link>.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Elegir nueva contraseña</CardTitle>
        <CardDescription>Mínimo 8 caracteres. El enlace vale una vez.</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "done" ? (
          <p className="text-sm text-secondary">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <Input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
              <Input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                minLength={8}
              />
            </div>
            {status === "error" && (
              <p className="text-sm text-destructive">{message}</p>
            )}
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-10">
        <Suspense>
          <ResetForm />
        </Suspense>
      </main>
    </div>
  )
}
