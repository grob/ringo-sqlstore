var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/main");
var dbMetaData = require("../lib/database/metadata");
var utils = require("./utils");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "table": "author",
    "id": {
        "column": "author_id"
    },
    "properties": {
        "name": {
            "column": "author_name",
            "type": "string",
            "length": 200,
            "nullable": false,
            "unique": true
        },
        "income": {
            "column": "author_income",
            "type": "double",
            "precision": 8,
            "scale": 2
        }
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author);
    store.close();
};

exports.testGetNextId = function() {
    // directly calling getNextId() must increment the mapping's internal ID
    // counter, although the ID is not used
    assert.strictEqual(Author.mapping.id.sequence.getNextId(store), 1);
    var values = {"name": "John Doe"};
    var author = new Author(values);
    author.save();
    assert.strictEqual(author.id, 2);
    assert.strictEqual(Author.mapping.id.sequence.getNextId(store), 3);
    author = new Author(values);
    author.save();
    assert.strictEqual(author.id, 4);
};

exports.testLength = function() {
    var conn = store.getConnection();
    var metaData = null;
    try {
        metaData = conn.getMetaData();
        var column = dbMetaData.getColumns(metaData, MAPPING_AUTHOR.table,
                null, MAPPING_AUTHOR.properties.name.column)[0] || null;
        assert.strictEqual(column.length, MAPPING_AUTHOR.properties.name.length);
    } finally {
        conn && conn.close();
    }
};

exports.testNullable = function() {
    var conn = store.getConnection();
    var metaData = null;
    try {
        metaData = conn.getMetaData();
        var column = dbMetaData.getColumns(metaData, MAPPING_AUTHOR.table,
                null, MAPPING_AUTHOR.properties.name.column)[0] || null;
        assert.isFalse(column.nullable);
    } finally {
        conn && conn.close();
    }
};

exports.testPrecisionScale = function() {
    var conn = store.getConnection();
    var metaData = null;
    try {
        metaData = conn.getMetaData();
        var column = dbMetaData.getColumns(metaData, MAPPING_AUTHOR.table,
                null, MAPPING_AUTHOR.properties.income.column)[0] || null;
        assert.strictEqual(column.length, MAPPING_AUTHOR.properties.income.precision);
        assert.strictEqual(column.scale, MAPPING_AUTHOR.properties.income.scale);
    } finally {
        conn && conn.close();
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
