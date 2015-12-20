#!/bin/bash
CWD=`dirname $0`
IN="${CWD}/parser.pegjs"
OUT="${CWD}/../lib/query/parser.js"

cat ${CWD}/parser.header > ${OUT}

pegjs -e "module.exports" --extra-options-file ${CWD}/parser-options.json  < ${IN} >> ${OUT}