// `/api/logs/[id]`
//
// 프로젝트 로그 파일을 브라우저로 "실시간 밀어 넣는" 스트리밍 API다.
// 일반 JSON 응답과 달리, 응답을 한 번 보내고 끝내지 않고 연결을 계속 유지한다.
//
// 동작 방식:
// 1. DB에서 프로젝트의 `log_path` 를 읽는다.
// 2. 서버에서 `tail -n 50 -f <logPath>` 프로세스를 띄운다.
// 3. tail 출력이 들어올 때마다 SSE 형식으로 브라우저에 전달한다.
// 4. 브라우저 탭이 닫히거나 이동하면 abort 이벤트가 발생하고 tail 도 종료한다.
//
// 즉, 이 Route는 "파일 로그"와 "브라우저 실시간 화면" 사이의 다리 역할이다.

import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { spawn } from "child_process";
import { expandPath } from "@/lib/system";
import type { Project } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(Number(id)) as Project | undefined;

  if (!project) {
    return new Response("프로젝트를 찾을 수 없습니다.", { status: 404 });
  }

  if (!project.log_path) {
    return new Response(
      "이 프로젝트에는 로그 파일 경로가 설정되지 않았습니다.",
      { status: 400 },
    );
  }

  const logPath = expandPath(project.log_path);

  // 브라우저로 바이트를 흘려보내기 위해 TextEncoder 를 사용한다.
  const encoder = new TextEncoder();

  // ReadableStream 은 "원하는 시점에 데이터를 조금씩 밀어 넣을 수 있는 응답 본문"이다.
  // SSE는 이 스트림에 `data: ...\n\n` 형식의 문자열을 계속 enqueue 하면서 구현한다.
  const stream = new ReadableStream({
    start(controller) {
      // tail -n 50: 마지막 50줄부터 시작, -f: 실시간 추가 감지
      const tail = spawn("tail", ["-n", "50", "-f", logPath]);

      // tail 이 새 로그를 출력할 때마다 브라우저 onmessage 로 보낼 이벤트를 만든다.
      // SSE 형식은 반드시 `data: ...` 뒤에 빈 줄(`\n\n`)이 와야 이벤트 하나가 끝난다.
      tail.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line) {
            // 로그에 따옴표, 특수문자가 들어와도 안전하게 보내기 위해 JSON 문자열로 감싼다.
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
            );
          }
        }
      });

      // tail 자체 오류도 일반 로그 줄처럼 흘려 보내면 화면에서 바로 볼 수 있다.
      tail.stderr.on("data", (chunk: Buffer) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify("[오류] " + chunk.toString())}\n\n`,
          ),
        );
      });

      tail.on("close", () => {
        controller.close();
      });

      // 사용자가 페이지를 떠나면 서버도 더 이상 tail 을 유지할 이유가 없다.
      // 이 정리가 없으면 탭을 열었다 닫을 때 tail 프로세스가 누적될 수 있다.
      req.signal.addEventListener("abort", () => {
        tail.kill("SIGTERM");
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      // 브라우저가 이 응답을 "스트림"으로 해석하게 만드는 핵심 헤더들
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // 같은 앱에서 주로 호출하지만, 로컬 개발 중 편의를 위해 허용
      "Access-Control-Allow-Origin": "*",
    },
  });
}
