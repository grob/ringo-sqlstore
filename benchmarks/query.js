const term = require("ringo/term");
const assert = require("assert");

const {Store, Cache} = require("../lib/main");
const utils = require("../test/utils");

let store = null;
let Author = null;
const maxAuthors = 1000;

const MAPPING_AUTHOR = {
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
    store = new Store(Store.initConnectionPool(dbProps));
    term.writeln("------------------------------");
    term.writeln("Using", store.connectionPool.getDriverClassName());
    store.setQueryCache(new Cache(10000));
    //store.setEntityCache(new Cache(10000));
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
    const start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        let id = ((Math.random() * maxAuthors) | 0) + 1;
        let author = store.query("select * from Author where id = :id", {
            "id": id
        })[0];
        assert.strictEqual(author.id, id);
    }
    const millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "queries,", millis / cnt + "ms/query", term.RESET);
};
