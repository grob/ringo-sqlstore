## v0.7.0

### Breaking changes

- Removed `ConnectionPool` constructor, use `Store.initConnectionPool()` instead
- Removed `Storable.prototype._id`, use `Storable.prototype.id` from now on

### Possibly breaking changes

- Restructured the whole package, most notably the "lib/sqlstore" directory is gone. If your application directly requires modules of ringo-sqlstore you'll need to adapt the module paths.

### Bugfixes and Improvements

- Switched to [HikariCP](https://github.com/brettwooldridge/HikariCP) as connection pool exclusively. All configuration options accepted by HikariCP can be specified in the configuration hash passed as argument to `Store.initConnectionPool()`.
- Added support for auto incremented IDs. From now on ID mappings can define either `autoIncrement: true` or `sequence: <name>`. The default is auto increment.
- Added basic support for `json` and `jsonb` PostgreSQL data types (contributed by [@botic](https://github.com/botic/)). Note that currently the sqlstore query language doesn't support JSON queries.
- Primitive or object mapping definitions can now contain a `unique` flag. [#33](https://github.com/grob/ringo-sqlstore/issues/33)
- `Store.prototype.syncTables()` creates a sequence only if it doesn't already exist. [#35](https://github.com/grob/ringo-sqlstore/issues/35)
- Fixed whitespace matching the empty string in query grammar [#32](https://github.com/grob/ringo-sqlstore/issues/32)
- Data types are now database specific, fixing [19](https://github.com/grob/ringo-sqlstore/issues/19)
- Added special SQL generator for Oracle, fixing [#27](https://github.com/grob/ringo-sqlstore/issues/27)
