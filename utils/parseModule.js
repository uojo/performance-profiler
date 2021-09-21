const urlParse = require('url-parse')
const queryString = require('query-string');

// const a = "webpack-internal:///./node_modules/cache-loader/dist/cjs.js?!./node_modules/babel-loader/lib/index.js?!./node_modules/cache-loader/dist/cjs.js?!./node_modules/vue-loader/lib/index.js?!./src/components/common/DynamicAudioIcon.vue?vue&type=script&lang=js&"


function parseLoaderPath(url) {
  const pr = urlParse(url.split('?!.').slice(-1)[0], false)
  return `${pr.pathname}?${pr.query}`
}

function parseModuleUrl(url) {
  if (!url) return ''

  if (/loader/.test(url)) {
    return parseLoaderPath(url)
  }

  url = url.replace('webpack-internal:///.', '')
  return url
}

// console.log(parseModuleUrl(a));

module.exports = {
  parseModuleUrl
}