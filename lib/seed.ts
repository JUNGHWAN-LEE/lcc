// 초기 프로젝트 데이터 삽입 스크립트.
// DB에 projects 테이블이 비어있을 때만 실행됨.
// 직접 실행: npx tsx lib/seed.ts

import { getDb } from "./db";

// ~/projects/ 하위 실제 프로젝트 목록
const SEED_PROJECTS = [
  {
    name: "invest-advisor",
    description: "투자 포트폴리오 조언 Next.js 웹 서비스",
    path: "~/projects/invest-advisor",
    start_cmd: "npm run dev",
    process_key: "invest-advisor",
    log_path: null,
    web_url: "http://localhost:3000",
    telegram_url: null,
  },
  {
    name: "binance-vol-stats",
    description: "바이낸스 변동성 통계 수집 봇",
    path: "~/projects/binance-vol-stats",
    start_cmd: "bash run_with_log.sh",
    process_key: "binance_vol_stats.py",
    log_path: "~/projects/binance-vol-stats/logs/volstats.log",
    web_url: null,
    telegram_url: null,
  },
  {
    name: "binance-futures-bottom-volume",
    description: "바이낸스 선물 저점 거래량 분석 봇",
    path: "~/projects/binance-futures-bottom-volume",
    start_cmd: "bash run_with_log.sh",
    process_key: "futures_bottom_volume.py",
    log_path: "~/projects/binance-futures-bottom-volume/logs/bottom.log",
    web_url: null,
    telegram_url: null,
  },
  {
    name: "polymarket-copy-bot",
    description: "Polymarket 예측 시장 자동 복사 매매 봇",
    path: "~/projects/polymarket-copy-bot",
    start_cmd: "python3 main.py",
    process_key: "polymarket-copy-bot/main.py",
    log_path: "~/projects/polymarket-copy-bot/bot.log",
    web_url: null,
    telegram_url: null,
  },
  {
    name: "polymarket-bot",
    description: "Polymarket 봇 (프론트엔드 포함)",
    path: "~/projects/polymarket-bot",
    start_cmd: null,
    process_key: "polymarket-bot",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "ipo-notifier",
    description: "공모주 청약 일정 알림 봇",
    path: "~/projects/ipo-notifier",
    start_cmd: "python3 main.py",
    process_key: "ipo-notifier/main.py",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "MyScheduler",
    description: "시장 브리핑, 날씨, RSI 알림 스케줄러",
    path: "~/projects/MyScheduler",
    start_cmd: "bash start_scheduler.sh",
    process_key: "Scheduler.py",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "telegram-script-executor",
    description: "텔레그램으로 서버 스크립트를 원격 실행하는 봇",
    path: "~/projects/telegram-script-executor",
    start_cmd: "python3 main.py",
    process_key: "telegram-script-executor/main.py",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "finance",
    description: "자산 조언 및 대출 관리 유틸리티",
    path: "~/projects/finance",
    start_cmd: null,
    process_key: "asset_advisor.py",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "weather",
    description: "날씨 정보 조회 스크립트",
    path: "~/projects/weather",
    start_cmd: "python3 weather.py",
    process_key: "weather/weather.py",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "binance_api-develop",
    description: "바이낸스 API 개발 브랜치",
    path: "~/projects/binance_api-develop",
    start_cmd: null,
    process_key: "binance_api",
    log_path: null,
    web_url: null,
    telegram_url: null,
  },
  {
    name: "finance-hub",
    description:
      "재무 관리 + 투자 관리 통합 대시보드 Next.js 웹 서비스 (port 9100)",
    path: "~/projects/finance-hub",
    start_cmd: "npm run dev",
    process_key: "finance-hub/node_modules",
    log_path: "/Users/jason/logs/finance-hub-web.log",
    web_url: "http://localhost:9100",
    telegram_url: null,
  },
  {
    name: "finance-hub-worker",
    description: "투자 조언 Python 백그라운드 워커",
    path: "~/projects/finance-hub",
    start_cmd: "worker/venv/bin/python worker/invest_advisor_worker.py",
    process_key: "invest_advisor_worker.py",
    log_path: "/Users/jason/logs/finance-hub-worker.log",
    web_url: null,
    telegram_url: null,
  },
];

// ~/projects/batch 의 주요 스크립트 시드 데이터
const SEED_BATCH_JOBS = [
  {
    name: "날씨 발송",
    description: "부산 날씨 조회 후 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 weather_sender.py",
    working_dir: "~/projects/batch",
  },
  {
    name: "가계부 발송",
    description: "이번 달 가계부 내역 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 fin_ledger_sender.py",
    working_dir: "~/projects/batch",
  },
  {
    name: "투자 현황 발송",
    description: "보유 종목 현재가·손익 현황 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 invest_sender.py",
    working_dir: "~/projects/batch",
  },
  {
    name: "바이낸스 변동성 분석 발송",
    description: "binance-vol-stats 분석 결과 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 volatility_sender.py",
    working_dir: "~/projects/batch",
  },
  {
    name: "바이낸스 저점 거래량 발송",
    description: "binance-futures-bottom-volume 분석 결과 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 bottom_volume_sender.py",
    working_dir: "~/projects/batch",
  },
  {
    name: "공모주 알림 발송",
    description: "공모주 청약 일정 크롤링 후 텔레그램 발송",
    command: "/opt/homebrew/bin/python3 ipo-notifier/ipo_notify_sender.py",
    working_dir: "~/projects/batch",
  },
];

export function seedBatchJobs() {
  const db = getDb();
  const count = (
    db.prepare("SELECT COUNT(*) as cnt FROM batch_jobs").get() as {
      cnt: number;
    }
  ).cnt;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO batch_jobs (name, description, command, working_dir)
    VALUES (@name, @description, @command, @working_dir)
  `);
  const insertMany = db.transaction((jobs: typeof SEED_BATCH_JOBS) => {
    for (const j of jobs) insert.run(j);
  });
  insertMany(SEED_BATCH_JOBS);
  console.log(`[seed] ${SEED_BATCH_JOBS.length}개 배치작업 시드 완료.`);
}

export function seedProjects() {
  const db = getDb();

  // 이미 데이터가 있으면 시드 건너뜀
  const count = (
    db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number }
  ).cnt;
  if (count > 0) {
    console.log(`[seed] 이미 ${count}개 프로젝트가 존재함. 시드 건너뜀.`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO projects (name, description, path, start_cmd, process_key, log_path, web_url, telegram_url)
    VALUES (@name, @description, @path, @start_cmd, @process_key, @log_path, @web_url, @telegram_url)
  `);

  // 트랜잭션으로 일괄 삽입 (성능 + 원자성)
  const insertMany = db.transaction((projects: typeof SEED_PROJECTS) => {
    for (const p of projects) {
      insert.run(p);
    }
  });

  insertMany(SEED_PROJECTS);
  console.log(`[seed] ${SEED_PROJECTS.length}개 프로젝트 시드 완료.`);
}
