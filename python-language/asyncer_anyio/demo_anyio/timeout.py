from anyio import create_task_group, move_on_after, sleep, run, fail_after



async def use_fail():
    async with create_task_group() as tg:
        try:
            with fail_after(1) as scope:
                print("fail_after: Starting sleep")
                await sleep(2)
                print('This should never be printed')
        except TimeoutError as exc:
            print('fail_after: Exited cancel scope, cancelled =', scope.cancelled_caught)

async def use_move():
    async with create_task_group() as tg:
        with move_on_after(1) as scope:
            print('move_on_after: Starting sleep')
            await sleep(2)
            print('This should never be printed')

        # The cancelled_caught property will be True if timeout was reached
        print('move_on_after: Exited cancel scope, cancelled =', scope.cancelled_caught)

if __name__ == "__main__":
    run(use_move)
    run(use_fail)
