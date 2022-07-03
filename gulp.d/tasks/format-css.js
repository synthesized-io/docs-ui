'use strict'

const stylelint = require('gulp-stylelint')
const vfs = require('vinyl-fs')

module.exports = (files) => (done) =>
  vfs
    .src(files)
    .pipe(stylelint({ fix: true, reporters: [{ formatter: 'string', console: true }], failAfterError: false }))
    .pipe(vfs.dest((file) => file.base))
// .on('error', done)
