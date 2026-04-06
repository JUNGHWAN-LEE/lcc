// macOS LaunchAgent 관리 유틸리티.
//
// LaunchAgent 는 macOS가 로그인한 사용자 기준으로 백그라운드 작업을 실행하게 해 주는 기능이다.
// 실제 저장 형식은 `~/Library/LaunchAgents/*.plist` 파일이고,
// 활성/비활성/실행 상태 확인은 `launchctl` 명령으로 한다.
//
// 이 파일은 그 둘을 감싼다.
// - plist 파일 읽기/쓰기
// - launchctl 상태 파싱
// - load / unload / delete / update
//
// 즉, Next.js 앱 입장에서는 "복잡한 macOS 전용 규칙"을 숨겨 주는 어댑터 계층이다.

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import os from "os";

// 사용자 홈 디렉터리 아래 LaunchAgents 기본 위치
export const AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");

// 화면에 보여 줄 LaunchAgent 정보를 정규화한 타입.
// plist 구조와 launchctl 출력을 합쳐서 하나의 객체로 만든 결과다.
export interface LaunchAgentInfo {
  label: string;
  filePath: string;
  programArgs: string[]; // ProgramArguments 원본 배열
  workingDir: string | null;
  scheduleType: "calendar" | "keepalive" | "other";
  // 스케줄 시간 (단일 또는 배열)
  schedules: Array<{ hour: number; minute: number }>;
  keepAlive: boolean;
  runAtLoad: boolean;
  logPath: string | null;
  status: "running" | "stopped" | "unloaded";
  pid: number | null;
  exitCode: number | null;
}

// 새 LaunchAgent 를 만들 때 필요한 입력값
export interface CreateAgentConfig {
  label: string;
  command: string; // bash -c 로 실행할 명령어
  workingDir: string;
  scheduleType: "calendar" | "keepalive";
  hour: number;
  minute: number;
  weekdayOnly: boolean; // 평일(월~금)만 실행 여부 (calendar 타입일 때)
  logPath: string;
}

// `launchctl list` 결과를 읽어서 label 기준 상태 맵으로 바꾼다.
// 한 줄이 대략 `PID    ExitStatus    Label` 구조라서 이를 파싱한다.
//
// 왜 맵으로 바꾸나?
// plist 파일들을 순회하면서 해당 label 의 실행 상태를 즉시 붙이기 쉽기 때문이다.
function getLaunchctlStatus(): Record<
  string,
  { pid: number | null; exitCode: number }
