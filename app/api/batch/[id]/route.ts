// /api/batch/[id]
// PUT: 배치작업 수정
// DELETE: 배치작업 삭제

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// PUT /api/batch/[id] → 배치작업 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, command, working_dir } = body;

    if (!name || !command) {
      return NextResponse.json(
        { error: "name과 command는 필수입니다." },
        { status: 400 },
      );
    }

    const db = getDb();
    db.prepare(
      `UPDATE batch_jobs SET name=?, description=?, command=?, working_dir=? WHERE id=?`,
    ).run(name, description ?? null, command, working_dir ?? null, Number(id));

    const updated = db
      .prepare("SELECT * FROM batch_jobs WHERE id = ?")
      .get(Number(id));
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/batch/[id] → 배치작업 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM batch_jobs WHERE id = ?").run(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
