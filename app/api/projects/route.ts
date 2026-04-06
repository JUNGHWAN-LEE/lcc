// /api/projects
// GET: 전체 프로젝트 목록 반환
// POST: 새 프로젝트 추가

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedProjects } from "@/lib/seed";

// GET /api/projects → 전체 프로젝트 목록
export async function GET() {
  try {
    const db = getDb();
    // 최초 요청 시 시드 데이터 삽입 (DB가 비어있으면)
    seedProjects();

    const projects = db.prepare("SELECT * FROM projects ORDER BY id ASC").all();
    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/projects → 새 프로젝트 추가
// body: { name, description, path, start_cmd, process_key, log_path, web_url, telegram_url }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      path,
      start_cmd,
      process_key,
      log_path,
      web_url,
      telegram_url,
    } = body;

    if (!name || !path) {
      return NextResponse.json(
        { error: "name과 path는 필수입니다." },
        { status: 400 },
      );
    }

    const db = getDb();
    const result = db
      .prepare(
        `
      INSERT INTO projects (name, description, path, start_cmd, process_key, log_path, web_url, telegram_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        name,
        description ?? null,
        path,
        start_cmd ?? null,
        process_key ?? null,
        log_path ?? null,
        web_url ?? null,
        telegram_url ?? null,
      );

    const newProject = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json(newProject, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
