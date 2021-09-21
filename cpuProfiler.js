
const _ = require('lodash')
const { parseModuleUrl } = require('./utils/parseModule')
const { genID, outputReport, pms2, nearNum } = require('./utils/common')
const { fluctuateReport } = require("./utils/report");

const records = require('./temp/v2.18-20s-im-p2.json')
// const records = require('./temp/v2.18-220s-im.json')
// const records = require('./temp/v2.17-10s.json')
// const records = require('./temp/v2.13.1-10s.json')

function getCPUNodes(cpuProfileRecords) {
  const nodes = cpuProfileRecords.map(e => e.args.data && e.args.data.cpuProfile && e.args.data.cpuProfile.nodes)
  // console.log('nodes: ', nodes);

  const callFrames = nodes.reduce((a, b) => {
    return (a ? a : []).concat(b ? b : [])
  })
  // console.log('callFrames: ', callFrames);

  const nodesMap = {}
  callFrames.forEach((e) => {
    nodesMap[e.id] = e
  })
  // console.log('nodesMap: ', nodesMap);
  return nodesMap
}

function getCPUSamples(sources) {
  return sources.map(e => {
    if (e.args.data && e.args.data.cpuProfile && e.args.data.cpuProfile.samples) {
      return {
        samples: e.args.data.cpuProfile.samples,
        timeDeltas: e.args.data.timeDeltas
      }
    }
  }).filter(Boolean)
}

/**
 * 分析 CPU 使用情况。
 * 原理：
 * cat:disabled-by-default-v8.cpu_profiler 对象中记录 CPU 持续的时间段，其中，args.data.timeDeltas 存放了时间段值，时间段对应运行的任务 ID 存放在 args.data.cpuProfile.samples 中。任务 ID 分布在所有 args.data.cpuProfile.nodes 中。 
 */
const cpuTimeDeltas = () => {
  let sources = records.filter(e => e['cat'] === 'disabled-by-default-v8.cpu_profiler')

  const nodesMap = getCPUNodes(sources)
  const samples = getCPUSamples(sources)

  const typeMap = {}
  const urlMap = {}
  const urlFuncMap = {}
  samples.forEach(e => {
    // 依据 samples 中的id，匹配对应的 nodeID
    e.samples.forEach((nodeID, i) => {
      // id 对应的时间段值，timeDeltas 与 samples 对应
      const timeDelta = e.timeDeltas[i]
      const node = nodesMap[nodeID]
      const type = node.callFrame.codeType
      const url = parseModuleUrl(node.callFrame.url)
      const funcName = node.callFrame.functionName || '(anonymous)'
      const urlFuncID = genID(url, funcName)

      // 一级代码分类
      if (!typeMap[type]) {
        typeMap[type] = { totalTime: 0, urls: {}, funcNames: {}, }
      }
      typeMap[type].totalTime += timeDelta
      typeMap[type].totalTimeFormat = pms2(typeMap[type].totalTime)

      if (url) {
        if (!typeMap[type].urls[url]) {
          typeMap[type].urls[url] = { totalTime: 0, timeDeltas: [] }
        }
        typeMap[type].urls[url].timeDeltas.push(timeDelta)
        typeMap[type].urls[url].totalTime += timeDelta
      }

      if (typeof typeMap[type].funcNames[funcName] !== 'object') {
        typeMap[type].funcNames[funcName] = { totalTime: 0, timeDeltas: [] }
      }

      typeMap[type].funcNames[funcName].timeDeltas || console.log('> ', typeMap[type].funcNames[funcName]);
      typeMap[type].funcNames[funcName].timeDeltas.push(timeDelta)
      typeMap[type].funcNames[funcName].totalTime += timeDelta


      // 三级方法名称，相同的 func 会存在多个 url 中
      if (!urlFuncMap[urlFuncID]) {
        urlFuncMap[urlFuncID] = { name: funcName, totalTime: 0, count: 0, timeDeltas: [] }
      }
      urlFuncMap[urlFuncID].count++
      urlFuncMap[urlFuncID].totalTime += timeDelta
      urlFuncMap[urlFuncID].timeDeltas.push(timeDelta)


      // 二级文件路径
      if (url) {
        if (!urlMap[url]) {
          urlMap[url] = { totalTime: 0, count: 0, timeDeltas: [], funcNames: new Set() }
        }
        urlMap[url].count++
        urlMap[url].totalTime += timeDelta
        urlMap[url].timeDeltas.push(timeDelta)
        urlMap[url].funcNames.add(funcName) // 加到对应的 url 下
      }
      // end
    })
  })

  // console.log('typeMap: ', typeMap);
  // console.log('typeMap.url: ', typeMap.JS.urls['/src/utils/date.js']);
  // console.log('typeMap.funcName: ', typeMap.other.funcNames['(idle)']);
  // console.log('urlFuncMap: ', Object.keys(urlFuncMap), urlFuncMap);

  const sortUrls = Object.keys(urlMap).map(key => {
    const val = urlMap[key]
    return {
      k: key,
      tt: val.totalTime,
      ttf: pms2(val.totalTime),
      c: val.count,
      fs: [...val.funcNames.values()].map(fname => ({
        f: fname,
        c: urlFuncMap[genID(key, fname)].count,
        tt: urlFuncMap[genID(key, fname)].totalTime,
        ttf: pms2(urlFuncMap[genID(key, fname)].totalTime)
      })).sort((a, b) => b.tt - a.tt)
    }
  }).sort((a, b) => b.tt - a.tt)
  // console.log('sortUrls: ', sortUrls);

  // 总耗时
  console.log(pms2(sortUrls.reduce((a, b) => {
    return (a.tt || a) + b.tt
  })));

  return { typeMap, sortUrls }
}

const parseRlt = cpuTimeDeltas()

// outputReport('sortUrls', parseRlt.sortUrls) // 输出到文件
// outputReport('typeMap', parseRlt.typeMap)

// console.log(Object.keys(parseRlt.typeMap)); // [ 'JS', 'other' ]
// console.log(Object.keys(parseRlt.typeMap.JS)); // [ 'totalTime', 'urls', 'funcNames', 'totalTimeFormat' ]
// console.log(parseRlt.typeMap.other.totalTimeFormat, parseRlt.typeMap.JS.totalTimeFormat); // 合等于 timeline 的总时长

/**
 * 分析 JS.urls 中所有的时间段样本
 */
const jsSamplesUrls = parseRlt.typeMap.JS.urls
const jsSamplesTimes = Object.keys(jsSamplesUrls).reduce((a, b) => {
  return (jsSamplesUrls[a] ? jsSamplesUrls[a].timeDeltas : a).concat(jsSamplesUrls[b].timeDeltas)
}).filter(e => e > 100)
// console.log('jsSamplesTimes: ', jsSamplesTimes.sort((a, b) => b - a));

fluctuateReport({
  reportTitle: "CPU used time deltas",
  coverage: 0.99,
  sampleValues: jsSamplesTimes.map(e => nearNum(e, 100)),
});
