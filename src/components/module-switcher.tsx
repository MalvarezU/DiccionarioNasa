"use client";

import Link from "next/link";
import { BookOpen, Gamepad2, GraduationCap } from "lucide-react";

const MODULES = [
  { href: "/diccionario", label: "Diccionario", icon: BookOpen, active: true },
  { href: "/juegos", label: "Juegos", icon: Gamepad2, active: false },
  { href: "/cursos", label: "Cursos", icon: GraduationCap, active: false },
] as const;

/**
 * Segmented module switcher. Diccionario renders active (ivory segment)
 * because the inline search below belongs to it; the other two segments
 * are real links to their modules.
 */
export function ModuleSwitcher() {
  return (
    <nav aria-label="Módulos">
      <ul className="flex flex-col gap-1 rounded-2xl border border-[#F6EEDC]/20 bg-black/25 p-1.5 backdrop-blur-md sm:flex-row sm:items-stretch sm:rounded-full">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li key={m.href} className="flex-1">
              <Link
                href={m.href}
                aria-current={m.active ? "page" : undefined}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container sm:rounded-full ${
                  m.active
                    ? "bg-[#F6EEDC] text-[#2F3E4E] shadow hover:bg-white"
                    : "text-[#F6EEDC] hover:bg-[#F6EEDC]/10"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
