"use client"

import { AudiosManager } from "@/components/admin/audios-manager"

export default function AdminAudiosPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-serif font-bold text-primary">Gestión de audios</h1>
      <AudiosManager />
    </>
  )
}
