// /api/projects/[id]
// GET: 프로젝트 상세 조회
// PUT: 프로젝트 수정
// DELETE: 프로젝트 삭제

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/projects/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(Number(id));
    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json(project);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/projects/[id]
// body: 수정할 필드 (부분 업데이트 지원)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(Number(id));
    if (!existing) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 기존 값과 병합 (제공된 필드만 업데이트)
    const merged = { ...(existing as object), ...body };
    db.prepare(
      `
      UPDATE projects
      SET name=?, description=?, path=?, start_cmd=?, process_key=?, log_path=?, web_url=?, telegram_url=?
      WHERE id=?
    `,
    ).run(
      (merged as Record<string, unknown>).name,
      (merged as Record<string, unknown>).description ?? null,
      (merged as Record<string, unknown>).path,
      (merged as Record<string, unknown>).start_cmd ?? null,
      (merged as Record<string, unknown>).process_key ?? null,
      (merged as Record<string, unknown>).log_path ?? null,
      (merged as Record<string, unknown>).web_url ?? null,
      (merged as Record<string, unknown>).telegram_url ?? null,
      Number(id),
    );

    const updated = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(Number(id));
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = db
      .prepare("DELETE FROM projects WHERE id = ?")
      .run(Number(id));
    if (result.changes === 0) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
