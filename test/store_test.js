var assert = require("assert");

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

function dropObjects(store) {
    sqlUtils.dropTable(store.getConnection(), store.dialect, mapping.table);
    if (store.dialect.hasSequenceSupport()) {
        sqlUtils.dropSequence(store.getConnection(), store.dialect, mapping.id.sequence);
    }
}

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

exports.testStoreConstructor = function() {
    var store = new Store(dbProps);
    assert.isNotNull(store);
    return;
};

exports.testEntityRegistry = function() {
    var store = new Store(dbProps);
    // this creates a table "book"
    var ctor = store.defineEntity("Book", mapping);
    assert.isNotNull(ctor);
    assert.strictEqual(typeof(ctor), "function");

    // static constructor functions
    assert.strictEqual(typeof(ctor.get), "function");
    
    // getEntityConstructor
    assert.strictEqual(ctor, store.getEntityConstructor("Book"));
    
    // cleanup
    dropObjects(store);
    return;
};

exports.testCRUD = function() {
    var store = new Store(dbProps);

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
    
    // cleanup
    dropObjects(store);
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
