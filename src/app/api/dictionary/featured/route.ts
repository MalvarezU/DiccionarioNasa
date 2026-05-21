import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [words, totalWords] = await Promise.all([
      db.dictionaryWord.findMany({
        where: { status: "PUBLISHED" },
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
      }),
      db.dictionaryWord.count({ where: { status: "PUBLISHED" } }),
    ]);

    return NextResponse.json({ words, totalWords });
  } catch (error) {
    console.error("Featured words error:", error);
    return NextResponse.json(
      { words: [], message: "Internal server error" },
      { status: 500 }
    );
  }
}
