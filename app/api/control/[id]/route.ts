// `/api/control/[id]`
//
// 브라우저에서 누른 "시작 / 중지 / 재시작" 버튼을
// 실제 macOS 프로세스 제어로 바꿔 주는 API다.
//
// 여기서 중요한 개념 두 가지:
// - `start_cmd`: 무엇을 실행할지
// - `process_key`: 이미 실행 중인지 확인하거나 종료할 때 어떤 프로세스를 찾을지
//
// 즉, 시작과 중지는 서로 다른 정보에 의존한다.
// 시작은 `start_cmd`, 중지는 `process_key` 가 핵심이다.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startProcess, stopProcess, checkProcess } from "@/lib/system";
import type { Project } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: "start" | "stop" | "restart" };

    if (!["start", "stop", "restart"].includes(action)) {
      return NextResponse.json(
        { error: "action은 'start', 'stop', 'restart' 중 하나여야 합니다." },
        { status: 400 },
      );
    }

    const db = getDb();
    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(Number(id)) as Project | undefined;
    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 1. stop / restart 는 먼저 현재 프로세스를 정리한다.
    // restart 는 결국 "stop 후 start" 이므로 같은 분기에서 처리한다.
    if (action === "stop" || action === "restart") {
      if (!project.process_key) {
        return NextResponse.json(
          {
            error: "process_key가 설정되지 않아 프로세스를 중지할 수 없습니다.",
          },
          { status: 400 },
        );
      }
      const stopResult = stopProcess(project.process_key);
      if (!stopResult.success) {
        return NextResponse.json(
          { error: `중지 실패: ${stopResult.error}` },
          { status: 500 },
        );
      }

      if (action === "stop") {
        return NextResponse.json({
          success: true,
          action: "stop",
          killed: stopResult.killed,
        });
      }

      // restart 는 방금 종료한 프로세스가 완전히 내려갈 시간을 조금 준 뒤 다시 시작한다.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 2. start / restart 는 새 프로세스를 띄운다.
    if (action === "start" || action === "restart") {
      if (!project.start_cmd) {
        return NextResponse.json(
          { error: "start_cmd가 설정되지 않아 시작할 수 없습니다." },
          { status: 400 },
        );
      }

      // 단순 start 일 때는 중복 실행을 막는다.
      // restart 는 위에서 이미 stop 을 거쳤으므로 여기서 막지 않는다.
      if (action === "start" && project.process_key) {
        const currentStatus = checkProcess(project.process_key);
        if (currentStatus === "running") {
          return NextResponse.json(
            { error: "이미 실행 중입니다. restart를 사용하세요." },
            { status: 409 },
          );
        }
      }

      const startResult = startProcess(project.start_cmd, project.path);
      if (!startResult.success) {
        return NextResponse.json(
          { error: `시작 실패: ${startResult.error}` },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, action, pid: startResult.pid });
    }

    return NextResponse.json({ error: "알 수 없는 오류" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
