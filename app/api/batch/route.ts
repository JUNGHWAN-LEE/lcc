// /api/batch
// GET: 전체 배치작업 목록 반환
// POST: 새 배치작업 추가

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedBatchJobs } from "@/lib/seed";

// GET /api/batch → 전체 배치작업 목록
export async function GET() {
  try {
    const db = getDb();
    // 최초 요청 시 시드 데이터 삽입 (DB가 비어있으면)
    seedBatchJobs();
    const jobs = db.prepare("SELECT * FROM batch_jobs ORDER BY id ASC").all();
    return NextResponse.json(jobs);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/batch → 새 배치작업 추가
// body: { name, description, command, working_dir }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, command, working_dir } = body;

    if (!name || !command) {
      return NextResponse.json(
        { error: "name과 command는 필수입니다." },
        { status: 400 },
      );
    }

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO batch_jobs (name, description, command, working_dir)
         VALUES (?, ?, ?, ?)`,
      )
      .run(name, description ?? null, command, working_dir ?? null);

    const newJob = db
      .prepare("SELECT * FROM batch_jobs WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json(newJob, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
