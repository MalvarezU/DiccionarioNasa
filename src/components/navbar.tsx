"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { BookOpen, Wifi, WifiOff, Settings, Shield, LogIn, LogOut, Heart, Clock, Gamepad2, GraduationCap, UserRound, UserPlus } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { usePwaMode } from "@/hooks/use-pwa-mode"
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
import { WelcomeGate } from "@/components/welcome-gate"
import { SkipLink } from "@/components/skip-link"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthModal, type AuthModalMode } from "@/components/auth-modal"

/** Open the favorites/history panel.
 *  - On /diccionario: dispatch the in-page "open-panel" event (no navigation).
 *  - Elsewhere: navigate to /diccionario with ?panel=... so the page opens it.
 */
function dispatchOpenPanel(
  tab: "favorites" | "history",
  pathname: string | null,
  router: { push: (href: string) => void },
) {
  if (pathname === "/diccionario") {
    window.dispatchEvent(new CustomEvent("open-panel", { detail: { tab } }))
  } else {
    router.push(`/diccionario?panel=${tab}`)
  }
}

/** Los 3 módulos de la plataforma Piiyaak. */
const NAV_ITEMS = [
  { href: "/diccionario", label: "Diccionario", icon: BookOpen },
  { href: "/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/cursos", label: "Cursos", icon: GraduationCap },
] as const

