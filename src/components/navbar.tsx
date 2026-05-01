"use client";

import { BookOpen, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Badge } from "@/components/ui/badge";

export function NavBar() {
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo / App Name */}
        <div className="flex items-center gap-2 shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base tracking-tight text-foreground">
            Nasa Yuwe
          </span>
        </div>

        {/* Connection Status */}
        <div className="shrink-0">
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
        </div>
      </div>
    </header>
  );
}
