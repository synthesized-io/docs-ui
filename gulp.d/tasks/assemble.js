'use strict'

const { Readable } = require('readable-stream')
const { obj: map } = require('through2')
const ospath = require('path')
const { posix: path } = ospath
const vfs = require('vinyl-fs')
const rename = require('gulp-rename')

const DOT_RELATIVE_RX = new RegExp(`^\\.{1,2}[/${ospath.sep.replace('/', '').replace('\\', '\\\\')}]`)

module.exports = (config, workDir) => () => {
  const result = Promise.all(
    config.sources.map((source) => {
      // console.log('source', source)
      var { path: sourcePath, startPath = '.', destPath = '.', filter = '**/*' } = source
      //from load-asciidoc:
      if (sourcePath.charAt() === '.' && DOT_RELATIVE_RX.test(sourcePath)) {
        // NOTE require resolves a dot-relative path relative to current file; resolve relative to playbook dir instead
        // console.log('dot case')
        sourcePath = ospath.resolve(config.dir || '.', sourcePath)
      } else if (!ospath.isAbsolute(sourcePath)) {
        // NOTE appending node_modules prevents require from looking elsewhere before looking in these paths
        const paths = [config.dir || '.', ospath.dirname(__dirname)].map((root) => ospath.join(root, 'node_modules'))
        // console.log('resolve paths: ', paths)
        sourcePath = require.resolve(sourcePath, { paths })
        //this is the path to the required "main" file or index.js file.
        //A better check would be good... assume the main file is in root, or there's an index.js file.
        sourcePath = ospath.dirname(sourcePath)
      }
      //end crib.
      //Is this enough posixification?  Maybe sourcePath needs to be converted after resolution?
      sourcePath = ospath.join(sourcePath, 'src', startPath)
      // console.log('sourcePath', sourcePath)
      const opts = { base: sourcePath, cwd: sourcePath }
      return new Promise((resolve, reject) =>
        vfs
          .src(filter, opts)
          .on('error', reject)
          .pipe(
            rename((file) => {
              file.dirname = path.join(destPath, file.dirname)
              // console.log('path', path)
            })
          )
          .pipe(collectFiles(resolve))
      )
    })
  )
    .then(
      (sourceFileList) => {
        // console.log('sourceFileList', sourceFileList)
        const sourceFiles = sourceFileList.reduce((accum, files) => {
          files.forEach((value, key) => accum.set(key, value))
          return accum
        }, new Map())
        // console.log('sourceFiles', sourceFiles)
        return sourceFiles
      },
      (reason) => {
        console.log('rejected', reason)
        return reason
      }
    )
    .then(
      (sourceFiles) =>
        new Promise((resolve, reject) => {
          Readable.from(sourceFiles.values())
            .pipe(vfs.dest(workDir))
            .on('finish', resolve)
            .on('error', reject)
        })
    )
  return result
}

function collectFiles (done) {
  const files = new Map()
  return map((file, _, next) => files.set(file.path, file) && next(), () => done(files)) // prettier-ignore
}
