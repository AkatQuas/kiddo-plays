"""Speaker clustering session state serialization."""

from __future__ import annotations

import base64
from typing import Any, Optional

import numpy as np
from common.logger_config import logger


def _get_cluster(pooled_speaker_clustering: Any):
    if not pooled_speaker_clustering:
        return None
    speaker_clustering = pooled_speaker_clustering.speaker_clustering
    if not hasattr(speaker_clustering, "speaker_cluster"):
        return None
    return speaker_clustering.speaker_cluster


def save_speaker_clustering(pooled_speaker_clustering: Any) -> Optional[dict]:
    try:
        cluster = _get_cluster(pooled_speaker_clustering)
        if cluster is None:
            logger.error("无法从池中获取说话人识别模型 speaker_cluster 为空")
            return None

        cluster_state = {
            "delta_new": cluster.delta_new,
            "metric": cluster.metric,
            "max_speakers": cluster.max_speakers,
            "rho_update": cluster.rho_update,
            "learning_rate": cluster.learning_rate,
            "features_per_speaker": cluster.features_per_speaker,
            "registered_speakers": cluster.registered_speakers.copy(),
            "last_speaker": cluster.last_speaker,
        }

        if cluster.centers is not None:
            centers_bytes = cluster.centers.tobytes()
            cluster_state["centers"] = {
                "data": base64.b64encode(centers_bytes).decode("utf-8"),
                "shape": cluster.centers.shape,
                "dtype": str(cluster.centers.dtype),
            }
        else:
            cluster_state["centers"] = None

        if hasattr(cluster, "counts") and cluster.counts is not None:
            counts_bytes = cluster.counts.tobytes()
            cluster_state["counts"] = {
                "data": base64.b64encode(counts_bytes).decode("utf-8"),
                "shape": cluster.counts.shape,
                "dtype": str(cluster.counts.dtype),
            }
        else:
            cluster_state["counts"] = None

        logger.info(
            f"完整序列化说话人聚类状态: 注册说话人={len(cluster.registered_speakers)}, "
            f"centers形状={cluster.centers.shape if cluster.centers is not None else 'None'}, "
            f"last_speaker={cluster.last_speaker}"
        )
        return cluster_state
    except Exception as exc:
        logger.error(f"保存ASR实例的会话状态失败: {exc}")
        return None


def restore_speaker_clustering(pooled_speaker_clustering: Any, speaker_data: dict) -> bool:
    try:
        cluster = _get_cluster(pooled_speaker_clustering)
        if cluster is None:
            logger.error("无法从池中获取说话人识别模型", speaker_data)
            return False

        for key in (
            "delta_new",
            "metric",
            "max_speakers",
            "rho_update",
            "learning_rate",
            "features_per_speaker",
            "last_speaker",
        ):
            if key in speaker_data:
                setattr(cluster, key, speaker_data[key])

        if "registered_speakers" in speaker_data:
            cluster.registered_speakers = speaker_data["registered_speakers"].copy()

        centers_info = speaker_data.get("centers")
        if centers_info and centers_info.get("data"):
            centers_bytes = base64.b64decode(centers_info["data"])
            cluster.centers = np.frombuffer(centers_bytes, dtype=centers_info["dtype"]).reshape(
                centers_info["shape"]
            )
        else:
            cluster.centers = None

        counts_info = speaker_data.get("counts")
        if counts_info and counts_info.get("data"):
            counts_bytes = base64.b64decode(counts_info["data"])
            cluster.counts = np.frombuffer(counts_bytes, dtype=counts_info["dtype"]).reshape(
                counts_info["shape"]
            )
        elif cluster.centers is not None:
            cluster.counts = np.zeros(
                cluster.max_speakers * cluster.features_per_speaker,
                dtype=int,
            )

        logger.info(
            f"完整恢复说话人聚类状态: 注册说话人={len(cluster.registered_speakers)}, "
            f"centers形状={cluster.centers.shape if cluster.centers is not None else 'None'}, "
            f"last_speaker={cluster.last_speaker}"
        )
        return True
    except Exception as exc:
        logger.error(f"恢复ASR实例的会话状态失败: {exc}")
        return False
