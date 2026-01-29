#!/usr/bin/env sh
# Установка Docker без Docker Desktop (Colima + Docker CLI).
# Запуск: ./scripts/install-docker-colima.sh
# Требуется: Homebrew, принятая лицензия Xcode (sudo xcodebuild -license accept).

set -e

echo "Проверка Homebrew..."
command -v brew >/dev/null 2>&1 || { echo "Установите Homebrew: https://brew.sh"; exit 1; }

echo "Установка Colima и Docker..."
brew install colima docker

echo "Запуск Colima (создаётся VM с Docker-демоном)..."
colima start

echo "Готово. Проверка: docker ps"
docker ps

echo "Docker работает без Docker Desktop. Остановить: colima stop. Запустить снова: colima start."
