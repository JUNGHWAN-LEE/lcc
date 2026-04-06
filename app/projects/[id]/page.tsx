"use client";

// 프로젝트 상세 페이지.
// 프로세스 상태, 제어 버튼, 실시간 로그 스트리밍 표시.

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LogViewer from "@/components/LogViewer";
import ResourceBadge from "@/components/ResourceBadge";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  ExternalLink,
  Send,
  RefreshCw,
  Folder,
  Terminal,
  FileText,
} from "lucide-react";
import type { Project } from "@/lib/db";

interface ProjectStatus {
  status: "running" | "stopped" | "unknown";
  cpu: number | null;
  mem: number | null;
}

const STATUS_CONFIG = {
  running: {
    dot: "bg-green-400",
    label: "실행 중",
    labelClass: "text-green-400",
    animate: true,
  },
  stopped: {
    dot: "bg-red-500",
    label: "중지됨",
    labelClass: "text-red-400",
    animate: false,
  },
  unknown: {
    dot: "bg-yellow-500",
    label: "알 수 없음",
    labelClass: "text-yellow-400",
    animate: false,
  },
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // 프로젝트 정보 로드
  useEffect(() => {
    const fetchProject = async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        setProject(await res.json());
      } else {
        router.push("/");
      }
    };

    const fetchStatus = async () => {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data[Number(id)] ?? null);
      }
    };

    const init = async () => {
      await Promise.all([fetchProject(), fetchStatus()]);
      setLoading(false);
    };

    init();
    // 15초마다 상태 갱신
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [id, router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleControl = async (action: "start" | "stop" | "restart") => {
    setControlling(true);
    try {
      const res = await fetch(`/api/control/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          action === "start"
            ? "프로세스가 시작됐습니다."
            : action === "stop"
              ? "프로세스가 중지됐습니다."
              : "프로세스가 재시작됐습니다.",
          "success",
        );
        // 2초 후 상태 갱신
        setTimeout(async () => {
          const statusRes = await fetch("/api/status");
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setStatus(statusData[Number(id)] ?? null);
          }
        }, 2000);
      } else {
        showToast(data.error ?? "제어 실패", "error");
      }
    } catch {
      showToast("네트워크 오류", "error");
    } finally {
      setControlling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        <RefreshCw size={24} className="animate-spin mr-3" />
        로딩 중...
      </div>
    );
  }

  if (!project) return null;

  const st = status?.status ?? "unknown";
  const config = STATUS_CONFIG[st];
  const isRunning = st === "running";

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm w-fit transition-colors"
      >
        <ArrowLeft size={16} />
        대시보드로 돌아가기
      </Link>

      {/* 프로젝트 헤더 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            {/* 이름 + 상태 */}
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${config.dot} ${config.animate ? "animate-pulse" : ""}`}
              />
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <span className={`text-sm ${config.labelClass}`}>
                {config.label}
              </span>
            </div>

            {project.description && (
              <p className="text-gray-400 text-sm">{project.description}</p>
            )}

            {/* 메타데이터 */}
            <div className="flex flex-col gap-1 mt-2 text-xs text-gray-600 font-mono">
              {project.path && (
                <div className="flex items-center gap-2">
                  <Folder size={12} />
                  <span>{project.path}</span>
                </div>
              )}
              {project.start_cmd && (
                <div className="flex items-center gap-2">
                  <Terminal size={12} />
                  <span>{project.start_cmd}</span>
                </div>
              )}
              {project.log_path && (
                <div className="flex items-center gap-2">
                  <FileText size={12} />
                  <span>{project.log_path}</span>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 리소스 + 링크 + 제어 버튼 */}
          <div className="flex flex-col gap-3 items-end flex-shrink-0">
            {/* 리소스 배지 */}
            {isRunning && (
              <ResourceBadge
                cpu={status?.cpu ?? null}
                mem={status?.mem ?? null}
              />
            )}

            {/* 링크 버튼 */}
            <div className="flex gap-2">
              {project.web_url && (
                <a
                  href={project.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-400 border border-blue-800 rounded hover:bg-blue-950 transition-colors"
                >
                  <ExternalLink size={12} />웹 UI
                </a>
              )}
              {project.telegram_url && (
                <a
                  href={project.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-400 border border-blue-800 rounded hover:bg-blue-950 transition-colors"
                >
                  <Send size={12} />
                  텔레그램
                </a>
              )}
            </div>

            {/* 제어 버튼 */}
            {(project.start_cmd || project.process_key) && (
              <div className="flex gap-2">
                {!isRunning ? (
                  <button
                    onClick={() => handleControl("start")}
                    disabled={controlling || !project.start_cmd}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-900 hover:bg-green-800 text-green-300 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={14} />
                    시작
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleControl("stop")}
                      disabled={controlling || !project.process_key}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-300 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Square size={14} />
                      중지
                    </button>
                    <button
                      onClick={() => handleControl("restart")}
                      disabled={
                        controlling ||
                        !project.process_key ||
                        !project.start_cmd
                      }
                      className="flex items-center gap-1.5 px-4 py-2 bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw size={14} />
                      재시작
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 로그 뷰어 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">실시간 로그</h2>
        <LogViewer projectId={Number(id)} logPath={project.log_path} />
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-900 border border-green-700 text-green-300"
              : "bg-red-900 border border-red-700 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
