import { NextRequest, NextResponse } from "next/server";
import { fetchSfu } from "@/lib/sfuApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const term = searchParams.get("term");
  const dept = searchParams.get("dept");
  const number = searchParams.get("number");
  const section = searchParams.get("section");
  if (!year || !term || !dept || !number || !section) {
    return NextResponse.json({ error: "Missing one or more required params: year, term, dept, number, section" }, { status: 400 });
  }
  const result = await fetchSfu([year, term, dept, number, section]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, url: result.url }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
