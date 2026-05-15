# 餐饮小店订单管理系统 - 构建入口
# 支持：Windows (PowerShell/cmd) 和 类Unix系统

.PHONY: help doctor install lint clean build-merchant build-ops-web build-ops-exe build-ops-bin build-all version-bump

# 默认目标：显示帮助
help:
	@echo "========================================"
	@echo "  餐饮小店订单管理系统 - 构建命令"
	@echo "========================================"
	@echo ""
	@echo "环境与依赖："
	@echo "  make doctor         检查开发环境"
	@echo "  make install        安装所有依赖"
	@echo "  make lint           代码规范检查"
	@echo ""
	@echo "构建产物："
	@echo "  make build-merchant 构建商家端APK"
	@echo ""
	@echo "  make build-ops-web  构建运维前端Web"
	@echo "  make build-ops-exe  构建运维服务端EXE (仅Windows)"
	@echo "  make build-ops-bin  构建运维服务端BIN (非Windows)"
	@echo "  make build-ops-all  构建运维产物"
	@echo ""
	@echo "版本管理："
	@echo "  make version-bump TYPE=patch  升级补丁版本"
	@echo "  make version-bump TYPE=minor  升级次版本"
	@echo "  make version-bump TYPE=major  升级主版本"
	@echo ""
	@echo "清理："
	@echo "  make clean          清理所有构建产物"
	@echo ""
	@echo "========================================"

doctor:
	@echo "检查开发环境..."
	@flutter --version || echo "Flutter 未安装"
	@dart --version || echo "Dart 未安装"
	@echo "环境检查完成"

install:
	@echo "安装依赖..."
	@cd packages/common_core && flutter pub get
	@cd packages/database_core && flutter pub get
	@cd packages/offline_voice && flutter pub get
	@cd packages/auth_core && flutter pub get
	@cd apps/merchant_app && flutter pub get
	@cd apps/ops_tool/web && flutter pub get
	@cd apps/ops_tool/server && dart pub get
	@echo "依赖安装完成"

lint:
	@echo "代码规范检查..."
	@cd packages/common_core && flutter analyze
	@cd packages/database_core && flutter analyze
	@cd packages/offline_voice && flutter analyze
	@cd packages/auth_core && flutter analyze
	@cd apps/merchant_app && flutter analyze
	@cd apps/ops_tool/web && flutter analyze
	@cd apps/ops_tool/server && flutter analyze

clean:
	@echo "清理构建产物..."
	@cd apps/merchant_app && flutter clean
	@cd apps/ops_tool/web && flutter clean
	@cd apps/ops_tool/server && flutter clean
	@rm -rf scripts/outputs/*
	@echo "清理完成"

build-merchant:
	@echo "构建商家端APK..."
	@cd apps/merchant_app && flutter build apk --debug
	@mkdir -p scripts/outputs/apk
	@cp apps/merchant_app/build/app/outputs/flutter-apk/*.apk scripts/outputs/apk/
	@echo "APK构建完成"

build-ops-web:
	@if [ "$(OS)" != "Windows_NT" ]; then \
		echo "错误: build-ops-all 仅支持 Windows"; \
		exit 1; \
	fi
	@echo "构建运维前端Web..."
	@cd apps/ops_tool/web && flutter build web
	@mkdir -p output
	@rm -rf output/public
	@cp -r apps/ops_tool/web/build/web output/public
	@echo "Web构建完成"

build-ops-exe:
	@if [ "$(OS)" != "Windows_NT" ]; then \
		echo "错误: build-ops-all 仅支持 Windows"; \
		exit 1; \
	fi
	@echo "构建运维服务端EXE..."
	@cd apps/ops_tool/server && dart run build_runner build && dart compile exe lib/main.dart -DENABLE_SWAGGER=false -o ../../../output/ops_server.exe
	@cp apps/ops_tool/server/lib/migrations output/migrations -Recurse -Force
	@echo "EXE构建完成"

build-ops-bin:
	@echo "构建运维服务端 BIN..."
	@cd apps/ops_tool/server && dart run build_runner build && dart compile exe lib/main.dart -DENABLE_SWAGGER=false -o ../../../output/ops_server
	@rm -rf output/migrations
	@cp -r apps/ops_tool/server/lib/migrations output/migrations
	@echo "BIN构建完成"

build-ops-all:
	@if [ "$(OS)" != "Windows_NT" ]; then \
		echo "错误: build-ops-all 仅支持 Windows"; \
		exit 1; \
	fi
	@echo "构建 OPS Tool产物..."
	@$(MAKE) build-ops-web
	@$(MAKE) build-ops-exe
	@echo "全部构建完成"

version-bump:
	@echo "升级版本号 (TYPE=$(TYPE))..."
	@if [ -z "$(TYPE)" ]; then \
		echo "错误: 请指定 TYPE (patch/minor/major)"; \
		exit 1; \
	fi
	@cd apps/merchant_app && \
		OLD_VERSION=$$(grep "^version:" pubspec.yaml | awk '{print $$2}'); \
		IFS='.' read -r MAJOR MINOR PATCH <<< "$$OLD_VERSION"; \
		case "$(TYPE)" in \
			patch) NEW_PATCH=$$((PATCH + 1)); NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH" ;; \
			minor) NEW_MINOR=$$((MINOR + 1)); NEW_VERSION="$$MAJOR.$$NEW_MINOR.0" ;; \
			major) NEW_MAJOR=$$((MAJOR + 1)); NEW_VERSION="$$NEW_MAJOR.0.0" ;; \
			*) echo "错误: TYPE 必须是 patch/minor/major"; exit 1 ;; \
		esac; \
		sed -i '' "s/^version: .*/version: $$NEW_VERSION/" pubspec.yaml; \
		echo "版本从 $$OLD_VERSION 升级到 $$NEW_VERSION"
