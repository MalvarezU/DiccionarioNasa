"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  Shield,
  ShieldCheck,
  Loader2,
  Search,
  Trash2,
  Heart,
  Clock,
  AlertTriangle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  _count: {
    favorites: number
    viewHistory: number
  }
}

export function UserManagementSection() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string })?.id
  const { toast } = useToast()

  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ""
      const res = await fetch(`/api/admin/users${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
      } else if (res.status === 403) {
        setUsers([])
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para ver los usuarios",
          variant: "destructive",
        })
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleToggleRole = async (user: UserRow) => {
    const newRole = user.role === "admin" ? "user" : "admin"
    setUpdatingId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
        )
        toast({
          title: newRole === "admin" ? "Rol actualizado" : "Rol actualizado",
          description: `${user.email} ahora es ${newRole === "admin" ? "administrador" : "usuario"}`,
        })
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.message || "No se pudo actualizar el rol",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al servidor",
        variant: "destructive",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
        toast({
          title: "Usuario eliminado",
          description: `Se eliminó la cuenta de ${deleteTarget.email}`,
        })
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.message || "No se pudo eliminar el usuario",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al servidor",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gestión de Usuarios
              </CardTitle>
              <CardDescription className="mt-1">
                Administra los roles y cuentas de usuario del sistema
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {search ? "No se encontraron usuarios" : "No hay usuarios registrados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden sm:table-cell">Favoritos</TableHead>
                    <TableHead className="hidden sm:table-cell">Historial</TableHead>
                    <TableHead className="hidden md:table-cell">Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {user.name || "Sin nombre"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "admin" ? (
                          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Usuario
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          {user._count.favorites}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {user._count.viewHistory}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {user.id !== currentUserId && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                disabled={updatingId === user.id}
                                onClick={() => handleToggleRole(user)}
                              >
                                {updatingId === user.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : user.role === "admin" ? (
                                  <Shield className="h-3 w-3" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                {user.role === "admin" ? "Quitar admin" : "Hacer admin"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(user)}
                                disabled={updatingId === user.id}
                                aria-label="Eliminar usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {user.id === currentUserId && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Tú
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Eliminar este usuario?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la cuenta de{" "}
              <strong>{deleteTarget?.email}</strong> junto con todos sus favoritos e historial.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Eliminar usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
