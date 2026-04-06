// SQLite 연결을 담당하는 모듈.
//
// 이 프로젝트는 별도 DB 서버(PostgreSQL, MySQL 등) 대신
// 프로젝트 루트의 `lcc.db` 파일 하나를 데이터 저장소로 사용한다.
//
// 왜 better-sqlite3 인가?
// - API Route 안에서 짧은 쿼리를 즉시 실행하기 쉽다.
// - 별도 연결 풀 없이 "파일 DB"를 바로 다룰 수 있다.
// - 이 앱 규모에서는 동기 방식이 단순하고 이해하기 쉽다.
//
// 중요한 점:
// Next.js 서버 코드에서는 이 파일을 여러 Route가 함께 import 한다.
// 그래서 DB 연결도 "매 요청마다 새로 열기"보다 "한 번 열고 재사용"하는 편이 낫다.

import Database from "better-sqlite3";
import path from "path";

// process.cwd() 는 현재 Next.js 앱 루트 디렉터리다.
// 따라서 DB 파일은 항상 프로젝트 루트의 `lcc.db` 가 된다.
const DB_PATH = path.join(process.cwd(), "lcc.db");

// 모듈 전역 변수에 연결을 저장해 두는 간단한 싱글톤 패턴.
// 첫 호출 전까지는 undefined 상태이고, 그 뒤에는 같은 연결을 재사용한다.
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // 최초 1회만 실제 파일 연결을 연다.
    db = new Database(DB_PATH);

    // WAL(Write-Ahead Logging) 모드는 SQLite에서 자주 쓰는 설정이다.
    // 간단히 말해 "읽는 중에도 쓰기 충돌을 줄여 주는 모드"라서
    // 대시보드 조회와 설정 저장이 같이 일어날 때 더 안정적이다.
    db.pragma("journal_mode = WAL");

    // 앱 첫 실행일 수 있으므로, 필요한 테이블이 없으면 바로 만든다.
    initSchema(db);
  }
  return db;
}

// 앱이 필요로 하는 최소 테이블을 준비한다.
// `CREATE TABLE IF NOT EXISTS` 를 쓰기 때문에 이미 테이블이 있으면 아무 일도 일어나지 않는다.
function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      description  TEXT,
      path         TEXT NOT NULL,
      start_cmd    TEXT,
      process_key  TEXT,
      log_path     TEXT,
      web_url      TEXT,
      telegram_url TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batch_jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      command     TEXT NOT NULL,
      working_dir TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}

// DB의 `batch_jobs` 행 한 줄을 TypeScript 타입으로 표현한 것이다.
// 프론트/백엔드 모두 이 타입을 공유해서 필드 이름을 안전하게 맞춘다.
export interface BatchJob {
  id: number;
  name: string;
  description: string | null;
  command: string;
  working_dir: string | null;
  created_at: string;
}

// DB의 `projects` 행 한 줄을 표현한다.
// nullable 필드는 "설정하지 않아도 되는 값"이라는 뜻이다.
// 예를 들어 CLI 스크립트 프로젝트는 `web_url` 이 없을 수 있다.
export interface Project {
  id: number;
  name: string;
  description: string | null;
  path: string;
  start_cmd: string | null;
  process_key: string | null;
  log_path: string | null;
  web_url: string | null;
  telegram_url: string | null;
  created_at: string;
}
