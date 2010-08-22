exports = require("./store_test");
exports.setDbProps({
    "url": "jdbc:postgresql://192.168.1.215/test",
    "driver": "org.postgresql.Driver",
    "username": "test",
    "password": "test"
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require('test').run(exports);
}
