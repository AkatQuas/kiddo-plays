/**
 * this is old way to creating DAO
 * more can be read at https://docs.nestjs.com/techniques/mongodb
 * it's recommend to use nestjs-typegoose at https://kpfromer.github.io/nestjs-typegoose/docs/install
 */


import * as mongoose from 'mongoose';

export const CatSchema = new mongoose.Schema({
  name: String,
  age: Number,
  breed: String,
});
