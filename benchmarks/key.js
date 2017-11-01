const term = require("ringo/term");

const Key = require("../lib/key");

const setUp = exports.setUp = function() {};

exports.tearDown = function() {};

const start = exports.start = function(cnt) {
    cnt || (cnt = 1000000);
    const start = Date.now();
    const result = [];
    for (let i=0; i<cnt; i+=1) {
        result.push(new Key("Author"));
    }
    const millis = Date.now() - start;
    term.writeln(term.GREEN, millis, "ms for", cnt, "instantiations,", millis / cnt + "ms/instantiation", term.RESET);
}