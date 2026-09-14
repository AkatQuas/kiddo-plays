"""MQTT Subscriber (runs on the HOST, not in Docker).

Subscribes to the `sensor/+/data` topic on the Dockerized broker. Every inbound
message is a binary Protobuf payload; we deserialize it back into a
SensorReading and print the structured fields.

Usage:
    uv run python -m src.subscriber
"""

import sys
import time

import paho.mqtt.client as mqtt

from src import config

# The generated protobuf module lives in generated/, outside the `src` package,
# so we add generated/ to sys.path. The guard below gives a clear hint if the
# generated file is missing (run scripts/generate_proto.sh).
sys.path.insert(0, str(config.GENERATED_DIR))
try:
    from sensor_pb2 import SensorReading
except ImportError:
    sys.exit(
        "ERROR: generated/sensor_pb2.py not found. "
        "Run `bash scripts/generate_proto.sh` first (see README)."
    )


def on_connect(client, userdata, flags, reason_code, properties=None):
    """Subscribe once connected. Doing it here (rather than right after
    connect) guarantees the subscription is active before the first message."""
    if reason_code == 0:
        print(f"[sub] Connected to broker; subscribing to '{config.TOPIC_SUBSCRIBE}'")
        client.subscribe(config.TOPIC_SUBSCRIBE, qos=config.QOS)
    else:
        print(f"[sub] Connection FAILED, reason code={reason_code}")


def on_message(client, userdata, msg):
    """Callback fired for every message on a subscribed topic."""
    topic = msg.topic
    # msg.payload arrives as raw bytes.
    raw = msg.payload

    # --- DESERIALIZATION ------------------------------------------------------
    # Turn the binary blob back into a structured SensorReading object.
    reading = SensorReading()
    reading.ParseFromString(raw)

    # Print a raw-vs-decoded comparison so the transformation is obvious.
    print(
        f"\n[sub] Got {len(raw)} raw bytes on topic '{topic}' -> "
        f"{raw.hex()}"
    )
    print(
        f"[sub] Decoded: device={reading.device_id} "
        f"ts={reading.timestamp} ({time.strftime('%H:%M:%S', time.localtime(reading.timestamp))}) "
        f"temp={reading.temperature:.1f}°C "
        f"hum={reading.humidity:.1f}% "
        f"bat={reading.battery}%"
    )


def main() -> int:
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="subscriber-console",
    )
    client.on_connect = on_connect
    client.on_message = on_message

    if config.MQTT_USERNAME:
        client.username_pw_set(config.MQTT_USERNAME, config.MQTT_PASSWORD)

    client.connect(config.MQTT_HOST, config.MQTT_PORT, config.MQTT_KEEPALIVE)

    print(f"[sub] Listening on '{config.TOPIC_SUBSCRIBE}' (Ctrl+C to stop)")
    # loop_forever blocks and dispatches callbacks on the current thread.
    client.loop_forever()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[sub] Stopping subscriber...")