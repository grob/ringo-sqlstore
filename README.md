About Ringo SQLstore
===============

Ringo SQLstore is a lightweight ORM/storage implementation for [RingoJS]. It uses JDBC for communication with databases. Current features are:

* Creation of tables and sequences
* Transaction support
* Lazy loading
* Simple one-to-one and one-to-many mappings (see below)
* Connection pooling

Currently supported databases are H2, MySQL (5.x), Oracle (XE) and PostgreSQL (8.x). H2 is part of the package, so one can start right off using it without the hassle of installing and configuring a database.

SQLstore is heavily inspired by

* [ringo-hibernate] by Robert Thurnher
* [Helma] (the predecessor of RingoJS)
* [Hibernate] Project

Status
======

Ringo SQLstore is experimental beta, so expect bugs and performance issues as well as significant API changes.

Supported data types
====================

Ringo SQLstore supports the following data types for use in mappings:

* integer
* long
* short
* float
* double
* character
* string
* byte
* boolean
* date
* time
* timestamp
* binary
* text

See the various [database] files for details about the mapping of these data types to specific column types.

Basic Usage
===========

This example model defines an entity "Author" having two properties, "firstName" and "lastName":

    // require Store and instantiate it (using an h2 in-memory database)
    var Store = require("ringo/storage/sql/store").Store;
    var store = new Store({
        "url": "jdbc:h2:mem:test",
        "driver": "org.h2.Driver"
    });
    // define the entity, passing the mapping as second argument
    // With this the table is created in the database
    var Author = store.defineEntity("Author", {
        "properties": {
            "firstName": "string",
            "lastName": "string"
        }
    });
    // create a new Author instance
    var author = new Author({
      "firstName": "John",
      "lastName": "Doe"
    });
    // persist the author instance
    author.save();

Since the above entity mapping definition doesn't specify a table name, the name of the entity is used. Same with the properties, the name of the columns storing the first and last name equals the property name. The table is created using the following SQL statement:

    CREATE TABLE "Author" ("id" bigint, "firstName" varchar(4000), "lastName" varchar(4000) PRIMARY KEY ("id"))

Note that because of the absence of an "id" definition, SQLstore automatically creates an "id" field. However all of these defaults can be overridden.


Mapping Definition
==================

A basic mapping definition starts with a few definitions:

    {
        "table": "mytable", // defaults to entity name
        "schema": "myschema" // optional, no default
    }

Instead of relying on the default "id" column creation you can specify the column name holding the primary key and the sequence to use for generating unique IDs. If the underlying database supports sequences, SQLstore creates them together with the table, otherwise this setting is ignored and IDs are generated using max(idColumn). 

    {
        "table": "mytable",
        "id": {
            "column": "mytable_id",
            "sequence": "mytable_id_seq"
        }
    }

Properties
----------

In the simplest way entity properties can be defined by specifying the property name and its type:

    {
        "table": "mytable",
        "properties": {
            "firstName": "string",
            "lastName": "string"
        }
    }

This will create columns in the table whose data type is string (for most databases this creates a VARCHAR() column with a length of 4000 characters) and which are nullable. However SQLstore supports a more explicit definition of properties:

    {
        "properties": {
            "firstName": {
                "column": "mt_firstname",
                "type": "string",
                "length": 200
            },
            "lastName": {
                "column": "mt_lastname",
                "type": "string",
                "length": 200,
                "nullable": false
            }
        }
    }

With this definition the values of the two properties will be stored in the columns "mt_firstname" and "mt_lastname". The "firstName" can be null while "lastName" doesn't accept the values null or undefined. Plus both properties can be up to 200 characters length.

Data types "float" and "double" accept the options "precision" and "scale" to further tune the range of accepted values.


One-to-one Mappings
-------------------

SQLstore supports one-to-one mappings, which can be defined as follows:

    "properties": {
        "author": {
            "type": "object",
            "entity": "Author",
            "column": "book_f_author", // optional
            "foreignProperty": "book_id" // optional, defaults to "id"
        }
    }

