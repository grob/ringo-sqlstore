var term = require("ringo/term");
var assert = require("assert");

var {Store, ConnectionPool, Cache} = require("../lib/sqlstore/main");
var utils = require("../test/utils");

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
    term.writeln("------------------------------");
    term.writeln("Using", store.connectionPool.getDriverClass());
    store.setQueryCache(new Cache(10000));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
    store.beginTransaction();
    for (let i=0; i<maxAuthors; i+=1) {
        (new Author({"name": "Author " + i})).save();
    }
    store.commitTransaction();
    assert.strictEqual(Author.all().length, maxAuthors);
    term.writeln("Inserted", maxAuthors, "rows");
};

exports.tearDown = function() {
    utils.drop(store, Author);
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
        assert.strictEqual(author.id, id);
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, cnt, "queries,", millis / cnt + "ms/query", term.RESET);
};
