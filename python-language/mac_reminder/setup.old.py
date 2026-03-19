from typing import List, Sequence, Tuple

from setuptools import setup

APP = ['main.py']
# DATA_FILES = ['config.yaml']
DATA_FILES: List[Tuple[str, Sequence[str]]] = [('.', ['config.yaml'])]
OPTIONS = {
    'argv_emulation': True,
    'packages': ['apscheduler', 'fastapi', 'uvicorn', 'pydantic', 'pyobjc','Foundation', 'UserNotifications'],
    'plist': {
        'CFBundleName': 'MacReminder',
        'CFBundleDisplayName': 'MacReminder',
        'CFBundleVersion': '1.0.0',
        'LSUIElement': True,  # 隐藏Dock图标，后台运行
    }
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
