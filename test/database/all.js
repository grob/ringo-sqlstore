var runner = require("../runner");
var system = require("system");

exports.testSchema = require("./schema_test");
exports.testSequence = require("./sequence_test");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
