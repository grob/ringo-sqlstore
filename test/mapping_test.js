var runner = require("./runner");
var assert = require("assert");

var {Store} = require("../lib/ringo/storage/sql/store");
var sqlUtils = require("../lib/ringo/storage/sql/util");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "table": "author",
    "id": {
        "column": "author_id",
    }
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    var schemaName = store.dialect.getDefaultSchema(conn);
    if (sqlUtils.tableExists(conn, Author.mapping.tableName, schemaName)) {
        sqlUtils.dropTable(conn, store.dialect, Author.mapping.tableName, schemaName);
    }
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Author = null;
    return;
};

exports.testGetNextId = function() {
    // directly calling getNextId() must increment the mapping's internal ID
    // counter, although the ID is not used
    assert.strictEqual(Author.mapping.id.getNextId(), 1);
    var author = new Author();
    author.save();
    assert.strictEqual(author._id, 2);
    assert.strictEqual(Author.mapping.id.getNextId(), 3);
    author = new Author();
    author.save();
    assert.strictEqual(author._id, 4);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  system.exit(runner.run(exports, arguments));
}
