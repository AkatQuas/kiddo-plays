import os

from vllm.sampling_params import RequestOutputKind

tp_size = int(os.environ.get("TP_SIZE", 1))
pp_size = int(os.environ.get("PP_SIZE", 1))
dist_backend = str(os.environ.get("DIST_BACKEND", "mp"))
gpu_memory_utilization = float(os.environ.get("GPU_UTIL", 0.9))

ENGINE_ARGS = {
    "tensor_parallel_size": tp_size,
    "pipeline_parallel_size": pp_size,
    "distributed_executor_backend": dist_backend,
    "gpu_memory_utilization": gpu_memory_utilization,
    "max_num_batched_tokens": 2048,
    "max_model_len": 8192,
    "max_num_seqs": 256,
    "disable_log_requests": True,
    "disable_log_stats": True,
    "dtype": "float16",
}

# SamplingParams
SAMPLING_PARAMS = {
    "temperature": 1,
    "top_p": 1,
    "top_k": 25,
    # "min_tokens": 80,
    # "presence_penalty": 1.0,
    # "frequency_penalty": 0.0,
    "max_tokens": 2048,
    "detokenize": False,
    "ignore_eos": False,
    "output_kind": RequestOutputKind.DELTA
}

OVERWRITE_NORMALIZER_CACHE = True

ESTIMATOR_COUNT = 4
