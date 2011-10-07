var runner = require("./runner");
var assert = require("assert");
var ConnectionPool = require("../lib/sqlstore/connectionpool").ConnectionPool;

var pool = null;

exports.setUp = function() {
    pool = new ConnectionPool(runner.getDbProps());
    return;
};

exports.tearDown = function() {
    pool.stopScheduler();
    pool = null;
    return;
};

exports.testGetConnection = function() {
    // first connection
    var conn1 = pool.getConnection();
    assert.strictEqual(pool.size(), 1);
    assert.isNotNull(conn1);
    assert.isTrue(conn1.isInUse());
    assert.isTrue(conn1.isValid());
    conn1.close();
    assert.isFalse(conn1.isInUse());
    assert.strictEqual(pool.size(), 1);

    // retrieve connection again - must be above connection, since it has been closed
    var conn2 = pool.getConnection();
    assert.strictEqual(conn1, conn2);
    assert.strictEqual(pool.size(), 1);

    // retrieve new connection
    var conn3 = pool.getConnection();
    assert.strictEqual(pool.size(), 2);
    assert.notStrictEqual(conn1, conn3);
    assert.notStrictEqual(conn2, conn3);
    assert.isFalse(conn1.getConnection().equals(conn3.getConnection()));
    assert.isFalse(conn2.getConnection().equals(conn3.getConnection()));
    return;
};

exports.testIsStale = function() {
    var conn = pool.getConnection();
    assert.isTrue(conn.isStale(0));
    assert.isFalse(conn.isStale(1000));
    return;
};

exports.testRemoveDeadConnection = function() {
    assert.strictEqual(pool.size(), 0);
    var conn = pool.getConnection();
    assert.strictEqual(pool.size(), 1);
    assert.isTrue(conn.isValid());
    // close underlying connection and return it to the pool - since the
    // connection is dead now, it must be removed from the pool when
    // calling conn.close()
    conn.getConnection().close();
    conn.close();
    assert.strictEqual(pool.size(), 0);
};

exports.testConnectionIsValid = function() {
    var conn = pool.getConnection();
    assert.isTrue(conn.isValid());
    assert.isTrue(conn.validate());
    // close underlying connection
    conn.getConnection().close();
    assert.isFalse(conn.isValid());
    assert.isFalse(conn.validate());
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
