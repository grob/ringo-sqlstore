var dbSchema = require("../lib/database/schema");

exports.drop = function(store) {
    var entities = Array.prototype.slice.call(arguments, 1);
    var conn = store.getConnection();
    try {
        entities.forEach(function(Entity) {
            dbSchema.dropTable(conn, store.dialect, Entity.mapping.tableName,
                    Entity.mapping.schemaName);
            Entity.mapping.id.sequence.drop(conn, store.dialect);
        });
    } finally {
        conn.close();
    }
};
