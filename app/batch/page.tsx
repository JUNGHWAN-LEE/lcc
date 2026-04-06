"use client";

// 배치작업 페이지: 버튼 하나로 shell 명령어 실행 및 결과 확인.
// 배치 목록 카드 + 추가/수정/삭제 + 실행 결과 인라인 표시.

import { useEffect, useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  Edit2,
  Check,
  X,
  Terminal,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import type { BatchJob } from "@/lib/db";

interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

const EMPTY_FORM = { name: "", description: "", command: "", working_dir: "" };

export default function BatchPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  // 실행 중인 배치 ID 집합
  const [running, setRunning] = useState<Set<number>>(new Set());
  // 배치별 실행 결과
  const [results, setResults] = useState<Record<number, RunResult>>({});
  // 결과 패널 열림 여부
  const [openResults, setOpenResults] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const fetchJobs = async () => {
    const res = await fetch("/api/batch");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 배치 실행
  const handleRun = async (job: BatchJob) => {
    setRunning((prev) => new Set(prev).add(job.id));
    setOpenResults((prev) => new Set(prev).add(job.id));
    // 이전 결과 초기화
    setResults((prev) => {
      const n = { ...prev };
      delete n[job.id];
      return n;
    });

    try {
      const res = await fetch(`/api/batch/${job.id}/run`, { method: "POST" });
      const data: RunResult = await res.json();
      setResults((prev) => ({ ...prev, [job.id]: data }));
      showToast(
        `${job.name}: ${data.success ? `완료 (exit ${data.exitCode})` : `실패 (exit ${data.exitCode})`}`,
        data.success ? "success" : "error",
      );
    } catch {
      setResults((prev) => ({
        ...prev,
        [job.id]: {
          success: false,
          stdout: "",
          stderr: "네트워크 오류",
          exitCode: -1,
        },
      }));
      showToast("네트워크 오류", "error");
    } finally {
      setRunning((prev) => {
        const n = new Set(prev);
        n.delete(job.id);
        return n;
      });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.command) return;
    setSaving(true);
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          command: form.command,
          working_dir: form.working_dir || null,
        }),
      });
      if (res.ok) {
        showToast("배치작업이 추가됐습니다.", "success");
        setForm(EMPTY_FORM);
        setShowForm(false);
        await fetchJobs();
      } else {
        const d = await res.json();
        showToast(d.error ?? "추가 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: number) => {
    if (!editForm.name || !editForm.command) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/batch/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          command: editForm.command,
          working_dir: editForm.working_dir || null,
        }),
      });
      if (res.ok) {
        showToast("저장됐습니다.", "success");
        setEditingId(null);
        await fetchJobs();
      } else {
        const d = await res.json();
        showToast(d.error ?? "저장 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 배치작업을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/batch/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("삭제됐습니다.", "success");
      await fetchJobs();
    } else showToast("삭제 실패", "error");
  };

  const toggleResult = (id: number) => {
    setOpenResults((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const inputCls =
    "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-blue-500 placeholder:text-gray-600";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">배치작업</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            버튼 하나로 스크립트 즉시 실행
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
        >
          <Plus size={16} />
          배치 추가
        </button>
      </div>

      {/* 새 배치 추가 폼 */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-white">새 배치작업</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                이름 *
              </label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="DB 백업"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                작업 디렉토리
              </label>
              <input
                className={inputCls}
                value={form.working_dir}
                onChange={(e) =>
                  setForm({ ...form, working_dir: e.target.value })
                }
                placeholder="~/projects/batch"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">설명</label>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="배치 설명"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">
                명령어 *{" "}
                <span className="text-gray-600">(bash -c 로 실행)</span>
              </label>
              <input
                className={`${inputCls} font-mono`}
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="python3 script.py"
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      )}

      {/* 배치작업 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
          <Loader2 size={20} className="animate-spin mr-2" />
          로딩 중...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-600 text-sm">
          배치작업이 없습니다. 위의 버튼으로 추가하세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {editingId === job.id ? (
                // 편집 모드
                <div className="p-5 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">
                        이름 *
                      </label>
                      <input
                        className={inputCls}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">
                        작업 디렉토리
                      </label>
                      <input
                        className={inputCls}
                        value={editForm.working_dir}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            working_dir: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1.5">
                        설명
                      </label>
                      <input
                        className={inputCls}
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1.5">
                        명령어 *
                      </label>
                      <input
                        className={`${inputCls} font-mono`}
                        value={editForm.command}
                        onChange={(e) =>
                          setEditForm({ ...editForm, command: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                    >
                      <X size={14} /> 취소
                    </button>
                    <button
                      onClick={() => saveEdit(job.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-green-700 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check size={14} /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                // 일반 모드
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-semibold text-white text-sm">
                        {job.name}
                      </span>
                      {job.description && (
                        <span className="text-gray-500 text-xs">
                          {job.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Terminal size={11} className="text-gray-600 shrink-0" />
                      <code className="text-xs text-gray-500 font-mono truncate">
                        {job.command}
                      </code>
                      {job.working_dir && (
                        <span className="text-gray-700 text-xs shrink-0 font-mono">
                          ({job.working_dir})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* 결과 토글 버튼 */}
                    {results[job.id] && (
                      <button
                        onClick={() => toggleResult(job.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                          results[job.id].success
                            ? "bg-green-950 text-green-400 hover:bg-green-900"
                            : "bg-red-950 text-red-400 hover:bg-red-900"
                        }`}
                      >
                        {openResults.has(job.id) ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                        {results[job.id].success ? "성공" : "실패"} ·{" "}
                        {results[job.id].exitCode}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingId(job.id);
                        setEditForm({
                          name: job.name,
                          description: job.description ?? "",
                          command: job.command,
                          working_dir: job.working_dir ?? "",
                        });
                      }}
                      className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(job.id, job.name)}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => handleRun(job)}
                      disabled={running.has(job.id)}
                      className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {running.has(job.id) ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          실행 중
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          실행
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 실행 결과 패널 */}
              {results[job.id] && openResults.has(job.id) && (
                <div className="border-t border-gray-800">
                  {results[job.id].stdout && (
                    <pre className="px-5 py-3 text-xs font-mono text-gray-300 bg-gray-950 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                      {results[job.id].stdout}
                    </pre>
                  )}
                  {results[job.id].stderr && (
                    <pre
                      className={`px-5 py-3 text-xs font-mono text-red-400 bg-gray-950 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed ${results[job.id].stdout ? "border-t border-gray-800" : ""}`}
                    >
                      {results[job.id].stderr}
                    </pre>
                  )}
                  {!results[job.id].stdout && !results[job.id].stderr && (
                    <div className="px-5 py-3 text-xs text-gray-600">
                      (출력 없음)
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 토스트 알림 */}
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
