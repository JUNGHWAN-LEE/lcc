// OS 레벨 작업을 모아 둔 유틸리티.
//
// 이 프로젝트의 핵심 특징은 "DB에 저장된 설정을 바탕으로 실제 macOS 프로세스를 제어"한다는 점이다.
// 브라우저는 직접 프로세스를 만질 수 없으므로, 서버가 child_process 로 쉘 명령을 실행한다.
//
// 여기서 담당하는 일:
// - `pgrep`, `ps`, `pkill` 로 프로젝트 프로세스 상태 확인/종료
// - `spawn` 으로 백그라운드 프로세스 시작
// - `top`, `powermetrics` 로 시스템 자원 사용량 수집
// - 배치 명령어를 즉시 실행하고 결과(stdout/stderr)를 돌려주기

import { execSync, spawn } from "child_process";
import os from "os";

// 사용자가 설정 화면에 `~/projects/foo` 처럼 입력한 경로를
// 실제 절대경로(`/Users/...`)로 바꿔 준다.
// 쉘은 `~` 를 알아서 풀어 주지만, Node.js 파일/프로세스 API는 그렇지 않다.
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", os.homedir());
  }
  return p;
}

// `pgrep -f` 는 "실행 중인 프로세스 전체 명령줄"에서 문자열 패턴을 찾는다.
// 예를 들어 process_key 가 `main.py` 라면 `python3 main.py` 프로세스를 잡아낼 수 있다.
//
// 반환값을 boolean 대신 문자열로 둔 이유:
// UI에서 그대로 `'running' | 'stopped'` 상태값으로 쓰기 쉽기 때문이다.
export function checkProcess(pattern: string): "running" | "stopped" {
  try {
    // pgrep -f: 전체 커맨드라인에서 패턴 검색
    // exitcode 0이면 프로세스 존재, 1이면 없음
    execSync(`pgrep -f "${pattern}"`, { stdio: "pipe" });
    return "running";
  } catch {
    return "stopped";
  }
}

// 같은 패턴에 여러 프로세스가 걸릴 수 있으므로 PID 배열로 돌려준다.
// 예: worker 여러 개를 띄운 경우
export function getProcessPids(pattern: string): number[] {
  try {
    const output = execSync(`pgrep -f "${pattern}"`, { stdio: "pipe" })
      .toString()
      .trim();
    return output.split("\n").map(Number).filter(Boolean);
  } catch {
    return [];
  }
}

// 특정 PID 하나의 CPU, 메모리 사용률을 가져온다.
// 현재 UI는 "프로젝트 대표 프로세스 하나"만 보여 주기 때문에 첫 PID만 사용한다.
// 더 정확한 합산이 필요하면 이 함수를 여러 PID에 대해 호출한 뒤 합계를 내면 된다.
export function getProcessStats(
  pid: number,
): { cpu: number; mem: number } | null {
  try {
    // macOS ps는 --no-headers를 지원하지 않으므로 헤더 포함 출력 후 두 번째 줄 파싱
    // ps -p <pid> -o %cpu,%mem: 첫 줄은 헤더(%CPU %MEM), 두 번째 줄이 실제 값
    const output = execSync(`ps -p ${pid} -o %cpu,%mem`, { stdio: "pipe" })
      .toString()
      .trim();
    const lines = output.split("\n");
    // 두 번째 줄(인덱스 1)이 실제 데이터
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          cpu: parseFloat(parts[0]) || 0,
          mem: parseFloat(parts[1]) || 0,
        };
      }
    }
  } catch {
    // PID가 없거나 접근 불가능한 경우
  }
  return null;
}

// macOS 전체 시스템 사용률을 읽는다.
// `top -l 1 -n 0` 은 한 번만 실행하고, 긴 프로세스 리스트는 생략하므로
// 대시보드 폴링용으로 비교적 가볍다.
export function getSystemMetrics(): {
  cpu: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
} {
  try {
    // top -l 1 -n 0: macOS용 1회 snapshot (프로세스 리스트 없이)
    const output = execSync("top -l 1 -n 0", {
      stdio: "pipe",
      timeout: 5000,
    }).toString();

    // CPU 사용률 파싱: "CPU usage: 12.50% user, 8.33% sys, 79.16% idle"
    const cpuMatch = output.match(
      /CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys/,
    );
    let cpu = 0;
    if (cpuMatch) {
      cpu = parseFloat(cpuMatch[1]) + parseFloat(cpuMatch[2]);
    }

    // 메모리 사용량 파싱: "PhysMem: 8192M used (1234M wired), 0B unused."
    // 또는: "PhysMem: 8820M used (3087M wired, 134M compressor), 7551M unused."
    const memMatch = output.match(
      /PhysMem:\s+([\d.]+)([MG])\s+used.*?,\s+([\d.]+)([MG])\s+unused/,
    );
    let memUsed = 0;
    let memTotal = 0;
    let memPercent = 0;
    if (memMatch) {
      // M을 GB로 변환
      const usedVal = parseFloat(memMatch[1]);
      const usedUnit = memMatch[2];
      const unusedVal = parseFloat(memMatch[3]);
      const unusedUnit = memMatch[4];

      const toMB = (val: number, unit: string) =>
        unit === "G" ? val * 1024 : val;
      const usedMB = toMB(usedVal, usedUnit);
      const unusedMB = toMB(unusedVal, unusedUnit);
      memUsed = Math.round(usedMB);
      memTotal = Math.round(usedMB + unusedMB);
      memPercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;
    }

    return { cpu: Math.round(cpu), memUsed, memTotal, memPercent };
  } catch {
    return { cpu: 0, memUsed: 0, memTotal: 0, memPercent: 0 };
  }
}

