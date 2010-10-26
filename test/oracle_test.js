var dbProps = {
    "url": "jdbc:oracle:thin:@192.168.1.212:1524:XE",
    "driver": "oracle.jdbc.driver.OracleDriver",
    "username": "test",
    "password": "test"
};

require("./suite").forEach(function(moduleName) {
    var testName = "test " + moduleName;
    exports[testName] = require("./" + moduleName);
    exports[testName].setDbProps(dbProps);
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