These mappings are loaded lazily, meaning that the author above is only loaded when accessing one of it's properties at the first time.

One-to-many Mappings
--------------------

One-to-many collections can be defined as follows:

    "properties": {
        "books": {
            "type": "collection",
            "entity": "Book", // the type of entities contained in this collection
            "localProperty": "id", // optional, defaults to the "id" value as local key
            "foreignProperty": "author", // the property containing the foreign key
            "orderBy": "publishDate desc" // optional, specified as "propertyName[ (asc|desc)[ending]]"
			"limit": 1000, // optional
			"loadAggressive": true // optional, see below
        }
    }

By default collections are loaded lazily, meaning they are only populated when accessed for the first time. Note that while collections mimick arrays, it's currently not possible to access objects in a collection using `collection[idx]` notation. Instead use `get(idx)` method of collection instances to retrieve objects by their index position. However collections support Array-like iteration with `for`, `for each` and `forEach`.

Many-To-Many Mappings
---------------------

In addition to one-to-many collections SQLstore also supports many-to-many mappings. To use these SQLstore expects a relation entity to be defined in the model:

    store.defineEntity("RelAuthorBook", {
        "table": "t_relation",
        "author": {
            "type": "object",
            "entity": "Author"
            "column": "rel_author"
        },
        "book": {
            "type": "object",
            "entity": "Book",
            "column": "rel_book"
        }
    });

Not that SQLstore will add an additional "id" column since it currently doesn't support combined keys. With this prerequisite fulfilled you can define a many-to-many collection as follows:

    "properties": {
        "books": {
            "type": "collection",
            "entity": "Book",
            "through": "RelAuthorBook", // the entity to join with
            "join": "RelAuthorBook.book = Book.id", // the join predicate
            "localProperty": "id", // optional, defaults to the "id" value as local key
            "foreignProperty": "RelAuthorBook.author" // the column containing the foreign key
            "orderBy": "publishDate desc" // optional, specified as "propertyName[ (asc|desc)[ending]]"
			"limit": 1000, // optional
			"loadAggressive": true // optional, see below
        }
    }

SQLstore will use the following SQL statement to populate the collection:

    SELECT "t_book"."id" FROM "t_book" INNER JOIN "t_relation" ON "t_relation"."rel_book" = "t_book"."id" WHERE "t_relation"."rel_author" = 2

The "join" and "foreignProperty" specifications above contain the join predicate and filter definition. Note that in both you need to specify the *entity name* followed by a dot and the *property name*, so you never directly specify the column names.

Aggressive Collection Loading
-----------------------------

By default collections are loaded lazily, which means SQLstore will retrieve the list of entity IDs when first accessing a collection property or method, and load the entities themselves one by one when a property of them is accessed. Depending on the collection size this can lead to a massive amount of SQL statements (imagine iterating over a huge collection), therefor you can define eager or *aggressive* loading of collections by setting the property `loadAggressive` within the collection definition to true. Note that this works for both one-to-many and many-to-many collections.

Partitioned Collections
-----------------------

SQLstore supports another collection optimization: partitioned collections. When a partitioned collection is first accessed, SQLstore retrieves the list of entity IDs depending on the collection filtering and creates partitions with a default size of 100 (this can be overridden). When accessing an object within this collection, SQLstore aggressively loads the partition in which the object resides using a single SQL statement and creates the entities in this partition. Partitioned collections can improve performance for big collections, however keep in mind that most databases have a maximum allowed size of `where value in values` clauses, so a single partition should not be bigger than that.


 [RingoJS]: http://ringojs.org/
 [ringo-hibernate]: http://github.com/robi42/ringo-hibernate/
 [Helma]: http://helma.org
 [Hibernate]: http://hibernate.org/
 [database]: http://github.com/grob/ringo-sqlstore/tree/master/lib/ringo/storage/sql/databases/
