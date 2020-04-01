import functools

# decorator takes the advantage of closure
# decorator without extra arguments

def decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kw):
        # do wrapper logic
        return func(*args, **kw)
    return wrapper


# decorator with extra arguments

def decorator_with_arg(args):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kw):
            # do wrapper logic
            return func(*args, **kw)
        return wrapper
    return decorator


