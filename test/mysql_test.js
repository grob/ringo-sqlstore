exports = require("./store_test");
exports.setDbProps({
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
    "username": "test",
    "password": "test"
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
