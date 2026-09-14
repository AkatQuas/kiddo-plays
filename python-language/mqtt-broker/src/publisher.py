"""MQTT Publisher (runs on the HOST, not in Docker).

Generates a simulated sensor reading every `PUBLISH_INTERVAL` seconds,
serializes it with Protobuf, and publishes the binary payload to the broker
container via MQTT.

Usage:
    uv run python -m src.publisher
"""

import random
import sys
import time

import paho.mqtt.client as mqtt

from src import config

# The generated protobuf module lives in generated/, outside the `src` package,
# so we add generated/ to sys.path. We guard the import so a missing file
# prints a clear hint instead of a bare stack trace.
sys.path.insert(0, str(config.GENERATED_DIR))
try:
    from sensor_pb2 import SensorReading
except ImportError:
    sys.exit(
        "ERROR: generated/sensor_pb2.py not found. "
        "Run `bash scripts/generate_proto.sh` first (see README)."
    )


class BatterySimulator:
    """Simulates a slowly draining battery so the log is more realistic."""

    def __init__(self, start: int = 100):
        self._level = start

    def state(self) -> int:
        # Occasionally drop by 1 percentage point, otherwise hold steady.
        self._level = max(0, self._level - (1 if random.random() < 0.25 else 0))
        return self._level


def on_connect(client, userdata, flags, reason_code, properties=None):
    """MQTT connect callback: report success/failure for easy debugging."""
    if reason_code == 0:
        print(
            f"[pub] Connected to broker at {config.MQTT_HOST}:{config.MQTT_PORT}"
        )
    else:
        print(f"[pub] Connection FAILED, reason code={reason_code}")


def main() -> int:
    battery = BatterySimulator(start=100)

    # Set up the MQTT client. VERSION2 is required by paho-mqtt >= 2.0 to get
    # the modern callback signatures (reason_code instead of the old rc).
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="publisher-device-001",
    )
    client.on_connect = on_connect

    if config.MQTT_USERNAME:
        client.username_pw_set(config.MQTT_USERNAME, config.MQTT_PASSWORD)

    # Connect to the Dockerized broker (mapped to localhost:1883), then spin up
    # its network loop in a background thread so callbacks fire automatically.
    client.connect(config.MQTT_HOST, config.MQTT_PORT, config.MQTT_KEEPALIVE)
    client.loop_start()

    print(f"[pub] Publishing to topic '{config.TOPIC_PUBLISH}' "
          f"every {config.PUBLISH_INTERVAL}s (Ctrl+C to stop)")

    try:
        while True:
            reading = SensorReading(
                device_id=config.DEVICE_ID,
                timestamp=int(time.time()),
                # Small random jitter around a plausible ambient temperature (°C).
                temperature=round(23.0 + random.uniform(-2.0, 4.0), 1),
                # Realistic humidity fluctuation (percent).
                humidity=round(55.0 + random.uniform(-10.0, 15.0), 1),
                battery=battery.state(),
            )

            # --- SERIALIZATION ------------------------------------------------
            # SensorReading -> bytes. This binary blob is exactly what travels
            # over the wire via MQTT.
            payload = reading.SerializeToString()
            print(f"[pub] Serialized {len(payload)} bytes: {payload.hex()}")

            # --- PUBLISH ------------------------------------------------------
            # QoS 1 = at-least-once delivery: the broker acknowledges each
            # message so we don't lose readings.
            info = client.publish(config.TOPIC_PUBLISH, payload, qos=config.QOS)
            info.wait_for_publish()

            # Short, human-friendly one-line log of what was sent.
            print(
                f"Published: {reading.device_id} "
                f"temp={reading.temperature:.1f} "
                f"hum={reading.humidity:.1f} "
                f"bat={reading.battery}"
            )

            time.sleep(config.PUBLISH_INTERVAL)
    except KeyboardInterrupt:
        print("\n[pub] Stopping publisher...")
    finally:
        client.loop_stop()
        client.disconnect()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())