type SqliteRunResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

type SqliteStatementSync = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): SqliteRunResult;
};

type SqliteDatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementSync;
};

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabaseSync;
};

export type Statement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): SqliteRunResult;
};

class StatementWrapper implements Statement {
  constructor(private readonly statement: SqliteStatementSync) {}

  all(...params: unknown[]): unknown[] {
    return this.statement.all(...params);
  }

  get(...params: unknown[]): unknown {
    return this.statement.get(...params);
  }

  run(...params: unknown[]): SqliteRunResult {
    return this.statement.run(...params);
  }
}

export class Database {
  private readonly database: SqliteDatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  pragma(sql: string): void {
    this.database.exec(`PRAGMA ${sql};`);
  }

  prepare(sql: string): Statement {
    return new StatementWrapper(this.database.prepare(sql));
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.database.exec('BEGIN');

      try {
        const result = fn();
        this.database.exec('COMMIT');
        return result;
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    };
  }
}
