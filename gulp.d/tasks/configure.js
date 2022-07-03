'use strict'

const camelCaseKeys = require('camelcase-keys')
const fs = require('fs')
const ospath = require('path')
const yaml = require('js-yaml')
const UI_CONFIG = 'antora-ui.yml'

//Reads antora-ui.yml from file system and returns result
module.exports = () => () => {
  var config = {}
  if (fs.existsSync(UI_CONFIG) && fs.statSync(UI_CONFIG).isFile()) {
    const configFile = fs.readFileSync(UI_CONFIG)
    config = camelCaseKeys(yaml.safeLoad(configFile.toString()), { deep: true })
  }
  config.sources || (config.sources = [{ path: './' }])
  config.dir = config.config ? ospath.dirname((config.file = config.config)) : process.cwd()

  return config
}
