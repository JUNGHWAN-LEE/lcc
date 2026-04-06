"use client";

// 메인 대시보드 페이지.
// 이 화면은 "프로젝트 목록"과 "현재 실행 상태"를 합쳐서 보여주는 진입점이다.
//
// 큰 흐름은 아래와 같다.
// 1. `/api/projects` 에서 DB에 저장된 프로젝트 목록을 읽는다.
// 2. `/api/status` 에서 각 프로젝트 프로세스의 현재 상태를 읽는다.
// 3. 두 데이터를 합쳐서 ProjectCard 목록을 그린다.
// 4. 사용자가 시작/중지/재시작 버튼을 누르면 `/api/control/[id]` 로 명령을 보낸다.
// 5. 명령 직후에는 실제 OS 프로세스가 반영될 시간을 조금 기다린 뒤 상태를 다시 읽는다.
//
// 즉, 이 파일은 "상태를 소유하는 컨테이너" 역할이고,
// 실제 카드 UI는 components/ProjectCard.tsx 가 담당한다.

import { useEffect, useState, useCallback } from "react";
import ProjectCard from "@/components/ProjectCard";
import { RefreshCw } from "lucide-react";
import type { Project } from "@/lib/db";

interface ProjectStatus {
  status: "running" | "stopped" | "unknown";
  cpu: number | null;
  mem: number | null;
}

export default function DashboardPage() {
  // DB에서 가져온 프로젝트 기본 정보 목록
  const [projects, setProjects] = useState<Project[]>([]);
  // 프로젝트 ID를 key로 쓰는 상태 맵.
  // 예: { 1: { status: 'running', cpu: 12.3, mem: 4.1 } }
  // 배열 대신 맵을 쓰면 카드 렌더링 때 project.id 로 바로 접근할 수 있다.
  const [statusMap, setStatusMap] = useState<Record<number, ProjectStatus>>({});
  // 첫 화면 진입 시 전체 로딩 여부
  const [loading, setLoading] = useState(true);
  // 수동 새로고침 또는 주기적 갱신 중인지 표시
  const [refreshing, setRefreshing] = useState(false);
  // 현재 start/stop/restart 요청이 진행 중인 프로젝트 ID 집합.
  // Set을 쓰는 이유는 "여러 카드가 동시에 제어 중인지"를 빠르게 확인하기 쉽기 때문이다.
  const [controlling, setControlling] = useState<Set<number>>(new Set());
  // 우측 하단에 잠깐 보여줄 알림 메시지
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // 프로젝트 "정적 정보"를 가져온다.
  // 여기에는 이름, 경로, 시작 명령어 같은 설정값이 들어 있다.
  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
    }
  }, []);

  // 프로젝트 "실행 중인지 여부"와 CPU/MEM 사용량을 가져온다.
  // 상태 조회는 실시간성이 더 중요하므로 목록보다 자주 갱신한다.
  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatusMap(data);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // 첫 진입 시 목록과 상태를 한 번 읽고,
  // 이후에는 30초마다 상태만 다시 읽는다.
  // 프로젝트 목록은 자주 바뀌지 않지만 실행 상태는 자주 바뀔 수 있기 때문이다.
  useEffect(() => {
    const init = async () => {
      await fetchProjects();
      await fetchStatus();
      setLoading(false);
    };
    init();
    // 30초마다 상태 자동 갱신
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchProjects, fetchStatus]);

  // 토스트 메시지를 보여주고 3초 뒤 자동으로 숨긴다.
  // 상태 관리 라이브러리 없이도 작은 알림은 이 정도 로직이면 충분하다.
  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 사용자가 누른 제어 명령을 서버에 전달한다.
  // 실제 OS 프로세스 제어는 브라우저가 아니라 서버 API가 담당한다.
  // 브라우저는 "요청을 보냈다"와 "결과를 다시 읽었다" 정도만 책임진다.
  const handleControl = async (
    id: number,
    action: "start" | "stop" | "restart",
  ) => {
    // 같은 프로젝트 버튼을 연속 클릭하지 못하도록 제어 중 상태로 표시
    setControlling((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/control/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        const p = projects.find((p) => p.id === id);
        showToast(
          `${p?.name}: ${action === "start" ? "시작됨" : action === "stop" ? "중지됨" : "재시작됨"}`,
          "success",
        );
        // 제어 직후 즉시 상태를 읽으면 OS에 반영되기 전에 조회할 수 있다.
        // 그래서 아주 짧게 기다렸다가 다시 읽는다.
        setTimeout(fetchStatus, 2000);
        // 웹 프로젝트는 시작 직후 브라우저로 바로 열어 주면 편하다.
        // 다만 dev server 가 포트를 여는 데 시간이 걸릴 수 있어 3초 늦춘다.
        if ((action === "start" || action === "restart") && p?.web_url) {
          setTimeout(async () => {
            try {
              await fetch("/api/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: p.web_url }),
              });
            } catch {
              /* 무시 */
            }
          }, 3000);
        }
      } else {
        showToast(data.error ?? "제어 실패", "error");
      }
    } catch {
      // fetch 자체가 실패한 경우
      showToast("네트워크 오류", "error");
    } finally {
      // 성공/실패와 관계없이 버튼 잠금은 해제한다.
      setControlling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // 상단 요약 배지용 집계값
  const runningCount = Object.values(statusMap).filter(
    (s) => s.status === "running",
  ).length;
  const stoppedCount = Object.values(statusMap).filter(
    (s) => s.status === "stopped",
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        <RefreshCw size={24} className="animate-spin mr-3" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더: 요약 통계 + 갱신 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">프로젝트 대시보드</h1>
          <div className="flex gap-2 text-sm">
            <span className="bg-green-950 text-green-400 px-2 py-0.5 rounded-full">
              🟢 {runningCount}개 실행 중
            </span>
            <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded-full">
              🔴 {stoppedCount}개 중지
            </span>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 3열 프로젝트 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            // 카드에는 "기본 정보"와 "실시간 상태"를 합쳐서 넘긴다.
            project={project}
            status={statusMap[project.id] ?? null}
            onControl={handleControl}
            controlling={controlling.has(project.id)}
          />
        ))}
        {projects.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-600">
            프로젝트가 없습니다.{" "}
            <a href="/settings" className="text-blue-500 hover:underline">
              설정에서 추가하세요.
            </a>
          </div>
        )}
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
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
