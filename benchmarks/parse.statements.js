const term = require("ringo/term");

const Parser = require("../lib/query/parser");
const SQL = "select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.name order by Author.name";

exports.setUp = function() {};

exports.tearDown = function() {};

exports.start = function(cnt) {
    cnt || (cnt = 10000);
    const start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        Parser.parse(SQL);
    }
    const millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "parsings,", millis / cnt + "ms/parse", term.RESET);
};