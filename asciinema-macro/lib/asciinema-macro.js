
const createDiv = function (target, attrs) {
  const theme = attrs.theme ? attrs.theme : 'solarized-light'
  const autoplay = attrs.autoplay ? attrs.autoplay : 'true'
  const loop = attrs.loop ? attrs.loop : 'true'
  const asciiDiv = `<div id="${target}" class="openblock"></div>`
  const props = `{loop: ${loop}, theme: '${theme}', autoplay: ${autoplay}}`
  const asciiScript = `AsciinemaPlayer.create('./_images/${target}.cast', document.getElementById('${target}'), ${props});`
  return `${asciiDiv}<script>${asciiScript}</script>`
}

const asciinemaMacro = function () {
  const self = this

  self.named('asciinema')
  self.positionalAttributes(['theme', 'autoplay', 'loop'])

  self.process(function (parent, target, attrs) {
    const html = createDiv(target, attrs)
    return self.createBlock(parent, 'pass', html, attrs, {})
  })
}

module.exports.register = function (registry) {
  function doRegister (registry) {
    if (typeof registry.blockMacro === 'function') {
      registry.blockMacro(asciinemaMacro)
    } else {
      console.warn('no \'blockMacro\' method on alleged registry')
    }
  }

  if (typeof registry.register === 'function') {
    registry.register(function () {
      registry = this
      doRegister(registry)
    })
  } else {
    doRegister(registry)
  }
  return registry
}
