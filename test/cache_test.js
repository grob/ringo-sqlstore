var assert = require("assert");
var Cache = require("ringo/storage/sql/cache").Cache;

exports.testCache = function() {
    var cache = new Cache();
    assert.isNotNull(cache);
    assert.strictEqual(cache.size(), 0);    
    assert.isTrue(cache.isEmpty());

    // put
    cache.put("one", 1);
    assert.isFalse(cache.isEmpty());
    assert.strictEqual(cache.size(), 1);

    // containsKey
    assert.isTrue(cache.containsKey("one"));
    assert.isFalse(cache.containsKey("two"));
    
    // get
    var value = cache.get("one");
    assert.strictEqual(value, 1);
    assert.isNull(cache.get("two"));

    // remove
    cache.remove("one");
    assert.isTrue(cache.isEmpty());
    assert.isNull(cache.get("one"));

    // clear
    cache.put("two");
    cache.clear();
    assert.isTrue(cache.isEmpty());
    return;
};

exports.testRotation = function() {
    var cache = new Cache();
    for (var i=1; i<=1001; i+=1) {
        cache.put("obj" + i, i);
    }
    assert.strictEqual(cache.size(), 501);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require('test').run(exports);
}
