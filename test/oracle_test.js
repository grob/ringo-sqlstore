exports = require("./store_test");
exports.setDbProps({
    "url": "jdbc:oracle:thin:@192.168.1.212:1524:XE",
    "driver": "oracle.jdbc.driver.OracleDriver",
    "username": "test",
    "password": "test"
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
