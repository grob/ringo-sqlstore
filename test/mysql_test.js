var dbProps = {
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
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
