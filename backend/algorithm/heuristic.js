// backend/algorithm/heuristic.js
// Euclidean heuristic — estimates remaining distance between two nodes
// Used only as A* guide, not as final distance shown to users

function euclidean(nodeA, nodeB) {
  const dx = nodeA.latitude - nodeB.latitude;
  const dy = nodeA.longitude - nodeB.longitude;
  // 111 km per degree — converts degrees to approximate km
  return Math.sqrt(dx * dx + dy * dy) * 111;
}

module.exports = { euclidean };
