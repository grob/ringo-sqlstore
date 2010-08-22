About Ringo SQLstore
===============

Ringo SQLstore is a lightweight ORM/storage implementation for [RingoJS]. It uses JDBC for communication with databases. Current features are:

* Creation of tables and sequences
* Transaction support
* Lazy loading
* Simple one-to-one and one-to-many mappings (see below)
* Connection pooling

Currently supported databases are H2, MySQL (5.x), Oracle (XE) and PostgreSQL (8.x).

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

    // require Store and instantiate it (using an h2 in-memory database)
    var Store = require("ringo/storage/sql/store").Store;
    var store = new Store({
        "url": "jdbc:h2:mem:test",
        "driver": "org.h2.Driver"
    });
    // define the entity, passing the mapping as second argument
    var Author = store.defineEntity("Author", {
        "table": "author",
        "properties": {
            "name": {
                "type": "string",
                "column": "author_name",
                "nullable": false
            }
        }
    });
    // create a new Author instance
    var author = new Author({"name": "Mr. FooBar"});
    // saving creates the table and stores the above instance
    author.save();


Mapping Definition
==================

A basic mapping definition looks like:

    {
        "table": "mytable",
        "schema": "myschema", // optional, is not created on-the-fly
        "id": { // optional
            "column": "mytable_id", // optional, defaults to "id"
            "sequence": "mytable_id_seq", // optional
        },
        "properties": {
            "myprop": {
                "type": "string",
                "column": "mytable_string", // optional
                "length": 255, // optional
                "nullable": false, // optional
                "default": "nada" // optional, currently only works for strings
            }
        }
    }

One-to-one Mappings (aka. Object-Mappings)
------------------------------------------

SQLstore supports simple one-to-one mappings, which can be defined as

    "properties": {
        "author": {
            "type": "object",
            "entity": "Author",
            "column": "book_f_author", // optional
            "foreignProperty": "book_id" // optional, defaults to "id"
        }
    }

These mappings are loaded lazily, meaning that only an empty entity is created during resolving, and the entity is only loaded when accessing a property at the first time.

One-to-many Mappings (aka. Collections)
---------------------------------------

SQLstore supports simple one-to-many mappings:

    "properties": {
        "books": {
            "type": "collection",
            "entity": "Book",
            "localProperty": "id", // optional, defaults to "id"
            "foreignProperty": "author"
        }
    }

Collections are also loaded lazily, so they are only populated when accessed for the first time. Note that while collections mimick arrays, it's currently not possible to access objects in a collection using collection[idx] notation. Instead retrieving objects by index position can be done through the get(idx) method of collection instances.

Also supported is iterating over collections using for, for each and forEach.

 [RingoJS]: http://ringojs.org/
 [ringo-hibernate]: http://github.com/robi42/ringo-hibernate/
 [Helma]: http://helma.org
 [Hibernate]: http://hibernate.org/
 [database]: http://github.com/grob/ringo-sqlstore/tree/master/lib/ringo/storage/sql/databases/
