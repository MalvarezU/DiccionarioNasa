"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Wifi, WifiOff, Settings, Shield } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SettingsDialog } from "@/components/settings-dialog"
import { cn } from "@/lib/utils"

export function NavBar() {
  const isOnline = useOnlineStatus()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = pathname === "/admin"

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

          {/* Right side: nav links + connection + settings */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Admin link */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/admin">
                    <Button
                      variant={isAdmin ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "gap-1.5 text-xs sm:text-sm",
                        isAdmin
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Shield className="h-4 w-4" />
                      <span className="hidden sm:inline">Admin</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Panel de administración</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
