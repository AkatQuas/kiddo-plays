# Overview

A learning on REST API with Node & Express & MongoDB.

# How to play

```bash
# development, watching the changes
npm run nodemon

# save mock data to MongoDB for further usage
npm run mock

# start the server
npm run server 

# debug the server
npm run debug

```

After the server started, open [home page](http://localhost:4040/index.html)

# Notes

- `express` is the main dependency.
- `nodemon` helps to watch the server file and restart the server on changes.
- `MongoDB`
    - `Models` represent collections in MongoDB
    - `Schemas` define the structure of the data objects
    - `Mongoose` helps to add a layer of methods to easily save, edit, retreive and delete data from mongobd, and to create models and schemas easily
    - `GeoJSON` is a fromat for encoding a variety of geographic data structures
