"""Tunables that belong to this pod.

Addresses of other pods and services (Redis, S3, the image engine) are not
here. Those come from the environment. See ``imgrelay.env``.
"""

# Process
BIND_HOST = "0.0.0.0"
BIND_PORT = 8000

# "s3" for shared output across pods. "local" writes inside this pod only
# and is wrong once more than one pod is running.
STORAGE_BACKEND = "s3"
LOCAL_OUTPUT_DIR = "/var/lib/imgrelay/outputs"
OBJECT_PREFIX = "jobs"
PRESIGN_SECONDS = 7 * 24 * 3600
S3_REGION = "us-east-1"
S3_CREATE_BUCKET = True

# Queue and worker policy
KEY_PREFIX = "imgrelay"
WORKER_CONCURRENCY = 2
MAX_ATTEMPTS = 3
QUEUE_BLOCK_SECONDS = 2
# Must stay above the engine timeout so a live call is not reclaimed.
HTTP_TIMEOUT_SECONDS = 300
VISIBILITY_SECONDS = HTTP_TIMEOUT_SECONDS + 30

# Job defaults
DEFAULT_STEPS = 40
DEFAULT_CFG_SCALE = 7.5
