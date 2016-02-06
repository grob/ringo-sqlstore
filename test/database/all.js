var runner = require("../runner");
var system = require("system");

exports.testSchema = require("./schema_test");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
