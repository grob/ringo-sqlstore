var authors = [];

function onmessage(event) {
    var workerNr = event.data.workerNr;
    var cnt = event.data.cnt;
    var Author = event.data.Author;
    for (var i=0; i<cnt; i+=1) {
        var author = new Author({
            "name": "Author " + (i + 1)
        });
        author.save();
        authors.push(author);
        // console.info("Inserted", author._key, "(Thread " + threadId + ")");
    }
    event.source.postMessage({
        "workerNr": workerNr,
        "authors": authors
    });
}