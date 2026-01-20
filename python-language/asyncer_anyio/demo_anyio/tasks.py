import time
from anyio import sleep, create_task_group, run


async def some_task(num: int) -> None:
    print('Task', num, 'running')
    await sleep(1)
    print('Task', num, 'finished')


async def main() -> None:
    async with create_task_group() as tg:
        for num in range(5):
            tg.start_soon(some_task, num)

    print('All tasks finished!')

if __name__ == "__main__":
  start = time.time()
  run(main)
  elapsed = time.time() - start
  print(f"Elapsed, {elapsed}")
