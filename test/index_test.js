var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/main");
var metaData = require("../lib/database/metadata");
var schema = require("../lib/database/schema");
var utils = require("./utils");

const MAPPING_AUTHOR = {
    "table": "author",
    "id": {
        "column": "author_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "author_name"
        }
    },
    "indexes": {
        "authorname": {
            "unique": false,
            "columns": [
                "author_id",
                {
                    "name": "author_name",
                    "sort": "desc",
                    "nulls": "last"
                }
            ]
        }
    }
};

var store = null;
var Author = null;

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
};

exports.tearDown = function() {
    utils.drop(store, Author);
    store.close();
};

exports.testCreateIndex = function() {
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
    var conn = store.getConnection();
    try {
        var indexes = metaData.getIndexes(conn, store.dialect, MAPPING_AUTHOR.table);
        assert.strictEqual(Object.keys(indexes).length, 2);
        for each (let [name, properties] in Iterator(indexes)) {
            assert.isTrue(metaData.indexExists(conn, store.dialect, MAPPING_AUTHOR.table, name));
            if (name === "authorname") {
                assert.isFalse(properties.isUnique);
                assert.deepEqual(properties.columns, [
                    {
                        "name": "author_id",
                        "sort": "asc"
                    },
                    {
                        "name": "author_name",
                        "sort": "desc"
                    }
                ]);
            } else {
                // the primary key
                assert.isTrue(properties.isUnique);
                assert.deepEqual(properties.columns, [
                    {
                        "name": "author_id",
                        "sort": "asc"
                    }
                ]);
            }
        }
    } finally {
        conn.close();
    }
};

exports.testDropIndex = function() {
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
    var indexName = "authorname";
    var conn = store.getConnection();
    schema.dropIndex(conn, store.dialect, indexName);
    try {
        let indexes = metaData.getIndexes(conn, store.dialect, MAPPING_AUTHOR.table);
        assert.strictEqual(Object.keys(indexes).length, 1);
        assert.isFalse(indexes.hasOwnProperty(indexName));
    } finally {
        conn.close();
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
