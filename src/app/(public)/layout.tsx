import type { ReactNode } from "react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"

/**
 * Chrome público persistente: NavBar + footer montados una sola vez para
 * todas las rutas del grupo (public). Al navegar entre ellas el layout no
 * se desmonta, así que `useSession` no vuelve a "loading" y el header no
 * parpadea con skeletons. Las páginas solo aportan su `<main>`.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col">{children}</div>
      <SiteFooter />
    </div>
  )
}
