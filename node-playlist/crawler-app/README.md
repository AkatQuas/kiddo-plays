# Overview

This is a simple crawler using [node](https://nodejs.org/en/) and [puppeteer](https://github.com/GoogleChrome/puppeteer).

As the `puppeteer` required, the node version is v7.6.0 at least.

## What I have done

At first, I used the [cheerio](https://github.com/cheeriojs/cheerio) to parse the html. However it's only suitable for those static html files. `Cheerio` loses it's power when the content are loaded by JavaScript.

So when it comes to easy and static content, it is a good idea to use `cheerio`.

Then I tried `puppeteer`, a powerful headless Chrome browser with a lot of Node APIs.

The `src/main.js` file showed an example on browsing some page, parse the html and analyze the content.

By the way, it my first time to use `async/await` in Node, awesome.

## Todo??

* Phantom JS

## How to play

```bash
# install dependencies
npm install 

# run the main file
npm run example
```

