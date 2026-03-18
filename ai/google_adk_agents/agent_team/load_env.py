import os

from dotenv import load_dotenv


def load_env():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, ".env")
    load_dotenv(dotenv_path=env_path)
