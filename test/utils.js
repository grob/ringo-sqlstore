var dbSchema = require("../lib/sqlstore/database/schema");

exports.drop = function(store) {
    var entities = Array.prototype.slice.call(arguments, 1);
    var conn = store.getConnection();
    entities.forEach(function(Entity) {
        var schemaName = Entity.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (dbSchema.tableExists(conn, Entity.mapping.tableName, schemaName)) {
            dbSchema.dropTable(conn, store.dialect, Entity.mapping.tableName, schemaName);
            Entity.mapping.id.sequence.drop(conn, store.dialect);
        }
    });
};
