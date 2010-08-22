var assert = require("assert");
var ConnectionPool = require("ringo/storage/sql/connectionpool").ConnectionPool;
var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
};

exports.testGetConnection = function() {
    var pool = new ConnectionPool(dbProps);
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

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
