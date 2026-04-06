"use client";

// LaunchAgent 관리 페이지.
// ~/Library/LaunchAgents/ plist 목록 표시 + 상태/로드/언로드/추가/수정/삭제.

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Power,
  RefreshCw,
  Clock,
  Repeat,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
} from "lucide-react";
import type { LaunchAgentInfo } from "@/lib/launchagent";

type FormState = {
  label: string;
  command: string;
  workingDir: string;
  scheduleType: "calendar" | "keepalive";
  hour: number;
  minute: number;
  weekdayOnly: boolean;
  logPath: string;
};

const EMPTY_FORM: FormState = {
  label: "",
  command: "",
  workingDir: "",
  scheduleType: "calendar",
  hour: 8,
  minute: 0,
  weekdayOnly: false,
  logPath: "",
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  running: {
    label: "실행 중",
    cls: "bg-green-950 text-green-400 border border-green-800",
  },
  stopped: {
    label: "정지",
    cls: "bg-gray-800 text-gray-400 border border-gray-700",
  },
  unloaded: {
    label: "비활성",
    cls: "bg-yellow-950 text-yellow-500 border border-yellow-800",
  },
};

const THIRD_PARTY_PREFIXES = [
  "com.google",
  "com.apple",
  "com.microsoft",
  "ai.openclaw",
];

// ProgramArguments → 표시용 명령어 + weekdayOnly 여부 추출
function parseAgentCommand(args: string[]): {
  command: string;
  weekdayOnly: boolean;
} {
  if (!args.length) return { command: "", weekdayOnly: false };
  if (args[0] === "/bin/bash" || args[0] === "/bin/sh") {
    const raw = args[args.length - 1] ?? "";
    // 평일 체크 래퍼 패턴 감지
    const m = raw.match(
      /day=\$\(date \+%u\);\s*if \[.*?\];\s*then (.+?);\s*fi\s*$/,
    );
    if (m) return { command: m[1].trim(), weekdayOnly: true };
    return { command: raw, weekdayOnly: false };
  }
  return { command: args.join(" "), weekdayOnly: false };
}

function formatSchedule(agent: LaunchAgentInfo): string {
  if (agent.scheduleType === "keepalive") return "상시 실행";
  if (agent.scheduleType === "calendar") {
    return agent.schedules
      .map(
        (s) =>
          `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`,
      )
      .join(", ");
  }
  return "-";
}

// 에이전트 → 편집 폼 초기값 변환
function agentToForm(agent: LaunchAgentInfo): FormState {
  const { command, weekdayOnly } = parseAgentCommand(agent.programArgs);
  return {
    label: agent.label,
    command,
    workingDir: agent.workingDir ?? "",
    scheduleType: agent.scheduleType === "keepalive" ? "keepalive" : "calendar",
    hour: agent.schedules[0]?.hour ?? 8,
    minute: agent.schedules[0]?.minute ?? 0,
    weekdayOnly,
    logPath: agent.logPath ?? "",
  };
}

