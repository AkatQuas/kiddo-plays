# Plagiarism Detection

Detect plagiarism among files.

## How to play

Use [dolos][dolos] to run plagiarism detection for source code.

```bash
# output metadata and similarity by file pairs
node ./dolos-similarity.mjs

# using info.csv to compare files
node ./dolos-similarity2.mjs
```

Use [jscpd][jscpd] to detect.

```bash
./node_modules/.bin/jscpd --pattern 'ts/*.ts'
```

[dolos]: https://dolos.ugent.be/guide/
[jscpd]: https://github.com/kucherenko/jscpd