> {
  try {
    const out = execSync("launchctl list", { encoding: "utf8", stdio: "pipe" });
    const result: Record<string, { pid: number | null; exitCode: number }> = {};
    for (const line of out.trim().split("\n").slice(1)) {
      const parts = line.trim().split("\t");
      if (parts.length >= 3) {
        result[parts[2]] = {
          pid: parts[0] === "-" ? null : Number(parts[0]),
          exitCode: Number(parts[1]),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

// plist 파일 하나를 읽어 화면 친화적인 LaunchAgentInfo 로 변환한다.
// 여기서 실제로 하는 일은 두 단계다.
// 1. `plutil` 로 plist(XML)를 JSON 으로 변환
// 2. launchctl 상태 맵과 합쳐 실행 상태까지 붙이기
function parsePlist(
  filePath: string,
  status: Record<string, { pid: number | null; exitCode: number }>,
): LaunchAgentInfo | null {
  try {
    const json = JSON.parse(
      execSync(`plutil -convert json -o - "${filePath}"`, {
        encoding: "utf8",
        stdio: "pipe",
      }),
    );

    const label: string = json.Label ?? path.basename(filePath, ".plist");
    const programArgs: string[] = json.ProgramArguments ?? [];

    // LaunchAgent 의 스케줄 표현은 여러 형태가 가능하다.
    // 여기서는 자주 쓰는 두 가지를 우선 분류한다.
    // - StartCalendarInterval: 특정 시각 실행
    // - KeepAlive: 항상 살아 있게 유지
    let scheduleType: LaunchAgentInfo["scheduleType"] = "other";
    const schedules: Array<{ hour: number; minute: number }> = [];

    if (json.StartCalendarInterval) {
      scheduleType = "calendar";
      const raw = json.StartCalendarInterval;
      if (Array.isArray(raw)) {
        for (const s of raw)
          schedules.push({ hour: s.Hour ?? 0, minute: s.Minute ?? 0 });
      } else {
        schedules.push({ hour: raw.Hour ?? 0, minute: raw.Minute ?? 0 });
      }
    } else if (json.KeepAlive) {
      scheduleType = "keepalive";
    }

    const s = status[label];
    let agentStatus: LaunchAgentInfo["status"] = "unloaded";
    if (s) agentStatus = s.pid !== null ? "running" : "stopped";

    return {
      label,
      filePath,
      programArgs,
      workingDir: json.WorkingDirectory ?? null,
      scheduleType,
      schedules,
      keepAlive: json.KeepAlive ?? false,
      runAtLoad: json.RunAtLoad ?? false,
      logPath: json.StandardOutPath ?? null,
      status: agentStatus,
      pid: s?.pid ?? null,
      exitCode: s?.exitCode ?? null,
    };
  } catch {
    return null;
  }
}

// LaunchAgents 폴더 전체를 읽어서 목록으로 반환한다.
export function listAgents(): LaunchAgentInfo[] {
  const status = getLaunchctlStatus();
  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".plist"));
  return files
    .map((f) => parsePlist(path.join(AGENTS_DIR, f), status))
    .filter(Boolean) as LaunchAgentInfo[];
}

// label 하나만 대상으로 조회
export function getAgent(label: string): LaunchAgentInfo | null {
  const status = getLaunchctlStatus();
  const filePath = path.join(AGENTS_DIR, `${label}.plist`);
  if (!fs.existsSync(filePath)) return null;
  return parsePlist(filePath, status);
}

// plist 를 launchctl 에 등록해 활성화
export function loadAgent(label: string): { success: boolean; error?: string } {
  const filePath = path.join(AGENTS_DIR, `${label}.plist`);
  try {
    execSync(`launchctl load "${filePath}"`, { stdio: "pipe" });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// launchctl 에서 내려 비활성화
export function unloadAgent(label: string): {
  success: boolean;
  error?: string;
} {
  const filePath = path.join(AGENTS_DIR, `${label}.plist`);
  try {
    execSync(`launchctl unload "${filePath}"`, { stdio: "pipe" });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// 파일 자체를 제거한다.
// load 상태일 수 있으므로 먼저 unload 를 시도한 다음 plist 파일을 삭제한다.
export function deleteAgent(label: string): {
  success: boolean;
  error?: string;
} {
  const filePath = path.join(AGENTS_DIR, `${label}.plist`);
  try {
    // 로드된 상태이면 먼저 언로드
    execSync(`launchctl unload "${filePath}" 2>/dev/null || true`, {
      stdio: "pipe",
      shell: "/bin/bash",
    });
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// 기존 에이전트를 수정한다.
// LaunchAgent 는 일부 필드만 부분 수정하는 API가 따로 있는 개념이 아니라
// 보통 plist 를 다시 써서 재등록하는 방식이 가장 단순하다.
export function updateAgent(
  originalLabel: string,
  config: CreateAgentConfig,
): { success: boolean; error?: string } {
  const originalPath = path.join(AGENTS_DIR, `${originalLabel}.plist`);
  try {
    // 기존 plist 언로드 + 삭제
    execSync(`launchctl unload "${originalPath}" 2>/dev/null || true`, {
      stdio: "pipe",
      shell: "/bin/bash",
    });
    fs.unlinkSync(originalPath);
  } catch (err) {
    return { success: false, error: `기존 에이전트 제거 실패: ${String(err)}` };
  }
  // 새 config로 생성
  return createAgent(config);
}

// plist XML 안에 들어갈 문자열은 `<`, `&`, `"` 같은 문자를 이스케이프해야 깨지지 않는다.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 사용자가 입력한 설정을 plist XML 로 만들어 저장하고 즉시 load 한다.
//
// 생성 흐름:
// 1. label 중복 확인
// 2. 로그 디렉터리 준비
// 3. 필요하면 평일 전용 실행 래퍼 명령 생성
// 4. plist XML 문자열 조립
// 5. 파일 저장
// 6. `launchctl load` 로 즉시 활성화
export function createAgent(config: CreateAgentConfig): {
  success: boolean;
  error?: string;
} {
  const filePath = path.join(AGENTS_DIR, `${config.label}.plist`);

  if (fs.existsSync(filePath)) {
    return {
      success: false,
      error: `이미 존재하는 label입니다: ${config.label}`,
    };
  }

  // 표준 출력/에러를 같은 로그 파일로 모으기 때문에 디렉터리가 없으면 먼저 만들어 준다.
  const logDir = path.dirname(config.logPath);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  // "평일만 실행" 옵션은 launchd 자체 옵션이 아니라 쉘 조건문으로 구현한다.
  // 즉, 스케줄은 매일 돌지만 토요일/일요일에는 바로 종료된다.
  const cmd = config.weekdayOnly
    ? `day=$(date +%u); if [ "$day" -le 5 ]; then ${config.command}; fi`
    : config.command;

  // launchd 스케줄 설정 XML 조각
  const scheduleXml =
    config.scheduleType === "calendar"
      ? `    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${config.hour}</integer>
        <key>Minute</key>
        <integer>${config.minute}</integer>
    </dict>`
      : `    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>`;

  const cwdXml = config.workingDir
    ? `    <key>WorkingDirectory</key>\n    <string>${escapeXml(config.workingDir)}</string>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(config.label)}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>${escapeXml(cmd)}</string>
    </array>
${cwdXml ? cwdXml + "\n" : ""}${scheduleXml}
    <key>StandardOutPath</key>
    <string>${escapeXml(config.logPath)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(config.logPath)}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
`;

  try {
    fs.writeFileSync(filePath, xml, "utf8");
    execSync(`launchctl load "${filePath}"`, { stdio: "pipe" });
    return { success: true };
  } catch (err) {
    // 파일만 남고 load 는 실패한 반쪽 상태를 막기 위해 롤백한다.
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* 무시 */
    }
    return { success: false, error: String(err) };
  }
}
