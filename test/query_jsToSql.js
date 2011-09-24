var runner = require("./runner");
var assert = require("assert");

var Store = require("../lib/sqlstore/store").Store;
var sqlUtils = require("../lib/sqlstore/util");
var jsToSql = require("../lib/sqlstore/query").jsToSql;
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
    assert.strictEqual(jsToSql(store, "id", "Author")[0],
            Author.mapping.getQualifiedColumnName("id", store.dialect));
    return;
};

exports.testPropertyPrefix = function() {
    assert.strictEqual(jsToSql(store, "Book.id", "Author")[0],
            Book.mapping.getQualifiedColumnName("id", store.dialect));
    assert.strictEqual(jsToSql(store, "Book.title", "Author")[0],
            Book.mapping.getQualifiedColumnName("title", store.dialect));
    return;
};

exports.testValues = function() {
    var [sql, parameters] = jsToSql(store, "id == 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "name == 'test'", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "string");
    assert.strictEqual(parameters[0].value, "test");

    [sql, parameters] = jsToSql(store, "name == \"test\"", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "string");
    assert.strictEqual(parameters[0].value, "test");

    [sql, parameters] = jsToSql(store, "isHyped == true", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("isHyped", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "boolean");
    assert.strictEqual(parameters[0].value, true);

    [sql, parameters] = jsToSql(store, "isHyped == false", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("isHyped", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "boolean");
    assert.strictEqual(parameters[0].value, false);
    return;
};

exports.testComparisonOperators = function() {
    var [sql, parameters] = jsToSql(store, "id == 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id === 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id > 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " > ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id >= 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " >= ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id < 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " < ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id <= 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " <= ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "id != 1", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " != ?");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);
    return;
};

exports.testBooleanOperators = function() {
    var [sql, parameters] = jsToSql(store, "id == 1 && name == 'test'", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ? AND " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = ?");
    assert.strictEqual(parameters.length, 2);
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);
    assert.strictEqual(parameters[1].type, "string");
    assert.strictEqual(parameters[1].value, "test");

    [sql, parameters] = jsToSql(store, "id == 1 || name == 'test'", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ? OR " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = ?");
    assert.strictEqual(parameters.length, 2);
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);
    assert.strictEqual(parameters[1].type, "string");
    assert.strictEqual(parameters[1].value, "test");
    return;
};

exports.testParenthesis = function() {
    var [sql, parameters] = jsToSql(store, "(id == 1)", "Author");
    assert.strictEqual(sql,
            "(" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?)");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "( (id == 1) )", "Author");
    assert.strictEqual(sql,
            "((" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?))");
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);

    [sql, parameters] = jsToSql(store, "((id == 1 || id == 2) && name === 'test')", "Author");
    assert.strictEqual(sql,
            "((" + Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ? OR " +
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " = ?) AND " +
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " = ?)");
    assert.strictEqual(parameters.length, 3);
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);
    assert.strictEqual(parameters[1].type, "long");
    assert.strictEqual(parameters[1].value, 2);
    assert.strictEqual(parameters[2].type, "string");
    assert.strictEqual(parameters[2].value, "test");
    return;
};

exports.testIn = function() {
    var [sql, parameters] = jsToSql(store, "id in [1,2,   3]", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("id", store.dialect) + " in (?, ?, ?)");
    assert.strictEqual(parameters.length, 3);
    assert.strictEqual(parameters[0].type, "long");
    assert.strictEqual(parameters[0].value, 1);
    assert.strictEqual(parameters[1].type, "long");
    assert.strictEqual(parameters[1].value, 2);
    assert.strictEqual(parameters[2].type, "long");
    assert.strictEqual(parameters[2].value, 3);

    [sql, parameters] = jsToSql(store, "name in ['test','no',  'longer']", "Author");
    assert.strictEqual(sql,
            Author.mapping.getQualifiedColumnName("name", store.dialect) + " in (?, ?, ?)");
    assert.strictEqual(parameters.length, 3);
    assert.strictEqual(parameters[0].type, "string");
    assert.strictEqual(parameters[0].value, "test");
    assert.strictEqual(parameters[1].type, "string");
    assert.strictEqual(parameters[1].value, "no");
    assert.strictEqual(parameters[2].type, "string");
    assert.strictEqual(parameters[2].value, "longer");
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
