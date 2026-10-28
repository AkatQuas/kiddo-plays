import pytest

from quickshare.settings import load_settings


def test_environment_overrides_config_file(tmp_path):
    settings = load_settings(
        environ={
            "QUICKSHARE_HOST": "127.0.0.1",
            "QUICKSHARE_PORT": "8080",
            "QUICKSHARE_DEBUG": "yes",
            "QUICKSHARE_MAX_UPLOAD_MB": "2",
            "QUICKSHARE_MAX_CONTENT_LENGTH": "30",
        },
        config={
            "host": "0.0.0.0",
            "port": 9527,
            "debug": False,
            "max_upload_mb": 1024,
            "max_content_length": 100000,
        },
        data_dir=tmp_path,
    )
    assert settings.host == "127.0.0.1"
    assert settings.port == 8080
    assert settings.debug is True
    assert settings.max_upload_bytes == 2 * 1024 * 1024
    assert settings.max_upload_mb == 2
    assert settings.text_file == tmp_path / "texts.json"
    assert settings.upload_folder == tmp_path / "uploads"
    assert settings.text_file.parent == settings.upload_folder.parent
    assert settings.md5_cache_file.parent == settings.categories_file.parent == tmp_path


def test_project_config_file_is_what_the_app_reads():
    settings = load_settings(environ={}, config=None)
    assert settings.port == 9527
    assert settings.max_upload_mb == 1024
    assert settings.debug is False
    assert settings.data_dir.name == "data"
    assert (settings.data_dir.parent / "pyproject.toml").is_file()
    assert settings.upload_folder.parent == settings.text_file.parent == settings.data_dir


def test_relative_data_dir_stays_next_to_the_project(tmp_path):
    settings = load_settings(
        environ={"QUICKSHARE_DATA_DIR": str(tmp_path / "shared")},
        config={
            "host": "0.0.0.0",
            "port": 9527,
            "debug": False,
            "max_upload_mb": 1,
            "max_content_length": 10,
            "data_dir": "data",
        },
    )
    assert settings.data_dir == tmp_path / "shared"


def test_invalid_port_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        load_settings(environ={"QUICKSHARE_PORT": "0"}, config={}, data_dir=tmp_path)
    with pytest.raises(ValueError):
        load_settings(environ={"QUICKSHARE_PORT": "nope"}, config={}, data_dir=tmp_path)
