> Every code block has a Python and a C++ version; use the switch above a block to pick one. Your choice is remembered.

# Introduction (Graph DP)

This document teaches dynamic programming from the very first idea to the techniques used in the hardest contests. It assumes only that you can write a loop and a recursive function in C++. Nothing else is needed.

The course is built like a staircase. **Chapter 1 is deliberately gentle**: no heavy math, just the core idea explained with small examples. Chapter 2 adds the classical problems. From Chapter 3 on we move to graphs (DAGs, trees, subsets, cycles), and the mathematics becomes gradually heavier, with proofs and complexity arguments. The last chapters cover expert tools. If you are new, read in order and do not worry when later chapters look harder: every chapter only uses what came before.

All code is C++17 and uses `using ll = long long;`.

---

# Chapter 3. DP on directed acyclic graphs

In Section 1.5 we saw that every DP is secretly a DAG. In this chapter we meet the opposite situation: the DAG is given to us as a graph, and the DP runs over its vertices. This is the cleanest setting for graph DP, and everything later (trees, cycles) is a reduction to it.

## 3.1 Longest path in a DAG

Let $G=(V,E)$ be a DAG. Find the length (number of edges) of the longest directed path starting at a given vertex $s$.

For a general graph this problem is NP-hard, because a cycle would let us walk forever or force us to avoid repeating vertices. The absence of cycles is what makes it easy. Let $\text{len}(v)$ be the length of the longest path that **starts at $v$**. Any such path either is just the vertex $v$ (length $0$), or begins with an edge $v\to u$ followed by a longest path from $u$:

$$\text{len}(v)=\max\Bigl(0,\ \max_{(v,u)\in E}\bigl(1+\text{len}(u)\bigr)\Bigr).$$

Because $G$ has no cycles, the recursion never returns to a vertex it is currently computing, so memoized DFS is well defined:

```python
# Global variables (set N to the number of vertices in the DAG)
N = 0
adj = [[] for _ in range(N)]
len_ = [0] * N
seen = [False] * N

def go(v):
    """Return the length of the longest directed path starting at vertex v."""
    if seen[v]:
        return len_[v]
    seen[v] = True
    best = 0
    for u in adj[v]:
        best = max(best, 1 + go(u))
    len_[v] = best
    return best
```

```cpp
vector<int> adj[N];
int len[N]; bool seen[N];

int go(int v) {
    if (seen[v]) return len[v];
    seen[v] = true;
    int best = 0;
    for (int u : adj[v]) best = max(best, 1 + go(u));
    return len[v] = best;
}
```

Each vertex is evaluated once, and each edge is looked at once while doing so. The total time is $O(|V|+|E|)$.

The definition of the state matters. We said "starts at $v$" rather than "ends at $v$". Both work, as the graph can be traversed in either direction, but starting-at is natural for the memoized DFS because it explores forward edges. With ending-at we would loop over incoming edges and use a bottom-up order.

## 3.2 Topological order and bottom-up DP

The recursion above relies on the call stack. To process a graph with millions of vertices, or to fill the table in a loop, we use an explicit **topological order**: a listing of the vertices such that every edge goes from an earlier vertex to a later one. A DAG always has one, and Kahn's algorithm finds it in $O(|V|+|E|)$ by repeatedly removing a vertex of in-degree zero:

```python
from collections import deque

def topo_order(n, adj):
    indeg = [0] * n
    order = []
    for v in range(n):
        for u in adj[v]:
            indeg[u] += 1
    q = deque()
    for v in range(n):
        if indeg[v] == 0:
            q.append(v)
    while q:
        v = q.popleft()
        order.append(v)
        for u in adj[v]:
            indeg[u] -= 1
            if indeg[u] == 0:
                q.append(u)
    return order  # len(order) < n  <=>  the graph has a cycle
```

