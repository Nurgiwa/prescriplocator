// backend/algorithm/astar.js
// A* shortest path algorithm using priority queue + euclidean heuristic

const PriorityQueue = require("./priorityQueue");
const { euclidean } = require("./heuristic");

function astar(graph, startId, targetId) {
  const start = String(startId);
  const target = String(targetId);

  if (!graph[start] || !graph[target]) return null;

  const pq = new PriorityQueue();
  const cameFrom = {};
  const gScore = {};

  // Initialise all scores to Infinity
  Object.keys(graph).forEach((id) => {
    gScore[id] = Infinity;
  });

  gScore[start] = 0;
  pq.enqueue(start, euclidean(graph[start], graph[target]));

  while (!pq.isEmpty()) {
    const current = pq.dequeue();

    // Reached target — reconstruct path
    if (current === target) {
      const path = [];
      let node = current;
      while (node !== undefined) {
        path.unshift(node);
        node = cameFrom[node];
      }
      return { distance: gScore[target], path };
    }

    const neighbors = graph[current].neighbors || [];
    for (const neighbor of neighbors) {
      const neighborId = String(neighbor.nodeId);
      const tentativeG = gScore[current] + neighbor.distance_km;

      if (tentativeG < (gScore[neighborId] ?? Infinity)) {
        cameFrom[neighborId] = current;
        gScore[neighborId] = tentativeG;
        const f = tentativeG + euclidean(graph[neighborId], graph[target]);
        pq.enqueue(neighborId, f);
      }
    }
  }

  return null; // No path found
}

module.exports = { astar };
