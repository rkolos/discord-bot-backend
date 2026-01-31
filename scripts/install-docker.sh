#!/usr/bin/env sh
# Установка Docker.
# Запуск: ./scripts/install-docker.sh

set -e

echo "Проверка Docker..."
if docker info >/dev/null 2>&1; then
  echo "Docker уже установлен и работает: $(docker --version)"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "Docker CLI найден, но демон не запущен."
  echo "Запустите Docker Desktop (macOS/Windows) или: sudo systemctl start docker (Linux)"
  exit 1
fi

# macOS: Docker Desktop через Homebrew
if [ "$(uname)" = "Darwin" ]; then
  echo "Установка Docker Desktop для macOS..."
  command -v brew >/dev/null 2>&1 || { echo "Установите Homebrew: https://brew.sh"; exit 1; }
  brew install --cask docker
  echo "Docker Desktop установлен. Запустите приложение Docker из Applications."
  echo "После запуска выполните: docker ps"
  exit 0
fi

# Linux
if [ "$(uname)" = "Linux" ]; then
  echo "Установка Docker для Linux..."
  echo "Инструкции: https://docs.docker.com/engine/install/"
  echo "Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io docker-compose-plugin"
  exit 0
fi

echo "Установите Docker вручную: https://docs.docker.com/get-docker/"
