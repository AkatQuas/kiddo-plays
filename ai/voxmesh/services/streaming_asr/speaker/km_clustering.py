from typing import List, Optional, Tuple

import numpy as np
from common.logger_config import logger

# from scipy.spatial.distance import cdist
from pyannote.core.utils.distance import (
    cdist,
)  # 比 scipy 的 cdist 多了几种 metric 可以用


class IncrementalSpeakerClustering:
    def __init__(
        self, delta_new: float, metric: Optional[str] = "cosine", max_speakers: int = 20, learning_rate: float = 0.1, features_per_speaker: int = 3
    ):
        self.delta_new = delta_new  # 设定一个阈值来判断是否需要新的 centroid
        self.metric = metric  # 距离度量方式，默认为 "cosine"
        self.max_speakers = max_speakers  # 最大的 global speakers 数量
        self.rho_update = 0.3
        self.learning_rate = learning_rate  # 学习率，控制centroid更新的步长
        self.features_per_speaker = features_per_speaker  # 每个说话人维护的特征份数
        self.centers: Optional[np.ndarray] = None  # 存储所有 centroids 的 numpy 数组
        self.counts = np.zeros(
            self.max_speakers * self.features_per_speaker, dtype=int
        )  # 存储每个 centroid 的计数器，为每个说话人维护多份特征
        self.registered_speakers = {}  # 存储位置到说话人ID的映射 {position: speaker_id}
        self.last_speaker = None  # 记录上一次的说话人

    def get_next_center_position(self) -> Optional[int]:
        """寻找下一个可用的位置来存储新的中心点。
        只返回每个说话人组的第一个位置，用于创建新说话人。

        返回值
        ------
        next_position: int 或 None
            下一个可用位置的索引；如果没有可用位置，则为 None。
        """
        # 只查找每个说话人组的第一个位置来创建新说话人
        for speaker_id in range(self.max_speakers):
            first_pos = speaker_id * self.features_per_speaker
            if np.all(self.centers[first_pos] == 0):
                return first_pos

        # 如果所有第一个位置都被占用，说明已达到最大说话人数限制
        return None

    def init_centers(self, dimension: int):
        """初始化 centroid 矩阵，为每个说话人维护多个特征槽位"""
        self.centers = np.zeros((self.max_speakers * self.features_per_speaker, dimension))

    def register_speakers(self, speakers_data: List[dict]):
        """注册预定义的说话人

        参数:
        speakers_data: List[dict] - 包含speaker_id和embedding的列表
            [{"speaker_id": "1", "embedding": base64_encoded_embedding}, ...]
        """
        import base64

        if not speakers_data:
            return

        logger.info(f"注册 {len(speakers_data)} 个预定义说话人")

        # 如果还没有初始化centers，使用第一个embedding的维度来初始化
        first_embedding_data = base64.b64decode(speakers_data[0]["embedding"])
        first_embedding = np.frombuffer(first_embedding_data, dtype=np.float32)

        if self.centers is None:
            self.init_centers(first_embedding.shape[0])

        for i, speaker_data in enumerate(speakers_data):
            if i >= self.max_speakers:
                logger.warning(f"超过最大说话人数限制 {self.max_speakers}，忽略后续说话人")
                break

            speaker_id = speaker_data["speaker_id"]
            embedding_data = base64.b64decode(speaker_data["embedding"])
            embedding = np.frombuffer(embedding_data, dtype=np.float32)

            # 计算该说话人在centers中的位置
            position = i * self.features_per_speaker
            self.centers[position] = embedding
            self.counts[position] = 1

            # 记录位置到说话人ID的映射
            self.registered_speakers[position] = speaker_id

            logger.info(f"注册说话人 {speaker_id} 到位置 {position}")

    def get_speaker_id_from_position(self, position: int) -> str:
        logger.info(f"get_speaker_id_from_position: {position}")
        """根据位置获取说话人ID"""
        # 如果是注册的说话人，直接返回注册的ID
        if position in self.registered_speakers:
            return self.registered_speakers[position]

        # 如果不是注册的说话人，返回基于位置的ID
        speaker_index = position // self.features_per_speaker
        return str(speaker_index)

    def has_registered_speakers(self) -> bool:
        """检查是否有注册的说话人"""
        return len(self.registered_speakers) > 0

    def get_default_speaker(self) -> str:
        """获取默认说话人ID"""
        if self.has_registered_speakers():
            # 如果有注册说话人，返回第一个注册的说话人ID
            first_position = min(self.registered_speakers.keys())
            return self.registered_speakers[first_position]
        else:
            # 如果没有注册说话人，返回默认ID
            return "0"

    def update(self, global_speaker: int, embedding: np.ndarray):
        """更新已知的 centroid，使用学习率进行加权更新，并添加新特征"""
        assert global_speaker < len(self.centers), "Cannot update unknown centers"

        logger.info(f"update global_speaker: {global_speaker}")

        # 使用学习率进行加权更新: new_centroid = (1-lr) * old_centroid + lr * new_embedding
        self.centers[global_speaker] = (
            (1 - self.learning_rate) * self.centers[global_speaker] +
            self.learning_rate * embedding
        )

        # 为该说话人查找下一个可用的特征槽位
        speaker_id = global_speaker // self.features_per_speaker
        start_idx = speaker_id * self.features_per_speaker
        end_idx = (speaker_id + 1) * self.features_per_speaker

        # 在该说话人的特征槽位中寻找空位来添加新特征
        for i in range(start_idx, end_idx):
            if i != global_speaker and np.all(self.centers[i] == 0):
                self.centers[i] = embedding
                self.counts[i] += 1
                break

    def add_center(self, embedding: np.ndarray) -> int:
        """新增一个 centroid，并返回它的 index"""
        next_position = self.get_next_center_position()

        # 检查是否还有可用位置
        if next_position is None or next_position >= self.max_speakers * self.features_per_speaker:
            raise IndexError("No available positions to add a new centroid.")
        self.centers[next_position] = embedding
        return next_position

    def _fuse_embeddings(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """融合多个embeddings并进行L2归一化"""
        if len(embeddings) == 0:
            raise ValueError("embedding列表不能为空")

        # 特征融合 (均值 + L2归一化)
        final_embedding = np.mean(embeddings, axis=0)
        # L2归一化
        norm = np.linalg.norm(final_embedding)
        if norm > 0:
            final_embedding = final_embedding / norm
        return final_embedding

    def _vote_for_speaker(self, embeddings: List[np.ndarray], non_zero_centers: np.ndarray) -> Tuple[str, float]:
        """对多个embeddings分别检索并投票选择最终说话人"""
        speaker_votes = {}  # {speaker_id: [(global_speaker, distance), ...]}

        for emb in embeddings:
            # 计算距离
            distances = cdist(emb.reshape(1, -1), self.centers, metric=self.metric).flatten()

            # 找最近的质心
            valid_distances = distances[non_zero_centers]
            min_idx = np.argmin(valid_distances)
            global_speaker = non_zero_centers[min_idx]
            min_distance = valid_distances[min_idx]

            speaker_id = self.get_speaker_id_from_position(global_speaker)

            # 投票统计
            if speaker_id not in speaker_votes:
                speaker_votes[speaker_id] = []
            speaker_votes[speaker_id].append((global_speaker, min_distance))

        # 找到得票最多的说话人
        max_votes = max(len(votes) for votes in speaker_votes.values())
        candidates = [speaker_id for speaker_id, votes in speaker_votes.items() if len(votes) == max_votes]

        # 如果有多个相同投票数的说话人，优先选择上一次的说话人
        if len(candidates) > 1 and self.last_speaker in candidates:
            most_voted_speaker = self.last_speaker
        else:
            most_voted_speaker = candidates[0]

        # 计算该说话人的平均距离
        avg_distance = np.mean([dist for _, dist in speaker_votes[most_voted_speaker]])

        # 记录这次的选择
        self.last_speaker = most_voted_speaker

        logger.info(f"多embedding投票结果: {[(k, len(v)) for k, v in speaker_votes.items()]}, 最终选择: {most_voted_speaker}")
        return most_voted_speaker, float(avg_distance)

    def _find_best_match(self, embedding: np.ndarray, non_zero_centers: np.ndarray) -> Tuple[str, float]:
        """为单个embedding找到最佳匹配的质心"""
        # 计算距离
        distances = cdist(embedding.reshape(1, -1), self.centers, metric=self.metric).flatten()

        # 在有效位置中找最小距离
        valid_distances = distances[non_zero_centers]
        min_idx = np.argmin(valid_distances)
        global_speaker = non_zero_centers[min_idx]
        min_distance = valid_distances[min_idx]

        speaker_id = self.get_speaker_id_from_position(global_speaker)
        return speaker_id, float(min_distance)

    def _try_match_existing_centers(self, embedding: np.ndarray, non_zero_centers: np.ndarray, allow_update_centroid: bool) -> Tuple[str, float]:
        """尝试匹配已有质心，如果距离小于阈值则匹配"""
        distances = cdist(embedding.reshape(1, -1), self.centers, metric=self.metric).flatten()

        # 确认是否有现有的centroid与这个embedding的距离小于阈值
        valid_map = np.intersect1d(np.where(distances < self.delta_new)[0], non_zero_centers)

        if valid_map.size > 0:
            # 在有效位置中找到距离最小的那个
            valid_distances = distances[valid_map]
            min_idx = np.argmin(valid_distances)
            global_speaker = valid_map[min_idx]
            min_distance = valid_distances[min_idx]

            # 判断是否需要更新该质心
            if min_distance < self.rho_update and allow_update_centroid:
                self.update(global_speaker, embedding)

            speaker_id = self.get_speaker_id_from_position(global_speaker)
            return speaker_id, float(min_distance)

        return None, None

    def identify_single_speaker(self, embeddings: List[np.ndarray]) -> Tuple[str, float]:
        """识别单一或多个 speaker 的 identity

        参数：
        embeddings: List[np.ndarray]
            该 speaker 的 embedding 列表，每个元素是一个 numpy 数组
        allow_new_speaker: bool
            是否允许创建新说话人，False时如果没有匹配则抛出异常

        返回：
        tuple: (speaker_id, distance)
            speaker_id: str - 该 speaker 对应的说话人ID (注册的speaker_id或自动生成的)
            distance: float - 与最近中心点的距离

        抛出：
        RuntimeError: 当allow_new_speaker为False且没有匹配的centroid时
        """

        if len(embeddings) == 0:
            raise RuntimeError("No embeddings provided")

        # 如果只有一个embedding（短音频）或者有注册特征，不允许创建新说话人
        allow_new_speaker = len(embeddings) > 1 and not self.has_registered_speakers()
        allow_update_centroid = not self.has_registered_speakers()

        if self.centers is None:
            if not allow_new_speaker:
                raise RuntimeError("No existing centroids and new speaker creation is disabled")

            self.init_centers(embeddings[0].shape[0])
            final_embedding = self._fuse_embeddings(embeddings)
            global_speaker = self.add_center(final_embedding)
            speaker_id = self.get_speaker_id_from_position(global_speaker)
            return speaker_id, 0.0  # 新建中心点，距离为0

        non_zero_centers = np.where(np.any(self.centers != 0, axis=1))[0]
        if len(non_zero_centers) == 0:
            raise RuntimeError("所有centroids都是零向量，无法进行说话人识别")

        if not allow_new_speaker:
            return self._vote_for_speaker(embeddings, non_zero_centers)

        final_embedding = self._fuse_embeddings(embeddings)

        if self.get_next_center_position() is None:
            return self._find_best_match(final_embedding, non_zero_centers)

        speaker_id, distance = self._try_match_existing_centers(final_embedding, non_zero_centers, allow_update_centroid)
        if speaker_id is not None:
            return speaker_id, distance

        global_speaker = self.add_center(final_embedding)
        self.counts[global_speaker] += 1
        speaker_id = self.get_speaker_id_from_position(global_speaker)
        return speaker_id, 0.0
