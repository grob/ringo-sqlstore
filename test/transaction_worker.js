const authors = [];

function onmessage(event) {
    const workerNr = event.data.workerNr;
    const cnt = event.data.cnt;
    const Author = event.data.Author;
    for (let i=0; i<cnt; i+=1) {
        let author = new Author({
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