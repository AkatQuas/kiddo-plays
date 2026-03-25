from mss import mss

# The simplest use, save a screenshot of the 1st monitor
with mss() as sct:
    # save to imag file
    sct.shot()
    # screenshot in memory
    s_memory = sct.grab(sct.monitors[1])
    print(s_memory)
