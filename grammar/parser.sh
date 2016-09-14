#!/bin/bash
CWD=`dirname $0`
IN="${CWD}/parser.pegjs"
OUT="${CWD}/../lib/query/parser.js"

pegjs --dependency ast:./ast \
      --extra-options-file ${CWD}/parser-options.json \
      --output ${OUT} ${IN}