const term = require("ringo/term");

const Key = require("../lib/key");
const {Store, Cache} = require("../lib/main");

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

let Author;

const setUp = exports.setUp = function() {
    const store = new Store(Store.initConnectionPool({
        "url": "jdbc:h2:mem:test;MVCC=TRUE",
        "driver": "org.h2.Driver"
    }));
    term.writeln("------------------------------");
    term.writeln("Using", store.connectionPool.getDriverClassName());
    store.setQueryCache(new Cache(10000));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
};

exports.tearDown = function() {};

const start = exports.start = function(cnt) {
    cnt || (cnt = 1000000);
    const start = Date.now();
    const result = [];
    const entity = {"author_name": "John Doe"};
    for (let i=0; i<cnt; i+=1) {
        result.push(Author.createInstance(new Key("Author", i), entity));
    }
    const millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "instantiations,", millis / cnt + "ms/instantiation", term.RESET);
};