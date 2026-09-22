import base64
import copy
import time

import numpy as np
import torch
from funasr import AutoModel
from funasr.auto.auto_model import prepare_data_iterator
from funasr.models.campplus.utils import merge_seque, smooth
from funasr.utils.load_utils import load_audio_text_image_video
from funasr.utils.misc import deep_update
from funasr.utils.timestamp_tools import timestamp_sentence, timestamp_sentence_en
from funasr.utils.vad_utils import merge_vad, slice_padding_audio_samples
from logger_config import get_logger
from tqdm import tqdm

try:
    from funasr.models.campplus.utils import distribute_spk, postprocess, sv_chunk
except ImportError:
    pass

logger = get_logger()


def decode_speaker_embeddings(speakers):
    """解码speakers参数中的base64编码的embedding"""
    decoded_speakers = []
    logger.info(f"开始解码 {len(speakers)} 个预定义说话人的embedding")

    for speaker in speakers:
        speaker_id = speaker.get('speaker_id', 'unknown')
        try:
            embedding_data = base64.b64decode(speaker["embedding"])
            embedding = np.frombuffer(embedding_data, dtype=np.float32)
            decoded_speakers.append({
                "speaker_id": speaker_id,
                "embedding": embedding
            })
            logger.debug(f"成功解码说话人 {speaker_id} 的embedding，维度: {embedding.shape}")
        except Exception as e:
            logger.error(f"解码说话人 {speaker_id} 的embedding失败: {e}")
            continue

    logger.info(f"embedding解码完成，成功解码 {len(decoded_speakers)}/{len(speakers)} 个说话人")
    return decoded_speakers

def find_most_similar_speaker(current_embedding, predefined_speakers):
    """在预定义的speakers中找到与当前embedding最相似的speaker"""
    if not predefined_speakers or current_embedding is None:
        logger.debug("没有预定义说话人或当前embedding为空")
        return None, float('inf')

    best_speaker_id = None
    min_distance = float('inf')
    similarities = []

    current_embedding_norm = current_embedding / np.linalg.norm(current_embedding)

    for speaker in predefined_speakers:
        speaker_id = speaker["speaker_id"]
        speaker_embedding = speaker["embedding"]
        speaker_embedding_norm = speaker_embedding / np.linalg.norm(speaker_embedding)

        # 使用余弦相似度计算距离 (1 - cosine_similarity)
        cosine_similarity = np.dot(current_embedding_norm, speaker_embedding_norm)
        distance = 1 - cosine_similarity
        similarities.append(f"{speaker_id}:{cosine_similarity:.4f}")

        if distance < min_distance:
            min_distance = distance
            best_speaker_id = speaker_id

    logger.debug(f"相似度计算结果: {', '.join(similarities)}, 最佳匹配: {best_speaker_id} (距离: {min_distance:.4f})")
    return best_speaker_id, min_distance


