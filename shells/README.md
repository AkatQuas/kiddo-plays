# Shells

A collection of shell scripts. Updating aperiodically.

- [select job from Procfile](./select-job-from-procfile): Using scripts to select some job listed in Procfile.

- [Makefiles](./makefiles): Several Makefile templates.

- [Shell checks](https://github.com/koalaman/shellcheck)

- [Shell basic 101](https://missing.csail.mit.edu/2020/shell-tools/)

  > _How should you organize your dotfiles?_ They should be in their own folder, under version control, and symlinked into place using a script.

  <details>
  <summary>Some special variables to refer to arguments, error codes, and other releavant variables</summary>

  - `$0` - Name of the script
  - `$1` to `$9` - Arguments to the script. `$1` is the first argument and so on.
  - `$@` - All the arguments
  - `$#` - Number of arguments
  - `$?` - Return code of the previous command
  - `$$` - Process identification number (PID) for the current script
  - `!!` - Entire last command, including arguments. A common pattern is to execute a command only for it to fail due to missing permissions; you can quickly re-execute the command with sudo by doing `sudo !!`
  - `$_` - Last argument from the last command. If you are in an interactive shell, you can also quickly get this value by typing `Esc` followed by .

  </details>

  <details>
  <summary>Expanding expressions techniques </summary>

  - Wildcards - Whenever you want to perform some sort of wildcard matching, you can use `?` and `*` to match one or any amount of characters respectively. For instance, given files `foo`, `foo1`, `foo2`, `foo10` and `bar`, the command rm `foo?` will delete `foo1` and `foo2` whereas rm `foo*` will delete all but `bar`.
  - Curly braces `{}` - Whenever you have a common substring in a series of commands, you can use curly braces for bash to expand this automatically. This comes in very handy when moving or converting files.

  </details>

  <details>
  <summary>Batch manipulation on files using globbing</summary>

  ```bash
  # Find all python files that have a folder named test in their path
  find . -path '*/test/*.py' -type f

  # Delete all files with .tmp extension
  find . -name '*.tmp' -exec rm {} \;

  # Find all conf files and back up them
  find . -name '*.conf' -exec convert {} {}.bak \;
  ```

  </details>