// GPU 사용률은 macOS에서 표준적으로 얻기 까다롭기 때문에 `powermetrics` 를 사용한다.
// 다만 이 명령은 권한이 필요할 수 있어, 실패해도 앱 전체는 정상 동작하게 null 을 반환한다.
export function getGpuMetrics(): { gpuPercent: number } | null {
  try {
    // --samplers gpu_power: GPU 관련 지표만 수집, -n 1: 1회 샘플
    // 권한 없으면 바로 에러 → null 반환
    const output = execSync(
      "sudo -n powermetrics --samplers gpu_power -n 1 -i 100",
      {
        stdio: "pipe",
        timeout: 3000,
      },
    ).toString();

    // "GPU Active Residency: 23.45%" 파싱
    const match = output.match(/GPU\s+Active\s+Residency:\s+([\d.]+)%/i);
    if (match) {
      return { gpuPercent: Math.round(parseFloat(match[1])) };
    }
  } catch {
    // sudo 권한 없거나 명령어 실패 시 null 반환 (선택적 기능)
  }
  return null;
}

// 배치 명령은 "백그라운드 서비스"가 아니라 "지금 즉시 실행하고 결과를 보고 싶은 작업"이다.
// 그래서 detached 프로세스가 아니라 execSync 로 끝날 때까지 기다린다.
//
// 반환값을 예외 대신 객체로 감싼 이유:
// API Route 에서 성공/실패를 JSON 형태로 일관되게 내려주기 쉽기 때문이다.
export function runBatchCommand(
  command: string,
  cwd?: string | null,
): { success: boolean; stdout: string; stderr: string; exitCode: number } {
  // 작업 디렉토리를 지정하지 않으면 현재 앱 루트를 사용한다.
  const expandedCwd = cwd ? expandPath(cwd) : process.cwd();
  try {
    const stdout = execSync(command, {
      cwd: expandedCwd,
      stdio: "pipe",
      timeout: 60000,
      encoding: "utf8",
    });
    return { success: true, stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    // execSync는 non-zero exit code일 때 에러를 throw함
    if (err && typeof err === "object" && "stdout" in err) {
      const e = err as {
        stdout: Buffer | string;
        stderr: Buffer | string;
        status: number;
      };
      return {
        success: false,
        stdout: e.stdout ? String(e.stdout).trim() : "",
        stderr: e.stderr ? String(e.stderr).trim() : "",
        exitCode: e.status ?? 1,
      };
    }
    return { success: false, stdout: "", stderr: String(err), exitCode: 1 };
  }
}

// 장기 실행 프로세스를 백그라운드로 시작한다.
//
// 여기서 중요한 설정:
// - `bash -c startCmd`: 사용자가 입력한 자유로운 쉘 명령어를 그대로 실행
// - `detached: true`: Next 서버와 분리된 독립 프로세스로 실행
// - `stdio: 'ignore'`: 부모 터미널에 매달리지 않게 함
// - `unref()`: 부모 이벤트 루프가 이 자식 프로세스를 기다리지 않게 함
//
// 즉, "대시보드가 요청만 보내고 실제 앱/봇은 혼자 계속 돌게" 만드는 함수다.
export function startProcess(
  startCmd: string,
  cwd: string,
): { success: boolean; pid?: number; error?: string } {
  try {
    const expandedCwd = expandPath(cwd);

    // 쉘을 통해 명령어 실행 (bash start.sh, python3 main.py 등 다양한 형식 지원)
    const child = spawn("bash", ["-c", startCmd], {
      cwd: expandedCwd,
      detached: true, // 부모 프로세스와 분리
      stdio: "ignore", // 표준 입출력 무시 (백그라운드)
    });

    child.unref(); // 부모가 종료돼도 자식은 계속 실행
    return { success: true, pid: child.pid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// 등록된 `process_key` 를 기준으로 관련 프로세스를 종료한다.
// `pkill -f` 는 매칭되는 모든 프로세스에 SIGTERM 을 보내므로,
// 일반적으로 "정상 종료 요청"에 해당한다.
//
// `killed` 는 정확한 PID 개수라기보다 "종료 시도 결과"에 가깝다.
// 현재 UI는 상세 개수보다 성공/실패 여부만 있으면 충분해서 이 정도 정보만 쓴다.
export function stopProcess(pattern: string): {
  success: boolean;
  killed: number;
  error?: string;
} {
  try {
    // pkill -f: 전체 커맨드라인에서 패턴 매칭해서 종료
    execSync(`pkill -f "${pattern}"`, { stdio: "pipe" });
    return { success: true, killed: 1 };
  } catch (err: unknown) {
    // exit code 1 = 매칭 프로세스 없음 (이미 종료됨)
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 1
    ) {
      return { success: true, killed: 0 };
    }
    return { success: false, killed: 0, error: String(err) };
  }
}
