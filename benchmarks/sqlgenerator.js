var term = require("ringo/term");

var Store = require("../lib/store");
var utils = require("../test/utils");
var Parser = require("../lib/query/parser");
var SqlGenerator = require("../lib/query/sqlgenerator");
var SQL = "select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.name order by Author.name";
var store = null;
var Author = null;
var Book = null;
var ast = null;

var MAPPING_AUTHOR = {
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
            "query": "from Book where author = :id"
        }
    }
};

var MAPPING_BOOK = {
    "table": "book",
    "id": {
        "column": "book_id",
        "sequence": "book_id"
    },
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "nullable": false
        },
        "author": {
            "type": "object",
            "column": "book_f_author",
            "entity": "Author",
            "nullable": false
        }
    }
};

exports.setUp = function(dbProps) {
    store = new Store(Store.initConnectionPool(dbProps));
    term.writeln("------------------------------");
    term.writeln("Using", store.connectionPool.getDriverClassName());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
    ast = Parser.parse(SQL);
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    store.close();
};

exports.start = function(cnt) {
    cnt || (cnt = 100000);
    var start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        SqlGenerator.generate(store, ast);
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "selectors,", millis / cnt + "ms/selector", term.RESET);
};