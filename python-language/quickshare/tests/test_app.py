import io

import pytest

from quickshare.app import create_app
from quickshare.settings import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        host="127.0.0.1",
        port=9527,
        debug=False,
        max_upload_bytes=1024 * 1024,
        max_content_length=100,
        data_dir=tmp_path,
    )
    application = create_app(settings)
    application.config.update(TESTING=True, PROPAGATE_EXCEPTIONS=False)
    return application.test_client()


def test_category_routes_exist_without_running_main(client):
    response = client.get("/api/categories")
    assert response.status_code == 200
    assert response.get_json() == []


def test_upload_download_and_page_share_the_upload_limit(client):
    uploaded = client.post(
        "/api/upload",
        data={"file": (io.BytesIO("报告正文".encode()), "报告.txt"), "category": "文档"},
        content_type="multipart/form-data",
    )
    body = uploaded.get_json()
    assert uploaded.status_code == 200
    assert body["success"] is True
    stored = body["uploaded_files"][0]["filename"]

    page = client.get("/")
    html = page.get_data(as_text=True)
    assert "最大 1MB" in html
    assert "报告.txt" in html
    assert 'id="files-tab"' in html
    assert "share.js" in html

    downloaded = client.get("/download/" + stored)
    assert downloaded.status_code == 200
    disposition = downloaded.headers["Content-Disposition"]
    assert "报告.txt" in disposition or "%E6%8A%A5%E5%91%8A.txt" in disposition


def test_page_shows_configured_limit(tmp_path):
    settings = Settings(
        host="127.0.0.1",
        port=4242,
        debug=False,
        max_upload_bytes=3 * 1024 * 1024,
        max_content_length=100,
        data_dir=tmp_path,
    )
    application = create_app(settings)
    application.config.update(TESTING=True, PROPAGATE_EXCEPTIONS=False)
    html = application.test_client().get("/").get_data(as_text=True)
    assert "最大 3MB" in html
    assert 'data-port="4242"' in html


def test_text_edit_keeps_id_through_http(client):
    created = client.post("/api/text", json={"content": "旧内容"})
    text_id = created.get_json()["text"]["id"]
    updated = client.put(f"/api/text/{text_id}", json={"content": "新内容"})
    assert updated.status_code == 200
    assert updated.get_json()["text"]["id"] == text_id
    listed = client.get("/api/texts").get_json()
    assert listed[0]["content"] == "新内容"
    assert listed[0]["id"] == text_id


def test_network_info_uses_settings_port(client):
    body = client.get("/api/network-info").get_json()
    assert body["port"] == 9527
    assert body["visitor_ip"]
    assert "ip" in body


def test_too_large_request_uses_the_same_limit(client):
    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(b"x" * (1024 * 1024 + 32)), "big.bin")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 413
    assert "1MB" in response.get_json()["message"]


def test_missing_download_is_not_found(client):
    response = client.get("/download/missing.txt")
    assert response.status_code == 404
    assert response.get_json()["error"] == "文件不存在"


def test_old_pages_return_to_the_home_tabs(client):
    files_page = client.get("/files")
    texts_page = client.get("/texts")
    assert files_page.status_code == 302
    assert files_page.headers["Location"].endswith("#files")
    assert texts_page.status_code == 302
    assert texts_page.headers["Location"].endswith("#texts")


def test_home_shows_share_address_and_not_the_whole_text(client):
    created = client.post("/api/text", json={"content": "只有打开时才加载的正文"})
    text_id = created.get_json()["text"]["id"]
    html = client.get("/").get_data(as_text=True)
    assert 'id="shareUrl"' in html
    assert "uploadModal" not in html
    assert "功能特性" not in html
    assert "data-text-content" not in html
    assert "row-cols-md-2" in html
    assert "row-cols-md-3" in html
    assert 'data-action="copy-text-item"' in html
    assert 'data-action="view-text"' not in html
    assert f'data-text-id="{text_id}"' in html
    fetched = client.get(f"/api/text/{text_id}")
    assert fetched.status_code == 200
    assert fetched.get_json()["content"] == "只有打开时才加载的正文"
