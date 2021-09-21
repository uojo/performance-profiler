# Performance-profiler
通过分析文件数据，静态获取性能稳定性。

数据来源：
- DevTools Performance 数据文件
- DevTools Network 数据文件

分析维度：
- 数据队列中值的分散度。分析队列中数值的集中度，例如 [1,2,2,2,2] 比 [1,2,2,3,3] 的数值集中度要高。当然，在数据分析前可以进行近似值处理。例如 [1,1.2,1.5,2.3,2.4] 可以转化为 [1,1,2,2,2]
- 分析值的波动性。计算数值队列中的最大值、最小值、平均值、中位数。通常稳定性好的形态是 4 个值相近。

使用

1、确保目标网页在 Chrome 中稳定运行，导出 DevTools 中的 Performance 运行数据，以及 Network 文件。
> 稳定性分析的目标数据，并不一定是 DevTools 相关文件，只要在导入数据时，将数据队列化即可。

2、在 cpuProfiler.js 、 networkProfiler.js 等文件中引入导出文件后，执行对于文件，例如：node cpuProfiler.js、node network.js。
> 注意，network 导出的文件是 xhr 文件，在导入前需要修改文件扩展名为 .json

