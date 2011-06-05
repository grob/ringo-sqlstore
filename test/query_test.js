var runner = require("./runner");
var assert = require("assert");

var Store = require("../lib/sqlstore/store").Store;
var sqlUtils = require("../lib/sqlstore/util");
var store = null;
var Author = null;
var Book = null;

const MAPPING_AUTHOR = {
    "properties": {
        "name": "string"
    }
};

const MAPPING_BOOK = {
    "properties": {
        "title": "string",
        "author": {
            "type": "object",
            "entity": "Author"
        }
    }
};

var populate = function() {
    store.beginTransaction();
    var authors = [];
    var books = [];
    for (var i=0; i<10; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
        var book = new Book({
            "title": "Book " + i,
            "author": authors[i]
        });
        book.save();
        books.push(book);
    }
    store.commitTransaction();
    return [authors, books];
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
        }
    });
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Author = null;
    Book = null;
    return;
};

exports.testQuerySelectLazy = function() {
    populate();
    var result = Book.query().select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.strictEqual(book.title, "Book " + idx);
    });
};

exports.testQuerySelectAggressive = function() {
    populate();
    var result = Book.query().select("*");
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.strictEqual(book.title, "Book " + idx);
    });
};

exports.testQuerySelectProperty = function() {
    populate();
    var result = Book.query().select("id");
    assert.strictEqual(result.length, 10);
    result.forEach(function(id, idx) {
        assert.strictEqual(id, idx + 1);
    });
    return;
};

exports.testQueryAll = function() {
    populate();
    var result = Book.all();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.strictEqual(book.title, "Book " + idx);
    });
};

exports.testQueryAllAggressive = function() {
    populate();
    var result = Book.all("*");
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.strictEqual(book.title, "Book " + idx);
    });
};

exports.testQueryAllProperty = function() {
    populate();
    var result = Book.all("id");
    assert.strictEqual(result.length, 10);
    result.forEach(function(id, idx) {
        assert.strictEqual(id, idx + 1);
    });
    return;
};

exports.testQueryEquals = function() {
    populate();
    var result = Book.query().equals("id", 1).select();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]._id, 1);
    // storable as argument
    result = Book.query().equals("author", Author.get(1)).select();
    assert.strictEqual(result.length, 1);
    // multiple values as argument
    result = Book.query().equals("id", [1, 2, 3, 4, 5]).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    // multiple storables as argument
    result = Book.query().equals("author", Author.all()).select();
    assert.strictEqual(result.length, 10);
    return;
};

exports.testQueryGreaterThan = function() {
    populate();
    var result = Book.query().greater("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryGreaterThanOrEquals = function() {
    populate();
    var result = Book.query().greaterEquals("id", 5).select();
    assert.strictEqual(result.length, 6);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 5);
    });
    return;
};

exports.testQueryLessThan = function() {
    populate();
    var result = Book.query().less("id", 6).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryLessThanOrEquals = function() {
    populate();
    var result = Book.query().lessEquals("id", 5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
    return;
};

exports.testQueryOrder = function() {
    populate();
    var result = Book.query().orderBy("id desc").select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, 10 - idx);
    });
    return;
};

exports.testQueryLimit = function() {
    populate();
    var result = Book.query().limit(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
    });
};

exports.testQueryOffset = function() {
    populate();
    var result = Book.query().offset(5).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 6);
    });
    return;
};

exports.testQueryRange = function() {
    populate();
    var result = Book.query().range(3, 8).select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 4);
    });
    return;
};

exports.testQueryCombined = function() {
    populate();
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

exports.testQueryFilter = function() {
    var [authors, books] = populate();
    // string argument(s)
    var result = Book.query().filter("title == " + sqlUtils.quote(books[0].title)).select();
    assert.strictEqual(result[0]._id, books[0]._id);
    var result = Book.query().filter("title == " + sqlUtils.quote(books[0].title) + " || title == " + sqlUtils.quote(books[1].title)).select();
    assert.strictEqual(result[0]._id, books[0]._id);
    assert.strictEqual(result[1]._id, books[1]._id);
    // explicit entity plus numeric argument
    var result = Book.query().filter("Book.id == " + books[0]._id).select();
    assert.strictEqual(result[0]._id, books[0]._id);
    return;
};

exports.testCount = function() {
    var [authors, books] = populate();
    assert.strictEqual(Book.query().count(), books.length);
    return;
};

exports.testMax = function() {
    var [authors, books] = populate();
    assert.strictEqual(Book.query().max("id"), books.length);
    assert.strictEqual(Book.query().equals("author", authors[1]).max("id"), books[1]._id);
    return;
};

exports.testMin = function() {
    var [authors, books] = populate();
    assert.strictEqual(Book.query().min("id"), books[0]._id);
    assert.strictEqual(Book.query().equals("author", authors[1]).min("id"), books[1]._id);
    return;
};

exports.testSum = function() {
    var [authors, books] = populate();
    assert.strictEqual(Book.query().sum("id"), books.reduce(function(sum, book) {
        return sum + book._id
    }, 0));
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
