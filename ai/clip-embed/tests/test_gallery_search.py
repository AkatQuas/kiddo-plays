import numpy as np

from clip_embed.gallery import GalleryStore


def test_gallery_search_returns_most_similar(tmp_path):
    store = GalleryStore(tmp_path)

    base = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)
    near = np.array([[0.9, 0.1, 0.0]], dtype=np.float32)
    far = np.array([[0.0, 1.0, 0.0]], dtype=np.float32)

    store.add("a.jpg", base, image_id="a")
    store.add("b.jpg", near, image_id="b")
    store.add("c.jpg", far, image_id="c")

    results = store.search(base, top_k=2)

    assert len(results) == 2
    assert results[0]["id"] == "a"
    assert results[0]["similarity"] == 1.0
    assert results[1]["id"] == "b"
    assert results[1]["similarity"] > results[0]["similarity"] - 0.2


def test_gallery_remove_and_reload(tmp_path):
    store = GalleryStore(tmp_path)
    vector = np.array([[0.5, 0.5, 0.0]], dtype=np.float32)
    store.add("x.jpg", vector, image_id="x")

    reloaded = GalleryStore(tmp_path)
    assert len(reloaded.list_items()) == 1

    reloaded.remove("x")
    assert reloaded.list_items() == []

    final = GalleryStore(tmp_path)
    assert final.list_items() == []
