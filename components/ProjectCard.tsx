"use client";

// 개별 프로젝트 상태 카드.
// 실행 상태(🟢/🔴/🟡), 리소스 사용량, 링크, 시작/중지 버튼 표시.

import Link from "next/link";
import {
  ExternalLink,
  Send,
  Play,
  Square,
  RotateCcw,
  FileText,
  Globe,
} from "lucide-react";
import ResourceBadge from "./ResourceBadge";
import type { Project } from "@/lib/db";

interface ProjectStatus {
  status: "running" | "stopped" | "unknown";
  cpu: number | null;
  mem: number | null;
}

interface ProjectCardProps {
  project: Project;
  status: ProjectStatus | null;
  // 제어 버튼 클릭 시 부모에게 알림 (대시보드에서 상태 갱신)
  onControl: (id: number, action: "start" | "stop" | "restart") => void;
  controlling: boolean; // 현재 제어 명령 실행 중 여부
}

// 상태에 따른 표시 설정
const STATUS_CONFIG = {
  running: {
    dot: "bg-green-400",
    label: "실행 중",
    labelClass: "text-green-400",
  },
  stopped: { dot: "bg-red-500", label: "중지됨", labelClass: "text-red-400" },
  unknown: {
    dot: "bg-yellow-500",
    label: "알 수 없음",
    labelClass: "text-yellow-400",
  },
};

// 서버에서 Chrome으로 URL 열기 (macOS open -a "Google Chrome")
async function openInChrome(url: string) {
  try {
    await fetch("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    // Chrome 열기 실패는 UX에 영향 없으므로 무시
  }
}

export default function ProjectCard({
  project,
  status,
  onControl,
  controlling,
}: ProjectCardProps) {
  const st = status?.status ?? "unknown";
  const config = STATUS_CONFIG[st];
  const isRunning = st === "running";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      {/* 헤더: 이름 + 상태 표시 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* 상태 점 (깜빡임 효과: 실행 중일 때) */}
            <span
              className={`flex-shrink-0 w-2 h-2 rounded-full ${config.dot} ${isRunning ? "animate-pulse" : ""}`}
            />
            <Link
              href={`/projects/${project.id}`}
              className="font-semibold text-white truncate hover:text-blue-400 transition-colors"
            >
              {project.name}
            </Link>
          </div>
          <span className={`text-xs ${config.labelClass} pl-4`}>
            {config.label}
          </span>
        </div>

        {/* 외부 링크 버튼들 */}
        <div className="flex gap-1 flex-shrink-0">
          {project.web_url && (
            <button
              onClick={() => openInChrome(project.web_url!)}
              className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
              title="Chrome에서 열기"
            >
              <ExternalLink size={14} />
            </button>
          )}
          {project.telegram_url && (
            <a
              href={project.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
              title="텔레그램 봇"
            >
              <Send size={14} />
            </a>
          )}
          <Link
            href={`/projects/${project.id}`}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="상세 보기"
          >
            <FileText size={14} />
          </Link>
        </div>
      </div>

      {/* 설명 */}
      {project.description && (
        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
          {project.description}
        </p>
      )}

      {/* 리소스 배지 (실행 중일 때만) */}
      {isRunning && (
        <ResourceBadge cpu={status?.cpu ?? null} mem={status?.mem ?? null} />
      )}

      {/* 제어 버튼: start_cmd가 있을 때만 표시 */}
      {(project.start_cmd || project.process_key) && (
        <div className="flex gap-1.5 mt-auto pt-2 border-t border-gray-800">
          {!isRunning ? (
            // 중지 상태: 시작 버튼
            <button
              onClick={() => onControl(project.id, "start")}
              disabled={controlling || !project.start_cmd}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-900 hover:bg-green-800 text-green-300 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={12} />
              시작
            </button>
          ) : (
            <>
              {/* 실행 중: 중지 + 재시작 버튼 */}
              <button
                onClick={() => onControl(project.id, "stop")}
                disabled={controlling || !project.process_key}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-900 hover:bg-red-800 text-red-300 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square size={12} />
                중지
              </button>
              <button
                onClick={() => onControl(project.id, "restart")}
                disabled={
                  controlling || !project.process_key || !project.start_cmd
                }
                className="flex items-center gap-1 px-2.5 py-1 bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={12} />
                재시작
              </button>
              {/* 웹 프로젝트: 실행 중일 때 Chrome 열기 버튼 */}
              {project.web_url && (
                <button
                  onClick={() => openInChrome(project.web_url!)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs rounded transition-colors"
                >
                  <Globe size={12} />웹 열기
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
