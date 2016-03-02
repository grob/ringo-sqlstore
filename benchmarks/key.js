var term = require("ringo/term");

var Key = require("../lib/key");

var setUp = exports.setUp = function() {};

exports.tearDown = function() {};

var start = exports.start = function(cnt) {
    cnt || (cnt = 1000000);
    var start = Date.now();
    var result = [];
    for (let i=0; i<cnt; i+=1) {
        result.push(new Key("Author"));
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "instantiations,", millis / cnt + "ms/instantiation", term.RESET);
}