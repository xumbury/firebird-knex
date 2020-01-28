import { Client } from 'knex';
import ColumnCompiler from './schema/columncompiler';
import QueryCompiler from './query/compiler';
import TableCompiler from './schema/tablecompiler';
import Transaction from './transaction';
import assert from 'assert';
import { assign } from 'lodash';
import inherits from 'inherits';

function Client_Firebird(config) {
  Client.call(this, config);
}
inherits(Client_Firebird, Client);

assign(Client_Firebird.prototype, {

  dialect: 'firebird',

  driverName: 'node-firebird',

  _driver() {
    return require('node-firebird');
  },

  QueryCompiler,

  TableCompiler,

  ColumnCompiler,

  Transaction,

  acquireRawConnection() {
    assert(!this._connectionForTransactions);
    return new Promise((resolve, reject) => {
      this.driver.attach(this.connectionSettings, (error, connection) => {
        if (error) return reject(error);
        resolve(connection);
      });
    });
  },

  destroyRawConnection(connection, cb) {
    connection.detach(cb);
  },

  _stream() {
    throw new Error('_stream not implemented');
  },

  _query(connection, obj) {
    if (!obj || typeof obj === 'string') obj = { sql: obj };
    return new Promise((resolve, reject) => {
      const { sql } = obj;
      if (!sql) return resolve();
      const c = connection._transaction || connection;
      c.query(sql, obj.bindings, (error, rows, fields) => {
        if (error) return reject(error);
        obj.response = [ rows, fields ];
        resolve(obj);
      });
    });
  },

  _fixBufferStrings(rows, fields) {
    if (!rows) return rows;
    for (const row of rows) {
      for (const cell in row) {
        const value = row[cell];
        if (Buffer.isBuffer(value)) {
          for (const field of fields) {
            if (field.alias === cell &&
                field.type === 448) { // SQLVarString
              row[cell] = value.toString();
              break;
            }
          }
        }
      }
    }
  },

  processResponse(obj) {
    if (!obj) return;
    const { response } = obj;
    const [ rows, fields ] = response;
    this._fixBufferStrings(rows, fields);
    return rows;
  },

  ping(resource, callback) {
    resource.query('select 1 from RDB$DATABASE', callback);
  }

});

Client_Firebird.dialect = 'firebird';

export default Client_Firebird;
