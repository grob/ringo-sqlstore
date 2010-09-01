var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var Collection = require("ringo/storage/sql/collection").Collection;
var sqlUtils = require("ringo/storage/sql/util");
var store = null;
var Book = null;
var Author = null;
var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
};

const MAPPING_BOOK = {
    "table": "book",
    "id": {
        "column": "book_id",
        "sequence": "book_id"
    },
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "length": 255,
            "nullable": false,
        }
    }
};

function populate() {
    var transaction = store.createTransaction();
    for (var i=0; i<101; i+=1) {
        var nr = i + 1;
        var props = {
            "title": "Book " + nr
        };
        var book = new Book(props);
        book.save(transaction);
    }
    transaction.commit();
    return;
};

exports.setDbProps = function(props) {
    dbProps = props;
};

exports.setUp = function() {
    store = new Store(dbProps);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    var schemaName = Book.mapping.schemaName || store.dialect.getDefaultSchema(conn);
    if (sqlUtils.tableExists(conn, Book.mapping.tableName, schemaName)) {
        sqlUtils.dropTable(conn, store.dialect, Book.mapping.tableName, schemaName);
        if (Book.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
            sqlUtils.dropSequence(conn, store.dialect, Book.mapping.id.sequence, schemaName);
        }
    }
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Book = null;
    return;
};

exports.testCollectionPartitioning = function() {
    populate();
    var query = store.query("Book");
    var collection = new Collection("allBooks", query, 10);
    assert.strictEqual(collection.partitions.length, 0);
    // accessing length populates the ids of the collection
    assert.strictEqual(collection.length, 101);
    assert.strictEqual(collection.partitions.length, 11);
    var book = collection.get(0);
    assert.isNotNull(book);
    assert.strictEqual(book._id, 1);
    assert.isNotUndefined(collection.partitions[0]);
    book = collection.get(10);
    assert.isNotUndefined(collection.partitions[1]);
    book = collection.get(99);
    assert.isNotUndefined(collection.partitions[9]);
    book = collection.get(100);
    assert.isNotUndefined(collection.partitions[10]);
    for (var i=2; i<9; i+=1) {
        assert.isUndefined(collection.partitions[i], "Partition " + i + " should be undefined");
    }
    return;
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require("test").run(exports);
}
