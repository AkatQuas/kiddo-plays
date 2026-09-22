import logging

from fastapi import FastAPI

from clip_embed import __version__
from clip_embed.routes import embedding_router, search_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="clip-embed",
    description="CLIP image embedding API service",
    version=__version__,
)

app.include_router(embedding_router)
app.include_router(search_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}
