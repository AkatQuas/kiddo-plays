# Dota 2 showcase (Team Spirit)

Fetches public match data from the [OpenDota API](https://docs.opendota.com/) into `data/` (gitignored).

```bash
python fetch_opendota.py --team 7119388 --limit 30 --out data
```

Then start the service and run the `dota2` built-in example from the dashboard or `POST /api/v1/examples/dota2/run`.