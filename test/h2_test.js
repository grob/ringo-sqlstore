exports = require("./store_test");
exports.setDbProps({
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require('test').run(exports);
}
