# Overview

A boilerplate based on gulp.

The main purpose is to develop some static html files with `i18n`, and no dependency on modern JS framework, only jQuery to make IE 8+ compatible.

# Features

- Less

- jQuery, no ES5/6/7/8, IE 8+ compatible.

- Template HTML component

- image minimize, cssnano, js uglify

# Usage

```bash

# development
npm run dev 

# build
npm run build
```

# Developing 

All assets will be placed at `/static/{css,js,images}/[file].[ext]`. 

In the `.html` files, you can `@@include` some `html snippets` in the directory `src/snippets`, check the [documents](https://github.com/coderhaoxin/gulp-file-include#readme).

