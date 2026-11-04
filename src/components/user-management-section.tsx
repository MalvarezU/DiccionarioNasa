"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  Shield,
  ShieldCheck,
  Pencil,
  Loader2,
  Search,
  Trash2,
  Heart,
  Clock,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UsersTableSkeleton } from "@/components/skeletons"
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
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

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
  const [totalUsers, setTotalUsers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // El input tipea al instante; el GET espera 300ms sin cambios.
  const debouncedSearch = useDebouncedValue(search)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      // pageSize=100 (máximo): el panel no pagina aún; con esto se mantiene
      // el comportamiento previo para instalaciones reales (<100 usuarios)
      // y la API queda acotada.
      const query = new URLSearchParams({ pageSize: "100" })
      if (debouncedSearch) query.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/users?${query}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
        setTotalUsers(typeof data.total === "number" ? data.total : (data.users ?? []).length)
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
  }, [debouncedSearch, toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const ROLE_LABELS: Record<string, string> = {
    user: "usuario",
    editor: "editor",
    admin: "administrador",
  }

  const nextRole = (role: string) =>
    role === "admin" ? "user" : role === "editor" ? "admin" : "editor"

  const handleToggleRole = async (user: UserRow) => {
    const newRole = nextRole(user.role)
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
          title: "Rol actualizado",
          description: `${user.email} ahora es ${ROLE_LABELS[newRole] ?? newRole}`,
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
                {totalUsers > 0 && (
                  <span aria-live="polite">
                    {" "}· {totalUsers} usuario{totalUsers !== 1 ? "s" : ""} en total
                  </span>
                )}
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
            <UsersTableSkeleton />
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-12">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {search ? "No se encontraron usuarios" : "No hay usuarios registrados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-muted/40">
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
                        ) : user.role === "editor" ? (
                          <Badge className="gap-1 bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/20">
                            <Pencil className="h-3 w-3" />
                            Editor
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Usuario
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          {user._count?.favorites ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {user._count?.viewHistory ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm tabular-nums text-muted-foreground md:table-cell">
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
                                {user.role === "admin" ? "A usuario" : user.role === "editor" ? "A admin" : "A editor"}
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
                            <Badge variant="outline" className="text-2xs text-muted-foreground">
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
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        titulo="¿Eliminar este usuario?"
        descripcion={
          <>
            Se eliminará permanentemente la cuenta de{" "}
            <strong>{deleteTarget?.email}</strong> junto con todos sus favoritos e historial.
            Esta acción no se puede deshacer.
          </>
        }
        accionLabel="Eliminar usuario"
        processing={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
