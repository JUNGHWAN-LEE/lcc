"use client";

// 왼쪽 사이드바 네비게이션.
// finance-hub 스타일: bg-gray-900, 섹션 그룹, 활성 메뉴 하이라이트.
// 하단에 시스템 지표(CPU/MEM) 컴팩트 표시.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Settings,
  Command,
  Cpu,
  MemoryStick,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";

// 메뉴 구조
const NAV_SECTIONS = [
  {
    label: "모니터링",
    items: [{ href: "/", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    label: "자동화",
    items: [
      { href: "/batch", label: "배치작업", icon: Zap },
      { href: "/launchagents", label: "LaunchAgent", icon: Timer },
    ],
  },
  {
    label: "시스템",
    items: [{ href: "/settings", label: "설정", icon: Settings }],
  },
];

// CPU/MEM 지표 타입
interface Metrics {
  cpu: number;
  memPercent: number;
  memUsed: number;
  memTotal: number;
}

// MB → 읽기 좋은 형식
function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`;
  return `${mb}M`;
}

// 퍼센트 값에 따라 색상 클래스 결정
function getColorClass(p: number) {
  if (p >= 80) return "text-red-400";
  if (p >= 60) return "text-yellow-400";
  return "text-green-400";
}

export default function Sidebar() {
  const pathname = usePathname();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // 30초마다 시스템 지표 갱신
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/metrics");
        if (res.ok) {
          const d = await res.json();
          setMetrics({
            cpu: d.cpu,
            memPercent: d.memPercent,
            memUsed: d.memUsed,
            memTotal: d.memTotal,
          });
        }
      } catch {
        /* 무시 */
      }
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, []);

  // 정확히 href와 일치할 때만 활성 (startsWith 쓰면 '/'가 모든 경로에서 활성화됨)
  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-100 flex flex-col shadow-xl shrink-0">
      {/* 로고 */}
      <Link
        href="/"
        className="px-5 py-4 border-b border-gray-800 flex items-center gap-2.5 hover:bg-gray-800 transition-colors"
      >
        <Command className="text-blue-400" size={20} />
        <div>
          <div className="font-bold text-sm leading-none">LCC</div>
          <div className="text-gray-500 text-xs mt-0.5">LJH Command Center</div>
        </div>
      </Link>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive(href)
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                    }
                  `}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 하단: 시스템 지표 */}
      <div className="px-4 py-3 border-t border-gray-800 space-y-1.5">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
          System
        </p>
        {metrics ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Cpu size={12} />
                <span>CPU</span>
              </div>
              <span
                className={`font-mono font-bold ${getColorClass(metrics.cpu)}`}
              >
                {metrics.cpu}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-500">
                <MemoryStick size={12} />
                <span>MEM</span>
              </div>
              <span
                className={`font-mono font-bold ${getColorClass(metrics.memPercent)}`}
              >
                {metrics.memPercent}%
                <span className="text-gray-600 font-normal ml-1">
                  {formatMB(metrics.memUsed)}/{formatMB(metrics.memTotal)}
                </span>
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-600">지표 로딩 중...</div>
        )}
      </div>
    </aside>
  );
}
