import heapq

# --- Union-Find for Kruskal ---
class UnionFind:
   def __init__(self, n):
       self.parent = list(range(n))
       self.rank   = [0] * n

   def find(self, x):
       if self.parent[x] != x:
           self.parent[x] = self.find(self.parent[x])
       return self.parent[x]

   def union(self, x, y):
       rx, ry = self.find(x), self.find(y)
       if rx == ry: return False
       if self.rank[rx] < self.rank[ry]: rx, ry = ry, rx
       self.parent[ry] = rx
       if self.rank[rx] == self.rank[ry]: self.rank[rx] += 1
       return True

def kruskal(n, edges):
   edges.sort()
   uf, mst, cost = UnionFind(n), [], 0
   for w, u, v in edges:
       if uf.union(u, v):
           mst.append((u, v, w))
           cost += w
           if len(mst) == n - 1: break
   return mst, cost

def prim(n, adj, start=0):
   INF = float('inf')
   key, parent = [INF] * n, [-1] * n
   inMST, key[start] = [False] * n, 0
   pq, mst, cost = [(0, start)], [], 0
   while pq:
       w, u = heapq.heappop(pq)
       if inMST[u]: continue
       inMST[u] = True
       if parent[u] != -1:
           mst.append((parent[u], u, w))
           cost += w
       for v, wt in adj.get(u, []):
           if not inMST[v] and wt < key[v]:
               key[v], parent[v] = wt, u
               heapq.heappush(pq, (wt, v))
   return mst, cost

n = 7
edges = [
   (7, 0, 1), (5, 0, 3), (8, 1, 2), (9, 1, 3),
   (7, 1, 4), (5, 2, 4), (15, 3, 4), (6, 3, 5),
   (8, 4, 5), (9, 4, 6), (11, 5, 6)
]
adj = {}
for w, u, v in edges:
   adj.setdefault(u, []).append((v, w))
   adj.setdefault(v, []).append((u, w))

k_mst, k_cost = kruskal(n, edges[:])
p_mst, p_cost = prim(n, adj)

print("Kruskal:", k_mst, "Cost:", k_cost)
print("Prim:", p_mst, "Cost:", p_cost)