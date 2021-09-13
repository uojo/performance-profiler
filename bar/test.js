const bars = require("./index");

const data = {
  ferrets: 20.4,
  cats: 12.99,
  dogs: 30.7,
  koalas: 3.99879987
};

console.log();
console.log(bars(data, { bar: "=", width: 50, sort: true }));
