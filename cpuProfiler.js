
const _ = require('lodash')
const { table, getBorderCharacters } = require('table')

const { parseModuleUrl } = require('./utils/parseModule')
const { genID, outputReport, pms2, nearNum, toPercent } = require('./utils/common')
const { fluctuateReport } = require("./utils/report");

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

function calcTableItems(obj) {
  const totalTime = obj.JS.totalTime + obj.other.totalTime
  const items = Object.keys(obj.other.funcNames)
    .map(e => (
      { name: e, totalTime: obj.other.funcNames[e].totalTime }
    ))
    .concat(
      { name: '(javascript)', totalTime: obj.JS.totalTime }
    )
    .map(e => {
      const tt = e.totalTime
      const ttr = toPercent(tt, totalTime)
      return {
        name: e.name,
        tt: [tt, pms2(tt)],
        ttr: [ttr, `${(ttr * 100).toFixed(2)}%`],
      }
    })
  items.sort((a, b) => (b.tt[0] - a.tt[0]))
  return items
}

function col2row(title, obj) {
  const items = calcTableItems(obj)
  const names = [''].concat(items.map(e => e.name))
  const values = [title].concat(items.map(e => {
    return [e.tt[1], e.ttr[1]].join(' … ')
  }))
  return {
    names,
    values
  }
}

/**
 * 归并分析所有 CPU 时间片
 * 原理：
 * cat:disabled-by-default-v8.cpu_profiler 对象中记录 CPU 持续的时间片，其中，args.data.timeDeltas 存放了时间片值，时间片对应运行的任务 ID 存放在 args.data.cpuProfile.samples 中。任务 ID 分布在所有 args.data.cpuProfile.nodes 中。 
 */
function cpuTimeDeltas(items) {
  let sources = items.filter(e => e['cat'] === 'disabled-by-default-v8.cpu_profiler')

  const totalOffset = sources.slice(-1)[0].ts - sources[0].ts
  const nodesMap = getCPUNodes(sources)
  const samples = getCPUSamples(sources)

  const typeMap = {}
  const urlMap = {}
  const urlFuncMap = {}
  samples.forEach(e => {
    // 依据 samples 中的id，匹配对应的 nodeID
    e.samples.forEach((nodeID, i) => {
      // id 对应的时间片值，timeDeltas 与 samples 对应
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

  return { typeMap, sortUrls }
}

/**
 * 时间片数值波动性分析
 * @param {} record
 * @param {string} parsePath
 */
function timeDeltaVolatility(record, parsePath = 'JS.urls') {
  const parseRlt = cpuTimeDeltas(record.data)
  // console.log(Object.keys(parseRlt.typeMap)); // [ 'JS', 'other' ]
  // console.log(Object.keys(parseRlt.typeMap.JS)); // [ 'totalTime', 'urls', 'funcNames', 'totalTimeFormat' ]

  /**
   * 分析 JS.urls 中所有的时间片样本
   * urls 表示运行 JS 代码的文件路径
   */
  const samples = _.get(parseRlt.typeMap, parsePath)
  const samplesTimeDeltas = Object.keys(samples).reduce((a, b) => {
    return (samples[a] ? samples[a].timeDeltas : a).concat(samples[b].timeDeltas)
  }).filter(e => e > 100)

  fluctuateReport({
    reportTitle: `CPU 时间片波动性 (${record.title})`,
    coverage: 0.99,
    sampleValues: samplesTimeDeltas.map(e => nearNum(e, 100)),
  });
}

/**
 * 将分析结果写到JSON文件中
 * @param {} records 
 */
function outputTDTree(record) {
  const parseRlt = cpuTimeDeltas(record.data)
  // outputReport('sortUrls', parseRlt.sortUrls) // 输出到文件
  // outputReport('typeMap', parseRlt.typeMap)
}

function timeDeltaInfo(record) {
  const parseRlt = cpuTimeDeltas(record.data)
  const rlt = calcTableItems(parseRlt.typeMap).map(e => {
    return [
      e.name,
      e.tt,
      e.ttr,
    ]
  })
  return rlt
}

/**
 * 输出单条分析结果，表头在左侧
 * @param {} records 
 * @param {*} title 
 */
function showRecord(record) {
  const items = timeDeltaInfo(record).map(e => [e[0], e[1][1], e[2][1]])

  console.log(table(items, {
    border: getBorderCharacters('norc'),
    header: {
      alignment: 'center',
      content: `CPU 分类耗时统计 (${record.title})`,
    },
  }));
}

/**
 * 输出多条分析结果，表头在首行
 * @param {} records 
 */
function showRecords(records) {
  let headRow = null
  const items = records.map((e, i) => {
    const rlt = col2row(e.title, cpuTimeDeltas(e.data).typeMap)
    if (i === 0) headRow = rlt.names
    return rlt.values
  })

  console.log(table([headRow, ...items], {
    border: getBorderCharacters('norc'),
    // header: {
    //   alignment: 'center',
    //   content: `CPU 分类耗时统计`,
    // },
    columnDefault: {
      // width: 18,
      alignment: 'justify'
    },
  }));
}


module.exports = {
  timeDeltaInfo,
  showRecord,
  showRecords,
  timeDeltaVolatility
}