```cpp
vector<int> topo_order(int n, vector<vector<int>>& adj) {
    vector<int> indeg(n, 0), order;
    for (int v = 0; v < n; v++) for (int u : adj[v]) indeg[u]++;
    queue<int> q;
    for (int v = 0; v < n; v++) if (!indeg[v]) q.push(v);
    while (!q.empty()) {
        int v = q.front(); q.pop(); order.push_back(v);
        for (int u : adj[v]) if (--indeg[u] == 0) q.push(u);
    }
    return order;     // order.size() < n  <=>  the graph has a cycle
}
```

With this order, the longest-path DP is a loop that visits the vertices in **reverse** topological order (so that all successors of $v$ are already finished when we reach $v$):

```python
for i in range(n - 1, -1, -1):
    v = order[i]
    len[v] = 0
    for u in adj[v]:
        len[v] = max(len[v], 1 + len[u])
```

```cpp
for (int i = n - 1; i >= 0; i--) {
    int v = order[i];
    len[v] = 0;
    for (int u : adj[v]) len[v] = max(len[v], 1 + len[u]);
}
```

A useful by-product: if the algorithm cannot output all $n$ vertices, the graph has a cycle. This is the standard cycle test for directed graphs.

## 3.3 Counting paths and other aggregations

The structure "combine the answers of all successors" works with any combining operation. If we want the number of different paths from $v$ to a target $t$, we sum:

$$\text{ways}(v)=\begin{cases}1 & v=t,\\ \sum_{(v,u)\in E}\text{ways}(u)&\text{otherwise,}\end{cases}$$

usually modulo a prime. If we want the cheapest path with edge costs, we take a minimum of $c(v,u)+\text{best}(u)$. If we want to know whether some path of a certain kind exists, we take a logical OR. The skeleton is always the same: *state = vertex, transition = fold over outgoing edges, order = reverse topological*.

Two practical remarks. First, the DP needs states to be "complete": if the problem has additional requirements (for example "the path must pass through exactly three special vertices"), you add that information to the state, so the state becomes $(v,\text{number of special vertices passed})$. This is the first appearance of an idea that dominates later chapters: **enrich the state until the future depends only on the state**. Second, to print the path rather than just its length, store for each vertex the successor that attained the optimum and follow these pointers.

## 3.4 Shortest paths as dynamic programming

Several famous shortest-path algorithms are dynamic programs in disguise, and recognizing this helps you modify them.

**Bellman-Ford.** Let $d_k(v)$ be the length of the shortest walk from the source $s$ to $v$ that uses **at most $k$ edges**. A walk with at most $k$ edges to $v$ either has at most $k-1$ edges, or ends with some edge $(u,v)$ preceded by a walk of at most $k-1$ edges to $u$:

$$d_k(v)=\min\Bigl(d_{k-1}(v),\ \min_{(u,v)\in E}\bigl(d_{k-1}(u)+w(u,v)\bigr)\Bigr),\qquad d_0(s)=0,\ d_0(v)=\infty\ (v\ne s).$$

The state is the pair $(k,v)$, which forms a DAG (layer $k$ depends on layer $k-1$). If there is no negative cycle, a shortest path never repeats a vertex and so has at most $|V|-1$ edges; therefore $d_{|V|-1}$ holds the final answers. The time is $O(|V|\cdot|E|)$. If layer $|V|$ still improves some value, a negative cycle is reachable from $s$. The familiar implementation keeps a single array, which is valid because updating in place can only make values smaller or equal, and never smaller than the true shortest distance:

```python
def bellman_ford(n, s, edges):
    INF = float('inf')
    d = [INF] * n
    d[s] = 0
    for _ in range(1, n):
        for u, v, w in edges:
            if d[u] < INF:
                d[v] = min(d[v], d[u] + w)
    return d
```

```cpp
vector<ll> d(n, INF); d[s] = 0;
for (int k = 1; k < n; k++)
    for (auto [u, v, w] : edges)
        if (d[u] < INF) d[v] = min(d[v], d[u] + w);
```

The layered view also gives you something the single-array code does not: the answer to "shortest walk using **exactly** $k$ edges", or "at most $k$ edges" (needed, for example, when the number of flights is limited), by simply stopping at layer $k$ and keeping the layers separate.