export default function LaunchAgentsPage() {
  const [agents, setAgents] = useState<LaunchAgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // 편집 중인 label (null이면 편집 모드 아님)
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedCmd, setExpandedCmd] = useState<Set<string>>(new Set());
  const [showThirdParty, setShowThirdParty] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const fetchAgents = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/launchagents");
      if (res.ok) setAgents(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const visibleAgents = showThirdParty
    ? agents
    : agents.filter(
        (a) => !THIRD_PARTY_PREFIXES.some((p) => a.label.startsWith(p)),
      );

  // load ↔ unload 토글
  const handleToggle = async (agent: LaunchAgentInfo) => {
    const action = agent.status === "unloaded" ? "load" : "unload";
    setToggling((prev) => new Set(prev).add(agent.label));
    try {
      const res = await fetch(
        `/api/launchagents/${encodeURIComponent(agent.label)}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        showToast(
          `${agent.label}: ${action === "load" ? "활성화됨" : "비활성화됨"}`,
          "success",
        );
        setTimeout(() => fetchAgents(true), 500);
      } else {
        showToast(data.error ?? "실패", "error");
      }
    } catch {
      showToast("네트워크 오류", "error");
    } finally {
      setToggling((prev) => {
        const n = new Set(prev);
        n.delete(agent.label);
        return n;
      });
    }
  };

  // 삭제
  const handleDelete = async (label: string) => {
    if (
      !confirm(`"${label}" 을 삭제하시겠습니까?\nplist 파일이 영구 삭제됩니다.`)
    )
      return;
    setDeleting(label);
    try {
      const res = await fetch(
        `/api/launchagents/${encodeURIComponent(label)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (res.ok) {
        showToast(`${label}: 삭제됨`, "success");
        await fetchAgents();
      } else {
        showToast(data.error ?? "삭제 실패", "error");
      }
    } catch {
      showToast("네트워크 오류", "error");
    } finally {
      setDeleting(null);
    }
  };

  // 새 에이전트 등록
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.command) return;
    setSaving(true);
    try {
      const logPath = form.logPath || `/Users/jason/logs/${form.label}.log`;
      const res = await fetch("/api/launchagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, logPath }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${form.label}: 등록됨`, "success");
        setForm(EMPTY_FORM);
        setShowForm(false);
        await fetchAgents();
      } else {
        showToast(data.error ?? "등록 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // 수정 저장
  const handleSaveEdit = async (originalLabel: string) => {
    if (!editForm.label || !editForm.command) return;
    setSaving(true);
    try {
      const logPath =
        editForm.logPath || `/Users/jason/logs/${editForm.label}.log`;
      const res = await fetch(
        `/api/launchagents/${encodeURIComponent(originalLabel)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editForm, logPath }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        showToast(`${editForm.label}: 수정됨`, "success");
        setEditingLabel(null);
        await fetchAgents();
      } else {
        showToast(data.error ?? "수정 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-500 placeholder:text-gray-600";

  const runningCount = visibleAgents.filter(
    (a) => a.status === "running",
  ).length;
  const stoppedCount = visibleAgents.filter(
    (a) => a.status === "stopped",
  ).length;
  const unloadedCount = visibleAgents.filter(
    (a) => a.status === "unloaded",
  ).length;

  // 폼 공통 렌더링 (등록/수정 공용)
  const renderFormFields = (
    f: FormState,
    set: (v: FormState) => void,
    idPrefix: string,
  ) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1.5">
          Label * <span className="text-gray-600">(예: com.myapp.task)</span>
        </label>
        <input
          className={`${inputCls} font-mono`}
          value={f.label}
          onChange={(e) => set({ ...f, label: e.target.value })}
          placeholder="com.myapp.task"
          required
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1.5">
          명령어 * <span className="text-gray-600">(bash -c 로 실행)</span>
        </label>
        <input
          className={`${inputCls} font-mono`}
          value={f.command}
          onChange={(e) => set({ ...f, command: e.target.value })}
          placeholder="python3 /Users/jason/projects/batch/script.py"
          required
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          작업 디렉토리
        </label>
        <input
          className={inputCls}
          value={f.workingDir}
          onChange={(e) => set({ ...f, workingDir: e.target.value })}
          placeholder="~/projects/batch"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          로그 파일 경로
        </label>
        <input
          className={inputCls}
          value={f.logPath}
          onChange={(e) => set({ ...f, logPath: e.target.value })}
          placeholder="~/logs/myapp.log (비워두면 자동)"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">실행 유형</label>
        <select
          className={inputCls}
          value={f.scheduleType}
          onChange={(e) =>
            set({
              ...f,
              scheduleType: e.target.value as "calendar" | "keepalive",
            })
          }
        >
          <option value="calendar">스케줄 (지정 시간)</option>
          <option value="keepalive">상시 실행 (KeepAlive)</option>
        </select>
      </div>
      {f.scheduleType === "calendar" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1.5">
                시 (0-23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                className={inputCls}
                value={f.hour}
                onChange={(e) => set({ ...f, hour: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1.5">
                분 (0-59)
              </label>
              <input
                type="number"
                min={0}
                max={59}
                className={inputCls}
                value={f.minute}
                onChange={(e) => set({ ...f, minute: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id={`${idPrefix}-weekday`}
              checked={f.weekdayOnly}
              onChange={(e) => set({ ...f, weekdayOnly: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600"
            />
            <label
              htmlFor={`${idPrefix}-weekday`}
              className="text-sm text-gray-400 cursor-pointer"
            >
              평일(월~금)만 실행
            </label>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">LaunchAgent</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ~/Library/LaunchAgents/ 관리
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAgents(true)}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingLabel(null);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={16} /> 등록
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      {!loading && (
        <div className="flex gap-3 items-center">
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-950 text-green-400 border border-green-900">
            실행 중 {runningCount}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
            정지 {stoppedCount}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-950 text-yellow-500 border border-yellow-900">
            비활성 {unloadedCount}
          </span>
          <button
            onClick={() => setShowThirdParty((v) => !v)}
            className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            {showThirdParty
              ? "서드파티 숨기기"
              : `서드파티 ${agents.length - visibleAgents.length}개 숨김`}
          </button>
        </div>
      )}

      {/* 새 에이전트 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-white">
            새 LaunchAgent 등록
          </h2>
          {renderFormFields(form, setForm, "add")}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
          <Loader2 size={20} className="animate-spin mr-2" /> 로딩 중...
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleAgents.map((agent) => {
            const isEditing = editingLabel === agent.label;
            const statusStyle =
              STATUS_STYLE[agent.status] ?? STATUS_STYLE.stopped;
            const isToggling = toggling.has(agent.label);
            const isDeleting = deleting === agent.label;
            const { command: cmdStr } = parseAgentCommand(agent.programArgs);
            const isCmdExpanded = expandedCmd.has(agent.label);

            return (
              <div
                key={agent.label}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                {isEditing ? (
                  // 인라인 편집 폼
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        LaunchAgent 수정
                      </h3>
                      <button
                        onClick={() => setEditingLabel(null)}
                        className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    {renderFormFields(
                      editForm,
                      setEditForm,
                      `edit-${agent.label}`,
                    )}
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => setEditingLabel(null)}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleSaveEdit(agent.label)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-700 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 font-medium"
                      >
                        <Check size={14} /> {saving ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  // 일반 표시
                  <div className="flex items-start gap-4 px-5 py-3.5">
                    {/* Power 버튼 */}
                    <button
                      onClick={() => handleToggle(agent)}
                      disabled={isToggling}
                      title={agent.status === "unloaded" ? "load" : "unload"}
                      className={`mt-0.5 p-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
                        agent.status === "running"
                          ? "text-green-400 hover:bg-green-950"
                          : agent.status === "stopped"
                            ? "text-gray-400 hover:bg-gray-800"
                            : "text-yellow-500 hover:bg-yellow-950"
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Power size={16} />
                      )}
                    </button>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-white">
                          {agent.label}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.cls}`}
                        >
                          {statusStyle.label}
                          {agent.pid && (
                            <span className="ml-1 opacity-60">
                              pid {agent.pid}
                            </span>
                          )}
                        </span>
                        {agent.exitCode !== null && agent.exitCode !== 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertCircle size={11} /> exit {agent.exitCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-start gap-1.5">
                        <span className="text-gray-600 text-xs font-mono shrink-0 mt-0.5">
                          $
                        </span>
                        <code
                          className={`text-xs text-gray-400 font-mono leading-relaxed ${isCmdExpanded ? "break-all" : "truncate"}`}
                        >
                          {cmdStr}
                        </code>
                        {cmdStr.length > 60 && (
                          <button
                            onClick={() =>
                              setExpandedCmd((prev) => {
                                const n = new Set(prev);
                                if (n.has(agent.label)) n.delete(agent.label);
                                else n.add(agent.label);
                                return n;
                              })
                            }
                            className="text-gray-600 hover:text-gray-400 shrink-0"
                          >
                            {isCmdExpanded ? (
                              <ChevronUp size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          {agent.scheduleType === "keepalive" ? (
                            <Repeat size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                          {formatSchedule(agent)}
                        </span>
                        {agent.workingDir && (
                          <span className="text-xs text-gray-700 font-mono">
                            {agent.workingDir}
                          </span>
                        )}
                        {agent.logPath && (
                          <span className="text-xs text-gray-700 font-mono truncate max-w-48">
                            {agent.logPath}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 수정 + 삭제 버튼 */}
                    <div className="flex items-center gap-1 mt-0.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingLabel(agent.label);
                          setEditForm(agentToForm(agent));
                          setShowForm(false);
                        }}
                        className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.label)}
                        disabled={isDeleting}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-950 rounded-lg transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        {isDeleting ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl ${
            toast.type === "success"
              ? "bg-green-900 border border-green-800 text-green-300"
              : "bg-red-900 border border-red-800 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
