const bp = require("../lib")

SatScaling = bp.lmsr.SatScaling

satCost = 100000

q1 = 12
q2 = 15
l = 10

change = (Math.sqrt(((satCost + l * Math.log((q1 / l) ** 2 + (q2 / l) ** 2)) / l) ** Math.e - (q2 / l) ** 2) - q1) * l

console.log(change)