**Floyd–Warshall.** Number the vertices $1,\dots,n$ and let $D_k(i,j)$ be the length of the shortest path from $i$ to $j$ whose **intermediate vertices all belong to $\{1,\dots,k\}$**. For $k=0$ only direct edges are allowed. A shortest path with intermediates in $\{1,\dots,k\}$ either does not use vertex $k$ at all, or passes through $k$ exactly once (assuming no negative cycles), splitting into an $i\to k$ part and a $k\to j$ part whose intermediates are in $\{1,\dots,k-1\}$:

$$D_k(i,j)=\min\bigl(D_{k-1}(i,j),\ D_{k-1}(i,k)+D_{k-1}(k,j)\bigr).$$

The state is the triple $(k,i,j)$, so $O(n^3)$ states with $O(1)$ work each. The in-place version works because row $k$ and column $k$ do not change during iteration $k$ (since $D_k(k,k)=0$ without negative cycles), so reading the "new" values is harmless:

```python
for k in range(n):
    for i in range(n):
        for j in range(n):
            d[i][j] = min(d[i][j], d[i][k] + d[k][j])
```

```cpp
for (int k = 0; k < n; k++)
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            d[i][j] = min(d[i][j], d[i][k] + d[k][j]);
```

A very common bug is to put $k$ in the innermost loop. It must be the outermost, because it is the "layer" index of the DP.

**Dijkstra.** The DP formulation is $d(v)=\min_{(u,v)\in E}(d(u)+w(u,v))$, which on a graph with cycles has circular dependencies. Dijkstra's algorithm resolves the difficulty by *discovering* a valid order on the fly. When all weights are non-negative, the unfinished vertex with the smallest tentative distance already has its final distance (no other path can sneak in with a smaller one), so we can finalize it, and then every state it feeds gets updated. The priority queue is simply the device that picks the next state in a valid order. The same observation, that Dijkstra produces an order in which DP may be run, is used in Chapter 7.

## 3.5 The shortest-path DAG

Take a graph with **positive** weights and compute the distances $d(\cdot)$ from the source. Keep only those edges $(u,v)$ with $d(u)+w(u,v)=d(v)$, the edges that can lie on some shortest path. The resulting graph is a DAG, even if the original had cycles, because along every kept edge $d$ strictly increases (since $w>0$), and a cycle would force it to come back to its starting value.

Many questions about shortest paths now become DP on this DAG: counting the shortest paths, finding the shortest path with the fewest edges among all shortest ones, determining which vertices lie on at least one shortest path, and so on. For example, the number of shortest paths $\text{cnt}(v)$ is $\sum\text{cnt}(u)$ over kept edges $(u,v)$ with $\text{cnt}(s)=1$, evaluated in increasing order of $d$.

## 3.6 Exercises for this chapter

AtCoder Educational DP Contest problem G (Longest Path); CSES *Longest Flight Route* and *Game Routes*; CSES *Shortest Routes I* and *II*; CSES *High Score* (longest path, with the twist of detecting positive cycles reachable on a route to the target).

---

# Chapter 7. Graphs with cycles

Everything so far required the state graph to be acyclic. Real graphs often contain cycles, and then the recurrences become circular: the value at $A$ depends on $B$, which depends on $A$. There are four standard ways out, and a strong graph-DP solver knows them all.

## 7.1 Strategy one: collapse every cycle (strongly connected components)

A **strongly connected component (SCC)** is a maximal set of vertices in which every vertex can reach every other. Two vertices lie in the same SCC exactly when they lie on a common directed cycle. If we **contract** every SCC into a single super-vertex, the resulting graph (the **condensation**) has no cycles. Indeed, a cycle among super-vertices would have merged them into one component. So the condensation is a DAG, and everything from Chapter 3 applies to it.

This is the right tool whenever the question is insensitive to what happens inside a cycle. A classical example: each room has some coins, you walk along one-way corridors, and you may revisit rooms (but collect the coins in a room only once). Inside an SCC you can reach every room, so you can collect all coins there. The value of a component is therefore the sum of its coins, and the problem becomes "find the most valuable path in the DAG of components".

