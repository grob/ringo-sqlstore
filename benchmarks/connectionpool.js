var term = require("ringo/term");
var assert = require("assert");

var {ConnectionPool} = require("../lib/sqlstore/connectionpool");

var connectionPool = null;

exports.setUp = function(dbProps) {
    connectionPool = new ConnectionPool(dbProps);
};

exports.tearDown = function() {
    connectionPool.closeConnections();
};

exports.start = function(cnt) {
    cnt || (cnt = 200000);
    var start = Date.now();
    for (let i=0; i<cnt; i+=1) {
        let conn = connectionPool.getConnection();
        conn.close();
    }
    var millis = Date.now() - start;
    term.writeln(term.GREEN, cnt, "connections,", millis / cnt + "ms per connection retrieval");
};
