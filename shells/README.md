# Shells

A collection of shell scripts. Updating aperiodically.

- [select job from Procfile](./select-job-from-procfile): Using scripts to select some job listed in Procfile.

- [Makefiles](./makefiles): Several Makefile templates.

  - [跟我一起写 makefile.pdf](https://github.com/huyubing/books-pdf/blob/master/%E8%B7%9F%E6%88%91%E4%B8%80%E8%B5%B7%E5%86%99makefile.pdf)

  - [GNU Automake](https://github.com/huyubing/books-pdf/blob/master/automake.pdf)

- [Shell checks](https://github.com/koalaman/shellcheck)

- [Shell quick tutorials (Simplified Chinese)](https://wangdoc.com/bash/intro.html)

- [Shell 脚本学习指南.pdf (Simplified Chinese)](https://github.com/huyubing/books-pdf/blob/master/Shell%E8%84%9A%E6%9C%AC%E5%AD%A6%E4%B9%A0%E6%8C%87%E5%8D%97.pdf)

- [Explain shell](https://www.explainshell.com/)

- [tldr manpage for command](https://github.com/tldr-pages/tldr)

- [Shell basic 101](https://missing.csail.mit.edu/2020/shell-tools/)

  `sed`, `awk`, `grep`, `printf`, `head`, `tail`, `sort`, `cut`, `tr`, `wc`.

  `bg`, `fg`, `jobs`, `kill`, `command`, `read`, `times`, `sleep`.

  `gzip`, `tar`.

  `mktemp`, `find`, `locate`.

  `ps`, `top`, `crontab`.

  `kill` ( `ABRT`, `HUP`, `KILL`, `TERM` ), `trap`.

  `set`, `shopt`, `getopts`.

  <details>
  <summary>Expansion</summary>

  ```bash
  # $varname exist and not null, using $varname
  # #varname undefined, using `word`
  ${varname:-word}
  ```

  ```bash
  # $varname exist and not null, using $varname
  # #varname undefined, using `word`
  ${varname:=word}
  ```

  ```bash
  # $varname exist and not null, using $varname
  # #varname undefined, script exit with error message `message`
  ${varname:?message}
  ```

  </details>

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

## Commands for network

1. ifconfig / ipconfig

   This command outputs your current networking configuration, including your computer’s assigned IP address, its default gateway, and information about your DNS server.

   ```bash
   # show the whole network configuration
   $ ifconfig

   # show the configuration for ethernet adapter "en0"
   $ ifconfig en0

   # show the current ip for the host machine
   $ ifconfig en0 | awk '/inet [0-9\.]+ netmask / {print $2}'
   ```

1. nslookup

   This command looks up IP addresses assigned to website domain names.

   ```bash
   $ nslookup cn.bing.com
   Server:		192.168.1.1
   Address:	192.168.112.1#53

   Non-authoritative answer:
   cn.bing.com	canonical name = cn-bing-com.cn.a-0001.a-msedge.net.
   cn-bing-com.cn.a-0001.a-msedge.net	canonical name = a-0001.a-msedge.net.
   Name:	a-0001.a-msedge.net
   Address: 204.79.197.200
   Name:	a-0001.a-msedge.net
   Address: 13.107.21.200
   ```

1. ping

   This command sends ICMP ECHO_REQUEST packets to network hosts.

   ```bash
   $ ping -c 2 13.107.21.200
   PING 13.107.21.200 (13.107.21.200): 56 data bytes
   64 bytes from 13.107.21.200: icmp_seq=0 ttl=98 time=123.313 ms
   64 bytes from 13.107.21.200: icmp_seq=1 ttl=98 time=116.461 ms

   --- 13.107.21.200 ping statistics ---
   2 packets transmitted, 2 packets received, 0.0% packet loss
   round-trip min/avg/max/stddev = 116.461/119.887/123.313/3.426 ms

   $ ping -c 2 cn.bing.com
   PING a-0001.a-msedge.net (13.107.21.200): 56 data bytes
   64 bytes from 13.107.21.200: icmp_seq=0 ttl=96 time=118.015 ms
   64 bytes from 13.107.21.200: icmp_seq=1 ttl=96 time=118.431 ms

   --- a-0001.a-msedge.net ping statistics ---
   2 packets transmitted, 2 packets received, 0.0% packet loss
   round-trip min/avg/max/stddev = 118.015/118.223/118.431/0.208 ms
   ```

1. traceroute / tracert

   This command sends packets to each router along the path between your computer and the destination you want your traffic to reach.

   These packets provide information about the stops (or hops) your traffic makes on its way to its destination, using a feature called Time to Live (TTL).

   ```bash
   $ traceroute 13.107.21.200
   ```