class AsrModel(AutoModel):
    def __init__(self, enable_batchsize, **kwargs):
        super().__init__(**kwargs)
        self.spk_uid = {}
        self.enable_batchsize = enable_batchsize

    def inference_with_vad(self, input, input_len=None, **cfg):
        kwargs = self.kwargs
        # step.1: compute the vad model
        deep_update(self.vad_kwargs, cfg)
        time.time()
        res = self.inference(
            input, input_len=input_len, model=self.vad_model, kwargs=self.vad_kwargs, **cfg
        )
        print(f'inference res len is {len(res)}')
        time.time()

        #  FIX(gcf): concat the vad clips for sense vocie model for better aed
        if cfg.get("merge_vad", False):
            for i in range(len(res)):
                res[i]["value"] = merge_vad(
                    res[i]["value"], kwargs.get("merge_length_s", 15) * 1000
                )
        speakers = cfg.get('speakers', [])
        speakers_identify = len(speakers) > 0
        decoded_speakers = decode_speaker_embeddings(speakers) if speakers_identify else []

        if speakers_identify:
            logger.info(f"启用预定义说话人识别模式，共有 {len(speakers)} 个预定义说话人")
            if decoded_speakers:
                logger.info(f"成功解码 {len(decoded_speakers)} 个说话人embedding")
            else:
                logger.warning("所有预定义说话人embedding解码失败")

        # step.2 compute asr model
        model = self.model
        deep_update(kwargs, cfg)
        temp_batch_size = max(int(kwargs.get("batch_size_s", 300)) * 1000, 1)
        if self.enable_batchsize:
            batch_size = max(int(kwargs.get("batch_size_s", 300)) * 1000, 1)
        else:
            batch_size = 1
        batch_size_threshold_ms = int(kwargs.get("batch_size_threshold_s", 60)) * 1000
        kwargs["batch_size"] = batch_size

        key_list, data_list = prepare_data_iterator(
            input, input_len=input_len, data_type=kwargs.get("data_type", None)
        )
        results_ret_list = []
        time_speech_total_all_samples = 1e-6

        time.time()
        pbar_total = (
            tqdm(colour="red", total=len(res), dynamic_ncols=True)
            if not kwargs.get("disable_pbar", False)
            else None
        )
        for i in range(len(res)):
            key = res[i]["key"]
            vadsegments = res[i]["value"]
            input_i = data_list[i]
            fs = kwargs["frontend"].fs if hasattr(kwargs["frontend"], "fs") else 16000
            speech = load_audio_text_image_video(input_i, fs=fs, audio_fs=kwargs.get("fs", 16000))
            speech_lengths = len(speech)
            n = len(vadsegments)
            data_with_index = [(vadsegments[i], i) for i in range(n)]
            sorted_data = sorted(data_with_index, key=lambda x: x[0][1] - x[0][0])
            results_sorted = []

            if not len(sorted_data):
                results_ret_list.append({"key": key, "text": "", "timestamp": []})
                logger.info("decoding, utt: {}, empty speech".format(key))
                continue

            if len(sorted_data) > 0 and len(sorted_data[0]) > 0:
                batch_size = max(batch_size, sorted_data[0][0][1] - sorted_data[0][0][0])

            if kwargs["device"] == "cpu":
                batch_size = 0
            print(f'batch size is {batch_size}')
            beg_idx = 0
            beg_asr_total = time.time()
            time_speech_total_per_sample = speech_lengths / 16000
            time_speech_total_all_samples += time_speech_total_per_sample

            # pbar_sample = tqdm(colour="blue", total=n, dynamic_ncols=True)

            all_segments = []
            max_len_in_batch = 0
            end_idx = 1
            for j, _ in enumerate(range(0, n)):
                # pbar_sample.update(1)
                sample_length = sorted_data[j][0][1] - sorted_data[j][0][0]
                potential_batch_length = max(max_len_in_batch, sample_length) * (j + 1 - beg_idx)
                # batch_size_ms_cum += sorted_data[j][0][1] - sorted_data[j][0][0]
                if (
                    j < n - 1
                    and sample_length < batch_size_threshold_ms
                    and potential_batch_length < batch_size
                ):
                    max_len_in_batch = max(max_len_in_batch, sample_length)
                    end_idx += 1
                    continue

                speech_j, speech_lengths_j = slice_padding_audio_samples(
                    speech, speech_lengths, sorted_data[beg_idx:end_idx]
                )
                results = self.inference(
                    speech_j, input_len=None, model=model, kwargs=kwargs, **cfg
                )
                if self.spk_model is not None:
                    # compose vad segments: [[start_time_sec, end_time_sec, speech], [...]]
                    for _b in range(len(speech_j)):
                        vad_segments = [
                            [
                                sorted_data[beg_idx:end_idx][_b][0][0] / 1000.0,
                                sorted_data[beg_idx:end_idx][_b][0][1] / 1000.0,
                                np.array(speech_j[_b]),
                            ]
                        ]
                        segments = sv_chunk(vad_segments)
                        print(f'vad_segments is {len(vad_segments)}, segments is {len(segments)}')
                        all_segments.extend(segments)
                        speech_b = [i[2] for i in segments]
                        print(f'speech_b is {len(speech_b)}, speech_b is {speech_b}, shape is {speech_b[0].shape}')
                        tmp = kwargs["batch_size"]
                        kwargs["batch_size"]= temp_batch_size
                        spk_res = self.inference(
                            speech_b, input_len=None, model=self.spk_model, kwargs=kwargs, **cfg
                        )
                        kwargs["batch_size"] = tmp
                        results[_b]["spk_embedding"] = spk_res[0]["spk_embedding"]
                        print(f'spk_res[0][spk_embedding] is {spk_res[0]["spk_embedding"].shape}')
                        # print(f' spk_res[0]["spk_embedding"] is { spk_res[0]["spk_embedding"]}')
                beg_idx = end_idx
                end_idx += 1
                max_len_in_batch = sample_length
                if len(results) < 1:
                    continue
                results_sorted.extend(results)

            # end_asr_total = time.time()
            # time_escape_total_per_sample = end_asr_total - beg_asr_total
            # pbar_sample.update(1)
            # pbar_sample.set_description(f"rtf_avg_per_sample: {time_escape_total_per_sample / time_speech_total_per_sample:0.3f}, "
            #                      f"time_speech_total_per_sample: {time_speech_total_per_sample: 0.3f}, "
            #                      f"time_escape_total_per_sample: {time_escape_total_per_sample:0.3f}")

            if len(results_sorted) != n:
                results_ret_list.append({"key": key, "text": "", "timestamp": []})
                logger.info("decoding, utt: {}, empty result".format(key))
                continue
            restored_data = [0] * n
            for j in range(n):
                index = sorted_data[j][1]
                restored_data[index] = results_sorted[j]
            result = {}

            # results combine for texts, timestamps, speaker embeddings and others
            # TODO: rewrite for clean code
            for j in range(n):
                for k, v in restored_data[j].items():
                    if k.startswith("timestamp"):
                        if k not in result:
                            result[k] = []
                        for t in restored_data[j][k]:
                            t[0] += vadsegments[j][0]
                            t[1] += vadsegments[j][0]
                        result[k].extend(restored_data[j][k])
                    elif k == "spk_embedding":
                        if k not in result:
                            result[k] = restored_data[j][k]
                        else:
                            result[k] = torch.cat([result[k], restored_data[j][k]], dim=0)
                    elif "text" in k:
                        if k not in result:
                            result[k] = restored_data[j][k]
                        else:
                            result[k] += " " + restored_data[j][k]
                    else:
                        if k not in result:
                            result[k] = restored_data[j][k]
                        else:
                            result[k] += restored_data[j][k]

            if not len(result["text"].strip()):
                continue
            logger.info(f"原始文本: {result['text']}")
            return_raw_text = kwargs.get("return_raw_text", False)
            # step.3 compute punc model
            raw_text = None
            if self.punc_model is not None:
                deep_update(self.punc_kwargs, cfg)
                punc_res = self.inference(
                    result["text"], model=self.punc_model, kwargs=self.punc_kwargs, **cfg
                )
                raw_text = copy.copy(result["text"])
                if return_raw_text:
                    result["raw_text"] = raw_text
                result["text"] = punc_res[0]["text"]
                logger.info(f"PUNC模型处理后文本: {result['text']}")

            # speaker embedding cluster after resorted
            if self.spk_model is not None and kwargs.get("return_spk_res", True):
                if raw_text is None:
                    logger.error("Missing punc_model, which is required by spk_model.")
                all_segments = sorted(all_segments, key=lambda x: x[0])
                spk_embedding = result["spk_embedding"]

                # 检查是否提供了预定义的speakers
                if speakers_identify and decoded_speakers:
                    logger.info(f"开始使用预定义speakers进行说话人识别，共有 {len(spk_embedding)} 个待识别的embedding")
                    # 为每个embedding找到最相似的预定义speaker
                    labels = []
                    last_matched_speaker = None

                    for idx, embedding in enumerate(spk_embedding.cpu()):
                        best_speaker_id, distance = find_most_similar_speaker(
                            embedding.numpy(), decoded_speakers
                        )

                        if best_speaker_id is not None:
                            labels.append(best_speaker_id)
                            last_matched_speaker = best_speaker_id
                            logger.debug(f"第{idx+1}个embedding -> 说话人{best_speaker_id} (距离: {distance:.4f})")
                        else:
                            # 如果没有找到相似的speaker，使用上一个匹配到的speaker
                            fallback_speaker = last_matched_speaker if last_matched_speaker is not None else "unknown"
                            labels.append(fallback_speaker)
                            logger.warning(f"第{idx+1}个embedding未找到匹配的说话人，使用{fallback_speaker}")

                    # 统计识别结果
                    speaker_counts = {}
                    for label in labels:
                        speaker_counts[label] = speaker_counts.get(label, 0) + 1

                    logger.info(f"预定义speakers识别完成，分配结果: {speaker_counts}")
                else:
                    # 没有提供预定义speakers，使用原有的聚类方法
                    logger.info("使用聚类方法进行说话人识别")
                    print(f'spk_embedding is {spk_embedding.cpu().shape}')
                    labels = self.cb_model(
                        spk_embedding.cpu(), oracle_num=kwargs.get("preset_spk_num", None)
                    )
                    logger.info(f"聚类识别完成, 共识别出 {len(set(labels))} 个说话人")

                # del result['spk_embedding']
                if speakers_identify and decoded_speakers:
                    # 使用预定义说话人时，使用postprocess_new
                    sv_output = postprocess_new(all_segments, None, labels, spk_embedding.cpu())
                    logger.info("使用postprocess_new处理预定义说话人识别结果")
                else:
                    # 使用聚类方法时，使用原有的postprocess
                    print(f'all seg is {len(all_segments)}')
                    print(f'label is {len(labels)}')
                    sv_output = postprocess(all_segments, None, labels, spk_embedding.cpu())
                    logger.info("使用postprocess处理聚类识别结果")
                if self.spk_mode == "vad_segment":  # recover sentence_list
                    sentence_list = []
                    for rest, vadsegment in zip(restored_data, vadsegments):
                        if "timestamp" not in rest:
                            logger.error(
                                "Only 'iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch' \
                                           and 'iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch'\
                                           can predict timestamp, and speaker diarization relies on timestamps."
                            )
                        sentence_list.append(
                            {
                                "start": vadsegment[0],
                                "end": vadsegment[1],
                                "sentence": rest["text"],
                                "timestamp": rest["timestamp"],
                            }
                        )
                elif self.spk_mode == "punc_segment":
                    if "timestamp" not in result:
                        logger.error(
                            "Only 'iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch' \
                                       and 'iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch'\
                                       can predict timestamp, and speaker diarization relies on timestamps."
                        )
                    if kwargs.get("en_post_proc", False):
                        sentence_list = timestamp_sentence_en(
                            punc_res[0]["punc_array"],
                            result["timestamp"],
                            raw_text,
                            return_raw_text=return_raw_text,
                        )
                    else:
                        sentence_list = timestamp_sentence(
                            punc_res[0]["punc_array"],
                            result["timestamp"],
                            raw_text,
                            return_raw_text=return_raw_text,
                        )
                distribute_spk(sentence_list, sv_output)
                result["sentence_info"] = sentence_list
            elif kwargs.get("sentence_timestamp", False):
                if not len(result["text"].strip()):
                    sentence_list = []
                else:
                    if kwargs.get("en_post_proc", False):
                        sentence_list = timestamp_sentence_en(
                            punc_res[0]["punc_array"],
                            result["timestamp"],
                            raw_text,
                            return_raw_text=return_raw_text,
                        )
                    else:
                        sentence_list = timestamp_sentence(
                            punc_res[0]["punc_array"],
                            result["timestamp"],
                            raw_text,
                            return_raw_text=return_raw_text,
                        )
                result["sentence_info"] = sentence_list
            if "spk_embedding" in result:
                del result["spk_embedding"]

            result["key"] = key
            results_ret_list.append(result)
            end_asr_total = time.time()
            time_escape_total_per_sample = end_asr_total - beg_asr_total
            if pbar_total:
                pbar_total.update(1)
                pbar_total.set_description(
                    f"rtf_avg: {time_escape_total_per_sample / time_speech_total_per_sample:0.3f}, "
                    f"time_speech: {time_speech_total_per_sample: 0.3f}, "
                    f"time_escape: {time_escape_total_per_sample:0.3f}"
                )

        # end_total = time.time()
        # time_escape_total_all_samples = end_total - beg_total
        # print(f"rtf_avg_all: {time_escape_total_all_samples / time_speech_total_all_samples:0.3f}, "
        #                      f"time_speech_all: {time_speech_total_all_samples: 0.3f}, "
        #                      f"time_escape_all: {time_escape_total_all_samples:0.3f}")
        return results_ret_list



def postprocess_new(
        segments: list, vad_segments: list, labels: np.ndarray, embeddings: np.ndarray
) -> list:
    assert len(segments) == len(labels)
    distribute_res = []
    for i in range(len(segments)):
        distribute_res.append([segments[i][0], segments[i][1], labels[i]])
    # merge the same speakers chronologically
    distribute_res = merge_seque(distribute_res)

    def is_overlapped(t1, t2):
        if t1 > t2 + 1e-4:
            return True
        return False

    # distribute the overlap region
    for i in range(1, len(distribute_res)):
        if is_overlapped(distribute_res[i - 1][1], distribute_res[i][0]):
            p = (distribute_res[i][0] + distribute_res[i - 1][1]) / 2
            distribute_res[i][0] = p
            distribute_res[i - 1][1] = p

    # smooth the result
    distribute_res = smooth(distribute_res)

    return distribute_res
