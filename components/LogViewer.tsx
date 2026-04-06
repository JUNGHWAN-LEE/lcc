"use client";

// 실시간 로그 뷰어.
//
// 이 컴포넌트는 브라우저의 EventSource API로 `/api/logs/[id]` 에 연결한다.
// 서버는 SSE(Server-Sent Events) 형식으로 로그 한 줄씩 보내고,
// 이 컴포넌트는 그 줄들을 배열에 쌓아서 화면에 뿌린다.
//
// 핵심 포인트:
// - 로그는 "한 번 받아오는" 것이 아니라 스트림으로 계속 들어온다.
// - 일시정지 시에는 화면에 바로 그리지 않고 bufferRef 에 임시 저장한다.
// - 줄 수가 너무 많아지면 메모리를 아끼기 위해 오래된 줄부터 버린다.

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Pause, Play, Trash2 } from "lucide-react";

interface LogViewerProps {
  projectId: number;
  logPath: string | null;
}

const MAX_LOG_LINES = 500; // 메모리 절약: 최대 500줄만 유지

export default function LogViewer({ projectId, logPath }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 현재 살아 있는 EventSource 연결 객체
  const sourceRef = useRef<EventSource | null>(null);
  // pause 상태일 때는 화면 대신 여기에 로그를 잠시 쌓아 둔다.
  const bufferRef = useRef<string[]>([]);

  const connect = useCallback(() => {
    // 재연결 전에 기존 연결이 남아 있으면 먼저 닫는다.
    if (sourceRef.current) {
      sourceRef.current.close();
    }
    setError(null);
    // 재연결은 "새 스트림을 처음부터 다시 본다"는 의미로 간주해 화면도 비운다.
    setLines([]);

    // EventSource: SSE 연결 (브라우저 기본 API)
    const source = new EventSource(`/api/logs/${projectId}`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);

    source.onmessage = (event) => {
      // 서버가 `JSON.stringify(line)` 형태로 보냈기 때문에 다시 parse 해서 원래 문자열로 꺼낸다.
      const line = JSON.parse(event.data) as string;

      if (paused) {
        // 일시정지 중에는 스크롤이 흔들리지 않게 화면 업데이트를 멈추고 버퍼에만 저장한다.
        bufferRef.current.push(line);
      } else {
        setLines((prev) => {
          const next = [...prev, line];
          // 최신 로그가 더 중요하므로 앞쪽(가장 오래된 줄)부터 잘라 낸다.
          return next.length > MAX_LOG_LINES
            ? next.slice(-MAX_LOG_LINES)
            : next;
        });
      }
    };

    source.onerror = () => {
      setConnected(false);
      setError("로그 스트림 연결이 끊어졌습니다. 재연결을 시도하세요.");
      source.close();
    };
  }, [projectId, paused]);

  useEffect(() => {
    if (!logPath) return;
    // 프로젝트가 바뀌거나 처음 열렸을 때 자동 연결
    connect();
    return () => {
      // 컴포넌트가 사라질 때 연결 해제
      sourceRef.current?.close();
    };
  }, [projectId, logPath]); // connect 의존성은 제외 (재연결 루프 방지)

  // 새 로그가 들어오면 최신 줄이 보이도록 아래로 스크롤
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, paused]);

  // 일시정지 해제 시, 그동안 모아 둔 로그를 한 번에 붙인다.
  const togglePause = () => {
    if (paused && bufferRef.current.length > 0) {
      setLines((prev) => {
        const next = [...prev, ...bufferRef.current];
        bufferRef.current = [];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
    }
    setPaused((p) => !p);
  };

  if (!logPath) {
    return (
      <div className="bg-gray-950 rounded-lg p-6 text-center text-gray-600 text-sm">
        이 프로젝트에는 로그 파일이 설정되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {/* 연결 상태 표시 */}
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}
          />
          <span>{connected ? "스트리밍 중" : "연결 끊김"}</span>
          <span className="text-gray-700">|</span>
          <span className="font-mono text-gray-700 truncate max-w-xs">
            {logPath}
          </span>
        </div>

        <div className="flex gap-1">
          {/* 일시정지 / 재개 */}
          <button
            onClick={togglePause}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused
              ? `재개${bufferRef.current.length > 0 ? ` (+${bufferRef.current.length})` : ""}`
              : "일시정지"}
          </button>

          {/* 로그 지우기 */}
          <button
            onClick={() => setLines([])}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <Trash2 size={12} />
            지우기
          </button>

          {/* 재연결 */}
          <button
            onClick={connect}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <RefreshCw size={12} />
            재연결
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-xs p-2 rounded">
          {error}
        </div>
      )}

      {/* 로그 뷰어 본체 */}
      <div className="bg-gray-950 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <span className="text-gray-700">로그를 기다리는 중...</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className="text-gray-300 whitespace-pre-wrap break-all hover:bg-gray-900 px-1 rounded"
            >
              <span className="text-gray-700 select-none mr-3">
                {String(lines.length - lines.length + i + 1).padStart(4, " ")}
              </span>
              {line}
            </div>
          ))
        )}
        {/* 자동 스크롤 앵커 */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
