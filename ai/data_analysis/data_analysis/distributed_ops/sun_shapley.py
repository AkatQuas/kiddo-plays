"""Sun-Shapley averages of sequential factor contributions.

A two-factor product has two orders. Laspeyres gives the whole cross term to
the second factor. The Sun-Shapley value splits that cross term in half by
averaging both orders. An additive SUM grouped by a dimension does not move
when the drill order changes; the average over permutations is the standalone
member diff, and the code still forms that average.
"""

from itertools import permutations
from math import factorial

_MAX_DIMENSIONS = 4


def two_factor_shapley(p0: float, p1: float, q0: float, q1: float) -> tuple[float, float]:
    """Average of (volume then rate) and (rate then volume).

    volume = ((p0 + p1) / 2) * (q1 - q0)
    rate   = ((q0 + q1) / 2) * (p1 - p0)
    The two effects add up to p1*q1 - p0*q0.
    """
    volume = 0.5 * ((p0 * (q1 - q0)) + (p1 * (q1 - q0)))
    rate = 0.5 * ((q0 * (p1 - p0)) + (q1 * (p1 - p0)))
    return volume, rate


def average_member_diffs(
    member_diffs_by_dim: dict[str, dict[str, float]],
) -> tuple[dict[str, dict[str, float]], int, list[str]]:
    """Average each dimension member's diff over permutations of the dimension set.

    At most four dimensions are enumerated (24 orderings). Extra names are
    returned in the third value and are not part of the average.
    """
    names = list(member_diffs_by_dim)
    skipped = names[_MAX_DIMENSIONS:]
    dims = names[:_MAX_DIMENSIONS]
    if not dims:
        return {}, 0, skipped
    used = factorial(len(dims))
    averaged = {dim: {value: 0.0 for value in member_diffs_by_dim[dim]} for dim in dims}
    for perm in permutations(dims):
        for dim in perm:
            for value, diff in member_diffs_by_dim[dim].items():
                averaged[dim][value] += diff / used
    return averaged, used, skipped
