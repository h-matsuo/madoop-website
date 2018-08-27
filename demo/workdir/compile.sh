#!/usr/bin/env bash

set -eu

EMSCRIPTEN_IMAGE_NAME="trzeci/emscripten-slim"
EMSCRIPTEN_IMAGE_TAG="sdk-tag-1.38.8-64bit"

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE:-$0}"); pwd)"

run_emscripten () {
  docker run --rm -t \
    -v "${SCRIPT_DIR}:/src" \
    "${EMSCRIPTEN_IMAGE_NAME}:${EMSCRIPTEN_IMAGE_TAG}" "$@"
}

run_emscripten emcc "${1}.cpp" \
  -O3 \
  -std=c++11 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s "EXPORTED_FUNCTIONS=['_${1}', '_malloc']" \
  -s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap', 'lengthBytesUTF8', 'stringToUTF8']" \
  --js-library lib_emit_func.js \
  -o "${1}.js"
