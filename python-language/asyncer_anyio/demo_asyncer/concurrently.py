import time

import anyio
import asyncer
async def do_async_work(name: str, t =1):
    await anyio.sleep(t)
    message = (f"Hello, {name}")
    print(message)
    return message

async def get_data():
    async with asyncer.create_task_group() as task_group:
        r1 = task_group.soonify(do_async_work)(name="jack", t=2)
        r2 = task_group.soonify(do_async_work)(name="betty")
        r3 = task_group.soonify(do_async_work)(name="42")
        await anyio.sleep(3)
        if r1.ready:
            print(f"Preview value 1: {r1.value}")

    result = [r1.value, r2.value, r3.value]
    return result

if __name__ == "__main__":
    start = time.time()

    result = anyio.run(get_data)
    print(f"Result, {result}")

    elapsed = time.time() - start
    print(f"Time elapsed, {elapsed}")
