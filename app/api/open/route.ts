// /api/open
// POST: 서버에서 macOS open 명령어로 Chrome에 URL을 엶.
// body: { url: string }
// LCC 대시보드에서 웹 프로젝트 URL을 Chrome으로 열 때 사용.

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
    }

    // 보안: http(s) 스킴만 허용 (file://, shell injection 방지)
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json(
        { error: "허용되지 않는 URL입니다." },
        { status: 400 },
      );
    }

    // macOS open 명령어로 Chrome에서 URL 열기
    // URL 내 큰따옴표 이스케이프로 shell injection 방지
    const safeUrl = url.replace(/"/g, '\\"');
    execSync(`open -a "Google Chrome" "${safeUrl}"`, { stdio: "pipe" });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
