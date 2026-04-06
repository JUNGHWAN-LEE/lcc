// PUT: LaunchAgent 수정 (unload → 재생성 → load)
// DELETE: LaunchAgent unload + plist 파일 삭제

import { NextRequest, NextResponse } from "next/server";
import { deleteAgent, updateAgent } from "@/lib/launchagent";
import type { CreateAgentConfig } from "@/lib/launchagent";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ label: string }> },
) {
  try {
    const { label } = await params;
    const body = (await req.json()) as CreateAgentConfig;
    if (!body.label || !body.command) {
      return NextResponse.json(
        { error: "label과 command는 필수입니다." },
        { status: 400 },
      );
    }
    const result = updateAgent(decodeURIComponent(label), body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ label: string }> },
) {
  try {
    const { label } = await params;
    const result = deleteAgent(decodeURIComponent(label));
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
