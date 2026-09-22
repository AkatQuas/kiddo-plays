from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import numpy as np
import torch
from PIL import Image


@dataclass
class FakeOutput:
    pooler_output: torch.Tensor


@patch("clip_embed.model.get_model_state")
def test_extract_features_handles_pooler_output(mock_get_state):
    from clip_embed.model import extract_features

    tensor = torch.ones(1, 768)
    mock_state = MagicMock()
    mock_state.device = "cpu"
    mock_state.processor.return_value = {"pixel_values": torch.zeros(1, 3, 224, 224)}
    mock_state.model.get_image_features.return_value = FakeOutput(pooler_output=tensor)
    mock_get_state.return_value = mock_state

    result = extract_features(Image.new("RGB", (64, 64)))

    assert result.shape == (1, 768)
    np.testing.assert_allclose(np.linalg.norm(result), 1.0, rtol=1e-5)


@patch("clip_embed.model.get_model_state")
def test_extract_features_handles_raw_tensor(mock_get_state):
    from clip_embed.model import extract_features

    tensor = torch.ones(1, 768) * 2
    mock_state = MagicMock()
    mock_state.device = "cpu"
    mock_state.processor.return_value = {"pixel_values": torch.zeros(1, 3, 224, 224)}
    mock_state.model.get_image_features.return_value = tensor
    mock_get_state.return_value = mock_state

    result = extract_features(Image.new("RGB", (64, 64)))

    assert result.shape == (1, 768)
    np.testing.assert_allclose(np.linalg.norm(result), 1.0, rtol=1e-5)
