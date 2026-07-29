# ⭐ Star History

Generate cumulative star chart (light/dark) for any GitHub repo.

## Usage

```bash
# install
pip install matplotlib numpy

# default: microsoft/vscode
python scripts/gen_star_history.py

# your repo
python scripts/gen_star_history.py --repo owner/name --start-date 2020-01-01

# re-fetch data (ignore cache)
python scripts/gen_star_history.py --refresh
```

Output: `assets/star-history-light.png` & `assets/star-history-dark.png`.

## Automated (GitHub Actions)

The included [`.github/workflows/star-history.yml`](.github/workflows/star-history.yml) runs weekly at 00:00 UTC Sunday. Just copy both files to your repo and update the `--repo` flag.

## Customize

Edit `ACCENT_COLOR` and `THEMES` at the top of the script — there are two commented-out palettes to choose from.
