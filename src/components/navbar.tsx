"use client"

import { useState } from "react"
import { BookOpen, Wifi, WifiOff, Settings } from "lucide-react"
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

export function NavBar() {
  const isOnline = useOnlineStatus()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo / App Name */}
          <div className="flex items-center gap-2 shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-base tracking-tight text-foreground">
              Nasa Yuwe
            </span>
          </div>

          {/* Right side: connection + settings */}
          <div className="flex items-center gap-2 shrink-0">
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