**Finding SCCs with Kosaraju's algorithm.** Run a DFS on the graph and record the vertices in the order in which their DFS calls **finish**. Then process the vertices in **decreasing** finishing time, running DFS on the *reversed* graph; each tree found by these searches is one SCC.

Why does this work? Consider two components $A$ and $B$ with an edge from $A$ to $B$ in the original graph. The last vertex to finish in $A\cup B$ always belongs to $A$: if the first DFS enters $A$ first, it will still be running in $A$ when it discovers and fully explores $B$, so $A$'s first vertex finishes later than everything in $B$; if it enters $B$ first, it finishes all of $B$ without ever reaching $A$ (there is no edge back), and $A$ finishes later. So decreasing finish order lists components in a topological order of the condensation: the first vertex is in a source component. In the reversed graph, the edges leaving that component now point *into* it, so a DFS from its vertex cannot escape to any other unvisited component, and it collects exactly one SCC. Repeating this peels the components off one at a time.

```python
g = []
rg = []
order_ = []
comp = []
vis = []

def dfs1(v):
    vis[v] = True
    for u in g[v]:
        if not vis[u]:
            dfs1(u)
    order_.append(v)

def dfs2(v, c):
    comp[v] = c
    for u in rg[v]:
        if comp[u] == -1:
            dfs2(u, c)

def scc(n):                       # vertices 0..n-1, returns number of components
    global comp, vis, order_
    for v in range(n):
        if not vis[v]:
            dfs1(v)
    comp = [-1] * n
    c = 0
    for i in range(n - 1, -1, -1):
        if comp[order_[i]] == -1:
            dfs2(order_[i], c)
            c += 1
    return c                          # component ids are in topological order of the condensation

if __name__ == "__main__":
    # Example usage:
    # n = 5
    # g = [[1], [2], [0, 3], [4], []]
    # rg = [[2], [0], [1], [2], [3]]
    # vis = [False] * n
    # order_ = []
    # comp = [-1] * n
    # print(scc(n))
    pass
```

```cpp
vector<int> g[N], rg[N], order_;
int comp[N]; bool vis[N];

void dfs1(int v) { vis[v] = true; for (int u : g[v]) if (!vis[u]) dfs1(u); order_.push_back(v); }
void dfs2(int v, int c) { comp[v] = c; for (int u : rg[v]) if (comp[u] == -1) dfs2(u, c); }

int scc(int n) {                       // vertices 0..n-1, returns number of components
    for (int v = 0; v < n; v++) if (!vis[v]) dfs1(v);
    fill(comp, comp + n, -1);
    int c = 0;
    for (int i = n - 1; i >= 0; i--) if (comp[order_[i]] == -1) dfs2(order_[i], c++);
    return c;                          // component ids are in topological order of the condensation
}
```

Since the component ids come out in topological order, every edge of the condensation goes from a smaller id to a larger one, and the DP can be written as a plain loop over the ids from largest to smallest:

```python
# weight[c] = total coins in component c; cadj[c] = list of components reachable by one edge
for c in range(C - 1, -1, -1):
    best[c] = 0
    for d in cadj[c]:
        best[c] = max(best[c], best[d])
    best[c] += weight[c]
```

```cpp
// weight[c] = total coins in component c; cadj[c] = list of components reachable by one edge
for (int c = C - 1; c >= 0; c--) {
    best[c] = 0;
    for (int d : cadj[c]) best[c] = max(best[c], best[d]);
    best[c] += weight[c];
}
```

The same method handles reachability questions ("can $a$ reach $b$"), counting how many vertices each vertex can reach (with bitsets on the condensation), and 2-SAT. Whenever someone says "directed graph with cycles" and a quantity that does not care about repetition, think of the condensation first.

## 7.2 Strategy two: let Dijkstra supply the order

