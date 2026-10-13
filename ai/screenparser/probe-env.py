import torch
import platform
from ultralytics import settings

print("Torch MPS avaliable: ", torch.backends.mps.is_available())
print("Platform arch: ", platform.machine())
print("Ultralytics dataset directory: ", settings["datasets_dir"])

