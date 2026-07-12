import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function DemoBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 text-[10px] font-normal bg-tertiary/5 text-tertiary border-tertiary/30"
    >
      <Sparkles className="h-2.5 w-2.5" />
      Demo
    </Badge>
  )
}