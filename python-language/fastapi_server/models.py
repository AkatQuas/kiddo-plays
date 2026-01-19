from enum import Enum

from fastapi import FastAPI


class ModelName(str, Enum):
    AlexNet = "AlexNet"
    ResNet = "ResNet"
    LeNet = "LeNet"


def register_models(app: FastAPI):
    @app.get("/models/{model_name}/")
    async def get_model(model_name: ModelName):
        if model_name is ModelName.AlexNet:
            return {"model_name": model_name, "message": "Deep Learning FTW"}
        if model_name.value == ModelName.LeNet.value:
            return {"model_name": model_name, "message": "LeCNN all the images"}
        return {"model_name": model_name, "message": "Have some residuals"}
