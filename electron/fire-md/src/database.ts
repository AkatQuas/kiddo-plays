import { app } from 'electron';
import knex from 'knex';
import { join } from 'path';
import 'sqlite3';

export const CLIPPING_TABLE = 'clippings';

/**
 * SQL database
 */
export const DB = knex({
  client: 'sqlite3',
  connection: {
    /**
     * preview sqlite3 data online
     * https://sqliteonline.com/
     */
    filename: join(app.getPath('desktop'), 'db.sqlite'),
  },
  useNullAsDefault: true,
});

DB.schema.hasTable(CLIPPING_TABLE).then((exists) => {
  if (!exists) {
    return DB.schema.createTable(CLIPPING_TABLE, (t) => {
      t.increments('id').primary();
      t.string('value', 1000).notNullable();
      t.timestamp('created_at').notNullable();
    });
  }
});
