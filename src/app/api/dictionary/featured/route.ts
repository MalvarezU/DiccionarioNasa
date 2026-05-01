import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const words = await db.dictionaryWord.findMany({
      select: {
        id: true,
        spanish: true,
        nasaYuwe: true,
        pronunciation: true,
        category: true,
        culturalContext: true,
      },
      take: 12,
      orderBy: { spanish: "asc" },
    });

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Featured words error:", error);
    return NextResponse.json(
      { words: [], message: "Internal server error" },
      { status: 500 }
    );
  }
}
