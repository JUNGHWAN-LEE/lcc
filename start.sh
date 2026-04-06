#!/bin/zsh
# LCC Next.js 개발 서버 시작 스크립트 (port 12000)
cd /Users/jason/projects/lcc
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec /opt/homebrew/bin/node node_modules/.bin/next dev --port 12000
