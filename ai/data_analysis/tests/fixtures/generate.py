"""python -m tests.fixtures.generate --profile large --out /absolute/new/run-directory"""

import argparse
import json

from tests.fixtures.generators.table_fixture import generate, profile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("tiny", "small", "large", "stress"), required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    manifest = generate(profile(args.profile), args.out)
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
