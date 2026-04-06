// GET: LaunchAgent 전체 목록 + 상태
// POST: 새 LaunchAgent 생성 + load

import { NextRequest, NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/launchagent";
import type { CreateAgentConfig } from "@/lib/launchagent";

export async function GET() {
  try {
    const agents = listAgents();
    return NextResponse.json(agents);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateAgentConfig;
    if (!body.label || !body.command) {
      return NextResponse.json(
        { error: "label과 command는 필수입니다." },
        { status: 400 },
      );
    }
    const result = createAgent(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
