var runner = require("./runner");
var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var sqlUtils = require("ringo/storage/sql/util");
var jsToSql = require("ringo/storage/sql/query").jsToSql;
var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
};
var store = null;
var Author = null;
var Book = null;

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", {
        "properties": {
            "name": "string",
            "age": "integer",
            "isHyped": "boolean"
        }
    });
    Book = store.defineEntity("Book", {
        "properties": {
            "title": "string",
            "price": "double",
        }
    });
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Author = null;
    Book = null;
    return;
};

exports.testDefaultType = function() {
    assert.strictEqual(jsToSql(store, "id", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect));
    return;
};

exports.testPropertyPrefix = function() {
    assert.strictEqual(jsToSql(store, "Book.id", "Author"),
            Book.mapping.getQualifiedColumnName("id", store.dialect));
    assert.strictEqual(jsToSql(store, "Book.title", "Author"),
            Book.mapping.getQualifiedColumnName("title", store.dialect));
    return;
};

exports.testValues = function() {
    assert.strictEqual(jsToSql(store, "id == 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1");
    assert.strictEqual(jsToSql(store, "name == 'test'", "Author"),
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = 'test'");
    assert.strictEqual(jsToSql(store, "name == \"test\"", "Author"),
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = 'test'");
    assert.strictEqual(jsToSql(store, "isHyped == true", "Author"),
            Author.mapping.getQualifiedColumnName("isHyped", store.dialect) + " = " +
            store.dialect.getBooleanValue(true));
    assert.strictEqual(jsToSql(store, "isHyped == false", "Author"),
            Author.mapping.getQualifiedColumnName("isHyped", store.dialect) + " = " +
            store.dialect.getBooleanValue(false));
    return;
};

exports.testComparisonOperators = function() {
    assert.strictEqual(jsToSql(store, "id == 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1");
    assert.strictEqual(jsToSql(store, "id === 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1");
    assert.strictEqual(jsToSql(store, "id > 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " > 1");
    assert.strictEqual(jsToSql(store, "id >= 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " >= 1");
    assert.strictEqual(jsToSql(store, "id < 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " < 1");
    assert.strictEqual(jsToSql(store, "id <= 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " <= 1");
    assert.strictEqual(jsToSql(store, "id != 1", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " != 1");
    return;
};

exports.testBooleanOperators = function() {
    assert.strictEqual(jsToSql(store, "id == 1 && name == 'test'", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1 AND " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = 'test'");
    assert.strictEqual(jsToSql(store, "id == 1 || name == 'test'", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1 OR " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = 'test'");
    return;
};

exports.testParenthesis = function() {
    assert.strictEqual(jsToSql(store, "(id == 1)", "Author"),
            "(" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1)");
    assert.strictEqual(jsToSql(store, "( (id == 1) )", "Author"),
            "((" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1))");
    assert.strictEqual(jsToSql(store, "((id == 1 || id == 2) && name === 'test')", "Author"),
            "((" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 1 OR " +
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = 2) AND " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = 'test')");
    return;
};

exports.testIn = function() {
    assert.strictEqual(jsToSql(store, "id in [1,2,   3]", "Author"),
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " in (1, 2, 3)");
    assert.strictEqual(jsToSql(store, "name in ['test','no',  'longer']", "Author"),
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " in ('test', 'no', 'longer')");
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
