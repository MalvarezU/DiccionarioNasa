"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { BookOpen, Wifi, WifiOff, Settings, Shield, LogIn, LogOut, Heart, Clock } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SettingsDialog } from "@/components/settings-dialog"
import { AuthModal } from "@/components/auth-modal"

/** Dispatch a custom event to open the favorites/history panel from the page */
function dispatchOpenPanel(tab: "favorites" | "history") {
  window.dispatchEvent(new CustomEvent("open-panel", { detail: { tab } }))
}

export function NavBar() {
  const isOnline = useOnlineStatus()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdminUser = userRole === "admin"

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Usuario"

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo / App Name — links to home */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <BookOpen className="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors" />
            <span className="font-semibold text-base tracking-tight text-foreground group-hover:text-foreground/80 transition-colors">
              Nasa Yuwe
            </span>
          </Link>

          {/* Right side: connection + auth + settings */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Connection Status */}
            {isOnline ? (
              <Badge
                variant="secondary"
                className="gap-1.5 text-[11px] font-normal"
              >
                <Wifi className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">En línea</span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1.5 text-[11px] font-normal text-amber-700 dark:text-amber-400"
              >
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">Sin conexión</span>
              </Badge>
            )}

            {/* Auth: Login button or User dropdown */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary shrink-0">
                      <span className="text-[11px] font-bold uppercase">
                        {userName.charAt(0)}
                      </span>
                    </div>
                    <span className="hidden sm:inline max-w-[100px] truncate">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => dispatchOpenPanel("favorites")}
                  >
                    <Heart className="mr-2 h-4 w-4 text-primary" />
                    Mis favoritos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => dispatchOpenPanel("history")}
                  >
                    <Clock className="mr-2 h-4 w-4 text-primary" />
                    Mi historial
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* Admin link — only visible to admin users */}
                  {isAdminUser && (
                    <DropdownMenuItem className="cursor-pointer" asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 h-4 w-4 text-primary" />
                        Panel de administración
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdminUser && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs sm:text-sm"
                onClick={() => setAuthModalOpen(true)}
              >
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            )}

            {/* Settings Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Configuración"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configuración</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Modals */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  )
}
