// /api/metrics
// GET: 시스템 전체 CPU, 메모리, GPU 지표 반환.
// 5초마다 폴링하는 클라이언트에서 호출됨.

import { NextResponse } from "next/server";
import { getSystemMetrics, getGpuMetrics } from "@/lib/system";

export async function GET() {
  try {
    // CPU, 메모리 지표 수집
    const systemMetrics = getSystemMetrics();

    // GPU 지표 수집 (sudo 권한 없으면 null)
    const gpuMetrics = getGpuMetrics();

    return NextResponse.json({
      cpu: systemMetrics.cpu,
      memUsed: systemMetrics.memUsed,
      memTotal: systemMetrics.memTotal,
      memPercent: systemMetrics.memPercent,
      gpuPercent: gpuMetrics?.gpuPercent ?? null,
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
