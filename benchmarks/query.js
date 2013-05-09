var term = require("ringo/term");
var assert = require("assert");

var {Store} = require("../lib/sqlstore/store");
var {ConnectionPool} = require("../lib/sqlstore/connectionpool");
var {Cache} = require("../lib/sqlstore/cache");
var sqlUtils = require("../lib/sqlstore/util");

var store = null;
var Author = null;
var maxAuthors = 10000;

var MAPPING_AUTHOR = {
    // "schema": "TEST",
    "table": "author",
    "id": {
        "column": "author_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "author_name",
            "nullable": false
        }
    }
};

exports.setUp = function(dbProps) {
    store = new Store(new ConnectionPool(dbProps));
    term.writeln("------------------------------")
    term.writeln("Using", store.connectionPool.getProperties().get("driver"));
    store.setQueryCache(new Cache(10000));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.beginTransaction();
    for (let i=0; i<maxAuthors; i+=1) {
        (new Author({"name": "Author " + i})).save();
    }
    store.commitTransaction();
    assert.strictEqual(Author.all().length, maxAuthors);
    term.writeln("Inserted", maxAuthors, "rows");
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    store.close();
};

exports.start = function(cnt) {
    cnt || (cnt = 10000);
    var start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        let id = ((Math.random() * maxAuthors) | 0) + 1;
        let author = store.query("select Author.* from Author where Author.id = :id", {
            "id": id
        })[0];
        assert.strictEqual(author._id, id);
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, cnt, "queries,", millis / cnt + "ms/query", term.RESET);
};
