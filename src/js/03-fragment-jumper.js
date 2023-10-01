;(function () {
  'use strict'

  const DEBUG = false

  var article = document.querySelector('article.doc')
  var toolbar = document.querySelector('.toolbar')

  function decodeFragment (hash) {
    return hash && (~hash.indexOf('%') ? decodeURIComponent(hash) : hash).slice(1)
  }

  function computePosition (el, sum) {
    if (article.contains(el)) {
      return computePosition(el.offsetParent, el.offsetTop + sum)
    } else {
      return sum
    }
  }

  function jumpToAnchor (e) {
    DEBUG && console.log('fragment-jumper jumpToAnchor', e)
    DEBUG && console.log('fragment-jumper jumpToAnchor window.scrollY', window.scrollY)
    if (e) {
      window.location.fragmentJumper || (window.location.fragmentJumper = { scrollY: window.scrollY })
      window.location.hash = '#' + this.id
      DEBUG && console.log('fragment-jumper jumpToAnchor after set hash window.scrollY', window.scrollY)
      e.preventDefault()
      onHashChange({ newURL: window.location.href })
    }
  }

  function onHashChange (e) {
    DEBUG && console.log('fragment-jumper onHashChange')
    DEBUG && e.oldURL && console.log('fragment-jumper old hash', new URL(e.oldURL).hash)
    DEBUG && console.log('fragment-jumper new hash', new URL(e.newURL).hash)
    DEBUG && console.log('fragment-jumper onHashChange window.location.fragmentJumper', window.location.fragmentJumper)
    let scrollY = window.location.fragmentJumper && window.location.fragmentJumper.scrollY
    if (!scrollY) {
      let target = window.location.fragmentJumper && window.location.fragmentJumper.target
      if (!target) {
        const fragment = decodeFragment(new URL(e.newURL).hash)
        fragment && (target = document.getElementById(fragment))
      }
      scrollY = computePosition(target, 0) - toolbar.getBoundingClientRect().bottom
      DEBUG && console.log('fragment-jumper target client rectangle', target.getBoundingClientRect())
      DEBUG && console.log('fragment-jumper computed position: toolbar.bottom', toolbar.getBoundingClientRect().bottom)
    }
    delete window.location.fragmentJumper
    DEBUG && console.log('fragment-jumper scrolling to ', scrollY)
    window.scrollTo(0, scrollY)
  }

  window.addEventListener('load', function jumpOnLoad (e) {
    DEBUG && console.log('fragment-jumper jumpOnLoad: location: ', window.location)
    var fragment, target
    if ((fragment = decodeFragment(window.location.hash)) && (target = document.getElementById(fragment))) {
      window.location.fragmentJumper || (window.location.fragmentJumper = { target })
      DEBUG && console.log('fragment-jumper jumpOnLoad: target: ', target)
      DEBUG && console.log('fragment-jumper jumpOnLoad: fragmentJumper: ', window.location.fragmentJumper)
      // jumpToAnchor.bind(target)()
      //TODO does this do anything useful?
      setTimeout(onHashChange, 0, { newURL: window.location.href })
    }
    window.removeEventListener('load', jumpOnLoad)
  })

  Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function (el) {
    var fragment, target
    if ((fragment = decodeFragment(el.hash)) && (target = document.getElementById(fragment))) {
      el.addEventListener('click', jumpToAnchor.bind(target))
    }
  })
  window.addEventListener('hashchange', onHashChange, false)
})()
