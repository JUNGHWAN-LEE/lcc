// POST: LaunchAgent load ↔ unload 토글
// body: { action: 'load' | 'unload' }

import { NextRequest, NextResponse } from "next/server";
import { loadAgent, unloadAgent } from "@/lib/launchagent";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ label: string }> },
) {
  try {
    const { label } = await params;
    const { action } = (await req.json()) as { action: "load" | "unload" };
    const decoded = decodeURIComponent(label);

    const result =
      action === "load" ? loadAgent(decoded) : unloadAgent(decoded);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, action });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
