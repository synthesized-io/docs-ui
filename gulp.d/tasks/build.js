'use strict'

const autoprefixer = require('autoprefixer')
const browserify = require('browserify')
const buffer = require('vinyl-buffer')
const concat = require('gulp-concat')
const cssnano = require('cssnano')
const fs = require('fs-extra')
const imagemin = require('gulp-imagemin')
const merge = require('merge-stream')
const ospath = require('path')
const path = ospath.posix
const postcss = require('gulp-postcss')
const postcssCalc = require('postcss-calc')
const postcssImport = require('postcss-import')
const postcssUrl = require('postcss-url')
const postcssVar = require('postcss-custom-properties')
const { Transform } = require('stream')
const map = (transform) => new Transform({ objectMode: true, transform })
const through = () => map((file, enc, next) => next(null, file))
const terser = require('gulp-terser')
const uglify = require('gulp-uglify')
const vfs = require('vinyl-fs')

module.exports = (srcbase, destbase, config, preview) => () => {
  const sourcemaps = preview || config.preview || process.env.SOURCEMAPS === 'true'

  const startPaths = config.sources.reduce((accum, path) => {
    const destPath = path.destPath
    destPath && (accum.includes(destPath) || accum.push(destPath))
    return accum
  }, [])

  startPaths.length > 0 || startPaths.push('')

  const css = (config.css || ['site.css']).map((p) => `css/${p}`)
  const js = (config.js || [{ target: 'site', contents: ['+([0-9])-*.js'] }])
    .map((data) => {
      if (data.require) {
        data.contents = require.resolve(data.require, { /*paths*/ })
      } else if (data.contents) {
        Array.isArray(data.contents) || (data.contents = [data.contents])
        data.contents = data.contents.map((glob) => `js/${glob}`)
      } else {
        data.contents = [`js/${data.target}/+([0-9])-*.js`]
      }
      data.target = `js/${data.target}.js`
      data.processor = data.processor === 'none' ? through : data.processor === 'terser' ? terser : uglify
      return data
    })

  return merge(
    startPaths.map((startPath) => {
      const src = startPath === '' ? srcbase : ospath.join(srcbase, startPath)
      const dest = startPath === '' ? destbase : ospath.join(destbase, startPath)
      const opts = { base: src, cwd: src }

      const postcssPlugins = [
        postcssImport,
        (css, { messages, opts: { file } }) =>
          Promise.all(
            messages
              .reduce((accum, { file: depPath, type }) => (type === 'dependency' ? accum.concat(depPath) : accum), [])
              .map((importedPath) => fs.stat(importedPath).then(({ mtime }) => mtime))
          ).then((mtimes) => {
            const newestMtime = mtimes.reduce((max, curr) => (!max || curr > max ? curr : max), file.stat.mtime)
            if (newestMtime > file.stat.mtime) file.stat.mtimeMs = +(file.stat.mtime = newestMtime)
          }),
        postcssUrl([
          {
            filter: '**/~typeface-*/files/*',
            url: (asset) => {
              const relpath = asset.pathname.substr(1)
              const abspath = require.resolve(relpath)
              const basename = ospath.basename(abspath)
              const destpath = ospath.join(dest, 'font', basename)
              if (!fs.pathExistsSync(destpath)) fs.copySync(abspath, destpath)
              return path.join('..', 'font', basename)
            },
          },
        ]),
        // postcssVar({ preserve: preview }),
        // NOTE importFrom is for supplemental CSS files
        // asciidoctor docs ui has preview: true
        // TODO this does not take account of added aux. vars files.
        postcssVar({ importFrom: path.join(src, 'css', 'vars.css'), preserve: preview }),
        preview ? postcssCalc : () => {},
        autoprefixer,
        preview
          ? () => {}
          : (css, result) =>
            cssnano({ preset: 'default' })(css, result).then(() => postcssPseudoElementFixer(css, result)),
      ]

      return merge(
        ...js.map(({ target, contents, processor }) => vfs
          .src(contents, { ...opts, sourcemaps })
          .pipe(processor())
          .pipe(concat(target))),
        vfs
          .src('js/vendor/*.js', { ...opts, read: false })
          .pipe(
            // see https://gulpjs.org/recipes/browserify-multiple-destination.html
            map((file, enc, next) => {
              if (file.relative.endsWith('.bundle.js')) {
                const mtimePromises = []
                const bundlePath = file.path
                browserify(file.relative, { basedir: src, detectGlobals: false })
                  .plugin(preview ? through : 'browser-pack-flat/plugin')
                  .on('file', (bundledPath) => {
                    if (bundledPath !== bundlePath) mtimePromises.push(fs.stat(bundledPath).then(({ mtime }) => mtime))
                  })
                  .bundle((bundleError, bundleBuffer) =>
                    Promise.all(mtimePromises).then((mtimes) => {
                      const newestMtime = mtimes.reduce((max, curr) => (curr > max ? curr : max), file.stat.mtime)
                      if (newestMtime > file.stat.mtime) file.stat.mtimeMs = +(file.stat.mtime = newestMtime)
                      if (bundleBuffer !== undefined) file.contents = bundleBuffer
                      file.path = file.path.slice(0, file.path.length - 10) + '.js'
                      next(bundleError, file)
                    })
                  )
              } else {
                fs.readFile(file.path, 'UTF-8').then((contents) => {
                  file.contents = Buffer.from(contents)
                  next(null, file)
                })
              }
            })
          )
          .pipe(buffer())
          .pipe(uglify()),
        vfs.src(css, { ...opts, sourcemaps })
          .pipe(postcss((file) => ({ plugins: postcssPlugins, options: { file } }))),
        vfs.src('font/*.{ttf,woff*(2)}', opts),
        vfs.src('img/**/*.{gif,ico,jpg,png,svg}', opts).pipe(
          preview
            ? through()
            : imagemin(
              [
                imagemin.gifsicle(),
                imagemin.jpegtran(),
                imagemin.optipng(),
                imagemin.svgo({
                  plugins: [
                    { cleanupIDs: { preservePrefixes: ['symbol-', 'view-'] } },
                    { removeViewBox: false },
                    { removeDesc: false },
                  ],
                }),
              ].reduce((accum, it) => (it ? accum.concat(it) : accum), [])
            )
        ),
        vfs.src('helpers/*.js', opts),
        vfs.src('layouts/*.hbs', opts),
        vfs.src('partials/*.hbs', opts),
        vfs.src('static/**/*', opts).pipe(map((file, enc, next) => {
          file.path = file.path.slice(0, file.path.length - file.relative.length) +
            file.relative.slice('/static'.length)
          next(null, file)
        }))
      ).pipe(vfs.dest(dest, { sourcemaps: sourcemaps && '.' }))
    })
  )
}

function postcssPseudoElementFixer (css, result) {
  css.walkRules(/(?:^|[^:]):(?:before|after)/, (rule) => {
    rule.selector = rule.selectors.map((it) => it.replace(/(^|[^:]):(before|after)$/, '$1::$2')).join(',')
  })
}
