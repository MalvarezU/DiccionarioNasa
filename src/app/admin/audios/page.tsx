import { AudiosManager } from "@/components/admin/audios-manager"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminAudiosPage() {
  return (
    <>
      <AdminPageHeader title="Gestión de audios" />
      <AudiosManager />
    </>
  )
}
