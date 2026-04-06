"use client";

// 상단 고정 시스템 지표 바: CPU, 메모리, GPU 사용률을 5초마다 폴링해서 표시.
// 각 지표는 색상으로 위험 수준을 표시 (녹색→노랑→빨강).

import { useEffect, useState } from "react";
import { Cpu, MemoryStick, Zap, RefreshCw } from "lucide-react";

interface Metrics {
  cpu: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
  gpuPercent: number | null;
  timestamp: number;
}

// 퍼센트 값에 따라 색상 클래스 결정
// 0~60: 녹색, 60~80: 노랑, 80+: 빨강
function getColorClass(percent: number): string {
  if (percent >= 80) return "text-red-400";
  if (percent >= 60) return "text-yellow-400";
  return "text-green-400";
}

// MB를 사람이 읽기 좋은 형식으로 변환 (1024MB → 1.0 GB)
function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb}MB`;
}

export default function SystemMetricsBar() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // 네트워크 오류는 조용히 무시 (다음 폴링에서 재시도)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // 5초마다 지표 갱신
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-6 bg-gray-900 border-b border-gray-800 px-6 py-2 text-sm">
      {/* 타이틀 */}
      <span className="text-gray-500 font-mono text-xs">SYSTEM</span>

      {loading ? (
        <span className="text-gray-600 text-xs flex items-center gap-1">
          <RefreshCw size={12} className="animate-spin" />
          로딩 중...
        </span>
      ) : metrics ? (
        <>
          {/* CPU 사용률 */}
          <div className="flex items-center gap-1.5">
            <Cpu size={14} className="text-gray-500" />
            <span className="text-gray-500">CPU</span>
            <span
              className={`font-mono font-bold ${getColorClass(metrics.cpu)}`}
            >
              {metrics.cpu}%
            </span>
          </div>

          {/* 메모리 사용률 */}
          <div className="flex items-center gap-1.5">
            <MemoryStick size={14} className="text-gray-500" />
            <span className="text-gray-500">MEM</span>
            <span
              className={`font-mono font-bold ${getColorClass(metrics.memPercent)}`}
            >
              {metrics.memPercent}%
            </span>
            <span className="text-gray-600 text-xs">
              ({formatMB(metrics.memUsed)}/{formatMB(metrics.memTotal)})
            </span>
          </div>

          {/* GPU 사용률 (sudo 권한 있을 때만 표시) */}
          {metrics.gpuPercent !== null && (
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-gray-500" />
              <span className="text-gray-500">GPU</span>
              <span
                className={`font-mono font-bold ${getColorClass(metrics.gpuPercent)}`}
              >
                {metrics.gpuPercent}%
              </span>
            </div>
          )}

          {/* 마지막 갱신 시간 */}
          <span className="ml-auto text-gray-700 text-xs">
            {new Date(metrics.timestamp).toLocaleTimeString("ko-KR")} 갱신
          </span>
        </>
      ) : (
        <span className="text-gray-600 text-xs">
          지표를 불러올 수 없습니다.
        </span>
      )}
    </div>
  );
}