Another source of cycles is shortest-path problems on cyclic graphs. Suppose we want not only the shortest distance but also the **number of shortest paths**. Let $cnt(v)$ be that number. A shortest path to $v$ must end with an edge $(u,v)$ where $d(u)+w(u,v)=d(v)$, and the part before it must be a shortest path to $u$. Hence

$$cnt(v)=\sum_{(u,v):\ d(u)+w(u,v)=d(v)}cnt(u),\qquad cnt(s)=1.$$

When all weights are strictly positive, the vertices in increasing order of $d$ form a valid evaluation order, because a contributing predecessor $u$ has $d(u)<d(v)$. Dijkstra visits vertices in exactly this order, so we simply update $cnt$ as we relax edges:

```python
# inside Dijkstra, when popping v and examining edge (v, u, w)
if d[v] + w < d[u]:
    d[u] = d[v] + w
    cnt[u] = cnt[v]
    heapq.heappush(pq, (d[u], u))
elif d[v] + w == d[u]:
    cnt[u] = (cnt[u] + cnt[v]) % MOD
```

```cpp
// inside Dijkstra, when popping v and examining edge (v, u, w)
if (d[v] + w < d[u])       { d[u] = d[v] + w; cnt[u] = cnt[v]; pq.push({d[u], u}); }
else if (d[v] + w == d[u]) { cnt[u] = (cnt[u] + cnt[v]) % MOD; }
```

The same technique tracks the minimum and maximum number of edges among shortest paths, which are other DP values on the shortest-path DAG of Section 3.5. The requirement of positive weights is essential: with zero-weight edges, two vertices at equal distance can depend on each other, the DAG argument breaks, and one must first contract the zero-weight cycles or order the vertices by a secondary key.

## 7.3 Strategy three: unroll the cycle into the state

The third and most flexible idea is to make the state richer so that the combined state graph is acyclic or Dijkstra-friendly. A cycle in the graph only matters if the state does not change when we traverse it; if the state records, say, "number of steps taken" or "which special ability has been used", the state graph is different from the original graph.

As an example, you travel from city $1$ to city $n$ along weighted roads, and you may use a coupon that halves the cost of **one** road. Find the cheapest trip. Let the state be $(v,b)$ where $b\in\{0,1\}$ tells whether the coupon has been used. From $(v,0)$ along edge $(v,u,w)$ we can go to $(u,0)$ with cost $w$, or to $(u,1)$ with cost $\lfloor w/2\rfloor$ (using the coupon here). From $(v,1)$ we can only go to $(u,1)$ with cost $w$. The graph has $2|V|$ vertices and non-negative weights, so we run Dijkstra on it and read off the distance to $(n,1)$:

```python
import heapq

# dist[v][b]; priority queue of (distance, v, b), smallest first
dist = [[float('inf')] * 2 for _ in range(n + 1)]
dist[1][0] = 0
pq = [(0, 1, 0)]
while pq:
    d, v, b = heapq.heappop(pq)
    if d > dist[v][b]:
        continue
    for u, w in g[v]:
        if d + w < dist[u][b]:
            dist[u][b] = d + w
            heapq.heappush(pq, (dist[u][b], u, b))
        if not b and d + w // 2 < dist[u][1]:
            dist[u][1] = d + w // 2
            heapq.heappush(pq, (dist[u][1], u, 1))
```

```cpp
// dist[v][b]; priority queue of (distance, v, b), smallest first
dist[1][0] = 0; pq.push({0, 1, 0});
while (!pq.empty()) {
    auto [d, v, b] = pq.top(); pq.pop();
    if (d > dist[v][b]) continue;
    for (auto [u, w] : g[v]) {
        if (d + w < dist[u][b]) { dist[u][b] = d + w; pq.push({dist[u][b], u, b}); }
        if (!b && d + w / 2 < dist[u][1]) { dist[u][1] = d + w / 2; pq.push({dist[u][1], u, 1}); }
    }
}
```

