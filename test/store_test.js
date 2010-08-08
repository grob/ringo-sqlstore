var assert = require("assert");
var profile = require("ringo/profiler").profile;

var Store = require("ringo/storage/sql/store").Store;
var Key = require("ringo/storage/sql/key").Key;
var Transaction = require("ringo/storage/sql/transaction").Transaction;
var sqlUtils = require("ringo/storage/sql/util");

var dbProps = {
//    "url": "jdbc:mysql://localhost/test",
//    "driver": "com.mysql.jdbc.Driver",
//    "username": "test",
//    "password": "test"
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver",
    "username": "test",
    "password": "test"
};

var store = null;

const mapping = {
    "table": "book",
    "id": {
        "column": "book_id", // optional
        "sequence": "book_id" // optional
    },
    "properties": {
        "title": {
            "type": "string",
            "length": 255,
            "nullable": false,
        },
        "isbn": {
            "type": "string",
            "length": 255,
            "nullable": false,
        },
        "publishDate": {
            "type": "timestamp",
            "nullable": false,
        },
        "readCount": {
            "type": "integer",
            "nullable": false,
            "default": 0
        },
        "summary": {
            "type": "text",
        }
    }
};

function populate(store) {
    var transaction = store.createTransaction();
    var Book = store.defineEntity("Book", mapping);
    for (var i=1; i<=10; i+=1) {
        var props = {
            "title": "Book " + i,
            "isbn": "AT-" + i,
            "publishDate": new Date(),
            "summary": "This is the book no. " + i
        };
        var book = new Book(props);
        book.save(transaction);
    }
    transaction.commit();
    return;
};

exports.setUp = function() {
    store = new Store(dbProps);
    assert.isNotNull(store);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    if (sqlUtils.tableExists(conn, mapping.table)) {
        sqlUtils.dropTable(conn, store.dialect, mapping.table);
        if (store.dialect.hasSequenceSupport()) {
            sqlUtils.dropSequence(conn, store.dialect, mapping.id.sequence);
        }
    }
    return;
};

exports.testKey = function() {
    var key = new Key("Book", 1);
    assert.strictEqual(key.type, "Book");
    assert.strictEqual(key.id, 1);
    assert.isTrue(key.isPersistent());
    // transient key
    key = new Key("Book", null);
    assert.isFalse(key.isPersistent());
    key = new Key("Book");
    assert.isFalse(key.isPersistent());
    return;
};

exports.testEntityRegistry = function() {
    // this creates a table "book"
    var ctor = store.defineEntity("Book", mapping);
    assert.isNotNull(ctor);
    assert.strictEqual(typeof(ctor), "function");

    // static constructor functions
    assert.strictEqual(typeof(ctor.get), "function");
    
    // getEntityConstructor
    assert.strictEqual(ctor, store.getEntityConstructor("Book"));
    return;
};

exports.testCRUD = function() {
    // create
    var Book = store.defineEntity("Book", mapping);
    var props = {
        "title": "Building a Javascript ORM with RingoJS",
        "isbn": "AT-123456",
        "publishDate": new Date(),
        "summary": "TL:DR"
    };
    var book = new Book(props);
    assert.isUndefined(book._key);
    book.save();
    assert.isTrue(book._key instanceof Key);
    assert.strictEqual(book._key.type, "Book");
    assert.strictEqual(book._id, 1);

    // read
    book = Book.get(1);
    assert.isNotNull(book);
    assert.isTrue(!isNaN(book._id));
    for (var propName in ["title", "isbn", "summary"]) {
        assert.strictEqual(props[propName], book[propName]);
    }
    // readCount is by default zero
    assert.strictEqual(book.readCount, 0);
    // compare publishDate - unfortunately MySQL doesn't support millis
    // in timestamp columns, so compare all except millis
    assert.strictEqual(props.publishDate.getFullYear(), book.publishDate.getFullYear());
    assert.strictEqual(props.publishDate.getMonth(), book.publishDate.getMonth());
    assert.strictEqual(props.publishDate.getDate(), book.publishDate.getDate());
    assert.strictEqual(props.publishDate.getHours(), book.publishDate.getHours());
    assert.strictEqual(props.publishDate.getMinutes(), book.publishDate.getMinutes());
    assert.strictEqual(props.publishDate.getSeconds(), book.publishDate.getSeconds());
    assert.isTrue(book.publishDate instanceof Date);
    
    // update
    var newTitle = "Inside RingoJS SQL Store";
    book.title = newTitle;
    book.readCount = 1234;
    book.save();
    
    // read
    book = Book.get(1);
    assert.strictEqual(book.title, newTitle);
    assert.strictEqual(book.readCount, 1234);
    
    // remove
    book.remove();
    assert.strictEqual(Book.get(1), null);
};

exports.testQueryAll = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.all();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryEquals = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var book = Book.query().equals("id", 1).select();
    assert.strictEqual(book.constructor, Book);
    assert.strictEqual(book.title, "Book " + 1);
    return;
};

exports.testQueryGreaterThan = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().greater("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryGreaterThanOrEquals = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().greaterEquals("id", 6).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryLessThan = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().less("id", 6).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryLessThanOrEquals = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().lessEquals("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryOrder = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().orderBy("id desc").select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, 10 - idx);
    });
    return;
};

exports.testQueryLimit = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().limit(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
};

exports.testQueryOffset = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().offset(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryRange = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().range(3, 8).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 4);
    });
    return;
};

exports.testQueryCombined = function() {
    var Book = store.defineEntity("Book", mapping);
    populate(store);
    var result = Book.query().greater("id", 5).orderBy("id desc").select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, 10 - idx);
    });
    var result = Book.query().lessEquals("id", 5).orderBy("id").select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

/*
exports.testQuery = function() {
    throw new Error("TBD");
};

exports.testCreateTable = function() {
    throw new Error("TBD");
};

exports.testGenerateId = function() {
    throw new Error("TBD");
};

exports.testGetIdColumnName = function() {
    throw new Error("TBD");
};

exports.testGetIdSequenceName = function() {
    throw new Error("TBD");
};

exports.testGetId = function() {
    throw new Error("TBD");
};

exports.testGetKey = function() {
    throw new Error("TBD");
};

exports.testGetEntity = function() {
    throw new Error("TBD");
};

exports.testRemove = function() {
    throw new Error("TBD");
};

exports.testUpdateEntity = function() {
    throw new Error("TBD");
};

exports.testInsert = function() {
    throw new Error("TBD");
};

exports.testUpdate = function() {
    throw new Error("TBD");
};

exports.testSave = function() {
    throw new Error("TBD");
};

exports.testGetProperties = function() {
    throw new Error("TBD");
};

exports.testLoadEntity = function() {
    throw new Error("TBD");
};

exports.testIsEntityExisting = function() {
    throw new Error("TBD");
};

exports.testGetById = function() {
    throw new Error("TBD");
};
*/


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require('test').run(exports);
}
