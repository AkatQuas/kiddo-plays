# Build tag syntax

|Build Tag Syntax|Build Tag Sample|Boolean Statement|
|:-:|:-:|:-:|
|Space-separated elements| `// +build pro enterprise` | `pro` **OR** `enterprise` |
|Comma-separated elements| `// +build pro,enterprise` | `pro` **AND** `enterprise` |
|Exclamation elements| `// +build !pro` |**NOT** `pro` |

