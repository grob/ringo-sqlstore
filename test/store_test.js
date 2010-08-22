var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var Key = require("ringo/storage/sql/key").Key;
var Transaction = require("ringo/storage/sql/transaction").Transaction;
var sqlUtils = require("ringo/storage/sql/util");
var strings = require("ringo/utils/strings.js");

var store = null;
var Book = null;
var Author = null;
var dbProps = {
        "url": "jdbc:h2:mem:test",
        "driver": "org.h2.Driver"
    };

const MAPPING_BOOK = {
    // "schema": "test",
    "table": "book",
    "id": {
        "column": "book_id", // optional
        "sequence": "book_id" // optional
    },
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "length": 255,
            "nullable": false,
        },
        "isbn": {
            "type": "string",
            "column": "book_isbn",
            "length": 255,
            "nullable": false,
        },
        "publishDate": {
            "type": "timestamp",
            "column": "book_timestamp",
            "nullable": false,
        },
        "readCount": {
            "type": "integer",
            "column": "book_readcount",
            "nullable": false,
            "default": 0
        },
        "price": {
            "type": "float",
            "column": "book_price",
            "nullable": false
        },
        "available": {
            "type": "boolean",
            "column": "book_available"
            // FIXME: doesn't work with oracle
            // "default": true
        },
        "summary": {
            "type": "text",
            "column": "book_text"
        },
        "author": {
            "type": "object",
            "entity": "Author",
            "column": "book_f_author",
            "foreignProperty": "id" // optional, defines the name of the property in the related entity
        }
    }
};

const MAPPING_AUTHOR = {
    // "schema": "test",
    "table": "author",
    "id": {
        "column": "author_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "author_name",
            "nullable": false
        },
        "books": {
            "type": "collection",
            "entity": "Book",
            "localProperty": "id",
            "foreignProperty": "author" // optional, defines the name of the property in the related entity
        }
    }
};