export function NavBar() {
  const isOnline = useOnlineStatus()
  const { isPwa, ready } = usePwaMode()
  const pathname = usePathname()
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthModalMode>("login")
  const openAuth = (mode: AuthModalMode) => {
    setAuthMode(mode)
    setAuthModalOpen(true)
  }
  const handleAuthOpenChange = (v: boolean) => {
    // Al cerrar se vuelve al modo login: el aviso ?auth=required del
    // middleware siempre abre en login sin setState dentro del efecto.
    if (!v) setAuthMode("login")
    setAuthModalOpen(v)
  }
  const { data: session, status } = useSession()
  const isAuthenticated = !!session?.user
  const isLoadingSession = status === "loading"
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdminUser = userRole === "admin"
  const canUsePanel = userRole === "admin" || userRole === "editor"

  // El proxy manda acá con ?auth=required|expired cuando piden /admin
  // sin sesión válida: se abre el login solo y se limpia la URL (sin
  // Suspense: se lee window en el efecto, no useSearchParams).
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const motivo = params.get("auth")
    if (motivo === "required" || motivo === "expired") {
      setAuthModalOpen(true)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Usuario"

  /** Hero overlay: while the hero photo is behind the header, the
   *  header floats frosted over it (ivory items); past the hero it uses
   *  the standard solid header. Applies to the two hero routes ("/" and
   *  "/diccionario"); every other route keeps the sticky header. Fixed
   *  in BOTH hero states so the switch never shifts layout 56px.
   *  Initial false + sync check in effect: no window read during render,
   *  so no hydration mismatch. */
  const hasHero = pathname === "/" || pathname === "/diccionario"
  const [heroTop, setHeroTop] = useState(false)
  const isHeroTop = hasHero && heroTop

  useEffect(() => {
    if (!hasHero) return
    let raf = 0
    const check = () => {
      const hero = document.querySelector("[data-hero]")
      setHeroTop((hero?.getBoundingClientRect().bottom ?? 0) > 56)
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
    // Re-run on route change so the threshold always measures the
    // current page hero ("/" and "/diccionario" each own one).
  }, [hasHero, pathname])

  /** Ruta activa: prefijo exacto (o "/" para la portada). SSR: pathname es null. */
  const isActive = (href: string) =>
    !pathname ? false : href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <>
      <SkipLink />
      {isHeroTop && (
        <style>{`@supports not (backdrop-filter: blur(4px)){.navbar-hero-top{background-color:rgb(14 42 34/.9)}}@media (prefers-contrast: more){.navbar-hero-top{background-color:rgb(14 42 34/.9)}}`}</style>
      )}
      <header
        className={
          isHeroTop
            ? "fixed inset-x-0 top-0 z-50 h-14 bg-montana-deep/25 backdrop-blur-sm backdrop-brightness-[.92] border-b border-crema/10 motion-safe:transition-[background-color,border-color] motion-safe:duration-300 navbar-hero-top"
            : hasHero
              ? "fixed inset-x-0 top-0 z-50 w-full border-b border-outline-variant/20 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 motion-safe:transition-[background-color,border-color] motion-safe:duration-300"
              : "sticky top-0 z-50 w-full border-b border-outline-variant/20 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90"
        }
        style={isHeroTop ? { textShadow: "0 1px 3px rgba(0,0,0,.5)" } : undefined}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo / App Name — links to home.
              logoPiiyaakblanco.png is the white badge version (transparent
              background); the serif wordmark stays for legibility at small
              sizes. */}
          <Link
            href="/"
            className={`flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isHeroTop
                ? "focus-visible:outline-crema"
                : "focus-visible:outline-primary"
            } group`}
          >
            <Image
              src="/logoPiiyaakblanco.png"
              alt="Piiyaak"
              width={25}
              height={28}
              priority
              className={
                isHeroTop
                  ? "h-7 w-auto rounded-md ring-1 ring-crema/25"
                  : "h-7 w-auto rounded-md ring-1 ring-black/10"
              }
            />
            <span
              className={
                isHeroTop
                  ? "hidden min-[400px]:inline font-serif font-semibold text-lg tracking-tight text-crema/90 transition-colors group-hover:text-crema"
                  : "hidden min-[400px]:inline font-serif font-semibold text-lg tracking-tight text-primary group-hover:text-primary/80 transition-colors"
              }
            >
              Piiyaak
            </span>
          </Link>

          {/* Center nav links — en la portada la elección de módulo se hace
              desde el hero, así que acá no se duplican */}
          {pathname !== "/" && (
            <>
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`link-underline-terracota flex items-center gap-1.5 px-1 py-1.5 rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      isHeroTop
                        ? "focus-visible:outline-crema"
                        : "focus-visible:outline-primary"
                    } ${
                      isActive(item.href)
                        ? isHeroTop
                          ? "text-crema"
                          : "text-primary"
                        : isHeroTop
                          ? "text-crema/85 hover:text-crema"
                          : "text-foreground/80 hover:text-primary"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <nav className="flex md:hidden items-center gap-0.5" aria-label="Secciones">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[56px] px-2 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      isHeroTop
                        ? "focus-visible:outline-crema"
                        : "focus-visible:outline-primary"
                    } ${
                      isActive(item.href)
                        ? isHeroTop
                          ? "text-crema bg-crema/15"
                          : "text-primary bg-primary/10"
                        : isHeroTop
                          ? "text-crema/85 hover:text-crema hover:bg-crema/10"
                          : "text-foreground/80 bg-card hover:text-primary hover:bg-surface-container-high"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs leading-none font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}

          {/* Right side: connection + auth + settings */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Connection Status — PWA-only: hidden in regular browser tabs */}
            {ready &&
              isPwa &&
              (isOnline ? (
                <Badge
                  variant="secondary"
                  className={
                    isHeroTop
                      ? "gap-1.5 text-2xs font-normal bg-crema/10 text-crema border border-crema/20"
                      : "gap-1.5 text-2xs font-normal bg-secondary/10 text-secondary border border-secondary/20"
                  }
                >
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">En línea</span>
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className={
                    isHeroTop
                      ? "gap-1.5 text-2xs font-normal bg-crema/10 text-crema border border-crema/20"
                      : "gap-1.5 text-2xs font-normal bg-tertiary/10 text-tertiary border border-tertiary/20"
                  }
                >
                  <WifiOff className={isHeroTop ? "h-3 w-3 text-tertiary-fixed" : "h-3 w-3"} />
                  <span className="hidden sm:inline">Sin conexión</span>
                </Badge>
              ))}

            {/* Auth: skeleton mientras carga la sesión, luego login o dropdown */}
            {isLoadingSession ? (
              <div className="flex items-center gap-2 px-2" aria-busy="true" aria-label="Cargando sesión">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="hidden sm:block h-4 w-20" />
              </div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      isHeroTop
                        ? "gap-1.5 text-xs sm:text-sm text-crema/90 hover:text-crema hover:bg-crema/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
                        : "gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                    }
                  >
                    <div
                      className={
                        isHeroTop
                          ? "flex items-center justify-center h-6 w-6 rounded-full bg-crema/10 text-crema shrink-0"
                          : "flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary shrink-0"
                      }
                    >
                      <span className="text-2xs font-bold uppercase">
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
                    onClick={() => dispatchOpenPanel("favorites", pathname, router)}
                  >
                    <Heart className="mr-2 h-4 w-4 text-primary" />
                    Mis favoritos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => dispatchOpenPanel("history", pathname, router)}
                  >
                    <Clock className="mr-2 h-4 w-4 text-primary" />
                    Mi historial
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link href="/perfil">
                      <UserRound className="mr-2 h-4 w-4 text-primary" />
                      Mi perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* Admin link — visible para admin y editor */}
                  {canUsePanel && (
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
              <>
              <Button
                variant="ghost"
                size="sm"
                className={
                  isHeroTop
                    ? "gap-1.5 text-xs sm:text-sm text-crema/90 hover:text-crema hover:bg-crema/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
                    : "gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                }
                onClick={() => openAuth("register")}
                aria-label="Registrarme"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden min-[400px]:inline">Registrarme</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className={
                  isHeroTop
                    ? "gap-1.5 text-xs sm:text-sm bg-crema text-primary hover:bg-background transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
                    : "gap-1.5 text-xs sm:text-sm bg-primary hover:bg-montana-deep transition-colors"
                }
                onClick={() => openAuth("login")}
                aria-label="Iniciar sesión"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden min-[400px]:inline">Iniciar sesión</span>
              </Button>
              </>
            )}

            {/* Settings Button — PWA-only: hidden in regular browser tabs */}
            {ready && isPwa && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={
                        isHeroTop
                          ? "size-8 text-crema/90 hover:text-crema hover:bg-crema/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
                          : "size-8 text-muted-foreground hover:text-foreground"
                      }
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
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AuthModal open={authModalOpen} onOpenChange={handleAuthOpenChange} initialMode={authMode} />
      <WelcomeGate />
    </>
  )
}