This pattern, called a **layered graph** or product graph, is enormously general. A state like (vertex, remaining fuel), (vertex, number of tickets), (vertex, parity of steps), (vertex, last color used), or (vertex, set of keys held) turns a problem on a graph with side constraints into an ordinary shortest-path or DP problem on a bigger graph. The price is the size of the state space, so the art is to choose the *smallest* extra information that makes the future independent of the past.

## 7.4 Strategy four: matrix exponentiation for counting walks

Let $A$ be the adjacency matrix of a graph with $n$ vertices, where $A_{ij}$ is the number of edges from $i$ to $j$. The number of walks of length exactly $2$ from $i$ to $j$ is $\sum_kA_{ik}A_{kj}=(A^2)_{ij}$, and by induction the number of walks of length $k$ is $(A^k)_{ij}$.

If $k$ is enormous (up to $10^{18}$) but $n$ is small, we compute $A^k$ by repeated squaring in $O(n^3\log k)$ time:

```python
MOD = 10**9+7  # modulo value, adjust as needed

def mul(A, B):
    n = len(A)
    C = [[0] * n for _ in range(n)]
    for i in range(n):
        for k in range(n):
            if A[i][k]:
                for j in range(n):
                    C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % MOD
    return C

def mpow(A, k):
    n = len(A)
    R = [[0] * n for _ in range(n)]
    for i in range(n):
        R[i][i] = 1
    while k:
        if k & 1:
            R = mul(R, A)
        A = mul(A, A)
        k >>= 1
    return R
```

```cpp
using Mat = vector<vector<ll>>;
Mat mul(const Mat& A, const Mat& B) {
    int n = A.size();
    Mat C(n, vector<ll>(n, 0));
    for (int i = 0; i < n; i++)
        for (int k = 0; k < n; k++) if (A[i][k])
            for (int j = 0; j < n; j++)
                C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % MOD;
    return C;
}
Mat mpow(Mat A, ll k) {
    int n = A.size();
    Mat R(n, vector<ll>(n, 0));
    for (int i = 0; i < n; i++) R[i][i] = 1;
    while (k) { if (k & 1) R = mul(R, A); A = mul(A, A); k >>= 1; }
    return R;
}
```

The same machinery works in other **semirings**. Replacing $(+,\times)$ by $(\min,+)$ makes $A^k$ the matrix of shortest walks with exactly $k$ edges; replacing it by $(\text{OR},\text{AND})$ answers reachability in exactly $k$ steps. And any linear recurrence, for example $F(n)=F(n-1)+F(n-2)$, is a walk-counting problem in disguise: the transition matrix $\begin{pmatrix}1&1\\1&0\end{pmatrix}$ raised to the power $n$ gives $F(n)$ in $O(\log n)$ time. Whenever a DP has a transition that is the same linear map at every step and the number of steps is huge, think of matrix powers.

## 7.5 Functional graphs

A **functional graph** is a directed graph in which every vertex has exactly one outgoing edge, that is, it is the graph of a function $f:[n]\to[n]$. Each connected component consists of exactly one cycle with trees hanging into it. Typical questions: where do we end up after $k$ applications of $f$, how long before we enter a cycle, how long is the cycle.

For "where after $k$ steps" we use **binary lifting**: let $up[j][v]$ be the vertex reached from $v$ after $2^j$ steps. Then $up[0]=f$ and $up[j][v]=up[j-1][up[j-1][v]]$, and to take $k$ steps we combine the powers of two present in the binary representation of $k$, in $O(\log k)$ time per query after $O(n\log k)$ preprocessing. The memory can be reduced using the cycle structure but this is usually unnecessary. Many "tree with cycle" problems are handled by running ordinary tree DP on the trees hanging into the cycle and then dealing with the cycle separately with prefix sums.

## 7.6 Exercises for this chapter

CSES *Coin Collector*, *Planets and Kingdoms*, *Giant Pizza* (SCC and 2-SAT); CSES *Investigation* (counting shortest paths); CSES *Flight Discount*; CSES *Planets Cycles* and *Planet Queries I* (functional graphs); CSES *Graph Paths I* (matrix power).

---
