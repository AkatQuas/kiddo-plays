"""Central configuration shared by publisher and subscriber.

Keeps broker address, port, authentication, topics and timing in one place so
both clients stay in sync and nothing is hard-coded across files.
"""

from pathlib import Path

# --- Broker connection ---------------------------------------------------------
# The broker runs in Docker and maps port 1883 to the host, so host-side
# clients simply connect to localhost.
MQTT_HOST = "localhost"  # or "127.0.0.1" / Docker host IP
MQTT_PORT = 1883

# For PRODUCTION (authentication enabled in mosquitto.conf), uncomment and fill:
# MQTT_USERNAME = "myuser"
# MQTT_PASSWORD = "mypassword"
# For this anonymous demo they are left as None.
MQTT_USERNAME = None
MQTT_PASSWORD = None

# --- Topic layout ----------------------------------------------------------------
# Publisher writes full readings; subscribers listen on the wildcard.
TOPIC_PREFIX = "sensor"
DEVICE_ID = "device-001"
TOPIC_PUBLISH = f"{TOPIC_PREFIX}/{DEVICE_ID}/data"
TOPIC_SUBSCRIBE = f"{TOPIC_PREFIX}/+/data"  # '+' matches any single device id

# --- Behaviour -------------------------------------------------------------------
# Seconds between two published readings.
PUBLISH_INTERVAL = 1.0

# Keep-alive (seconds) for the MQTT connection.
MQTT_KEEPALIVE = 60

# QoS for publish/subscribe. 1 = at-least-once delivery, broker acks.
QOS = 1

# Repo-relative helpers so clients can locate the generated protobuf module.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = PROJECT_ROOT / "generated"
PROTO_DIR = PROJECT_ROOT / "proto"