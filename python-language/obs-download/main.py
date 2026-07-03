import os
import traceback

from obs import ObsClient


def main():
    ACCESS_KEY = os.getenv("ACCESS_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY")
    SERVER = os.getenv("SERVER")
    BUCKET_NAME = os.getenv("BUCKET_NAME")
    OBJECT_KEY = "amazon/images/kitten-1285341__340.jpg"

    # 创建obsClient实例
    obsClient = ObsClient(
        access_key_id=ACCESS_KEY, secret_access_key=SECRET_KEY, server=SERVER
    )
    try:
        # 获取对象元数据
        resp = obsClient.getObjectMetadata(BUCKET_NAME, OBJECT_KEY)
        # 返回码为2xx时，接口调用成功，否则接口调用失败
        if resp.status < 300:
            print("Get Object Metadata Succeeded")
            print("requestId:", resp.requestId)
            print("etag:", resp.body.etag)
            print("lastModified:", resp.body.lastModified)
            print("contentType:", resp.body.contentType)
            print("contentLength:", resp.body.contentLength)
        else:
            print("Get Object Metadata Failed")
            print("requestId:", resp.requestId)
            print("status:", resp.status)
            print("reason:", resp.reason)
    except Exception:
        print("Get Object Metadata Failed")
        print(traceback.format_exc())

    try:
        # 生成创建桶的带授权信息的URL
        res1 = obsClient.createSignedUrl(
            method="GET", bucketName=BUCKET_NAME, objectKey=OBJECT_KEY, expires=100
        )
        # createSignedUrl 返回 dict-like 对象，推荐使用字典访问方式获取签名URL和请求头
        print("signedUrl:", res1["signedUrl"])
        print("actualSignedRequestHeaders:", res1["actualSignedRequestHeaders"])

    except Exception:
        print(traceback.format_exc())

    # 关闭obsClient
    obsClient.close()


if __name__ == "__main__":
    main()
