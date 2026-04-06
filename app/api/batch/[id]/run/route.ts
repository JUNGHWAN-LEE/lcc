// /api/batch/[id]/run
// POST: 배치작업 실행 후 결과(stdout, stderr, exitCode) 반환

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runBatchCommand } from "@/lib/system";
import type { BatchJob } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();
    const job = db
      .prepare("SELECT * FROM batch_jobs WHERE id = ?")
      .get(Number(id)) as BatchJob | undefined;

    if (!job) {
      return NextResponse.json(
        { error: "배치작업을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const result = runBatchCommand(job.command, job.working_dir);
    return NextResponse.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
