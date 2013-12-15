var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../../lib/sqlstore/main");
var sqlUtils = require("../../lib/sqlstore/util");
var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "table": "T_AUTHOR",
    "id": {
        "column": "AUTHOR_ID"
    },
    "properties": {
        "name": {
            "column": "AUTHOR_NAME",
            "type": "string"
        }
    }
};

var populate = function(cnt) {
    for (let i=1; i<=cnt; i+=1) {
        (new Author({
            "name": "Author " + i
        })).save();
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
};

exports.tearDown = function() {
    var conn = store.getConnection();
    var schemaName = Author.mapping.schemaName || store.dialect.getDefaultSchema(conn);
    if (sqlUtils.tableExists(conn, Author.mapping.tableName, schemaName)) {
        sqlUtils.dropTable(conn, store.dialect, Author.mapping.tableName, schemaName);
    }
    store.close();
    store = null;
    Author = null;
};

exports.testSqlQuery = function() {
    populate(10);
    var queryStr = ["select", store.dialect.quote("AUTHOR_ID") + ",",
        store.dialect.quote("AUTHOR_NAME"), "from", store.dialect.quote("T_AUTHOR")].join(" ");
    var result = store.sqlQuery(queryStr);
    assert.strictEqual(result.length, 10);
    for (let i=1; i<=10; i+=1) {
        let obj = result[i - 1];
        assert.strictEqual(obj["AUTHOR_ID"], i);
        assert.strictEqual(obj["AUTHOR_NAME"], "Author " + i);
    }
    queryStr = [queryStr, "where", store.dialect.quote("AUTHOR_ID"), "= 1"].join(" ");
    result = store.sqlQuery(queryStr);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]["AUTHOR_ID"], 1);
};

exports.testResultPropertyNames = function() {
    populate(10);
    var queryStr = ["select", store.dialect.quote("AUTHOR_ID"), "as", store.dialect.quote("id") + ",",
        store.dialect.quote("AUTHOR_NAME"), "as", store.dialect.quote("name"),
        "from", store.dialect.quote("T_AUTHOR")].join(" ");
    var result = store.sqlQuery(queryStr);
    assert.strictEqual(result.length, 10);
    for (let i=1; i<=10; i+=1) {
        let obj = result[i - 1];
        assert.strictEqual(obj.id, i);
        assert.strictEqual(obj.name, "Author " + i);
    }
};

exports.testParameters = function() {
    populate(10);
    var queryStr = ["select", store.dialect.quote("AUTHOR_NAME"), "as", store.dialect.quote("name"),
        "from", store.dialect.quote("T_AUTHOR"),
        "where", store.dialect.quote("AUTHOR_ID"), "IN (?, ?, ?)"].join(" ");
    var result = store.sqlQuery(queryStr, [1, 2, 3]);
    assert.strictEqual(result.length, 3);
    result.forEach(function(obj, idx) {
        assert.strictEqual(obj.name, "Author " + (idx + 1));
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
