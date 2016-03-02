var term = require("ringo/term");

var Key = require("../lib/key");
var {Store, Cache} = require("../lib/main");

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

var Author;

var setUp = exports.setUp = function() {
    var store = new Store(Store.initConnectionPool({
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

var start = exports.start = function(cnt) {
    cnt || (cnt = 1000000);
    var start = Date.now();
    var result = [];
    var entity = {"author_name": "John Doe"};
    for (let i=0; i<cnt; i+=1) {
        result.push(Author.createInstance(new Key("Author", i), entity));
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "instantiations,", millis / cnt + "ms/instantiation", term.RESET);
};