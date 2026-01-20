import time

import anyio
from asyncer import asyncify, runnify,syncify

async def do_async_work(name: str):
    await anyio.sleep(1)
    return f"Hello, {name}"

def do_sync_work(name: str):
    time.sleep(1)
    return f"Hello, {name}"


async def main():
    message = await do_async_work(name="42")
    print("raw async", message)

    message = await asyncify(do_sync_work)(name="World")
    print("change sync to async", message)

    print("main async")
    return message

if __name__ == "__main__":
    result = anyio.run(main)
    print("main result", result)

    # runnify uses `anyio.run` underneath
    result = runnify(do_async_work)(name="runnify")
    print("async to sync using runnify", result)
