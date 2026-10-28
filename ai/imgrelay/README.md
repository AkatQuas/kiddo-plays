# imgrelay

[中文](README.zh-CN.md)

Multi-pod scheduler for image-to-image jobs. This process does not load a model. It puts jobs on a shared queue, calls an image-to-image HTTP engine outside the pod, and writes the result to S3 or to a directory on this pod.

Use it when:

- Several replicas consume one queue in front of an image-to-image service you already run
- Jobs need retries, expired-claim recovery, and a pollable result
- Object storage speaks the S3 API (AWS, MinIO, Cloudflare R2, and others)

Do not use it when:

- The diffusion model should run inside this process
- You want an in-process memory queue. The only queue implementation is Redis
- More than one pod should write results to its own local disk. The local directory is valid only when `STORAGE_BACKEND = "local"` and a single pod is running

## Modules

| Module | Callers need to know | Hidden behind the interface |
| --- | --- | --- |
| JobBoard | submit, get, claim, ack, retry, fail | Redis lists, leases, expiry |
| Scheduler | run one claimed job, or start this pod's workers | attempt limit, concurrency, call order |
| ImageEngine | a job in, image bytes out | HTTP path, timeout, status codes |
| ObjectStore | store bytes, return a result reference | S3 presign, or a path inside the pod |

Names are defined in [GLOSSARY.md](GLOSSARY.md).

A job moves like this:

```
POST /v1/jobs
  → JobBoard.submit (Redis, first-come first-served)
any pod's Scheduler
  → claim
  → POST {ENGINE_BASE_URL}/v1/images/edits
  → ObjectStore.put
  → ack / retry / fail
GET /v1/jobs/{id}
  → any pod can read status and result_ref
```

If a worker disappears after a claim, the job returns to the tail once the visibility window ends. It is marked failed after `MAX_ATTEMPTS`. Retries join the tail and do not jump the queue.

## Constants and environment

Policy lives in [`src/imgrelay/constants.py`](src/imgrelay/constants.py). Change behaviour there and rebuild the image. That file covers the bind address, storage backend, concurrency, retry limit, HTTP timeout, presign lifetime, and default step count.

Environment variables describe only services outside this pod:

| Variable | Required |
| --- | --- |
| `REDIS_URL` | always |
| `ENGINE_BASE_URL` | always, for example `http://engine:8081` |
| `S3_ENDPOINT_URL` | when `STORAGE_BACKEND == "s3"` |
| `S3_BUCKET` | same |
| `S3_ACCESS_KEY_ID` | same |
| `S3_SECRET_ACCESS_KEY` | same |
| `S3_REGION` | optional, default `us-east-1` |

To keep results on this pod, set `STORAGE_BACKEND` to `"local"`. Files go to `LOCAL_OUTPUT_DIR`. `result_ref` is an absolute path on that pod. Other pods cannot read it.

## Engine contract

`HttpImageEngine` posts JSON to `{ENGINE_BASE_URL}/v1/images/edits`:

```json
{
  "prompt": "forest",
  "negative_prompt": "",
  "input_image": "https://example.com/in.png",
  "width": null,
  "height": null,
  "steps": 40,
  "cfg_scale": 7.5,
  "seed": null
}
```

Success is HTTP 200 with `Content-Type` `image/png`, `image/jpeg`, or `image/webp`, and the image bytes as the body. A 4xx/5xx status or an empty body counts as one failed attempt.

`input_image` must be an http(s) URL the engine can fetch itself. The scheduler does not download the source image and does not accept a file upload.

`examples/mock_engine.py` returns a 1×1 PNG. It only exists so the scheduling path can be exercised.

## API

`POST /v1/jobs`

```json
{
  "prompt": "replace the background with a forest",
  "input_image": "https://example.com/in.jpg",
  "steps": 40
}
```

The response carries `job_id` and `status: waiting`.

`GET /v1/jobs/{job_id}`

`status` is `waiting`, `running`, `finished`, or `failed`. On success, `result_ref` is a presigned URL or a local path. On failure, read `error`.

`GET /v1/health` reports whether this process can ping Redis.

## Run

Tests do not need Redis:

```bash
pip install -e ".[dev]"
pytest
```

From `deploy/`, Compose starts Redis, MinIO, the mock engine, and the scheduler:

```bash
docker compose up --build
```

The Compose file uses MinIO's published local defaults (`minioadmin` / `minioadmin`). Those values are for this local stack only.

Submit a job:

```bash
curl -s localhost:8000/v1/jobs \
  -H 'content-type: application/json' \
  -d '{"prompt":"forest","input_image":"https://example.com/in.png"}'
```

Poll `GET /v1/jobs/{job_id}` with the returned id. The bucket is created on first startup when `S3_CREATE_BUCKET` is true.

For more than one replica, point every pod at the same `REDIS_URL`, `ENGINE_BASE_URL`, and S3 variables, and leave `STORAGE_BACKEND = "s3"`. Pods claim independently and share no memory.

## License

MIT. See [LICENSE](LICENSE).
