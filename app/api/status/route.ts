// `/api/status`
//
// 대시보드와 상세 페이지가 공통으로 호출하는 "상태 집계 API"다.
// 이 라우트는 DB의 프로젝트 목록을 읽고, 각 프로젝트마다 OS 프로세스 상태를 확인한 뒤
// 아래 형태의 맵으로 돌려준다.
//
// {
//   1: { status: 'running', cpu: 3.2, mem: 1.1 },
//   2: { status: 'stopped', cpu: null, mem: null }
// }
//
// 포인트:
// - DB는 "설정값"을 저장하고
// - 이 API는 "현재 순간의 실제 상태"를 계산한다.
// - 그래서 이 값은 DB에 저장하지 않고 요청할 때마다 새로 만든다.

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { checkProcess, getProcessPids, getProcessStats } from "@/lib/system";
import type { Project } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const projects = db
      .prepare("SELECT * FROM projects ORDER BY id ASC")
      .all() as Project[];

    // 각 프로젝트를 같은 규칙으로 순회하며 상태를 계산한다.
    // 실제 내부 동작은 대부분 동기 함수지만, 결과를 한 번에 모아 다루기 위해 Promise.all 형태를 유지한다.
    const statuses = await Promise.all(
      projects.map(async (project) => {
        if (!project.process_key) {
          // process_key 는 "이 프로젝트 프로세스를 어떤 문자열로 찾을지"에 대한 기준이다.
          // 이 값이 없으면 pgrep 자체를 할 수 없으므로 unknown 처리한다.
          return {
            id: project.id,
            status: "unknown" as const,
            cpu: null,
            mem: null,
          };
        }

        const status = checkProcess(project.process_key);
        let cpu = null;
        let mem = null;

        if (status === "running") {
          // 하나의 프로젝트가 여러 PID를 가질 수 있지만,
          // 현재 UI는 대표 프로세스 하나의 수치만 표시한다.
          const pids = getProcessPids(project.process_key);
          if (pids.length > 0) {
            const stats = getProcessStats(pids[0]);
            if (stats) {
              cpu = stats.cpu;
              mem = stats.mem;
            }
          }
        }

        return { id: project.id, status, cpu, mem };
      }),
    );

    // 배열을 그대로 내려주지 않고 ID 기반 맵으로 바꾸면
    // 클라이언트에서 `statusMap[project.id]` 형태로 즉시 접근할 수 있다.
    const statusMap: Record<
      number,
      { status: string; cpu: number | null; mem: number | null }
    > = {};
    for (const s of statuses) {
      statusMap[s.id] = { status: s.status, cpu: s.cpu, mem: s.mem };
    }

    return NextResponse.json(statusMap);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
