exports.h2 = {
    "url": "jdbc:h2:mem:test;MVCC=TRUE",
    "driver": "org.h2.Driver"
};

exports.mysql = {
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
/*
    "pool": "c3p0",
    "minPoolSize": 5,
    "acquireIncrement": 2,
    "numHelperThreads": 6,
    "maxPoolSize": 20,
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
    "url": "jdbc:postgresql://localhost/test",
    "driver": "org.postgresql.Driver",
    "user": "test",
    "password": "test"
};
