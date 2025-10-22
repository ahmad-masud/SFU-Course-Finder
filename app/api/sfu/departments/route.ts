import { NextRequest, NextResponse } from "next/server";
import { fetchSfu } from "@/lib/sfuApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const term = searchParams.get("term");
  if (!year || !term) {
    return NextResponse.json({ error: "Missing year or term" }, { status: 400 });
  }
  const result = await fetchSfu([year, term]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, url: result.url }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
