#!/usr/bin/env bash
# generate_proto.sh
# Compile proto/sensor.proto into Python code under generated/.
#
# We use grpcio-tools' bundled protoc so there is no need to install protoc
# system-wide. The generated module is `generated/sensor_pb2.py`.
#
# The generated file is also committed to the repo, so this script only needs
# to be re-run after you edit proto/sensor.proto.
set -euo pipefail

# Resolve the repo root (parent of the scripts/ directory) regardless of where
# the script is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="$REPO_ROOT/proto"
OUT_DIR="$REPO_ROOT/generated"

mkdir -p "$OUT_DIR"

echo ">> Compiling $PROTO_DIR/sensor.proto -> $OUT_DIR/sensor_pb2.py"

# -I <dir> : .proto import/search root
# --python_out : only generate the *_pb2.py message classes (we do not use gRPC
#                services here, so no _pb2_grpc is produced)
uv run python -m grpc_tools.protoc \
    -I "$PROTO_DIR" \
    --python_out="$OUT_DIR" \
    "$PROTO_DIR/sensor.proto"

echo ">> Done. Generated: $OUT_DIR/sensor_pb2.py"