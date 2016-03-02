var term = require("ringo/term");

var Parser = require("../lib/query/parser");
var SQL = "select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.name order by Author.name";

exports.setUp = function() {};

exports.tearDown = function() {};

exports.start = function(cnt) {
    cnt || (cnt = 10000);
    var start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        Parser.parse(SQL);
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "parsings,", millis / cnt + "ms/parse", term.RESET);
};