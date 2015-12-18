exports.h2 = {
    "url": "jdbc:h2:mem:test;MVCC=TRUE",
    "driver": "org.h2.Driver"
};

exports.mysql = {
//    "url": "jdbc:mysql://localhost/test?jdbcCompliantTruncation=false&elideSetAutoCommits=true&dontTrackOpenResources=true&enableQueryTimeouts=false&useLocalSessionState=true&cachePrepStmts=true&cacheCallableStmts=true&alwaysSendSetIsolation=false&prepStmtCacheSize=1024&cacheServerConfiguration=true&prepStmtCacheSqlLimit=2048&zeroDateTimeBehavior=convertToNull&traceProtocol=false&useUnbufferedInput=false&useReadAheadInput=true&maintainTimeStats=false&useServerPrepStmts=true&cacheRSMetadata=true&poolPreparedStatements=true&maxOpenPreparedStatements=100",
//    "url": "jdbc:mysql://localhost/test?cachePrepStmts=true&prepStmtCacheSize=50&cacheResultSetMetadata=true&cacheServerConfiguration=true&dontTrackOpenResources=true&elideSetAutoCommits=true",
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
/*
    "pool": "c3p0",
    "minPoolSize": 20,
    "initialPoolSize": 20,
    "acquireIncrement": 5,
    "numHelperThreads": 4,
    "maxPoolSize": 100,
    "maxStatementsPerConnection": 10,
*/
/*
    "pool": "boneCP",
    "minConnectionsPerPartition": 5,
    "acquireIncrement": 5,
    "maxConnectionsPerPartition": 20,
    "partitionCount": 1,
*/
    "user": "test",
    "password": "test"
};

exports.oracle = {
    "url": "jdbc:oracle:thin:@192.168.1.25:1521:XE",
    "driver": "oracle.jdbc.driver.OracleDriver",
    "user": "test",
    "password": "test"
};

exports.postgresql = {
    "pool": "hikari",
    "url": "jdbc:postgresql://localhost/test",
    "driver": "org.postgresql.Driver",
    "user": "test",
    "password": "test",
    "autoCommit": true,
    "readOnly": true,
    "minimumIdle": 10,
    "maximumPoolSize": 30
};
