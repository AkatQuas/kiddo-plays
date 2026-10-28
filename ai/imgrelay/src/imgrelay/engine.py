"""Image engine seam.

The scheduler does not load a model. It calls an external image-to-image
HTTP engine. The contract is fixed so any server that speaks it can sit
behind this adapter.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from imgrelay.constants import HTTP_TIMEOUT_SECONDS
from imgrelay.jobs import JobRecord


class EngineError(RuntimeError):
    """The external engine rejected the job or returned nothing usable."""


class ImageEngine(Protocol):
    """Turn one claimed job into image bytes.

    Returns ``(body, content_type)``. Raises ``EngineError`` or any other
    exception when the attempt should count as a failure. Does not upload
    or touch the queue.
    """

    def edit(self, job: JobRecord) -> tuple[bytes, str]: ...


class HttpImageEngine:
    """POST ``{base}/v1/images/edits`` and read a raw image body back.

    JSON body: prompt, negative_prompt, input_image, width, height, steps,
    cfg_scale, seed. Success is HTTP 200 with ``Content-Type`` image/* and
    the bytes in the body. Error status or an empty body raises EngineError.
    """

    def __init__(self, base_url: str, client: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=HTTP_TIMEOUT_SECONDS)

    def edit(self, job: JobRecord) -> tuple[bytes, str]:
        spec = job.spec
        payload = {
            "prompt": spec.prompt,
            "negative_prompt": spec.negative_prompt,
            "input_image": spec.input_image,
            "width": spec.width,
            "height": spec.height,
            "steps": spec.steps,
            "cfg_scale": spec.cfg_scale,
            "seed": spec.seed,
        }
        try:
            response = self._client.post(f"{self.base_url}/v1/images/edits", json=payload)
        except httpx.HTTPError as exc:
            raise EngineError(str(exc)) from exc
        if response.status_code >= 400:
            detail = response.text[:300]
            raise EngineError(f"engine returned {response.status_code}: {detail}")
        if not response.content:
            raise EngineError("engine returned an empty body")
        content_type = response.headers.get("content-type", "image/png").split(";")[0].strip()
        return response.content, content_type or "image/png"

    def close(self) -> None:
        if self._owns_client:
            self._client.close()
