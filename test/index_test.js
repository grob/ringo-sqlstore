const runner = require("./runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../lib/main");
const metaData = require("../lib/database/metadata");
const schema = require("../lib/database/schema");
const utils = require("./utils");

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

let store = null;
let Author = null;

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
    const conn = store.getConnection();
    try {
        const indexes = metaData.getIndexes(conn, store.dialect, MAPPING_AUTHOR.table);
        assert.strictEqual(Object.keys(indexes).length, 2);
        Object.keys(indexes).forEach(function(name) {
            const properties = indexes[name];
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
        });
    } finally {
        conn.close();
    }
};

exports.testDropIndex = function() {
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
    const indexName = "authorname";
    const conn = store.getConnection();
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
