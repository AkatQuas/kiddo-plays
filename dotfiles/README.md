# dotfiles

My dotfile configurations using [`yadm`](https://yadm.io/).

## Prerequisites:

- [Homebrew](https://brew.sh/)
- Xcode Command Line Tools (will be installed by homebrew)

### Pre-Installation

```bash
# install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

To install `yadm` temporarily, then clone the dotfiles repo and bootstrap the system, run the following command:

```bash
curl -sL https://github.com/AkatQuas/dotfiles/raw/main/pre_bootstrap.sh | bash && rm pre_bootstrap.sh
```

### Init, add files and commit

```bash
yadm init
yadm add .vuerc
yadm commit -m 'vuerc'
yadm push
```

### Remove or untrack files

```bash
FILE=/path/to/not-want-track-file
mv "$FILE" "$FILE.bak"
yadm rm "$FILE"
yadm commit -m "remove"
yadm push
mv "$FILE.bak" "$FILE"
```

### Update plugins with submodules

```bash
yadm submodule update --remote
```

## Acknowledgement

The idea of `pre_bootstrap.sh` comes from [marcogreiveldinger](https://github.com/marcogreiveldinger/.dotfiles).
