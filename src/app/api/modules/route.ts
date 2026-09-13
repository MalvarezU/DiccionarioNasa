import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { createModule } from "../courses/_lib"

/** POST /api/modules { courseId, title } (editor+) */
export async function POST(request: NextRequest) {
  const { error } = await requireRole("editor")
  if (error) return error
  return createModule(request)
}
