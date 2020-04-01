# my git command

Git command wrapping [common-bin](https://github.com/node-modules/common-bin).

## Directory tree

```bash
test/fixtures/my-git
├── bin
│   └── my-git.js
├── command
│   ├── remote
│   │   ├── add.js
│   │   └── remove.js
│   ├── clone.js
│   └── remote.js
├── index.js
└── package.json
```

## [my-git-cmd.js](./bin/my-git-cmd.js)

## Run result

```bash
$ my-git-cmd clone gh://node-modules/common-bin dist --depth=1
git clone gh://node-modules/common-bin to dist with depth 1

$ my-git-cmd remote remove origin
git remote remove origin

$ my-git-cmd remote add origin gh://node-modules/common-bin
git remote add origin to gh://node-modules/common-bin with tags=false
```


