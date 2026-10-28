#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HTTP adapter for file share and text share on the local network."""

from __future__ import annotations

import socket

from flask import Flask, jsonify, redirect, render_template, request, send_file

from quickshare.file_share import FileShare, FileShareError
from quickshare.lan import discover_lan_ip
from quickshare.settings import Settings, load_settings
from quickshare.text_share import TextShare, TextShareError


def create_app(settings: Settings | None = None) -> Flask:
    settings = settings or load_settings()
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.max_upload_bytes
    app.config["SETTINGS"] = settings
    app.extensions["file_share"] = FileShare(
        settings.upload_folder,
        settings.md5_cache_file,
        settings.categories_file,
        settings.max_upload_bytes,
    )
    app.extensions["text_share"] = TextShare(
        settings.text_file,
        settings.max_content_length,
    )

    @app.context_processor
    def inject_settings():
        return {"max_upload_mb": settings.max_upload_mb, "server_port": settings.port}

    @app.errorhandler(413)
    def too_large(_error):
        limit = f"{settings.max_upload_mb}MB"
        return jsonify({
            "error": "文件或内容过大",
            "message": f"文件大小不能超过 {limit}",
            "max_size": limit,
        }), 413

    @app.errorhandler(FileShareError)
    def file_error(error):
        return jsonify({"error": error.message}), error.status

    @app.errorhandler(TextShareError)
    def text_error(error):
        return jsonify({"error": error.message}), error.status

    @app.route("/")
    def index():
        return render_template(
            "index.html",
            files=_files().list_files(),
            texts=_texts().list_texts(),
        )

    @app.route("/files")
    def files():
        return redirect("/#files")

    @app.route("/texts")
    def texts():
        return redirect("/#texts")

    @app.route("/api/upload", methods=["POST"])
    def upload_file():
        incoming = request.files.getlist("file")
        if not incoming or all(not item.filename for item in incoming):
            return jsonify({"error": "没有选择文件"}), 400
        result = _files().add(
            [(item.filename, item.stream) for item in incoming],
            request.form.get("category", "未分类"),
        )
        if not result.ok:
            return jsonify({"success": False, "error": "所有文件上传失败", "failed_files": result.failed})
        message = f"成功上传 {len(result.uploaded)} 个文件"
        if result.failed:
            message += f"，{len(result.failed)} 个文件上传失败"
        return jsonify({
            "success": True,
            "uploaded_files": result.uploaded,
            "failed_files": result.failed,
            "message": message,
        })

    @app.route("/api/files")
    def api_files():
        return jsonify([item.as_dict() for item in _files().list_files()])

    @app.route("/download/<filename>")
    def download_file(filename):
        path, original_name = _files().open(filename)
        return send_file(path, as_attachment=True, download_name=original_name)

    @app.route("/delete/<filename>")
    def delete_file(filename):
        _files().remove(filename)
        return jsonify({"success": True, "message": "文件已删除"})

    @app.route("/api/files/clear", methods=["DELETE"])
    def clear_all_files():
        _files().remove_all()
        return jsonify({"success": True, "message": "所有文件已删除"})

    @app.route("/api/files/calculate-md5", methods=["POST"])
    def calculate_all_md5():
        count = _files().checksum_all()
        return jsonify({
            "success": True,
            "message": f"已为 {count} 个文件计算MD5值",
            "updated_count": count,
        })

    @app.route("/api/files/<filename>/md5", methods=["POST"])
    def calculate_file_md5(filename):
        digest = _files().checksum(filename)
        return jsonify({
            "success": True,
            "message": "MD5值计算成功",
            "filename": filename,
            "md5": digest,
        })

    @app.route("/api/files/<filename>/category", methods=["PUT"])
    def update_file_category(filename):
        data = request.get_json(silent=True) or {}
        _files().set_category(filename, data.get("category", ""))
        return jsonify({"success": True, "message": "文件分类更新成功"})

    @app.route("/api/categories", methods=["GET"])
    def get_categories():
        return jsonify([item.as_dict() for item in _files().list_categories()])

    @app.route("/api/categories", methods=["POST"])
    def create_category():
        data = request.get_json(silent=True) or {}
        category = _files().create_category(data.get("name", ""))
        return jsonify({"success": True, "category": category.as_dict(), "message": "分类创建成功"})

    @app.route("/api/categories/<category_id>", methods=["PUT"])
    def update_category(category_id):
        data = request.get_json(silent=True) or {}
        category = _files().rename_category(category_id, data.get("name", ""))
        return jsonify({"success": True, "category": category.as_dict(), "message": "分类更新成功"})

    @app.route("/api/categories/<category_id>", methods=["DELETE"])
    def delete_category(category_id):
        _files().delete_category(category_id)
        return jsonify({"success": True, "message": "分类删除成功"})

    @app.route("/api/text", methods=["POST"])
    def save_text():
        data = request.get_json(silent=True) or {}
        text = _texts().create(data.get("content", ""))
        return jsonify({"success": True, "text": text.as_dict(), "message": "文本保存成功"})

    @app.route("/api/text/<text_id>", methods=["GET"])
    def get_text(text_id):
        return jsonify(_texts().get(text_id).as_dict())

    @app.route("/api/text/<text_id>", methods=["PUT"])
    def update_text(text_id):
        data = request.get_json(silent=True) or {}
        text = _texts().update(text_id, data.get("content", ""))
        return jsonify({"success": True, "text": text.as_dict(), "message": "文本更新成功"})

    @app.route("/api/texts")
    def api_texts():
        return jsonify([item.as_dict() for item in _texts().list_texts()])

    @app.route("/api/text/<text_id>", methods=["DELETE"])
    def delete_text(text_id):
        _texts().delete(text_id)
        return jsonify({"success": True, "message": "文本删除成功"})

    @app.route("/api/texts/clear", methods=["DELETE"])
    def clear_all_texts():
        _texts().clear()
        return jsonify({"success": True, "message": "所有文本已删除"})

    @app.route("/api/network-info")
    def network_info():
        return jsonify({
            "hostname": socket.gethostname(),
            "ip": discover_lan_ip(),
            "port": settings.port,
            "visitor_ip": _visitor_ip(),
        })

    def _files() -> FileShare:
        return app.extensions["file_share"]

    def _texts() -> TextShare:
        return app.extensions["text_share"]

    def _visitor_ip() -> str:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.remote_addr or ""

    return app


def main() -> None:
    settings = load_settings()
    application = create_app(settings)
    local_ip = discover_lan_ip()
    print("局域网文件共享服务器启动中...")
    print(f"数据目录: {settings.data_dir.resolve()}")
    print(f"上传上限: {settings.max_upload_mb}MB")
    print(f"本地访问: http://localhost:{settings.port}")
    print(f"局域网访问: http://{local_ip}:{settings.port}")
    print("其他设备可以通过局域网 IP 访问")
    print("按 Ctrl+C 停止服务器")
    application.run(host=settings.host, port=settings.port, debug=settings.debug, threaded=True)


if __name__ == "__main__":
    main()