function populate(store) {
    var authors = [];
    for (var i=1; i<=5; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
    }
    var transaction = store.createTransaction();
    for (var i=0; i<10; i+=1) {
        var nr = i + 1;
        var props = {
            "title": "Book " + nr,
            "isbn": "AT-" + nr,
            "publishDate": new Date(),
            "price": 12.95,
            "summary": "This is the book no. " + nr,
            "author": authors[Math.floor(i / 2)]
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
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    assert.isNotNull(store);
    assert.isTrue(Book instanceof Function);
    assert.isTrue(Author instanceof Function);
    // static constructor functions
    assert.strictEqual(typeof(Book.get), "function");
    assert.strictEqual(typeof(Book.all), "function");
    assert.strictEqual(typeof(Book.query), "function");
    assert.strictEqual(Book, store.getEntityConstructor("Book"));
    assert.strictEqual(Author, store.getEntityConstructor("Author"));
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Book, Author].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    conn.close();
    store.closeConnections();
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

exports.testCRUD = function() {
    // create
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    var props = {
        "title": "Building a Javascript ORM with RingoJS",
        "isbn": "AT-123456",
        "publishDate": new Date(),
        "price": 12.95,
        "available": false,
        "summary": "TL:DR",
        "author": author
    };
    var book = new Book(props);
    assert.isUndefined(book._key);
    book.save();
    assert.isTrue(book._key instanceof Key);
    assert.strictEqual(book._key.type, "Book");
    assert.strictEqual(book._id, 1);
    assert.strictEqual(book.author, author);

    // read
    book = Book.get(1);
    assert.isNotNull(book);
    assert.isTrue(!isNaN(book._id));
    for (var propName in ["title", "isbn", "summary", "price", "available"]) {
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

    // compare mapped author
    assert.isNotNull(book.author);
    assert.isTrue(book.author instanceof Author);
    assert.strictEqual(book.author._key.toString(), author._key.toString());

    // null author property
    book.author = null;
    book.save();

    // read again
    book = Book.get(1);
    assert.isNull(book.author);

    // update properties
    var newTitle = "Inside RingoJS SQL Store";
    book.title = newTitle;
    book.readCount = 1234;
    var newAuthor = new Author({
        "name": "Jane Doe"
    });
    book.author = newAuthor;
    assert.isUndefined(book.author._id);
    book.save();
    // author must have been persisted
    assert.strictEqual(book.author._id, 2);

    // read again
    book = Book.get(1);
    assert.strictEqual(book.title, newTitle);
    assert.strictEqual(book.readCount, 1234);
    // newAuthor must have been persisted when saving book above
    assert.isNotNull(newAuthor._id);
    assert.strictEqual(book.author._key.toString(), newAuthor._key.toString());

    // remove
    book.remove();
    assert.strictEqual(Book.get(1), null);
    author.remove();
    assert.strictEqual(Author.get(1), null);
    newAuthor.remove();
    assert.strictEqual(Author.get(2), null);
    return;
};

exports.testTypes = function() {
    var mapping = {
        "table": "typetest",
        "properties": {
            "typeInteger": {
                "type": "integer"
            },
            "typeLong": {
                "type": "long"
            },
            "typeShort": {
                "type": "short"
            },
            "typeFloat": {
                "type": "float"
            },
            "typeDouble": {
                "type": "double"
            },
            "typeCharacter": {
                "type": "character"
            },
            "typeString": {
                "type": "string"
            },
            "typeByte": {
                "type": "byte"
            },
            "typeBoolean": {
                "type": "boolean"
            },
            "typeDate": {
                "type": "date"
            },
            "typeTime": {
                "type": "time"
            },
            "typeTimestamp": {
                "type": "timestamp"
            },
            "typeBinary": {
                "type": "binary"
            },
            "typeText": {
                "type": "text"
            }
        }
    };
    var props = {
        "typeInteger": 12345678,
        "typeLong": 12345678910,
        "typeShort": 12345,
        "typeFloat": 10.99,
        "typeDouble": 2199.99,
        "typeCharacter": "T",
        "typeString": "Test",
        "typeByte": 5,
        "typeBoolean": true,
        "typeDate": new Date(2010, 7, 11),
        "typeTime": new Date(0, 0, 0, 17, 36, 04, 723),
        "typeTimestamp": new Date(2010, 7, 11, 36, 04, 723),
        "typeBinary": java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 100000),
        "typeText": strings.repeat("abcdefghij", 10000)
    };
    var Type = store.defineEntity("TypeTest", mapping);
    var type = new Type(props);
    type.save();

    // read again
    type = Type.get(1);
    for (var propName in props) {
        var origValue = props[propName];
        var value = type[propName];
        switch (propName) {
            case "typeDate":
                assert.strictEqual(value.getFullYear(), origValue.getFullYear());
                assert.strictEqual(value.getMonth(), origValue.getMonth());
                assert.strictEqual(value.getDate(), origValue.getDate());
                break;
            case "typeTime":
                assert.strictEqual(value.getHours(), origValue.getHours());
                assert.strictEqual(value.getMinutes(), origValue.getMinutes());
                assert.strictEqual(value.getSeconds(), origValue.getSeconds());
                break;
            case "typeTimestamp":
                assert.strictEqual(value.getFullYear(), origValue.getFullYear());
                assert.strictEqual(value.getMonth(), origValue.getMonth());
                assert.strictEqual(value.getDate(), origValue.getDate());
                break;
            case "typeBinary":
                assert.isTrue(java.util.Arrays.equals(value, origValue)); 
                break;
            default:
                assert.strictEqual(value, origValue);
        }
    }

    // drop the table
    sqlUtils.dropTable(store.getConnection(), store.dialect, mapping.table);
    return;
};

exports.testQueryAll = function() {
    populate(store);
    var result = Book.all();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryEquals = function() {
    populate(store);
    var result = Book.query().equals("id", 1).select();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]._id, 1);
    return;
};

exports.testQueryGreaterThan = function() {
    populate(store);
    var result = Book.query().greater("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryGreaterThanOrEquals = function() {
    populate(store);
    var result = Book.query().greaterEquals("id", 6).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryLessThan = function() {
    populate(store);
    var result = Book.query().less("id", 6).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryLessThanOrEquals = function() {
    populate(store);
    var result = Book.query().lessEquals("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryOrder = function() {
    populate(store);
    var result = Book.query().orderBy("id desc").select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, 10 - idx);
    });
    return;
};

exports.testQueryLimit = function() {
    populate(store);
    var result = Book.query().limit(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
};

exports.testQueryOffset = function() {
    populate(store);
    var result = Book.query().offset(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryRange = function() {
    populate(store);
    var result = Book.query().range(3, 8).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 4);
    });
    return;
};

exports.testQueryCombined = function() {
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

exports.testCollection = function() {
    populate(store);
    var author = Author.get(1);
    assert.isNotNull(author.books);
    assert.strictEqual(author.books.length, 2);

    // iteration tests
    for (var i=0; i<author.books.length; i+=1) {
        var book = author.books.get(i);
        assert.strictEqual(book.constructor, Book);
    }
    for each (var book in author.books) {
        assert.strictEqual(book.constructor, Book);
    }
    author.books.forEach(function(book, idx) {
        assert.strictEqual(book.constructor, Book);
    });
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    dbProps = databases.h2;
    require("test").run(exports);
}
