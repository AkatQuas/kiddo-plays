# Deprecated

Using online mock-server is better than creating a local one, especially you don't need to save these mocking data.

Recommandation: [mock.js](https://github.com/nuysoft/Mock), [online server supplier](https://www.easy-mock.com/)

# Overview 

A project just for mock-data.

# How it works

Using express to create a local sever, configuring the api, storing the data in `src/data` folder in which most are `.json`.

Amazingly, the mock data come from [mockaroo.com](https://mockaroo.com/).

# Script
Run `npm run nodemon` to watch the file changing when developing.

Run `npm run server` to run the server, and this script won't reload the server even though the file changed.

# Happy Coding
