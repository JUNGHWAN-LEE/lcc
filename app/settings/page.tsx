"use client";

// 설정 페이지: 프로젝트 추가/수정/삭제.
// 프로젝트 목록을 테이블로 표시하고 인라인 편집 가능.

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Check, X, ExternalLink } from "lucide-react";
import type { Project } from "@/lib/db";

// 새 프로젝트 폼의 빈 상태
const EMPTY_FORM = {
  name: "",
  description: "",
  path: "",
  start_cmd: "",
  process_key: "",
  log_path: "",
  web_url: "",
  telegram_url: "",
};

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // 편집 중인 프로젝트 ID (null이면 편집 모드 아님)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 새 프로젝트 추가
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.path) return;

    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // 빈 문자열은 null로 변환
          description: form.description || null,
          start_cmd: form.start_cmd || null,
          process_key: form.process_key || null,
          log_path: form.log_path || null,
          web_url: form.web_url || null,
          telegram_url: form.telegram_url || null,
        }),
      });
      if (res.ok) {
        showToast("프로젝트가 추가됐습니다.", "success");
        setForm(EMPTY_FORM);
        setShowForm(false);
        await fetchProjects();
      } else {
        const data = await res.json();
        showToast(data.error ?? "추가 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // 인라인 편집 시작
  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setEditForm({
      name: project.name,
      description: project.description ?? "",
      path: project.path,
      start_cmd: project.start_cmd ?? "",
      process_key: project.process_key ?? "",
      log_path: project.log_path ?? "",
      web_url: project.web_url ?? "",
      telegram_url: project.telegram_url ?? "",
    });
  };

  // 인라인 편집 저장
  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          description: editForm.description || null,
          start_cmd: editForm.start_cmd || null,
          process_key: editForm.process_key || null,
          log_path: editForm.log_path || null,
          web_url: editForm.web_url || null,
          telegram_url: editForm.telegram_url || null,
        }),
      });
      if (res.ok) {
        showToast("저장됐습니다.", "success");
        setEditingId(null);
        await fetchProjects();
      } else {
        const data = await res.json();
        showToast(data.error ?? "저장 실패", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // 프로젝트 삭제
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("삭제됐습니다.", "success");
      await fetchProjects();
    } else {
      showToast("삭제 실패", "error");
    }
  };

  // 텍스트 인풋 공통 클래스
  const inputCls =
    "bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-blue-500";

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">프로젝트 설정</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
        >
          <Plus size={16} />
          프로젝트 추가
        </button>
      </div>

      {/* 새 프로젝트 추가 폼 */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-4"
        >
          <h2 className="text-base font-semibold text-white">새 프로젝트</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">이름 *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="my-project"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">경로 *</label>
              <input
                className={inputCls}
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="~/projects/my-project"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">설명</label>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="프로젝트 설명"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                시작 명령어
              </label>
              <input
                className={inputCls}
                value={form.start_cmd}
                onChange={(e) =>
                  setForm({ ...form, start_cmd: e.target.value })
                }
                placeholder="python3 main.py"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                프로세스 키 (pgrep -f 패턴)
              </label>
              <input
                className={inputCls}
                value={form.process_key}
                onChange={(e) =>
                  setForm({ ...form, process_key: e.target.value })
                }
                placeholder="main.py"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                로그 파일 경로
              </label>
              <input
                className={inputCls}
                value={form.log_path}
                onChange={(e) => setForm({ ...form, log_path: e.target.value })}
                placeholder="~/projects/my-project/app.log"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">웹 URL</label>
              <input
                className={inputCls}
                value={form.web_url}
                onChange={(e) => setForm({ ...form, web_url: e.target.value })}
                placeholder="http://localhost:3000"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                텔레그램 URL
              </label>
              <input
                className={inputCls}
                value={form.telegram_url}
                onChange={(e) =>
                  setForm({ ...form, telegram_url: e.target.value })
                }
                placeholder="https://t.me/mybot"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-700 hover:bg-blue-600 rounded transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      )}

      {/* 프로젝트 목록 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600 text-sm">
            로딩 중...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-left px-4 py-3">경로</th>
                <th className="text-left px-4 py-3">시작 명령어</th>
                <th className="text-left px-4 py-3">프로세스 키</th>
                <th className="text-left px-4 py-3">로그</th>
                <th className="text-left px-4 py-3">링크</th>
                <th className="text-right px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-gray-800 hover:bg-gray-800/30"
                >
                  {editingId === project.id ? (
                    // 편집 모드 행
                    <>
                      <td className="px-4 py-2">
                        <input
                          className={inputCls}
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className={inputCls}
                          value={editForm.path}
                          onChange={(e) =>
                            setEditForm({ ...editForm, path: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className={inputCls}
                          value={editForm.start_cmd}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              start_cmd: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className={inputCls}
                          value={editForm.process_key}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              process_key: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className={inputCls}
                          value={editForm.log_path}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              log_path: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          <input
                            className={inputCls}
                            value={editForm.web_url}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                web_url: e.target.value,
                              })
                            }
                            placeholder="웹 URL"
                          />
                          <input
                            className={inputCls}
                            value={editForm.telegram_url}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                telegram_url: e.target.value,
                              })
                            }
                            placeholder="텔레그램 URL"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => saveEdit(project.id)}
                            disabled={saving}
                            className="p-1 text-green-400 hover:text-green-300 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // 일반 표시 행
                    <>
                      <td className="px-4 py-3 font-medium text-white">
                        {project.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-40">
                        {project.path}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-32">
                        {project.start_cmd ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-32">
                        {project.process_key ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {project.log_path ? "있음" : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {project.web_url && (
                            <a
                              href={project.web_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-400"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(project)}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(project.id, project.name)
                            }
                            className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-600 text-sm"
                  >
                    프로젝트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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
