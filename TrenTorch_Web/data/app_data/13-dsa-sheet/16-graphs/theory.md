> Every code block has a Python and a C++ version; use the switch above a block to pick one. Your choice is remembered.

# Introduction (Graphs)

Graphs are everywhere: maps, friendships, web pages, game boards, task lists. This course teaches how to think about them and how to answer the questions interviewers love to ask. It assumes only that you can write loops and a simple function.

The course is a staircase. **Chapter 1 is gentle**: what a graph is and how to store one. Chapters 2 and 3 teach the two basic ways of walking through a graph. After that each chapter adds one new tool: finding cycles, putting tasks in order, shortest paths, union-find, spanning trees, and finally bridges and strongly connected components. The last two chapters are optional extras that combine graphs with dynamic programming. If a later chapter looks hard, do not worry; every chapter only uses what came before.

Every code example is shown in Python and in C++, so pick whichever language you like.

# Chapter 1. Graphs from scratch

## 1.1 What a graph is

A **graph** is a collection of dots and lines. The dots are called **vertices** (or nodes) and the lines are called **edges**.  
Think of a map: cities are vertices, roads are edges. Or a social network: people are vertices, friendships are edges.  
The web is a graph too: pages are vertices, hyperlinks are edges.

An edge can be **directed** (one-way) or **undirected** (two-way). A one-way street is a directed edge; a friendship is usually undirected.  
An edge can also carry a **weight** (a number), like the distance between two cities or the time to send a message.

A **path** is a sequence of vertices where each consecutive pair is connected by an edge.  
A **cycle** is a path that starts and ends at the same vertex without repeating other vertices.  
A graph is **connected** if there is a path between every pair of vertices (for undirected graphs).

In this course vertices are numbered `0, 1, …, n-1`. An edge list is a list of pairs `(u, v)`.

```python
# Example: a tiny undirected graph with 4 vertices and 3 edges
n = 4
edges = [(0, 1), (1, 2), (2, 3)]  # 0-1-2-3

# Build adjacency list
adj = [[] for _ in range(n)]
for u, v in edges:
    adj[u].append(v)
    adj[v].append(u)

assert adj == [[1], [0, 2], [1, 3], [2]]
```

```cpp
// C++ version: same tiny graph
int n = 4;
vector<vector<int>> adj(n);
vector<pair<int,int>> edges = {{0,1},{1,2},{2,3}};
for (auto [u,v] : edges) {
    adj[u].push_back(v);
    adj[v].push_back(u);
}
// adj = [[1], [0,2], [1,3], [2]]
```

## 1.2 Storing a graph

Two common ways to store a graph in memory are the **adjacency list** and the **adjacency matrix**.

**Adjacency list**: for each vertex we keep a list of its neighbours.  
**Adjacency matrix**: an `n × n` grid where `mat[u][v] = 1` if there is an edge `u-v`, else `0`.

For our tiny graph (4 vertices, edges 0-1, 1-2, 2-3):

Adjacency list:  
`0: [1]`  
`1: [0, 2]`  
`2: [1, 3]`  
`3: [2]`

Adjacency matrix:

```
  0 1 2 3
0 0 1 0 0
1 1 0 1 0
2 0 1 0 1
3 0 0 1 0
```

When to choose which?

- If the graph is **sparse** (few edges, `m` much smaller than `n²`), adjacency list uses less memory (`O(n+m)`) and iterating neighbours is fast.
- If the graph is **dense** (many edges, `m` close to `n²`), adjacency matrix (`O(n²)`) lets you check if an edge exists in `O(1)` time.

```python
# Build both representations from an edge list
def build_graph(n, edges):
    # adjacency list
    adj = [[] for _ in range(n)]
    # adjacency matrix
    mat = [[0]*n for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
        mat[u][v] = 1
        mat[v][u] = 1
    return adj, mat

n = 4
edges = [(0,1), (1,2), (2,3)]
adj, mat = build_graph(n, edges)
assert adj == [[1], [0,2], [1,3], [2]]
assert mat == [
    [0,1,0,0],
    [1,0,1,0],
    [0,1,0,1],
    [0,0,1,0]
]
```

```cpp
// Build both representations
pair<vector<vector<int>>, vector<vector<int>>> build_graph(int n, vector<pair<int,int>> edges) {
    vector<vector<int>> adj(n);
    vector<vector<int>> mat(n, vector<int>(n, 0));
    for (auto [u,v] : edges) {
        adj[u].push_back(v);
        adj[v].push_back(u);
        mat[u][v] = 1;
        mat[v][u] = 1;
    }
    return {adj, mat};
}
```

## 1.3 A grid is a graph

A rectangular grid (like a chessboard or a maze) is a graph where each cell is a vertex.  
Edges connect a cell to its four neighbours: up, down, left, right (if inside the grid).

We can use a **direction array** to loop over the four moves without writing four separate `if` statements:

```python
# Directions: up, right, down, left
dr = [-1, 0, 1, 0]
dc = [0, 1, 0, -1]

def grid_to_adj(R, C):
    """Return adjacency list for an R x C grid. Vertex id = r*C + c."""
    n = R * C
    adj = [[] for _ in range(n)]
    for r in range(R):
        for c in range(C):
            u = r * C + c
            for k in range(4):
                nr = r + dr[k]
                nc = c + dc[k]
                if 0 <= nr < R and 0 <= nc < C:
                    v = nr * C + nc
                    adj[u].append(v)
    return adj

# 2x3 grid: vertices 0..5
adj = grid_to_adj(2, 3)
# Check a few: vertex 0 (0,0) -> neighbours 1 (0,1) and 3 (1,0)
assert adj[0] == [1, 3]
assert adj[4] == [1, 5, 3]  # vertex 4 is (1,1)
```

```cpp
// Grid to adjacency list
vector<vector<int>> grid_to_adj(int R, int C) {
    int n = R * C;
    vector<vector<int>> adj(n);
    int dr[4] = {-1, 0, 1, 0};
    int dc[4] = {0, 1, 0, -1};
    for (int r = 0; r < R; ++r) {
        for (int c = 0; c < C; ++c) {
            int u = r * C + c;
            for (int k = 0; k < 4; ++k) {
                int nr = r + dr[k];
                int nc = c + dc[k];
                if (0 <= nr && nr < R && 0 <= nc && nc < C) {
                    int v = nr * C + nc;
                    adj[u].push_back(v);
                }
            }
        }
    }
    return adj;
}
```

## 1.4 Connected components

A **connected component** is a maximal set of vertices where every vertex can reach every other vertex via edges.  
In an undirected graph, the components partition the vertices.

To find all components we can run a graph traversal (Depth-First Search or Breadth-First Search) from each unvisited vertex.  
Each traversal marks one whole component. The total work is `O(n + m)` because each vertex and edge is processed once.

This is exactly the problem **Connected Components**.  
A related problem **Valid Path** asks whether two given vertices lie in the same component.

We'll show two implementations of DFS: recursive (simple) and iterative (avoids recursion depth limits).

```python
from collections import deque

def connected_components_recursive(adj):
    """Return list of components, each a list of vertices. Recursive DFS."""
    n = len(adj)
    used = [False] * n
    comps = []

    def dfs(v, comp):
        used[v] = True
        comp.append(v)
        for u in adj[v]:
            if not used[u]:
                dfs(u, comp)

    for v in range(n):
        if not used[v]:
            comp = []
            dfs(v, comp)
            comps.append(comp)
    return comps

def connected_components_iterative(adj):
    """Return list of components using an explicit stack."""
    n = len(adj)
    used = [False] * n
    comps = []
    for v in range(n):
        if not used[v]:
            comp = []
            stack = [v]
            while stack:
                cur = stack.pop()
                if not used[cur]:
                    used[cur] = True
                    comp.append(cur)
                    # push neighbours; order doesn't matter for components
                    for u in adj[cur]:
                        if not used[u]:
                            stack.append(u)
            comps.append(comp)
    return comps

# Test on graph with two components: 0-1-2 and 3-4
adj = [[1], [0,2], [1], [4], [3]]
assert sorted(connected_components_recursive(adj)) == sorted([[0,1,2], [3,4]])
assert sorted(connected_components_iterative(adj)) == sorted([[0,1,2], [3,4]])
```

```cpp
// Recursive DFS for connected components
vector<vector<int>> connected_components_recursive(const vector<vector<int>>& adj) {
    int n = adj.size();
    vector<bool> used(n, false);
    vector<vector<int>> comps;
    vector<int> comp;
    function<void(int)> dfs = [&](int v) {
        used[v] = true;
        comp.push_back(v);
        for (int u : adj[v]) {
            if (!used[u]) dfs(u);
        }
    };
    for (int v = 0; v < n; ++v) {
        if (!used[v]) {
            comp.clear();
            dfs(v);
            comps.push_back(comp);
        }
    }
    return comps;
}

// Iterative DFS for connected components
vector<vector<int>> connected_components_iterative(const vector<vector<int>>& adj) {
    int n = adj.size();
    vector<bool> used(n, false);
    vector<vector<int>> comps;
    for (int v = 0; v < n; ++v) {
        if (!used[v]) {
            vector<int> comp;
            stack<int> st;
            st.push(v);
            while (!st.empty()) {
                int cur = st.top(); st.pop();
                if (!used[cur]) {
                    used[cur] = true;
                    comp.push_back(cur);
                    for (int u : adj[cur]) {
                        if (!used[u]) st.push(u);
                    }
                }
            }
            comps.push_back(comp);
        }
    }
    return comps;
}
```

Both versions run in `O(n + m)` time and `O(n)` extra space (for the `used` array and the recursion stack or explicit stack).

## 1.5 Check yourself

1. In an undirected graph with vertices 0..4 and edges (0,1), (1,2), (3,4), how many connected components are there?
2. If you run the iterative DFS on a component of 5 vertices arranged in a line, what is the maximum size the explicit stack will reach?
3. Why does an adjacency matrix use `O(n²)` memory even for a sparse graph?
4. Given a 3x3 grid, what is the vertex id of the cell at row 1, column 2 (0-indexed)?

# Chapter 2. Breadth-first search

## 2.1 Exploring in rings

Imagine dropping a pebble into a pond. A ripple spreads out in rings: first everything one step away, then everything two steps away, then three, and so on. **Breadth-first search**, or **BFS**, explores a graph in exactly this way. It starts at one vertex, called the **source**, visits all of its neighbours, then all of their neighbours, and keeps going outward ring by ring.

This ring-by-ring order has a very useful side effect. The first time BFS reaches a vertex, it has used the fewest possible edges to get there. That is why BFS is the standard tool for finding shortest paths when every edge counts the same.

## 2.2 The queue and the visited array

To explore ring by ring we need to remember which vertices are waiting for their turn. We use a **queue**, a line where the first vertex to join is the first one to be served. We also keep a **visited** array, so that we never put the same vertex into the line twice.

The recipe is short. Put the source in the queue and mark it visited. Then repeat: take the vertex at the front of the queue, look at each of its neighbours, and for every neighbour that is not visited yet, mark it visited and add it to the back of the queue. Stop when the queue is empty.

Let us trace it on a small graph with five vertices and the edges 0-1, 0-2, 1-3, 2-4 and 3-4:

```
0 --- 1
|     |
2     3
|     |
4 ----+
```

We start at vertex 0, so the queue is `[0]`. We take 0 and find the neighbours 1 and 2, which are new, so the queue becomes `[1, 2]`. We take 1 and find 3, so the queue is `[2, 3]`. We take 2 and find 4, so the queue is `[3, 4]`. Taking 3 and then 4 discovers nothing new, because all their neighbours are already visited. The queue is empty and every vertex has been reached.

We usually store, for every vertex, the **distance** from the source, which is the number of edges on the way. A distance of `-1` can mean "not reached yet", which also replaces the visited array.

```python
from collections import deque

def bfs(n, adj, source):
    dist = [-1] * n
    dist[source] = 0
    queue = deque([source])
    while queue:
        v = queue.popleft()
        for u in adj[v]:
            if dist[u] == -1:
                dist[u] = dist[v] + 1
                queue.append(u)
    return dist

adj = [[1, 2], [0, 3], [0, 4], [1, 4], [2, 3]]
assert bfs(5, adj, 0) == [0, 1, 1, 2, 2]
```

```cpp
vector<int> bfs(int n, const vector<vector<int>>& adj, int source) {
    vector<int> dist(n, -1);
    dist[source] = 0;
    queue<int> q;
    q.push(source);
    while (!q.empty()) {
        int v = q.front();
        q.pop();
        for (int u : adj[v]) {
            if (dist[u] == -1) {
                dist[u] = dist[v] + 1;
                q.push(u);
            }
        }
    }
    return dist;
}
```

Every vertex enters the queue at most once and every edge is looked at a constant number of times, so BFS runs in $O(n+m)$ time for $n$ vertices and $m$ edges, and uses $O(n)$ extra space.

## 2.3 Why BFS finds shortest paths

Vertices leave the queue in order of their distance: first the source (distance 0), then everything at distance 1, then everything at distance 2, and so on. A vertex at distance $d+1$ can only be discovered by a vertex at distance $d$, and all vertices at distance $d$ are served before any vertex at distance $d+1$. So when a vertex is discovered, it is discovered through a shortest route, and its recorded distance never needs to be corrected.

If you need the path itself and not only its length, remember for every vertex who discovered it, in an array called `parent`. Then walk from the target back to the source and reverse what you collected.

```python
from collections import deque

def shortest_path(n, adj, source, target):
    parent = [-1] * n
    seen = [False] * n
    seen[source] = True
    queue = deque([source])
    while queue:
        v = queue.popleft()
        for u in adj[v]:
            if not seen[u]:
                seen[u] = True
                parent[u] = v
                queue.append(u)
    if not seen[target]:
        return []
    path = [target]
    while path[-1] != source:
        path.append(parent[path[-1]])
    return path[::-1]

adj = [[1, 2], [0, 3], [0, 4], [1, 4], [2, 3]]
assert shortest_path(5, adj, 0, 4) == [0, 2, 4]
assert shortest_path(5, adj, 0, 0) == [0]
```

```cpp
vector<int> shortest_path(int n, const vector<vector<int>>& adj, int source, int target) {
    vector<int> parent(n, -1);
    vector<bool> seen(n, false);
    queue<int> q;
    seen[source] = true;
    q.push(source);
    while (!q.empty()) {
        int v = q.front();
        q.pop();
        for (int u : adj[v]) {
            if (!seen[u]) {
                seen[u] = true;
                parent[u] = v;
                q.push(u);
            }
        }
    }
    if (!seen[target]) return {};
    vector<int> path = {target};
    while (path.back() != source) path.push_back(parent[path.back()]);
    reverse(path.begin(), path.end());
    return path;
}
```

## 2.4 BFS on a grid: shortest path in a binary matrix

A grid is a graph whose vertices are cells, as we saw in Chapter 1. This is exactly the problem _Shortest Path in Binary Matrix_. We are given a grid of `0` (open) and `1` (blocked) cells and want the shortest route from the top-left cell to the bottom-right cell. In this problem we may also move diagonally, so every cell has up to 8 neighbours. The answer counts the cells on the path, both ends included.

We run BFS from the top-left cell. Instead of a separate visited array we store the distance in a table `dist`, which starts as `-1` everywhere.

```python
from collections import deque

def shortest_path_binary_matrix(grid):
    n = len(grid)
    if n == 0 or grid[0][0] == 1 or grid[n - 1][n - 1] == 1:
        return -1
    dist = [[-1] * n for _ in range(n)]
    dist[0][0] = 1
    queue = deque([(0, 0)])
    while queue:
        r, c = queue.popleft()
        if (r, c) == (n - 1, n - 1):
            return dist[r][c]
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] == 0 and dist[nr][nc] == -1:
                    dist[nr][nc] = dist[r][c] + 1
                    queue.append((nr, nc))
    return -1

assert shortest_path_binary_matrix([[0, 0, 0], [1, 1, 0], [1, 1, 0]]) == 4
assert shortest_path_binary_matrix([[0, 1], [1, 0]]) == 2
assert shortest_path_binary_matrix([[1, 0], [0, 0]]) == -1
```

```cpp
int shortest_path_binary_matrix(vector<vector<int>>& grid) {
    int n = grid.size();
    if (n == 0 || grid[0][0] == 1 || grid[n - 1][n - 1] == 1) return -1;
    vector<vector<int>> dist(n, vector<int>(n, -1));
    dist[0][0] = 1;
    queue<pair<int, int>> q;
    q.push({0, 0});
    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        if (r == n - 1 && c == n - 1) return dist[r][c];
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                int nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] == 0 && dist[nr][nc] == -1) {
                    dist[nr][nc] = dist[r][c] + 1;
                    q.push({nr, nc});
                }
            }
        }
    }
    return -1;
}
```

In the first example the path is $(0,0) \to (0,1) \to (1,2) \to (2,2)$, which has 4 cells. The loop also tries the move $(0,0)$ to itself, but that cell already has a distance, so it is skipped. The cost is $O(n^2)$ for an $n \times n$ grid, because each cell is handled once.

## 2.5 Many starting points at once

Sometimes there is not one source but many. This is exactly the problem _Distance to Nearest Zero_: for every cell of a grid with `0`s and `1`s, find how far the nearest `0` is.

Running one BFS from every cell would be slow. The trick is to flip the question and start from all the zeros together. Put every `0` cell into the queue at the beginning with distance 0. The BFS then spreads out from all of them at the same time, and the first ripple to reach a cell is the one from its nearest zero. This is called **multi-source BFS**, and it costs only $O(nm)$ for an $n \times m$ grid.

```python
from collections import deque

def nearest_zero(mat):
    rows = len(mat)
    if rows == 0:
        return []
    cols = len(mat[0])
    dist = [[-1] * cols for _ in range(rows)]
    queue = deque()
    for r in range(rows):
        for c in range(cols):
            if mat[r][c] == 0:
                dist[r][c] = 0
                queue.append((r, c))
    while queue:
        r, c = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and dist[nr][nc] == -1:
                dist[nr][nc] = dist[r][c] + 1
                queue.append((nr, nc))
    return dist

assert nearest_zero([[0, 0, 0], [0, 1, 0], [1, 1, 1]]) == [[0, 0, 0], [0, 1, 0], [1, 2, 1]]
```

```cpp
vector<vector<int>> nearest_zero(vector<vector<int>>& mat) {
    int rows = mat.size();
    if (rows == 0) return {};
    int cols = mat[0].size();
    vector<vector<int>> dist(rows, vector<int>(cols, -1));
    queue<pair<int, int>> q;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++)
            if (mat[r][c] == 0) {
                dist[r][c] = 0;
                q.push({r, c});
            }
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int k = 0; k < 4; k++) {
            int nr = r + dr[k], nc = c + dc[k];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && dist[nr][nc] == -1) {
                dist[nr][nc] = dist[r][c] + 1;
                q.push({nr, nc});
            }
        }
    }
    return dist;
}
```

## 2.6 Spreading over time: rotting oranges

Multi-source BFS also describes things that spread as time passes. In _Rotting Oranges_ a grid holds empty cells (`0`), fresh oranges (`1`) and rotten oranges (`2`). Each minute, every fresh orange next to a rotten one becomes rotten. We want the number of minutes until no fresh orange is left, or `-1` if some orange can never rot.

Every rotten orange starts in the queue. One ring of the BFS is one minute, so we process the queue one whole ring at a time and count the rings. We also count the fresh oranges, so that at the end we can tell whether any are left over.

```python
from collections import deque

def oranges_rotting(grid):
    rows, cols = len(grid), len(grid[0]) if grid else 0
    queue = deque()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1
    minutes = 0
    while queue and fresh > 0:
        for _ in range(len(queue)):
            r, c = queue.popleft()
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    queue.append((nr, nc))
        minutes += 1
    return minutes if fresh == 0 else -1

assert oranges_rotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]) == 4
assert oranges_rotting([[2, 1, 1], [0, 1, 1], [1, 0, 1]]) == -1
assert oranges_rotting([[0, 2]]) == 0
```

```cpp
int oranges_rotting(vector<vector<int>>& grid) {
    int rows = grid.size(), cols = rows ? grid[0].size() : 0;
    queue<pair<int, int>> q;
    int fresh = 0;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == 2) q.push({r, c});
            else if (grid[r][c] == 1) fresh++;
        }
    int minutes = 0;
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    while (!q.empty() && fresh > 0) {
        int size = q.size();
        while (size--) {
            auto [r, c] = q.front();
            q.pop();
            for (int k = 0; k < 4; k++) {
                int nr = r + dr[k], nc = c + dc[k];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                    grid[nr][nc] = 2;
                    fresh--;
                    q.push({nr, nc});
                }
            }
        }
        minutes++;
    }
    return fresh == 0 ? minutes : -1;
}
```

## 2.7 Graphs made from a rule: word ladder

Not every graph is handed to us as a list of edges. In _Word Ladder_ the vertices are words, and two words are neighbours if they differ in exactly one letter. We start from a word `begin` and want the shortest chain of words to `end`, where every word after the first must come from a given list. The answer is the number of words in the chain.

We never build the whole graph. When BFS is standing on a word, we simply try changing each letter to each of the 26 letters, and keep the new word if it is in the list and unseen. A set makes the lookup fast. For words of length $L$ and a list of $W$ words, this costs about $O(W \cdot L \cdot 26 \cdot L)$ in the worst case, because building each candidate word takes $O(L)$.

```python
from collections import deque

def ladder_length(begin, end, words):
    word_set = set(words)
    if end not in word_set:
        return 0
    dist = {begin: 1}
    queue = deque([begin])
    while queue:
        word = queue.popleft()
        if word == end:
            return dist[word]
        for i in range(len(word)):
            for ch in "abcdefghijklmnopqrstuvwxyz":
                nxt = word[:i] + ch + word[i + 1:]
                if nxt in word_set and nxt not in dist:
                    dist[nxt] = dist[word] + 1
                    queue.append(nxt)
    return 0

assert ladder_length("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]) == 5
assert ladder_length("hit", "cog", ["hot", "dot", "dog", "lot", "log"]) == 0
```

```cpp
int ladder_length(string begin, string end, vector<string>& words) {
    unordered_set<string> word_set(words.begin(), words.end());
    if (!word_set.count(end)) return 0;
    unordered_map<string, int> dist;
    dist[begin] = 1;
    queue<string> q;
    q.push(begin);
    while (!q.empty()) {
        string word = q.front();
        q.pop();
        if (word == end) return dist[word];
        for (int i = 0; i < (int)word.size(); i++) {
            string next = word;
            for (char ch = 'a'; ch <= 'z'; ch++) {
                next[i] = ch;
                if (word_set.count(next) && !dist.count(next)) {
                    dist[next] = dist[word] + 1;
                    q.push(next);
                }
            }
        }
    }
    return 0;
}
```

## 2.8 0-1 BFS

What if some edges cost 0 and the others cost 1? A plain queue is no longer enough, because a free edge should not count as a step. The fix is a **deque**, a queue that lets us add at both ends. When we cross an edge of cost 0, the new vertex is as close as the current one, so it goes to the **front** and is served next. When we cross an edge of cost 1, it goes to the **back**, as in normal BFS. This keeps the vertices in order of distance, and we may update a vertex's distance more than once, as long as the new distance is smaller. The running time is still $O(n+m)$.

```python
from collections import deque

def zero_one_bfs(n, adj, source):
    INF = float("inf")
    dist = [INF] * n
    dist[source] = 0
    dq = deque([source])
    while dq:
        v = dq.popleft()
        for u, w in adj[v]:
            if dist[v] + w < dist[u]:
                dist[u] = dist[v] + w
                if w == 0:
                    dq.appendleft(u)
                else:
                    dq.append(u)
    return dist

adj = [[(1, 0), (2, 1)], [(3, 1)], [(4, 0)], [(4, 1)], []]
assert zero_one_bfs(5, adj, 0) == [0, 0, 1, 1, 1]
```

```cpp
vector<int> zero_one_bfs(int n, const vector<vector<pair<int, int>>>& adj, int source) {
    vector<int> dist(n, INT_MAX);
    dist[source] = 0;
    deque<int> dq;
    dq.push_back(source);
    while (!dq.empty()) {
        int v = dq.front();
        dq.pop_front();
        for (auto [u, w] : adj[v]) {
            if (dist[v] + w < dist[u]) {
                dist[u] = dist[v] + w;
                if (w == 0) dq.push_front(u);
                else dq.push_back(u);
            }
        }
    }
    return dist;
}
```

## 2.9 Check yourself

1. Why does BFS use a queue and not a stack?
2. In the multi-source BFS of Section 2.5, why is the first distance written into a cell always the right one?
3. In rotting oranges, why do we process the queue one whole ring at a time?
4. In 0-1 BFS, why does a cost-0 edge send the vertex to the front of the deque?

# Chapter 3. Depth-first search

## 3.1 The idea: go deep, then back up

Imagine you are standing at the entrance of a maze. You have a piece of chalk. You walk forward until you hit a dead end. Then you turn around, walk back to the last junction where you saw an unexplored passage, and go down that one. You repeat this — always going as deep as you can before backing up — until you have seen every corridor reachable from the start. That is depth-first search.

A graph is a collection of vertices (dots) connected by edges (lines). In code we usually number the vertices `0` through `n-1` and store for each vertex a list of its neighbours. This list is called an **adjacency list**. Depth-first search (DFS) visits every vertex reachable from a chosen starting vertex exactly once. It does this by recursively stepping to an unvisited neighbour, then returning when no unvisited neighbours remain.

The first time we see a vertex we mark it **visited** so we never process it again. This simple rule guarantees we do not loop forever in cycles.

## 3.2 Recursive DFS traced by hand

Let us trace DFS on a tiny graph with five vertices numbered 0 to 4 and the edges 0-1, 0-2, 1-3 and 2-4. The adjacency list looks like this:

```
0: [1, 2]
1: [0, 3]
2: [0, 4]
3: [1]
4: [2]
```

We start at vertex 0. The recursive call stack grows like this:

1. Enter 0, mark visited. Neighbours: 1, 2. Pick 1 first.
2. Enter 1, mark visited. Neighbours: 0, 3. 0 is already visited, so pick 3.
3. Enter 3, mark visited. Neighbour: 1 (visited). No unvisited neighbours. Return from 3.
4. Back in 1, no more unvisited neighbours. Return from 1.
5. Back in 0, next neighbour is 2 (unvisited). Enter 2, mark visited.
6. Enter 2, neighbour 0 visited, neighbour 4 unvisited. Enter 4, mark visited.
7. Enter 4, neighbour 2 visited. Return from 4.
8. Return from 2.
9. Return from 0. Done.

Visit order: 0, 1, 3, 2, 4. Every vertex and every edge is examined a constant number of times. If `n` is the number of vertices and `m` the number of edges, the total work is $O(n + m)$. The recursion depth can reach $n$ in the worst case, so the call stack uses $O(n)$ extra space.

```python
def dfs_recursive(adj, start):
    """Return list of vertices in the order they are first visited."""
    n = len(adj)
    visited = [False] * n
    order = []

    def dfs(v):
        visited[v] = True
        order.append(v)
        for u in adj[v]:
            if not visited[u]:
                dfs(u)

    dfs(start)
    return order

# Hand-checked example from the text above
adj = [
    [1, 2],   # 0
    [0, 3],   # 1
    [0, 4],   # 2
    [1],      # 3
    [2]       # 4
]
assert dfs_recursive(adj, 0) == [0, 1, 3, 2, 4]
```

```cpp
vector<int> dfs_recursive(const vector<vector<int>>& adj, int start) {
    int n = adj.size();
    vector<bool> visited(n, false);
    vector<int> order;
    function<void(int)> dfs = [&](int v) {
        visited[v] = true;
        order.push_back(v);
        for (int u : adj[v]) {
            if (!visited[u]) dfs(u);
        }
    };
    dfs(start);
    return order;
}
```

## 3.3 Flood fill and counting islands

A grid of 0s and 1s can be seen as a graph: each cell is a vertex, and edges connect a cell to its four orthogonal neighbours (up, down, left, right) that share the same value. Running DFS from every unvisited 1-cell counts **connected components** of land — this is exactly the problem _Number of Islands_. While exploring one component we can also count its cells to get the _Max Area of Island_. Changing the value of every visited cell in a component performs _Flood Fill_.

Let us trace a 3×3 grid by hand:

```
1 1 0
0 1 0
0 0 1
```

Coordinates are (row, col). Start at (0,0), value 1. DFS visits (0,0) → (0,1) → (1,1). That component has size 3. Next unvisited 1 is at (2,2), size 1. So number of islands = 2, max area = 3.

For Flood Fill we start at a given cell and change all connected cells of the same original colour to a new colour.

```python
from collections import deque

def num_islands(grid):
    """Return number of islands (4-directionally connected groups of '1')."""
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    visited = [[False] * cols for _ in range(rows)]

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return
        if visited[r][c] or grid[r][c] != '1':
            return
        visited[r][c] = True
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1' and not visited[r][c]:
                count += 1
                dfs(r, c)
    return count

def max_area_of_island(grid):
    """Return the area of the largest island."""
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    visited = [[False] * cols for _ in range(rows)]

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return 0
        if visited[r][c] or grid[r][c] != '1':
            return 0
        visited[r][c] = True
        return 1 + dfs(r + 1, c) + dfs(r - 1, c) + dfs(r, c + 1) + dfs(r, c - 1)

    best = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1' and not visited[r][c]:
                best = max(best, dfs(r, c))
    return best

def flood_fill(image, sr, sc, new_color):
    """Classic flood fill: change the connected component of (sr,sc) to new_color."""
    if not image:
        return image
    rows, cols = len(image), len(image[0])
    orig = image[sr][sc]
    if orig == new_color:
        return image

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return
        if image[r][c] != orig:
            return
        image[r][c] = new_color
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    dfs(sr, sc)
    return image

# Tiny hand-checked tests
grid1 = [
    ["1","1","0"],
    ["0","1","0"],
    ["0","0","1"]
]
assert num_islands(grid1) == 2
assert max_area_of_island(grid1) == 3

img = [[1,1,1],[1,1,0],[1,0,1]]
assert flood_fill([row[:] for row in img], 1, 1, 2) == [[2,2,2],[2,2,0],[2,0,1]]
```

```cpp
int numIslands(vector<vector<char>>& grid) {
    if (grid.empty()) return 0;
    int rows = grid.size(), cols = grid[0].size();
    vector<vector<bool>> vis(rows, vector<bool>(cols, false));
    function<void(int,int)> dfs = [&](int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (vis[r][c] || grid[r][c] != '1') return;
        vis[r][c] = true;
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1);
    };
    int count = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            if (grid[r][c] == '1' && !vis[r][c]) {
                ++count;
                dfs(r, c);
            }
    return count;
}

int maxAreaOfIsland(vector<vector<char>>& grid) {
    if (grid.empty()) return 0;
    int rows = grid.size(), cols = grid[0].size();
    vector<vector<bool>> vis(rows, vector<bool>(cols, false));
    function<int(int,int)> dfs = [&](int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return 0;
        if (vis[r][c] || grid[r][c] != '1') return 0;
        vis[r][c] = true;
        return 1 + dfs(r+1,c) + dfs(r-1,c) + dfs(r,c+1) + dfs(r,c-1);
    };
    int best = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            if (grid[r][c] == '1' && !vis[r][c])
                best = max(best, dfs(r, c));
    return best;
}

vector<vector<int>> floodFill(vector<vector<int>>& image, int sr, int sc, int newColor) {
    if (image.empty()) return image;
    int rows = image.size(), cols = image[0].size();
    int orig = image[sr][sc];
    if (orig == newColor) return image;
    function<void(int,int)> dfs = [&](int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (image[r][c] != orig) return;
        image[r][c] = newColor;
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1);
    };
    dfs(sr, sc);
    return image;
}
```

## 3.4 DFS from the borders

In _Pacific Atlantic Water Flow_ we have a height grid. Water can flow from a cell to a neighbour of equal or lower height. A cell can reach the Pacific if there is a path to the top or left border; it can reach the Atlantic if there is a path to the bottom or right border. Instead of starting DFS from every cell, we reverse the thinking: start DFS from all Pacific-border cells simultaneously (only moving to neighbours of **greater or equal** height, because we are going uphill), mark all cells that can reach Pacific. Do the same for Atlantic. The answer is the intersection of the two marked sets.

```python
def pacific_atlantic(heights):
    """Return list of [r,c] that can flow to both oceans."""
    if not heights:
        return []
    rows, cols = len(heights), len(heights[0])
    pac = [[False] * cols for _ in range(rows)]
    atl = [[False] * cols for _ in range(rows)]

    def dfs(r, c, visited, prev_h):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return
        if visited[r][c] or heights[r][c] < prev_h:
            return
        visited[r][c] = True
        h = heights[r][c]
        dfs(r + 1, c, visited, h)
        dfs(r - 1, c, visited, h)
        dfs(r, c + 1, visited, h)
        dfs(r, c - 1, visited, h)

    # Pacific from top and left borders
    for c in range(cols):
        dfs(0, c, pac, heights[0][c])
    for r in range(rows):
        dfs(r, 0, pac, heights[r][0])

    # Atlantic from bottom and right borders
    for c in range(cols):
        dfs(rows - 1, c, atl, heights[rows - 1][c])
    for r in range(rows):
        dfs(r, cols - 1, atl, heights[r][cols - 1])

    ans = []
    for r in range(rows):
        for c in range(cols):
            if pac[r][c] and atl[r][c]:
                ans.append([r, c])
    return ans

# Tiny hand-checked example
h = [
    [1, 2, 2, 3, 5],
    [3, 2, 3, 4, 4],
    [2, 4, 5, 3, 1],
    [6, 7, 1, 4, 5],
    [5, 1, 1, 2, 4]
]
# Known answer from LeetCode example
expected = [[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]
assert sorted(pacific_atlantic(h)) == sorted(expected)
```

```cpp
vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights) {
    if (heights.empty()) return {};
    int rows = heights.size(), cols = heights[0].size();
    vector<vector<bool>> pac(rows, vector<bool>(cols, false));
    vector<vector<bool>> atl(rows, vector<bool>(cols, false));

    function<void(int,int,vector<vector<bool>>&,int)> dfs = [&](int r, int c, auto& vis, int prev) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (vis[r][c] || heights[r][c] < prev) return;
        vis[r][c] = true;
        int h = heights[r][c];
        dfs(r+1, c, vis, h);
        dfs(r-1, c, vis, h);
        dfs(r, c+1, vis, h);
        dfs(r, c-1, vis, h);
    };

    for (int c = 0; c < cols; ++c) dfs(0, c, pac, heights[0][c]);
    for (int r = 0; r < rows; ++r) dfs(r, 0, pac, heights[r][0]);
    for (int c = 0; c < cols; ++c) dfs(rows-1, c, atl, heights[rows-1][c]);
    for (int r = 0; r < rows; ++r) dfs(r, cols-1, atl, heights[r][cols-1]);

    vector<vector<int>> ans;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            if (pac[r][c] && atl[r][c])
                ans.push_back({r, c});
    return ans;
}
```

## 3.5 Entry and exit times, and iterative DFS

During recursive DFS we can note the moment we first enter a vertex and the moment we leave it. A global counter `timer` increases by one at each event. The **entry time** `tin[v]` is the counter value when we first see `v`. The **exit time** `tout[v]` is the counter value when we finish all recursive calls from `v`. These times have a useful property: for any two vertices `u` and `v` in the same DFS tree, `u` is an ancestor of `v` if and only if `tin[u] < tin[v]` and `tout[u] > tout[v]`. This lets us answer ancestor queries in $O(1)$ after one DFS.

Sometimes recursion depth is too large for the system stack. We can write DFS iteratively with our own stack. Each stack element holds a vertex and the index of the next neighbour to explore. When we pop a vertex whose neighbours are all processed, we record its exit time.

```python
def dfs_times(adj, start):
    """Return (tin, tout) arrays for vertices reachable from start.
       Unreachable vertices keep tin = tout = -1.
    """
    n = len(adj)
    tin = [-1] * n
    tout = [-1] * n
    timer = 0
    stack = [(start, 0, False)]  # (vertex, next neighbour index, entered_flag)

    while stack:
        v, idx, entered = stack.pop()
        if not entered:
            tin[v] = timer
            timer += 1
            # push exit marker
            stack.append((v, 0, True))
            # push neighbours in reverse order to mimic recursive order
            for u in reversed(adj[v]):
                if tin[u] == -1:
                    stack.append((u, 0, False))
        else:
            tout[v] = timer
            timer += 1
    return tin, tout

# Hand-checked on the 5-vertex graph from section 3.2
adj = [
    [1, 2],
    [0, 3],
    [0, 4],
    [1],
    [2]
]
tin, tout = dfs_times(adj, 0)
# Recursive order was 0,1,3,2,4. Entry times increase along that path.
# 0 enters first, exits last. 3 enters before 2, exits before 2.
assert tin[0] < tin[1] < tin[3]
assert tin[0] < tin[2] < tin[4]
assert tout[3] < tout[1] < tout[0]
assert tout[4] < tout[2] < tout[0]
```

```cpp
pair<vector<int>, vector<int>> dfs_times(const vector<vector<int>>& adj, int start) {
    int n = adj.size();
    vector<int> tin(n, -1), tout(n, -1);
    int timer = 0;
    struct Frame { int v, idx; bool entered; };
    vector<Frame> st;
    st.push_back({start, 0, false});

    while (!st.empty()) {
        auto [v, idx, entered] = st.back();
        st.pop_back();
        if (!entered) {
            tin[v] = timer++;
            st.push_back({v, 0, true}); // exit marker
            for (int i = (int)adj[v].size() - 1; i >= 0; --i) {
                int u = adj[v][i];
                if (tin[u] == -1) st.push_back({u, 0, false});
            }
        } else {
            tout[v] = timer++;
        }
    }
    return {tin, tout};
}
```

## 3.6 Check yourself

1. In recursive DFS, why do we mark a vertex visited before making recursive calls to its neighbours?
2. If a grid has 10 rows and 10 columns, what is the maximum recursion depth DFS could reach when flooding from one corner?
3. In the Pacific-Atlantic problem, why do we start DFS from the ocean borders and move to cells with greater or equal height?
4. Given entry and exit times `tin[u]=5, tout[u]=12` and `tin[v]=7, tout[v]=10`, is `u` an ancestor of `v` in the DFS tree?

# Chapter 4. Cycles, two colours and safe nodes

## 4.1 Cycles in an undirected graph

In an undirected graph a cycle appears when a depth‑first search (DFS) reaches a vertex that has already been visited **and** that vertex is not the immediate parent we just came from. The parent check avoids mistaking the edge we used to enter the current vertex for a cycle.

Imagine a small graph with four vertices and edges `0–1`, `1–2`, `2–0`, `1–3`.  
Start DFS at vertex 0 (parent `-1`).

- From 0 go to 1 (parent 0).
- From 1 go to 2 (parent 1).
- From 2 see neighbour 0. Vertex 0 is already visited and it is **not** the parent of 2 (parent is 1).  
  → We found a cycle `0–1–2–0`.
- The search continues but we already know the answer.

This is exactly the problem _Detect Cycle Undirected_.

```python
def has_cycle_undirected(n, edges):
    """Return True if the undirected graph has a cycle."""
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)

    visited = [False] * n

    def dfs(v, parent):
        visited[v] = True
        for u in adj[v]:
            if u == parent:
                continue
            if visited[u]:
                return True
            if dfs(u, v):
                return True
        return False

    for v in range(n):
        if not visited[v]:
            if dfs(v, -1):
                return True
    return False


# Tiny hand‑checked example:
# 0-1, 1-2, 2-0 (triangle) + isolated 3 -> cycle exists
assert has_cycle_undirected(4, [[0,1],[1,2],[2,0]]) == True
# 0-1, 1-2, 2-3 (path of length 3) -> no cycle
assert has_cycle_undirected(4, [[0,1],[1,2],[2,3]]) == False
```

```cpp
bool hasCycleUndirected(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> adj(n);
    for (auto& e : edges) {
        adj[e[0]].push_back(e[1]);
        adj[e[1]].push_back(e[0]);
    }
    vector<bool> visited(n, false);
    function<bool(int,int)> dfs = [&](int v, int parent) {
        visited[v] = true;
        for (int u : adj[v]) {
            if (u == parent) continue;
            if (visited[u]) return true;
            if (dfs(u, v)) return true;
        }
        return false;
    };
    for (int v = 0; v < n; ++v) {
        if (!visited[v] && dfs(v, -1)) return true;
    }
    return false;
}
```

The algorithm visits every vertex and edge once, so its time cost is $O(n + m)$ and space cost is $O(n)$ for the visited array and recursion stack.

## 4.2 Cycles in a directed graph: three colours

In a directed graph we cannot use a simple parent check because edges have direction. Instead we give each vertex one of three colours:

- **White (0)** – not visited yet.
- **Grey (1)** – currently on the recursion stack (DFS entered this vertex but has not finished it).
- **Black (2)** – completely processed (DFS finished this vertex and all its descendants).

If during DFS we follow an edge to a **grey** vertex, that vertex is an ancestor on the current recursion stack, so we have found a directed cycle. Edges to white vertices continue the search; edges to black vertices go to an already finished branch and cannot form a cycle with the current path.

Consider a directed graph with edges `0→1`, `1→2`, `2→0`, `3→4`.  
Start at 0 (white→grey).

- Go to 1 (white→grey).
- Go to 2 (white→grey).
- From 2 see edge to 0. Vertex 0 is **grey** → cycle `0→1→2→0` detected.  
  Later we start at 3 (white→grey), go to 4 (white→grey→black), backtrack, 3 becomes black. No cycle there.

This is exactly the problem _Detect Cycle Directed_.

```python
def has_cycle_directed(n, edges):
    """Return True if the directed graph has a cycle."""
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)

    # 0 = white, 1 = grey, 2 = black
    color = [0] * n

    def dfs(v):
        color[v] = 1  # grey
        for u in adj[v]:
            if color[u] == 0:
                if dfs(u):
                    return True
            elif color[u] == 1:
                return True
        color[v] = 2  # black
        return False

    for v in range(n):
        if color[v] == 0:
            if dfs(v):
                return True
    return False


# Hand‑checked examples:
# 0->1, 1->2, 2->0 (cycle) + 3->4 (no cycle) -> True
assert has_cycle_directed(5, [[0,1],[1,2],[2,0],[3,4]]) == True
# 0->1, 1->2, 2->3 (path) -> False
assert has_cycle_directed(4, [[0,1],[1,2],[2,3]]) == False
```

```cpp
bool hasCycleDirected(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> adj(n);
    for (auto& e : edges) adj[e[0]].push_back(e[1]);
    vector<int> color(n, 0); // 0 white, 1 grey, 2 black
    function<bool(int)> dfs = [&](int v) {
        color[v] = 1;
        for (int u : adj[v]) {
            if (color[u] == 0) {
                if (dfs(u)) return true;
            } else if (color[u] == 1) {
                return true;
            }
        }
        color[v] = 2;
        return false;
    };
    for (int v = 0; v < n; ++v)
        if (color[v] == 0 && dfs(v)) return true;
    return false;
}
```

Time cost is $O(n + m)$, space cost is $O(n)$ for the colour array and recursion stack.

## 4.3 Bipartite graphs and two colours

A graph is **bipartite** if we can split its vertices into two groups such that every edge connects a vertex from one group to a vertex from the other group. Equivalently, we can colour every vertex with one of two colours (say 0 and 1) so that adjacent vertices always have different colours.

We can test this with a BFS (or DFS) that spreads colours level by level. Start from any uncoloured vertex, give it colour 0, and put it in a queue. While the queue is not empty, pop a vertex `v`, and for each neighbour `u`:

- If `u` is uncoloured, give it the opposite colour (`colour[v] ^ 1`) and push it.
- If `u` already has a colour, check that it differs from `v`'s colour. If it is the same, the graph is **not** bipartite.

Why does an odd cycle break bipartiteness? Walk around a cycle of length 3: colours must alternate 0,1,0 but the last edge connects two 0s. In general, an odd cycle forces two adjacent vertices to share a colour. Conversely, if a graph has no odd cycles, the alternating colouring always works.

This is exactly the problem _Is Graph Bipartite_.

```python
from collections import deque

def is_bipartite(n, edges):
    """Return True if the undirected graph is bipartite."""
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)

    colour = [-1] * n  # -1 = uncoloured, 0 or 1 = colour
    for start in range(n):
        if colour[start] != -1:
            continue
        colour[start] = 0
        q = deque([start])
        while q:
            v = q.popleft()
            for u in adj[v]:
                if colour[u] == -1:
                    colour[u] = colour[v] ^ 1
                    q.append(u)
                elif colour[u] == colour[v]:
                    return False
    return True


# Hand‑checked examples:
# Even cycle 0-1-2-3-0 (4 vertices) -> bipartite
assert is_bipartite(4, [[0,1],[1,2],[2,3],[3,0]]) == True
# Odd cycle 0-1-2-0 (triangle) -> not bipartite
assert is_bipartite(3, [[0,1],[1,2],[2,0]]) == False
```

```cpp
bool isBipartite(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> adj(n);
    for (auto& e : edges) {
        adj[e[0]].push_back(e[1]);
        adj[e[1]].push_back(e[0]);
    }
    vector<int> colour(n, -1);
    queue<int> q;
    for (int start = 0; start < n; ++start) {
        if (colour[start] != -1) continue;
        colour[start] = 0;
        q.push(start);
        while (!q.empty()) {
            int v = q.front(); q.pop();
            for (int u : adj[v]) {
                if (colour[u] == -1) {
                    colour[u] = colour[v] ^ 1;
                    q.push(u);
                } else if (colour[u] == colour[v]) {
                    return false;
                }
            }
        }
    }
    return true;
}
```

Time cost is $O(n + m)$, space cost is $O(n)$ for the colour array and queue.

## 4.4 Eventual safe states

A node is **eventually safe** if every possible path starting from it eventually reaches a terminal node (a node with no outgoing edges) and never enters a cycle. In other words, the node cannot reach any cycle.

Instead of searching forward from every node (which would repeat work), we reverse the graph and think backwards. In the reversed graph, terminal nodes become sources (indegree 0). Any node that can reach a terminal node in the original graph becomes reachable from a source in the reversed graph. Nodes that are part of a cycle, or that lead into a cycle, will never be reached by this backward propagation because cycles have no terminal nodes.

Algorithm (Kahn’s topological sort on the reversed graph):

1. Build the reversed adjacency list `rev_adj` and compute the outdegree of each node in the original graph (which is the indegree in the reversed graph).
2. Start a queue with all nodes whose outdegree is 0 (terminal nodes).
3. While the queue is not empty, pop a node `v`. For each predecessor `u` in `rev_adj[v]`, decrement `outdegree[u]`. If `outdegree[u]` becomes 0, push `u`.
4. All nodes that get popped from the queue are eventually safe.

Consider a graph with edges `0→1`, `1→2`, `2→3`, `3→4`, `4→5`, `5→6`, `6→3` (cycle 3‑4‑5‑6) and `7→8`, `8→9` (9 terminal).  
Terminal nodes: 9. Queue starts with 9.  
Process 9 → decrement outdegree of 8 (becomes 0) → push 8.  
Process 8 → decrement outdegree of 7 (becomes 0) → push 7.  
Nodes 3,4,5,6 never reach outdegree 0 because they are in a cycle. Nodes 0,1,2 point into the cycle, so their outdegree never drops to 0.  
Safe nodes: 7, 8, 9.

This is exactly the problem _Eventual Safe States_.

```python
from collections import deque

def eventual_safe_nodes(n, edges):
    """Return sorted list of eventually safe nodes."""
    rev_adj = [[] for _ in range(n)]
    outdeg = [0] * n
    for u, v in edges:
        rev_adj[v].append(u)
        outdeg[u] += 1

    q = deque([v for v in range(n) if outdeg[v] == 0])
    safe = [False] * n
    while q:
        v = q.popleft()
        safe[v] = True
        for u in rev_adj[v]:
            outdeg[u] -= 1
            if outdeg[u] == 0:
                q.append(u)
    return [v for v in range(n) if safe[v]]


# Hand‑checked example:
# 0->1, 1->2, 2->3, 3->4, 4->5, 5->6, 6->3 (cycle)
# 7->8, 8->9 (9 terminal)
n = 10
edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3],[7,8],[8,9]]
assert eventual_safe_nodes(n, edges) == [7,8,9]
```

```cpp
vector<int> eventualSafeNodes(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> rev_adj(n);
    vector<int> outdeg(n, 0);
    for (auto& e : edges) {
        rev_adj[e[1]].push_back(e[0]);
        outdeg[e[0]]++;
    }
    queue<int> q;
    for (int v = 0; v < n; ++v)
        if (outdeg[v] == 0) q.push(v);
    vector<bool> safe(n, false);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        safe[v] = true;
        for (int u : rev_adj[v]) {
            if (--outdeg[u] == 0) q.push(u);
        }
    }
    vector<int> ans;
    for (int v = 0; v < n; ++v)
        if (safe[v]) ans.push_back(v);
    return ans;
}
```

Time cost is $O(n + m)$, space cost is $O(n + m)$ for the reversed adjacency list and queues.

## 4.5 Check yourself

1. In an undirected DFS, why do we ignore the edge that leads back to the parent vertex?
2. What does a grey vertex mean during a directed DFS, and why does seeing a grey neighbour prove a cycle exists?
3. If a graph contains a triangle (3‑cycle), can it be bipartite? Explain in one sentence.
4. In the eventual safe states algorithm, why do we start the queue with nodes whose outdegree is zero?

# Chapter 5. Topological sort

## 5.1 Prerequisites as arrows

Imagine you have a set of tasks. Some tasks must be finished before others can start. For example, you must put on socks before shoes. We can draw an arrow from "socks" to "shoes" to show that dependency. If we have many tasks and many arrows, we get a **directed graph**: vertices are tasks, edges are prerequisites.

A **topological order** is a linear ordering of the vertices so that every arrow points forward. In the sock‑shoe example, "socks" comes before "shoes". If the graph has a cycle (e.g., A before B, B before C, C before A), no ordering can satisfy all arrows.

Here is a tiny graph with four tasks:

```
0 → 1
↓   ↓
2 → 3
```

Edges: 0→1, 0→2, 1→3, 2→3. One valid order is `[0, 1, 2, 3]`; another is `[0, 2, 1, 3]`. Both respect every arrow.

This idea appears in many problems. The sheet problem _Course Schedule_ asks whether an order exists (cycle detection). _Course Schedule Order_ asks for one valid order. _Alien Dictionary_ builds a graph from sorted words and then finds a topological order of letters.

## 5.2 Kahn's algorithm

Kahn's algorithm builds the order by repeatedly removing vertices that have no incoming edges (in‑degree zero). Those vertices can safely go next because nothing must precede them.

Let's trace on the graph above. We'll keep a table of in‑degrees and a queue of zero‑in‑degree vertices.

**Initial in‑degrees:**

| vertex | 0   | 1   | 2   | 3   |
| ------ | --- | --- | --- | --- |
| in‑deg | 0   | 1   | 1   | 2   |

Queue starts with `[0]`. Pop 0, add to order. Decrease in‑degree of its neighbors (1 and 2). New in‑degrees: 1→0, 2→0, 3→2. Queue becomes `[1, 2]`.

Pop 1, add to order. Neighbor 3 in‑degree becomes 1. Queue: `[2]`.

Pop 2, add to order. Neighbor 3 in‑degree becomes 0. Queue: `[3]`.

Pop 3, add to order. Queue empty. Final order: `[0, 1, 2, 3]`.

If the graph had a cycle, at some point the queue would become empty before all vertices are processed. That tells us no topological order exists.

**Time and space:** $O(V+E)$ for both.

```python
from collections import deque
from typing import List, Optional

def topological_sort_kahn(n: int, edges: List[List[int]]) -> Optional[List[int]]:
    """Return a topological order of n vertices (0..n-1) given directed edges.
    If a cycle exists, return None."""
    adj = [[] for _ in range(n)]
    indeg = [0] * n
    for u, v in edges:
        adj[u].append(v)
        indeg[v] += 1

    q = deque([i for i in range(n) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)

    if len(order) == n:
        return order
    return None

# Tiny test from the traced example
edges = [[0,1],[0,2],[1,3],[2,3]]
assert topological_sort_kahn(4, edges) in ([0,1,2,3], [0,2,1,3])
# Cycle test
cycle_edges = [[0,1],[1,2],[2,0]]
assert topological_sort_kahn(3, cycle_edges) is None
```

```cpp
#include <vector>
#include <queue>
using namespace std;

vector<int> topological_sort_kahn(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> adj(n);
    vector<int> indeg(n, 0);
    for (auto& e : edges) {
        adj[e[0]].push_back(e[1]);
        indeg[e[1]]++;
    }
    queue<int> q;
    for (int i = 0; i < n; ++i)
        if (indeg[i] == 0) q.push(i);
    vector<int> order;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        order.push_back(u);
        for (int v : adj[u]) {
            if (--indeg[v] == 0) q.push(v);
        }
    }
    if ((int)order.size() == n) return order;
    return {};
}
```

## 5.3 The DFS version

Depth‑first search can also produce a topological order. The idea: when we finish exploring a vertex (all its descendants are done), we append it to a list. Because every edge goes from a vertex to a descendant, the descendant finishes first and appears earlier in the list. Reversing the list gives a valid order.

Let's run DFS on the same graph starting from 0. We'll use a recursion stack to detect cycles.

```
dfs(0):
  visit 1:
    visit 3: finish 3
  finish 1
  visit 2:
    3 already visited
  finish 2
finish 0
```

Finish order (post‑order): `[3, 1, 2, 0]`. Reverse → `[0, 2, 1, 3]` (a valid order).

If we encounter a vertex that is already on the current recursion stack, we have a cycle.

**Time and space:** $O(V+E)$.

```python
from typing import List, Optional

def topological_sort_dfs(n: int, edges: List[List[int]]) -> Optional[List[int]]:
    """Return a topological order using DFS. None if cycle."""
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)

    visited = [0] * n   # 0=unvisited, 1=visiting, 2=done
    order = []
    has_cycle = False

    def dfs(u: int):
        nonlocal has_cycle
        if has_cycle:
            return
        visited[u] = 1
        for v in adj[u]:
            if visited[v] == 0:
                dfs(v)
            elif visited[v] == 1:
                has_cycle = True
                return
        visited[u] = 2
        order.append(u)

    for i in range(n):
        if visited[i] == 0:
            dfs(i)
        if has_cycle:
            return None
    order.reverse()
    return order

# Same tests
edges = [[0,1],[0,2],[1,3],[2,3]]
assert topological_sort_dfs(4, edges) in ([0,1,2,3], [0,2,1,3])
cycle_edges = [[0,1],[1,2],[2,0]]
assert topological_sort_dfs(3, cycle_edges) is None
```

```cpp
#include <vector>
using namespace std;

bool dfs(int u, const vector<vector<int>>& adj, vector<int>& state, vector<int>& order) {
    state[u] = 1; // visiting
    for (int v : adj[u]) {
        if (state[v] == 0) {
            if (!dfs(v, adj, state, order)) return false;
        } else if (state[v] == 1) {
            return false; // cycle
        }
    }
    state[u] = 2; // done
    order.push_back(u);
    return true;
}

vector<int> topological_sort_dfs(int n, const vector<vector<int>>& edges) {
    vector<vector<int>> adj(n);
    for (auto& e : edges) adj[e[0]].push_back(e[1]);
    vector<int> state(n, 0), order;
    for (int i = 0; i < n; ++i) {
        if (state[i] == 0) {
            if (!dfs(i, adj, state, order)) return {};
        }
    }
    reverse(order.begin(), order.end());
    return order;
}
```

## 5.4 Course schedule

The _Course Schedule_ problem gives `n` courses labeled `0..n-1` and a list of prerequisite pairs `[a, b]` meaning you must take `b` before `a`. This is exactly a directed edge `b → a`. We need to decide if a cycle exists (impossible) and, for _Course Schedule Order_, output one valid sequence.

We can reuse either Kahn or DFS. Here is a complete solver using Kahn:

```python
from collections import deque
from typing import List, Optional

def can_finish(num_courses: int, prerequisites: List[List[int]]) -> bool:
    """Return True if all courses can be finished (no cycle)."""
    adj = [[] for _ in range(num_courses)]
    indeg = [0] * num_courses
    for a, b in prerequisites:  # b -> a
        adj[b].append(a)
        indeg[a] += 1
    q = deque([i for i in range(num_courses) if indeg[i] == 0])
    taken = 0
    while q:
        u = q.popleft()
        taken += 1
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return taken == num_courses

def find_order(num_courses: int, prerequisites: List[List[int]]) -> List[int]:
    """Return one topological order, or empty list if impossible."""
    adj = [[] for _ in range(num_courses)]
    indeg = [0] * num_courses
    for a, b in prerequisites:
        adj[b].append(a)
        indeg[a] += 1
    q = deque([i for i in range(num_courses) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == num_courses else []

# Example: 4 courses, prerequisites: [1,0], [2,0], [3,1], [3,2]
# 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3
prereqs = [[1,0],[2,0],[3,1],[3,2]]
assert can_finish(4, prereqs) == True
assert find_order(4, prereqs) in ([0,1,2,3], [0,2,1,3])
# Cycle example
assert can_finish(2, [[0,1],[1,0]]) == False
assert find_order(2, [[0,1],[1,0]]) == []
```

```cpp
#include <vector>
#include <queue>
using namespace std;

bool can_finish(int numCourses, vector<vector<int>>& prerequisites) {
    vector<vector<int>> adj(numCourses);
    vector<int> indeg(numCourses, 0);
    for (auto& p : prerequisites) {
        adj[p[1]].push_back(p[0]);
        indeg[p[0]]++;
    }
    queue<int> q;
    for (int i = 0; i < numCourses; ++i)
        if (indeg[i] == 0) q.push(i);
    int taken = 0;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        taken++;
        for (int v : adj[u]) {
            if (--indeg[v] == 0) q.push(v);
        }
    }
    return taken == numCourses;
}

vector<int> find_order(int numCourses, vector<vector<int>>& prerequisites) {
    vector<vector<int>> adj(numCourses);
    vector<int> indeg(numCourses, 0);
    for (auto& p : prerequisites) {
        adj[p[1]].push_back(p[0]);
        indeg[p[0]]++;
    }
    queue<int> q;
    for (int i = 0; i < numCourses; ++i)
        if (indeg[i] == 0) q.push(i);
    vector<int> order;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        order.push_back(u);
        for (int v : adj[u]) {
            if (--indeg[v] == 0) q.push(v);
        }
    }
    if ((int)order.size() == numCourses) return order;
    return {};
}
```

## 5.5 Alien dictionary

In _Alien Dictionary_ we receive a list of words sorted according to an unknown alphabet. We must reconstruct a possible order of letters. For example, words `["wrt","wrf","er","ett","rftt"]` imply:

- `wrt` before `wrf` → first difference at index 2: `t` before `f` → edge `t → f`.
- `wrf` before `er` → `w` before `e` → `w → e`.
- `er` before `ett` → `r` before `t` → `r → t`.
- `ett` before `rftt` → `e` before `r` → `e → r`.

Graph edges: `t→f`, `w→e`, `r→t`, `e→r`. A topological order: `w, e, r, t, f` (letters not appearing in edges can go anywhere).

We build the graph by comparing adjacent words, find the first differing character, add that edge. Then run topological sort. If a cycle appears, the dictionary is invalid.

```python
from collections import deque, defaultdict
from typing import List, Optional

def alien_order(words: List[str]) -> str:
    # Collect all unique letters
    letters = set("".join(words))
    # Build graph
    adj = {c: set() for c in letters}
    indeg = {c: 0 for c in letters}
    for i in range(len(words)-1):
        w1, w2 = words[i], words[i+1]
        # Find first difference
        for c1, c2 in zip(w1, w2):
            if c1 != c2:
                if c2 not in adj[c1]:
                    adj[c1].add(c2)
                    indeg[c2] += 1
                break
        else:
            # w1 is prefix of w2 but w1 comes after w2 -> invalid
            if len(w1) > len(w2):
                return ""
    # Kahn
    q = deque([c for c in letters if indeg[c] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) != len(letters):
        return ""  # cycle
    return "".join(order)

# Test from the example
words = ["wrt","wrf","er","ett","rftt"]
assert alien_order(words) in ("wertf", "wetrf", "ewrtf", "wertf")  # multiple valid
# Invalid case: ["abc","ab"] -> prefix but longer first
assert alien_order(["abc","ab"]) == ""
```

```cpp
#include <vector>
#include <string>
#include <queue>
#include <unordered_set>
#include <unordered_map>
using namespace std;

string alienOrder(vector<string>& words) {
    unordered_set<char> letters;
    for (auto& w : words) for (char c : w) letters.insert(c);
    unordered_map<char, unordered_set<char>> adj;
    unordered_map<char, int> indeg;
    for (char c : letters) {
        adj[c] = {};
        indeg[c] = 0;
    }
    for (int i = 0; i+1 < (int)words.size(); ++i) {
        string& w1 = words[i];
        string& w2 = words[i+1];
        int len = min(w1.size(), w2.size());
        int j = 0;
        while (j < len && w1[j] == w2[j]) j++;
        if (j == len) {
            if (w1.size() > w2.size()) return ""; // invalid prefix
        } else {
            char c1 = w1[j], c2 = w2[j];
            if (!adj[c1].count(c2)) {
                adj[c1].insert(c2);
                indeg[c2]++;
            }
        }
    }
    queue<char> q;
    for (char c : letters) if (indeg[c] == 0) q.push(c);
    string order;
    while (!q.empty()) {
        char u = q.front(); q.pop();
        order.push_back(u);
        for (char v : adj[u]) {
            if (--indeg[v] == 0) q.push(v);
        }
    }
    if ((int)order.size() != (int)letters.size()) return "";
    return order;
}
```

## 5.6 Check yourself

1. In a directed graph, what does an edge `u → v` mean for a topological order?
2. Why does Kahn's algorithm fail to process all vertices when the graph contains a cycle?
3. In the DFS version, why do we reverse the post‑order list to get a topological order?
4. When building the graph for Alien Dictionary, why do we only add an edge from the first differing character of two adjacent words?

# Chapter 6. Shortest paths with weights

## 6.1 Why BFS is not enough

Breadth-first search finds the shortest path when every edge has the same cost, because it explores vertices in layers: first all vertices one step away, then two steps away, and so on. The first time we reach a vertex, we have used the fewest possible edges.

When edges have different costs, the path with the fewest edges is not always the cheapest. Imagine a graph with three vertices 0, 1, 2 and these directed edges:

- 0 → 1 with cost 5
- 0 → 2 with cost 2
- 2 → 1 with cost 2

BFS starting at 0 visits 1 and 2 in the first layer (both are one edge away). It would say the distance to 1 is 1 step, but the actual cheapest cost from 0 to 1 is 0 → 2 → 1 with total cost 4, which uses two edges. BFS cannot see this because it treats every edge as equal.

We need an algorithm that always expands the vertex with the smallest _total cost so far_, not the fewest edges. That idea leads to Dijkstra's algorithm.

## 6.2 Dijkstra: the idea and a worked example

Dijkstra's algorithm keeps a current best distance to every vertex. Initially only the start vertex has distance 0; all others are infinity. Repeatedly, it picks the unvisited vertex with the smallest distance, marks it visited, and _relaxes_ its outgoing edges: for each edge to a neighbor, it checks whether going through this vertex gives a shorter path to the neighbor.

Let's trace Dijkstra on this small graph (vertices 0..3, undirected edges shown as pairs with cost):

```
0 --1-- 1
|       |
4       2
|       |
2 --1-- 3
```

Edges: (0,1,1), (0,2,4), (1,3,2), (2,3,1). Start at 0.

We maintain a table of distances `dist` and a visited set. Initially `dist = [0, ∞, ∞, ∞]`.

| Step | Pick vertex | Visited   | Relax edges from picked vertex | dist after step |
| ---- | ----------- | --------- | ------------------------------ | --------------- |
| 0    | –           | {}        | –                              | [0, ∞, ∞, ∞]    |
| 1    | 0 (dist 0)  | {0}       | 0→1: dist[1]=1; 0→2: dist[2]=4 | [0, 1, 4, ∞]    |
| 2    | 1 (dist 1)  | {0,1}     | 1→3: dist[3]=1+2=3             | [0, 1, 4, 3]    |
| 3    | 3 (dist 3)  | {0,1,3}   | 3→2: 3+1=4, no improvement     | [0, 1, 4, 3]    |
| 4    | 2 (dist 4)  | {0,1,3,2} | no outgoing to unvisited       | [0, 1, 4, 3]    |

Final distances from 0: `[0, 1, 4, 3]`. The shortest path to 3 is 0→1→3 with cost 3.

The naive way to pick the smallest unvisited distance scans all vertices each time, giving $O(n^2)$ total. For sparse graphs we use a min-heap (priority queue) to get $O((n+m)\log n)$. Each vertex enters the heap when its distance improves; we may have stale entries, so we skip them when popped.

This is exactly the problem _Dijkstra Shortest Paths_.

```python
import heapq
from typing import List, Tuple

def dijkstra(n: int, adj: List[List[Tuple[int, int]]], start: int) -> List[int]:
    """
    Returns list of shortest distances from start to every vertex.
    adj[u] = list of (v, weight) pairs.
    """
    INF = 10**18
    dist = [INF] * n
    dist[start] = 0
    pq = [(0, start)]  # (distance, vertex)
    while pq:
        d, u = heapq.heappop(pq)
        if d != dist[u]:
            continue  # stale entry
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist

# Hand-checked example from the table above:
# 4 vertices, edges: 0-1(1), 0-2(4), 1-3(2), 2-3(1)
adj = [
    [(1, 1), (2, 4)],
    [(0, 1), (3, 2)],
    [(0, 4), (3, 1)],
    [(1, 2), (2, 1)],
]
assert dijkstra(4, adj, 0) == [0, 1, 4, 3]
assert dijkstra(4, adj, 2) == [4, 3, 0, 1]
```

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
const ll INF = (1LL<<60);

vector<ll> dijkstra(int n, const vector<vector<pair<int,int>>>& adj, int start) {
    vector<ll> dist(n, INF);
    dist[start] = 0;
    using pli = pair<ll,int>;
    priority_queue<pli, vector<pli>, greater<pli>> pq;
    pq.emplace(0, start);
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d != dist[u]) continue;
        for (auto [v, w] : adj[u]) {
            ll nd = d + w;
            if (nd < dist[v]) {
                dist[v] = nd;
                pq.emplace(nd, v);
            }
        }
    }
    return dist;
}
```

## 6.3 Why Dijkstra needs non-negative weights

Dijkstra's correctness relies on the fact that when we pick the unvisited vertex with the smallest distance, that distance can never improve later. This is true only if all edge weights are non-negative. If an edge has negative weight, a path that goes through already-visited vertices could become cheaper after they are marked visited.

Consider three vertices 0, 1, 2 with the edges 0 → 1 with cost 1, 0 → 2 with cost 2, and 2 → 1 with cost $-4$. Dijkstra starts at 0 and finds the distances 1 for vertex 1 and 2 for vertex 2. The smallest unvisited distance belongs to vertex 1, so vertex 1 is finalised with distance 1. Only then does it look at vertex 2 and see that the route 0 → 2 → 1 costs $2 - 4 = -2$, which is better. But vertex 1 is already finalised, so the algorithm never fixes it and reports 1 instead of $-2$. With negative edges we need Bellman-Ford (next section).

## 6.4 Variations: minimum effort and counting paths

Sometimes the cost of a path is not the sum of edge weights but the **maximum** edge weight along the path. Two classic problems use this idea: _Path with Minimum Effort_ and _Swim in Rising Water_. In both, we want a path from start to target that minimizes the maximum edge weight encountered. This is exactly the same as Dijkstra, except the relaxation uses `max` instead of `+`:

```
new_cost = max(current_cost, edge_weight)
```

The algorithm still picks the unvisited vertex with the smallest current cost, because any path extending from a vertex with a larger current maximum can never yield a smaller overall maximum.

Another variation: **counting the number of shortest paths**. While running Dijkstra, we keep a `ways` array. When we find a strictly shorter distance to a vertex, we set `ways[v] = ways[u]`. When we find an equal distance, we add `ways[u]` to `ways[v]`. This works because Dijkstra processes vertices in increasing distance order, so by the time we relax edges from `u`, all shortest paths to `u` are already counted.

This covers the problems _Path with Minimum Effort_, _Swim in Rising Water_, and _Number of Shortest Paths_.

```python
import heapq
from typing import List, Tuple

def min_max_path(n: int, adj: List[List[Tuple[int, int]]], start: int, target: int) -> int:
    """
    Returns the minimum possible maximum edge weight on any path from start to target.
    """
    INF = 10**18
    best = [INF] * n
    best[start] = 0
    pq = [(0, start)]
    while pq:
        cost, u = heapq.heappop(pq)
        if cost != best[u]:
            continue
        if u == target:
            return cost
        for v, w in adj[u]:
            nc = max(cost, w)
            if nc < best[v]:
                best[v] = nc
                heapq.heappush(pq, (nc, v))
    return -1  # unreachable

def count_shortest_paths(n: int, adj: List[List[Tuple[int, int]]], start: int) -> Tuple[List[int], List[int]]:
    """
    Returns (dist, ways) where ways[v] is the number of shortest paths from start to v.
    Assumes non-negative weights.
    """
    MOD = 10**9 + 7
    INF = 10**18
    dist = [INF] * n
    ways = [0] * n
    dist[start] = 0
    ways[start] = 1
    pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d != dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                ways[v] = ways[u]
                heapq.heappush(pq, (nd, v))
            elif nd == dist[v]:
                ways[v] = (ways[v] + ways[u]) % MOD
    return dist, ways

# Tiny hand-checked examples
adj1 = [  # 0-1(5), 1-2(3), 0-2(10)
    [(1, 5), (2, 10)],
    [(0, 5), (2, 3)],
    [(0, 10), (1, 3)],
]
assert min_max_path(3, adj1, 0, 2) == 5  # path 0-1-2 has max edge 5, direct 0-2 has max 10

adj2 = [  # 0-1(1), 0-2(1), 1-3(1), 2-3(1) -> two shortest paths 0-1-3 and 0-2-3 to 3
    [(1, 1), (2, 1)],
    [(0, 1), (3, 1)],
    [(0, 1), (3, 1)],
    [(1, 1), (2, 1)],
]
dist, ways = count_shortest_paths(4, adj2, 0)
assert dist == [0, 1, 1, 2]
assert ways == [1, 1, 1, 2]
```

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
const ll INF = (1LL<<60);
const int MOD = 1'000'000'007;

int min_max_path(int n, const vector<vector<pair<int,int>>>& adj, int start, int target) {
    vector<int> best(n, INT_MAX);
    best[start] = 0;
    using pii = pair<int,int>;
    priority_queue<pii, vector<pii>, greater<pii>> pq;
    pq.emplace(0, start);
    while (!pq.empty()) {
        auto [cost, u] = pq.top(); pq.pop();
        if (cost != best[u]) continue;
        if (u == target) return cost;
        for (auto [v, w] : adj[u]) {
            int nc = max(cost, w);
            if (nc < best[v]) {
                best[v] = nc;
                pq.emplace(nc, v);
            }
        }
    }
    return -1;
}

pair<vector<ll>, vector<int>> count_shortest_paths(int n, const vector<vector<pair<int,int>>>& adj, int start) {
    vector<ll> dist(n, INF);
    vector<int> ways(n, 0);
    dist[start] = 0;
    ways[start] = 1;
    using pli = pair<ll,int>;
    priority_queue<pli, vector<pli>, greater<pli>> pq;
    pq.emplace(0, start);
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d != dist[u]) continue;
        for (auto [v, w] : adj[u]) {
            ll nd = d + w;
            if (nd < dist[v]) {
                dist[v] = nd;
                ways[v] = ways[u];
                pq.emplace(nd, v);
            } else if (nd == dist[v]) {
                ways[v] = (ways[v] + ways[u]) % MOD;
            }
        }
    }
    return {dist, ways};
}
```

## 6.5 Bellman-Ford and negative weights

Bellman-Ford works even when edges have negative weights, as long as there is no negative cycle reachable from the start. The idea is simple: repeat $n-1$ times the following step — scan **all** edges and try to relax each one. After $n-1$ rounds, every shortest path (which has at most $n-1$ edges) has been fully relaxed.

If we do one more round and some distance still improves, that means a negative cycle is reachable. We can then mark all vertices reachable from that cycle as having $-\infty$ distance.

Let's trace on a tiny graph with a negative edge but no negative cycle: vertices 0,1,2; edges 0→1 (4), 0→2 (5), 2→1 (-3). Start at 0.

Initial: `dist = [0, ∞, ∞]`

Round 1: relax all edges

- 0→1: dist[1] = 4
- 0→2: dist[2] = 5
- 2→1: dist[1] = min(4, 5 + (-3)) = 2

Round 2: no further changes. Final distances: `[0, 2, 5]`. The path 0→2→1 costs 2, better than direct 0→1 (4).

Time complexity is $O(nm)$, space $O(n)$.

This is exactly the problem _Bellman Ford_.

```python
from typing import List, Tuple

def bellman_ford(n: int, edges: List[Tuple[int, int, int]], start: int) -> List[float]:
    """
    edges: list of (u, v, w) directed edges.
    Returns distances; unreachable = inf, negative-cycle-reachable = -inf.
    """
    INF = float('inf')
    dist = [INF] * n
    dist[start] = 0
    # n-1 rounds of full relaxation
    for _ in range(n - 1):
        updated = False
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                updated = True
        if not updated:
            break
    # one more round to detect negative cycles
    on_neg_cycle = [False] * n
    for u, v, w in edges:
        if dist[u] != INF and dist[u] + w < dist[v]:
            on_neg_cycle[v] = True
    # propagate -inf to all vertices reachable from any vertex on a negative cycle
    # (simple BFS/DFS from those vertices)
    from collections import deque
    q = deque([i for i, flag in enumerate(on_neg_cycle) if flag])
    while q:
        u = q.popleft()
        dist[u] = -INF
        for uu, vv, ww in edges:
            if uu == u and not on_neg_cycle[vv]:
                on_neg_cycle[vv] = True
                q.append(vv)
    return dist

# Hand-checked example: 0->1(4), 0->2(5), 2->1(-3)
edges = [(0, 1, 4), (0, 2, 5), (2, 1, -3)]
assert bellman_ford(3, edges, 0) == [0, 2, 5]

# Negative cycle example: 0->1(1), 1->2(-1), 2->0(-1) cycle sum -1
edges2 = [(0, 1, 1), (1, 2, -1), (2, 0, -1)]
d = bellman_ford(3, edges2, 0)
assert d[0] == -float('inf') and d[1] == -float('inf') and d[2] == -float('inf')
```

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
const ll INF = (1LL<<60);

struct Edge { int u, v; ll w; };

vector<ll> bellman_ford(int n, const vector<Edge>& edges, int start) {
    vector<ll> dist(n, INF);
    dist[start] = 0;
    // n-1 rounds
    for (int i = 0; i < n - 1; ++i) {
        bool any = false;
        for (auto e : edges) {
            if (dist[e.u] != INF && dist[e.u] + e.w < dist[e.v]) {
                dist[e.v] = dist[e.u] + e.w;
                any = true;
            }
        }
        if (!any) break;
    }
    // detect negative cycles
    vector<bool> on_neg(n, false);
    for (auto e : edges) {
        if (dist[e.u] != INF && dist[e.u] + e.w < dist[e.v]) {
            on_neg[e.v] = true;
        }
    }
    // propagate -INF
    queue<int> q;
    for (int i = 0; i < n; ++i) if (on_neg[i]) q.push(i);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        dist[u] = -INF;
        for (auto e : edges) {
            if (e.u == u && !on_neg[e.v]) {
                on_neg[e.v] = true;
                q.push(e.v);
            }
        }
    }
    return dist;
}
```

## 6.6 Cheapest flights within K stops

The problem _Cheapest Flights within K Stops_ asks for the cheapest path from source to destination using at most $K$ edges (i.e., $K$ stops means $K+1$ edges). This is exactly Bellman-Ford run for $K+1$ rounds, because after $i$ rounds `dist[v]` holds the cheapest cost using at most $i$ edges.

We must be careful: in each round we relax edges based on the distances from the _previous_ round only, otherwise a single round could chain multiple edges. So we copy the distance array at the start of each round.

Example: 3 cities, flights 0→1 (100), 1→2 (100), 0→2 (500). K=1 (at most 2 edges). Round 0: `dist=[0,∞,∞]`. Round 1 (1 edge): relax all → `dist=[0,100,500]`. Round 2 (2 edges): use copy of round 1 → 1→2 gives 200, so `dist=[0,100,200]`. Answer 200.

Time $O(K \cdot m)$, space $O(n)$.

```python
from typing import List, Tuple

def cheapest_flights(n: int, flights: List[Tuple[int, int, int]], src: int, dst: int, K: int) -> int:
    """
    flights: (u, v, price). At most K stops = at most K+1 edges.
    Returns -1 if no such route.
    """
    INF = 10**18
    dist = [INF] * n
    dist[src] = 0
    for _ in range(K + 1):
        ndist = dist[:]  # copy previous round
        for u, v, w in flights:
            if dist[u] != INF and dist[u] + w < ndist[v]:
                ndist[v] = dist[u] + w
        dist = ndist
    return -1 if dist[dst] == INF else dist[dst]

# Example from description
flights = [(0, 1, 100), (1, 2, 100), (0, 2, 500)]
assert cheapest_flights(3, flights, 0, 2, 1) == 200
assert cheapest_flights(3, flights, 0, 2, 0) == 500  # direct only
```

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
const ll INF = (1LL<<60);

struct Flight { int u, v, w; };

int cheapest_flights(int n, const vector<Flight>& flights, int src, int dst, int K) {
    vector<ll> dist(n, INF);
    dist[src] = 0;
    for (int i = 0; i <= K; ++i) {
        vector<ll> ndist = dist;
        for (auto f : flights) {
            if (dist[f.u] != INF && dist[f.u] + f.w < ndist[f.v]) {
                ndist[f.v] = dist[f.u] + f.w;
            }
        }
        dist.swap(ndist);
    }
    return dist[dst] == INF ? -1 : (int)dist[dst];
}
```

## 6.7 Floyd-Warshall: all pairs

Floyd-Warshall finds shortest paths between **all pairs** of vertices. It works for negative edges (no negative cycles) and is extremely simple: three nested loops over an $n \times n$ distance matrix.

Let `dist[i][j]` be the current best distance from $i$ to $j$. Initially `dist[i][j]` is the edge weight if an edge exists, 0 if $i=j$, otherwise infinity. Then for each intermediate vertex $k$ from 0 to $n-1$, we try to improve every pair $(i,j)$ by going through $k$:

```
dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
```

After all $k$, `dist[i][j]` is the shortest path distance. If `dist[i][i] < 0` for any $i$, there is a negative cycle.

Example: 3 vertices, edges 0→1 (2), 1→2 (3), 0→2 (10). Initial matrix:

```
  0  1  2
0 0  2  10
1 ∞  0  3
2 ∞  ∞  0
```

k=0: nothing improves (no paths into 0).
k=1: 0→2 via 1: 2+3=5 < 10 → update to 5.
k=2: no new improvements.
Final: 0→2 = 5.

Time $O(n^3)$, space $O(n^2)$. This is exactly the problem _Floyd Warshall_.

```python
from typing import List, Tuple

def floyd_warshall(n: int, edges: List[Tuple[int, int, int]]) -> List[List[float]]:
    """
    edges: (u, v, w) directed. Returns n x n matrix of shortest distances.
    Unreachable = inf. Negative cycle detected by dist[i][i] < 0.
    """
    INF = float('inf')
    dist = [[INF] * n for _ in range(n)]
    for i in range(n):
        dist[i][i] = 0
    for u, v, w in edges:
        dist[u][v] = min(dist[u][v], w)  # keep smallest if multi-edges
    for k in range(n):
        for i in range(n):
            if dist[i][k] == INF:
                continue
            for j in range(n):
                if dist[k][j] == INF:
                    continue
                nd = dist[i][k] + dist[k][j]
                if nd < dist[i][j]:
                    dist[i][j] = nd
    return dist

# Hand-checked example
edges = [(0, 1, 2), (1, 2, 3), (0, 2, 10)]
d = floyd_warshall(3, edges)
assert d[0][2] == 5
assert d[1][0] == float('inf')
assert d[0][0] == 0

# Negative cycle detection
edges2 = [(0, 1, 1), (1, 2, -1), (2, 0, -1)]
d2 = floyd_warshall(3, edges2)
assert d2[0][0] < 0
```

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
const ll INF = (1LL<<60);

vector<vector<ll>> floyd_warshall(int n, const vector<tuple<int,int,ll>>& edges) {
    vector<vector<ll>> dist(n, vector<ll>(n, INF));
    for (int i = 0; i < n; ++i) dist[i][i] = 0;
    for (auto [u, v, w] : edges) {
        dist[u][v] = min(dist[u][v], w);
    }
    for (int k = 0; k < n; ++k) {
        for (int i = 0; i < n; ++i) {
            if (dist[i][k] == INF) continue;
            for (int j = 0; j < n; ++j) {
                if (dist[k][j] == INF) continue;
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]);
            }
        }
    }
    return dist;
}
```

## 6.8 Check yourself

1. In the worked Dijkstra table, why did vertex 3 get picked before vertex 2 in step 3?
2. Give a tiny graph with a negative edge where Dijkstra gives the wrong answer.
3. In the minimum-effort variation, why does the algorithm still pick the vertex with the smallest current maximum?
4. How many rounds of Bellman-Ford are needed to guarantee all shortest paths are found if there are no negative cycles?
5. In Floyd-Warshall, what does a negative value on the diagonal `dist[i][i]` indicate?

# Chapter 7. Disjoint sets (union-find)

## 7.1 Groups that keep merging

Picture a school on the first day. Nobody knows anybody, so every student is in a group of one. As days pass, friendships form and groups merge: when Asha befriends Ben, Asha's whole group and Ben's whole group become one big group. At any moment we want to answer one question quickly: **are these two students in the same group?**

The data structure built for exactly this is called a **disjoint set union**, or **DSU**, and also **union-find**. "Disjoint" means that no student belongs to two groups at once. It supports two actions. `find(x)` tells us which group `x` is in, and `union(a, b)` merges the group of `a` with the group of `b`.

Graphs fit this picture perfectly. Vertices are the students, and an edge is a friendship that merges two groups. After adding some edges, the groups are exactly the connected components we met in Chapter 1.

## 7.2 The parent array

We give every group a **leader**, one chosen member who stands for the whole group. Every vertex stores a `parent`. A leader is its own parent. Everyone else points to someone closer to the leader, so following parents always ends at the leader. `find(x)` follows the parents until it meets a vertex that is its own parent. `union(a, b)` finds both leaders and makes one of them the parent of the other.

```python
def make_sets(n):
    return list(range(n))

def find(parent, x):
    while parent[x] != x:
        x = parent[x]
    return x

def union(parent, a, b):
    a, b = find(parent, a), find(parent, b)
    if a != b:
        parent[b] = a

parent = make_sets(5)
union(parent, 0, 1)
union(parent, 3, 4)
assert find(parent, 1) == find(parent, 0)
assert find(parent, 0) != find(parent, 3)
union(parent, 1, 4)
assert find(parent, 0) == find(parent, 3)
```

```cpp
vector<int> make_sets(int n) {
    vector<int> parent(n);
    iota(parent.begin(), parent.end(), 0);
    return parent;
}

int find(vector<int>& parent, int x) {
    while (parent[x] != x) x = parent[x];
    return x;
}

void unite(vector<int>& parent, int a, int b) {
    a = find(parent, a);
    b = find(parent, b);
    if (a != b) parent[b] = a;
}
```

This works, but it can become slow. If we keep attaching a long chain of vertices under each other, the chain grows tall, and every `find` has to walk along the whole chain. In the worst case one `find` costs $O(n)$.

## 7.3 Two tricks that make it fast

The first trick is **path compression**. After `find` has walked up to the leader, we make every vertex on the way point directly at the leader. The next `find` from any of them takes a single step. We pay a little extra now and save a lot later.

The second trick is **union by size**. When merging two groups, we hang the smaller group under the leader of the bigger one. That way the trees stay short, because a vertex only moves one level deeper when its group at least doubles in size, and that can happen only about $\log_2 n$ times.

Together, the two tricks make each operation take almost constant time, formally $O(\alpha(n))$, where $\alpha$ grows so slowly that it stays below 5 for any input you can ever store. We will treat each operation as $O(1)$. Below is the version we will use for the rest of this chapter. It also keeps the group sizes and the number of groups, and `union` tells us whether it actually merged two different groups.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n
        self.groups = n

    def find(self, x):
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b):
        a, b = self.find(a), self.find(b)
        if a == b:
            return False
        if self.size[a] < self.size[b]:
            a, b = b, a
        self.parent[b] = a
        self.size[a] += self.size[b]
        self.groups -= 1
        return True

d = DSU(6)
assert d.union(0, 1) and d.union(1, 2)
assert not d.union(0, 2)
assert d.groups == 4
assert d.size[d.find(0)] == 3
```

```cpp
struct DSU {
    vector<int> parent, size;
    int groups;

    DSU(int n) : parent(n), size(n, 1), groups(n) {
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        groups--;
        return true;
    }
};
```

## 7.4 Spotting cycles

The code in the rest of this chapter uses the `DSU` class from Section 7.3.

Here is the most useful fact about union-find. Suppose we add the edges of a graph one by one. If an edge joins two vertices that are **already in the same group**, then those two vertices were already connected by a path, and the new edge closes a **cycle**. If the edge joins two different groups, it just merges them. Our `union` function returns `False` exactly in the first case, so cycle detection is one line.

This is the heart of _Redundant Connection_. The input is a tree with one extra edge, and we must return the edge that can be removed, choosing the last one if there are several. We add the edges in the given order. The first edge whose ends are already in the same group is the one that closes the cycle, and it is the last edge of that cycle in the list.

```python
def first_cycle_edge(n, edges):
    dsu = DSU(n + 1)  # vertices are numbered from 1
    for a, b in edges:
        if not dsu.union(a, b):
            return [a, b]
    return None

assert first_cycle_edge(3, [[1, 2], [1, 3], [2, 3]]) == [2, 3]
assert first_cycle_edge(4, [[1, 2], [2, 3], [3, 4], [1, 4]]) == [1, 4]
assert first_cycle_edge(3, [[1, 2], [2, 3]]) is None
```

```cpp
vector<int> first_cycle_edge(int n, const vector<vector<int>>& edges) {
    DSU dsu(n + 1);
    for (auto& e : edges)
        if (!dsu.unite(e[0], e[1])) return e;
    return {};
}
```

_Is Graph a Tree_ asks whether a graph is connected and has no cycle. A tree on $n$ vertices has exactly $n-1$ edges, so we can check that the number of edges is $n-1$ and that every union succeeded (no cycle). Then the graph is connected too, because $n-1$ edges that never closed a cycle must have merged all $n$ vertices into one group.

_Connect the Network_ has a different flavour. We have $n$ computers and some cables, and we may move a cable that is not needed to join two separate groups. The number of groups tells us how many joins we need: to connect $g$ groups we need $g-1$ extra cables. The cables that closed a cycle during the union step are exactly the spare ones, so the answer is $g-1$ if at least that many spares exist, and $-1$ otherwise. Counting is even simpler: we need at least $n-1$ cables overall.

```python
def operations_to_connect(n, connections):
    if len(connections) < n - 1:
        return -1
    dsu = DSU(n)
    for a, b in connections:
        dsu.union(a, b)
    return dsu.groups - 1

assert operations_to_connect(4, [[0, 1], [0, 2], [1, 2]]) == 1
assert operations_to_connect(6, [[0, 1], [0, 2], [0, 3], [1, 2]]) == -1
assert operations_to_connect(3, [[0, 1], [1, 2]]) == 0
```

```cpp
int operations_to_connect(int n, const vector<vector<int>>& connections) {
    if ((int)connections.size() < n - 1) return -1;
    DSU dsu(n);
    for (auto& c : connections) dsu.unite(c[0], c[1]);
    return dsu.groups - 1;
}
```

## 7.5 Grouping by a rule

Union-find is not only for graphs that are given as edges. Whenever a rule says "these two things belong together", we can call `union` and let the groups form by themselves.

In _Satisfiability of Equality Equations_ every equation is either `a==b` or `a!=b`. Equal variables must be in the same group, so we first read all the `==` equations and union the two letters. After that, every `!=` equation must connect letters from different groups. If we ever see `a!=b` with `a` and `b` in the same group, the equations contradict each other.

```python
def equations_possible(equations):
    dsu = DSU(26)
    for eq in equations:
        if eq[1] == "=":
            dsu.union(ord(eq[0]) - 97, ord(eq[3]) - 97)
    for eq in equations:
        if eq[1] == "!" and dsu.find(ord(eq[0]) - 97) == dsu.find(ord(eq[3]) - 97):
            return False
    return True

assert equations_possible(["a==b", "b==c", "a==c"])
assert not equations_possible(["a==b", "b!=a"])
assert equations_possible(["a==b", "b!=c", "c==a"]) is False
```

```cpp
bool equations_possible(const vector<string>& equations) {
    DSU dsu(26);
    for (auto& eq : equations)
        if (eq[1] == '=') dsu.unite(eq[0] - 'a', eq[3] - 'a');
    for (auto& eq : equations)
        if (eq[1] == '!' && dsu.find(eq[0] - 'a') == dsu.find(eq[3] - 'a')) return false;
    return true;
}
```

In _Most Stones Removed_ a stone may be removed if another stone remains in its row or column. Stones that share a row or a column belong together, and the rule chains: a stone linked to a stone that is linked to a third one is in the same group. So we want the groups, and inside each group we can remove all stones but one. The trick that makes it easy is to turn each stone `(x, y)` into an edge between a "row vertex" `x` and a "column vertex" `y`. We shift the column numbers so they do not collide with row numbers, for example by using the vertex `y + 10001`. A group of stones becomes one group of rows and columns. The answer is the number of stones minus the number of groups that contain at least one stone.

```python
def removable_stones(stones):
    dsu = DSU(20002)
    used = set()
    for x, y in stones:
        dsu.union(x, y + 10001)
        used.add(x)
    roots = {dsu.find(x) for x in used}
    return len(stones) - len(roots)

assert removable_stones([[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]]) == 5
assert removable_stones([[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]) == 3
assert removable_stones([[0, 0]]) == 0
```

```cpp
int removable_stones(const vector<vector<int>>& stones) {
    DSU dsu(20002);
    set<int> used;
    for (auto& s : stones) {
        dsu.unite(s[0], s[1] + 10001);
        used.insert(s[0]);
    }
    set<int> roots;
    for (int x : used) roots.insert(dsu.find(x));
    return (int)stones.size() - (int)roots.size();
}
```

## 7.6 Sizes live at the leader

Our `DSU` keeps `size` at the leader of each group, so the size of the group of any vertex is `dsu.size[dsu.find(v)]`. This helps in _Making a Large Island_. The grid has water (`0`) and land (`1`), and we may turn one water cell into land. We want the largest island we can end up with.

First we group the land cells. For every land cell we union it with its land neighbours, so each island becomes one group, and its size is stored at its leader. Then we try every water cell. Looking at its four neighbours, we collect the **different** island leaders (a set removes duplicates, because one island can touch the water cell from two sides). Flipping this cell joins all those islands, plus the cell itself, so the new island has size $1 + {}$the sum of their sizes. The answer is the best value over all water cells, or the biggest existing island if there is no water.

```python
def largest_island(grid):
    n, m = len(grid), len(grid[0])
    dsu = DSU(n * m)
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for r in range(n):
        for c in range(m):
            if grid[r][c] == 1:
                for dr, dc in dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < n and 0 <= nc < m and grid[nr][nc] == 1:
                        dsu.union(r * m + c, nr * m + nc)
    best = max((dsu.size[dsu.find(r * m + c)]
                for r in range(n) for c in range(m) if grid[r][c] == 1), default=0)
    for r in range(n):
        for c in range(m):
            if grid[r][c] == 0:
                roots = set()
                for dr, dc in dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < n and 0 <= nc < m and grid[nr][nc] == 1:
                        roots.add(dsu.find(nr * m + nc))
                best = max(best, 1 + sum(dsu.size[x] for x in roots))
    return best

assert largest_island([[1, 0], [0, 1]]) == 3
assert largest_island([[1, 1], [1, 1]]) == 4
assert largest_island([[0, 0], [0, 0]]) == 1
```

```cpp
int largest_island(vector<vector<int>>& grid) {
    int n = grid.size(), m = grid[0].size();
    DSU dsu(n * m);
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    for (int r = 0; r < n; r++)
        for (int c = 0; c < m; c++)
            if (grid[r][c] == 1)
                for (int k = 0; k < 4; k++) {
                    int nr = r + dr[k], nc = c + dc[k];
                    if (nr >= 0 && nr < n && nc >= 0 && nc < m && grid[nr][nc] == 1)
                        dsu.unite(r * m + c, nr * m + nc);
                }
    int best = 0;
    for (int r = 0; r < n; r++)
        for (int c = 0; c < m; c++)
            if (grid[r][c] == 1) best = max(best, dsu.size[dsu.find(r * m + c)]);
    for (int r = 0; r < n; r++)
        for (int c = 0; c < m; c++)
            if (grid[r][c] == 0) {
                set<int> roots;
                for (int k = 0; k < 4; k++) {
                    int nr = r + dr[k], nc = c + dc[k];
                    if (nr >= 0 && nr < n && nc >= 0 && nc < m && grid[nr][nc] == 1)
                        roots.insert(dsu.find(nr * m + nc));
                }
                int total = 1;
                for (int x : roots) total += dsu.size[x];
                best = max(best, total);
            }
    return best;
}
```

The whole thing runs in about $O(nm)$ time, since every cell does a constant number of union and find calls.

## 7.7 Check yourself

1. Why does a `union` that returns `False` prove that the new edge closes a cycle?
2. In the parent-array version, what kind of input makes `find` slow, and which trick fixes it?
3. In _Connect the Network_, why is the answer the number of groups minus one, and when is it impossible?
4. In _Most Stones Removed_, why do we shift the column numbers by 10001 before calling `union`?

# Chapter 8. Minimum spanning trees

## 8.1 What a spanning tree is

Suppose a company must lay cables so that four offices are all connected, directly or through other offices. Every possible cable has a price. We do not need cables that loop around, because a loop wastes money: one of its cables could be removed and everyone would still be connected. So the cheapest plan is always a **tree**.

A **spanning tree** of a connected graph is a set of edges that touches every vertex, keeps the graph connected, and contains no cycle. For $n$ vertices it always uses exactly $n-1$ edges. A **minimum spanning tree**, or **MST**, is a spanning tree whose total weight is as small as possible. This is exactly the problem _Minimum Spanning Tree_. If the graph is not connected, no spanning tree exists.

There are two classic ways to build one, and both are greedy: they keep choosing the cheapest option that is safe.

## 8.2 Kruskal: cheapest edge first

**Kruskal's algorithm** looks at all edges from the cheapest to the most expensive. It takes an edge if it joins two vertices that are not yet connected, and skips it if it would close a cycle. We already have the perfect tool to check this: the union-find structure from Chapter 7, whose `DSU` class the code below uses. `union` returns `False` exactly when an edge would close a cycle.

Let us trace it on four vertices 0, 1, 2, 3 with the edges (0,1) weight 1, (1,2) weight 2, (0,2) weight 3, (2,3) weight 4 and (1,3) weight 5. Sorted by weight, the order is already the order we listed them.

We take (0,1): the groups were {0}, {1}, so it joins them. We take (1,2): it joins {0,1} with {2}. Next is (0,2) with weight 3, but 0 and 2 are already in the same group, so this edge would close a cycle and we skip it. We take (2,3): it joins {0,1,2} with {3}. Now we have $3 = n-1$ edges, so we stop. The tree is (0,1), (1,2), (2,3) with total weight $1+2+4=7$.

```python
def kruskal(n, edges):
    dsu = DSU(n)
    total = 0
    for a, b, w in sorted(edges, key=lambda e: e[2]):
        if dsu.union(a, b):
            total += w
    return total if dsu.groups == 1 else -1

edges = [[0, 1, 1], [1, 2, 2], [0, 2, 3], [2, 3, 4], [1, 3, 5]]
assert kruskal(4, edges) == 7
assert kruskal(4, [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 10], [0, 2, 5]]) == 6
assert kruskal(4, [[0, 1, 1], [2, 3, 1]]) == -1
assert kruskal(1, []) == 0
```

```cpp
long long kruskal(int n, vector<vector<int>> edges) {
    sort(edges.begin(), edges.end(), [](auto& x, auto& y) { return x[2] < y[2]; });
    DSU dsu(n);
    long long total = 0;
    for (auto& e : edges)
        if (dsu.unite(e[0], e[1])) total += e[2];
    return dsu.groups == 1 ? total : -1;
}
```

(The `DSU` class is the one from Chapter 7.) Sorting the $m$ edges costs $O(m \log m)$ and the union-find work is almost free, so Kruskal runs in $O(m \log m)$ time. At the end, if more than one group is left, the graph was not connected and we return $-1$.

## 8.3 Prim: grow one tree

**Prim's algorithm** works differently. It starts from one vertex and grows a single tree. At every step it looks at all edges that leave the tree, picks the cheapest one, and adds the new vertex at its other end. To find the cheapest leaving edge quickly we use a **min-heap**, a structure that always hands us the smallest item first.

Let us use the same graph and start at vertex 0. The edges leaving $\{0\}$ are (0,1) with weight 1 and (0,2) with weight 3. The cheapest is (0,1), so vertex 1 joins the tree. Now the leaving edges are (0,2) weight 3, (1,2) weight 2 and (1,3) weight 5. The cheapest is (1,2), so vertex 2 joins. The leaving edges are now (2,3) weight 4 and (1,3) weight 5, and the edge (0,2) leads back into the tree, so it is ignored. We take (2,3) with weight 4. Total: $1+2+4=7$, the same tree as before.

```python
import heapq

def prim(n, edges):
    adj = [[] for _ in range(n)]
    for a, b, w in edges:
        adj[a].append((w, b))
        adj[b].append((w, a))
    seen = [False] * n
    heap = [(0, 0)]
    total = 0
    count = 0
    while heap:
        w, v = heapq.heappop(heap)
        if seen[v]:
            continue
        seen[v] = True
        total += w
        count += 1
        for item in adj[v]:
            if not seen[item[1]]:
                heapq.heappush(heap, item)
    return total if count == n else -1

edges = [[0, 1, 1], [1, 2, 2], [0, 2, 3], [2, 3, 4], [1, 3, 5]]
assert prim(4, edges) == 7
assert prim(4, [[0, 1, 1], [2, 3, 1]]) == -1
assert prim(1, []) == 0
```

```cpp
long long prim(int n, const vector<vector<int>>& edges) {
    vector<vector<pair<int, int>>> adj(n);
    for (auto& e : edges) {
        adj[e[0]].push_back({e[2], e[1]});
        adj[e[1]].push_back({e[2], e[0]});
    }
    vector<bool> seen(n, false);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;
    pq.push({0, 0});
    long long total = 0;
    int count = 0;
    while (!pq.empty()) {
        auto [w, v] = pq.top();
        pq.pop();
        if (seen[v]) continue;
        seen[v] = true;
        total += w;
        count++;
        for (auto [w2, u] : adj[v])
            if (!seen[u]) pq.push({w2, u});
    }
    return count == n ? total : -1;
}
```

With the heap, Prim runs in $O(m \log m)$ time, the same as Kruskal. As a rule of thumb, Kruskal is easier when the edges come as a list, and Prim is nicer when the graph is dense.

## 8.4 Why the greedy choice is safe

Why can we trust "always take the cheapest edge"? Here is the idea. Split the vertices into two non-empty groups, any way you like. At least one edge of the final tree must cross between the two groups, or the tree would not connect them. If you look at the cheapest edge crossing the split, there is always a minimum spanning tree that contains it: if some tree used a more expensive crossing edge instead, swapping it for the cheaper one keeps the tree connected and does not cost more. Kruskal and Prim are both just two ways of repeatedly picking such a safe edge.

## 8.5 Points on a plane

In _Min Cost to Connect All Points_ we get points on a plane, and connecting two points costs their **Manhattan distance**, $|x_1-x_2|+|y_1-y_2|$. Any two points can be connected, so the graph has an edge between every pair. With $n$ points that is about $n^2/2$ edges, so building and sorting them all for Kruskal costs $O(n^2 \log n)$.

For a graph with so many edges, Prim without a heap is nicer. We keep, for every point not yet in the tree, the cheapest distance to the tree so far. At each step we take the point with the smallest value and then update the others. This needs only $O(n^2)$ time and $O(n)$ space, because we never store the edges at all.

```python
def min_cost_connect(points):
    n = len(points)
    INF = float("inf")
    best = [INF] * n
    best[0] = 0
    used = [False] * n
    total = 0
    for _ in range(n):
        v = -1
        for i in range(n):
            if not used[i] and (v == -1 or best[i] < best[v]):
                v = i
        used[v] = True
        total += best[v]
        for u in range(n):
            if not used[u]:
                d = abs(points[v][0] - points[u][0]) + abs(points[v][1] - points[u][1])
                if d < best[u]:
                    best[u] = d
    return total

assert min_cost_connect([[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]) == 20
assert min_cost_connect([[3, 12], [-2, 5], [-4, 1]]) == 18
assert min_cost_connect([[0, 0]]) == 0
```

```cpp
int min_cost_connect(const vector<vector<int>>& points) {
    int n = points.size();
    vector<int> best(n, INT_MAX);
    vector<bool> used(n, false);
    best[0] = 0;
    int total = 0;
    for (int step = 0; step < n; step++) {
        int v = -1;
        for (int i = 0; i < n; i++)
            if (!used[i] && (v == -1 || best[i] < best[v])) v = i;
        used[v] = true;
        total += best[v];
        for (int u = 0; u < n; u++)
            if (!used[u]) {
                int d = abs(points[v][0] - points[u][0]) + abs(points[v][1] - points[u][1]);
                best[u] = min(best[u], d);
            }
    }
    return total;
}
```

## 8.6 Check yourself

1. How many edges does a spanning tree of a connected graph with 10 vertices have?
2. In Kruskal's algorithm, what does it mean when `union` returns `False`, and what do we do with the edge?
3. In the trace of Prim above, why was the edge (0,2) ignored once vertices 0 and 2 were both in the tree?
4. Why is Prim without a heap a good choice when every pair of points is connected?

# Chapter 9. Bridges, cut vertices and strongly connected components

## 9.1 Bridges and cut vertices

Imagine a map of towns connected by roads. A **bridge** is a road that, if it closes, leaves some pair of towns with no path between them. A **cut vertex** (also called an articulation point) is a town that, if it disappears along with all roads touching it, splits the map into more pieces than before. Finding these weak spots is exactly the problem _Critical Connections_ for bridges and _Articulation Points_ for cut vertices.

Both problems live on undirected graphs. We will use a depth first search that numbers each vertex with the moment we first arrive. That number is called the **entry time** `tin[v]`. We also keep a second number `low[v]`: the earliest entry time we can reach from `v` by walking down the DFS tree and then taking at most one back edge (an edge that goes to an ancestor in the DFS tree). If a child `to` of `v` has `low[to] > tin[v]`, then the edge `(v, to)` is a bridge — nothing from `to`'s subtree reaches `v` or above except that edge. For a cut vertex (not the root), if some child `to` has `low[to] >= tin[v]`, then `v` is an articulation point — removing `v` separates `to`'s subtree from the rest. The root is special: it is a cut vertex only when it has more than one child in the DFS tree.

Both algorithms run in $O(n+m)$ time and $O(n)$ space, where $n$ is the number of vertices and $m$ the number of edges.

Let's trace a tiny graph by hand before we write code.

```
0 -- 1 -- 2
|    |
3 -- 4
```

Vertices 0..4. Edges: (0,1), (1,2), (0,3), (3,4), (1,4). Start DFS at 0.

- Visit 0: `tin[0]=0`, `low[0]=0`.
- Go to 1: `tin[1]=1`, `low[1]=1`.
- Go to 2: `tin[2]=2`, `low[2]=2`. Backtrack: `low[1]=min(1,2)=1`. Edge (1,2) has `low[2]=2 > tin[1]=1` → bridge.
- From 1 go to 4: `tin[4]=3`, `low[4]=3`.
- From 4 go to 3: `tin[3]=4`, `low[3]=4`.
- From 3 see 0 (already visited, not parent): `low[3]=min(4,0)=0`. Backtrack: `low[4]=min(3,0)=0`. Backtrack: `low[1]=min(1,0)=0`.
- Edge (0,1) has `low[1]=0 ≤ tin[0]=0` → not a bridge.
- Vertex 1 is not root; child 2 gave `low[2]=2 ≥ tin[1]=1` → 1 is a cut vertex. Child 4 gave `low[4]=0 < tin[1]=1` → does not make 1 a cut vertex again.
- Root 0 has only one child (1) → not a cut vertex.

Bridges: (1,2). Cut vertices: 1.

```python
def find_bridges_and_cut_vertices(n, adj):
    timer = 0
    tin = [-1] * n
    low = [-1] * n
    visited = [False] * n
    is_cut = [False] * n
    bridges = []

    def dfs(v, p):
        nonlocal timer
        visited[v] = True
        tin[v] = low[v] = timer
        timer += 1
        children = 0
        for to in adj[v]:
            if to == p:
                continue
            if visited[to]:
                low[v] = min(low[v], tin[to])
            else:
                dfs(to, v)
                low[v] = min(low[v], low[to])
                if low[to] > tin[v]:
                    bridges.append((v, to))
                if low[to] >= tin[v] and p != -1:
                    is_cut[v] = True
                children += 1
        if p == -1 and children > 1:
            is_cut[v] = True

    for i in range(n):
        if not visited[i]:
            dfs(i, -1)
    return bridges, [i for i, v in enumerate(is_cut) if v]

# test on the traced graph
n = 5
adj = [[] for _ in range(n)]
edges = [(0,1),(1,2),(0,3),(3,4),(1,4)]
for u,v in edges:
    adj[u].append(v)
    adj[v].append(u)
bridges, cuts = find_bridges_and_cut_vertices(n, adj)
assert bridges == [(1,2)]
assert cuts == [1]
```

```cpp
vector<int> tin, low;
vector<bool> visited, is_cut;
vector<pair<int,int>> bridges;
int timer = 0;

void dfs(int v, int p, const vector<vector<int>>& adj) {
    visited[v] = true;
    tin[v] = low[v] = timer++;
    int children = 0;
    for (int to : adj[v]) {
        if (to == p) continue;
        if (visited[to]) {
            low[v] = min(low[v], tin[to]);
        } else {
            dfs(to, v, adj);
            low[v] = min(low[v], low[to]);
            if (low[to] > tin[v])
                bridges.emplace_back(v, to);
            if (low[to] >= tin[v] && p != -1)
                is_cut[v] = true;
            children++;
        }
    }
    if (p == -1 && children > 1)
        is_cut[v] = true;
}

pair<vector<pair<int,int>>, vector<int>> find_bridges_and_cut_vertices(int n, const vector<vector<int>>& adj) {
    timer = 0;
    tin.assign(n, -1);
    low.assign(n, -1);
    visited.assign(n, false);
    is_cut.assign(n, false);
    bridges.clear();
    for (int i = 0; i < n; ++i)
        if (!visited[i])
            dfs(i, -1, adj);
    vector<int> cuts;
    for (int i = 0; i < n; ++i)
        if (is_cut[i]) cuts.push_back(i);
    return {bridges, cuts};
}
```

## 9.2 Entry times and low-link values

The `tin` array is simply a counter that increases each time we first step onto a vertex. The `low` value of a vertex `v` is the smallest `tin` we can see from `v` by going down zero or more tree edges and then possibly one back edge. In the trace above, vertex 3 saw vertex 0 through the back edge (3,0), so `low[3]` became 0. That information bubbled up: `low[4]` became 0, then `low[1]` became 0. Because `low[1]` dropped to 0, the edge (0,1) is not a bridge — there is an alternative route from 1's side back to 0.

Think of `low` as "the highest ancestor (earliest entry time) my subtree can touch". If a child's `low` is strictly greater than my `tin`, my child's subtree cannot touch me or my ancestors — the edge to that child is a bridge. If a child's `low` is at least my `tin`, my child's subtree cannot escape above me — I am a cut vertex (unless I am the root).

## 9.3 Critical connections and articulation points

The code in the previous section already solves both _Critical Connections_ (collect every edge where `low[to] > tin[v]`) and _Articulation Points_ (collect every vertex `v` where the condition holds). The root rule (a root is a cut vertex only when it has more than one DFS child) is handled in the same pass.

Time: $O(n+m)$. Space: $O(n)$ for the arrays plus recursion stack.

## 9.4 Strongly connected components

Now switch to directed graphs. A **strongly connected component** (SCC) is a maximal set of vertices where every vertex can reach every other vertex following the directed edges. The problem _Strongly Connected Components_ asks for all SCCs. Kosaraju's algorithm finds them in two DFS passes.

First pass: run DFS on the original graph, pushing each vertex onto a list `order` when we finish it (exit time). This gives vertices in increasing exit time. Second pass: reverse every edge to get the transpose graph. Process vertices from `order` in reverse (decreasing exit time). Each DFS on the transpose graph starting from an unvisited vertex collects exactly one SCC. The reason: the first vertex we pick from `order` lies in a "source" SCC of the condensation graph (no incoming edges from other SCCs). In the transpose graph that SCC becomes a "sink" — DFS cannot leave it.

Let us trace Kosaraju on a small graph with the edges 0 → 1, 1 → 2, 2 → 0, 2 → 3, 3 → 4 and 4 → 3. The vertices 0, 1, 2 form one loop and the vertices 3, 4 form another, so there are two components, and the single edge 2 → 3 leads from the first into the second.

First pass: start the DFS at 0. We go 0 → 1 → 2, and from 2 we skip 0 (already seen) and go on to 3 and 4. Vertex 4 finishes first, then 3, then 2, then 1, then 0. The finishing order is `[4, 3, 2, 1, 0]`.

Second pass: reverse every edge, so we now have 1 → 0, 2 → 1, 0 → 2, 3 → 2, 4 → 3 and 3 → 4. Take the vertices in the reverse of the finishing order, which is 0, 1, 2, 3, 4. A DFS from 0 reaches 2 and 1 and then gets stuck, because the only edge that leaves their group in the original graph (2 → 3) now points the other way. So the first component is {0, 1, 2}. The next unvisited vertex is 3, and its DFS reaches 4, giving the component {3, 4}.

```python
def kosaraju_scc(n, adj):
    visited = [False] * n
    order = []

    def dfs1(v):
        visited[v] = True
        for to in adj[v]:
            if not visited[to]:
                dfs1(to)
        order.append(v)

    for i in range(n):
        if not visited[i]:
            dfs1(i)

    # transpose
    adj_rev = [[] for _ in range(n)]
    for v in range(n):
        for to in adj[v]:
            adj_rev[to].append(v)

    visited = [False] * n
    comps = []

    def dfs2(v, comp):
        visited[v] = True
        comp.append(v)
        for to in adj_rev[v]:
            if not visited[to]:
                dfs2(to, comp)

    for v in reversed(order):
        if not visited[v]:
            comp = []
            dfs2(v, comp)
            comps.append(comp)
    return comps

# test on the example
n = 6
adj = [[] for _ in range(n)]
edges = [(0,1),(1,2),(2,3),(3,0),(1,4),(4,1),(2,5)]
for u,v in edges:
    adj[u].append(v)
comps = kosaraju_scc(n, adj)
# sort each component and the list for stable comparison
comps = [sorted(c) for c in comps]
comps.sort()
assert comps == [[0,1,2,3,4], [5]]
```

```cpp
vector<int> order;
vector<bool> visited;

void dfs1(int v, const vector<vector<int>>& adj) {
    visited[v] = true;
    for (int to : adj[v])
        if (!visited[to])
            dfs1(to, adj);
    order.push_back(v);
}

void dfs2(int v, const vector<vector<int>>& adj_rev, vector<int>& comp) {
    visited[v] = true;
    comp.push_back(v);
    for (int to : adj_rev[v])
        if (!visited[to])
            dfs2(to, adj_rev, comp);
}

vector<vector<int>> kosaraju_scc(int n, const vector<vector<int>>& adj) {
    visited.assign(n, false);
    order.clear();
    for (int i = 0; i < n; ++i)
        if (!visited[i])
            dfs1(i, adj);

    vector<vector<int>> adj_rev(n);
    for (int v = 0; v < n; ++v)
        for (int to : adj[v])
            adj_rev[to].push_back(v);

    visited.assign(n, false);
    vector<vector<int>> comps;
    for (int i = n - 1; i >= 0; --i) {
        int v = order[i];
        if (!visited[v]) {
            vector<int> comp;
            dfs2(v, adj_rev, comp);
            comps.push_back(comp);
        }
    }
    return comps;
}
```

Time: $O(n+m)$ for two DFS passes plus building the transpose. Space: $O(n+m)$.

## 9.5 Minimum height trees

A **tree** is an undirected connected graph with no cycles. The height of a rooted tree is the maximum distance from the root to any leaf. The problem _Minimum Height Trees_ asks for all roots that give the smallest possible height. The answer is always the one or two middle vertices of any longest path (diameter). We can find them by repeatedly peeling off leaves: put all current leaves in a queue, remove them, and their neighbours may become new leaves. Repeat until at most two vertices remain. Those are the centres.

Example: path 0-1-2-3-4. Leaves: 0 and 4. Remove them, left with 1-2-3. Leaves: 1 and 3. Remove them, left with 2. Centre: [2]. Path 0-1-2-3. Leaves: 0,3 → remove → 1,2 remain. Centres: [1,2].

```python
from collections import deque

def find_min_height_trees(n, edges):
    if n == 1:
        return [0]
    adj = [[] for _ in range(n)]
    deg = [0] * n
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
        deg[u] += 1
        deg[v] += 1
    leaves = deque([i for i in range(n) if deg[i] == 1])
    remaining = n
    while remaining > 2:
        sz = len(leaves)
        remaining -= sz
        for _ in range(sz):
            leaf = leaves.popleft()
            for nei in adj[leaf]:
                deg[nei] -= 1
                if deg[nei] == 1:
                    leaves.append(nei)
    return list(leaves)

# test
assert find_min_height_trees(5, [(0,1),(1,2),(2,3),(3,4)]) == [2]
assert sorted(find_min_height_trees(4, [(0,1),(1,2),(2,3)])) == [1,2]
```

```cpp
vector<int> findMinHeightTrees(int n, const vector<vector<int>>& edges) {
    if (n == 1) return {0};
    vector<vector<int>> adj(n);
    vector<int> deg(n, 0);
    for (auto& e : edges) {
        adj[e[0]].push_back(e[1]);
        adj[e[1]].push_back(e[0]);
        deg[e[0]]++; deg[e[1]]++;
    }
    queue<int> leaves;
    for (int i = 0; i < n; ++i)
        if (deg[i] == 1) leaves.push(i);
    int remaining = n;
    while (remaining > 2) {
        int sz = leaves.size();
        remaining -= sz;
        for (int i = 0; i < sz; ++i) {
            int leaf = leaves.front(); leaves.pop();
            for (int nei : adj[leaf]) {
                if (--deg[nei] == 1)
                    leaves.push(nei);
            }
        }
    }
    vector<int> ans;
    while (!leaves.empty()) {
        ans.push_back(leaves.front());
        leaves.pop();
    }
    return ans;
}
```

Time: $O(n)$. Space: $O(n)$.

## 9.6 Check yourself

1. In the bridge algorithm, why does `low[to] > tin[v]` mean the edge `(v,to)` is a bridge?
2. Why is the root of the DFS tree a cut vertex only when it has more than one child?
3. In Kosaraju's algorithm, why do we run the second DFS on the transpose graph in reverse order of exit times?
4. For a tree that is a simple path of 6 vertices, how many centres does the leaf-peeling algorithm return, and which vertices are they?

# Chapter 10. DP on directed acyclic graphs

In Section 1.5 we saw that every DP is secretly a DAG. In this chapter we meet the opposite situation: the DAG is given to us as a graph, and the DP runs over its vertices. This is the cleanest setting for graph DP, and everything later (trees, cycles) is a reduction to it.

## 10.1 Longest path in a DAG

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

## 10.2 Topological order and bottom-up DP

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

## 10.3 Counting paths and other aggregations

The structure "combine the answers of all successors" works with any combining operation. If we want the number of different paths from $v$ to a target $t$, we sum:

$$\text{ways}(v)=\begin{cases}1 & v=t,\\ \sum_{(v,u)\in E}\text{ways}(u)&\text{otherwise,}\end{cases}$$

usually modulo a prime. If we want the cheapest path with edge costs, we take a minimum of $c(v,u)+\text{best}(u)$. If we want to know whether some path of a certain kind exists, we take a logical OR. The skeleton is always the same: _state = vertex, transition = fold over outgoing edges, order = reverse topological_.

Two practical remarks. First, the DP needs states to be "complete": if the problem has additional requirements (for example "the path must pass through exactly three special vertices"), you add that information to the state, so the state becomes $(v,\text{number of special vertices passed})$. This is the first appearance of an idea that dominates later chapters: **enrich the state until the future depends only on the state**. Second, to print the path rather than just its length, store for each vertex the successor that attained the optimum and follow these pointers.

## 10.4 Shortest paths as dynamic programming

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

**Dijkstra.** The DP formulation is $d(v)=\min_{(u,v)\in E}(d(u)+w(u,v))$, which on a graph with cycles has circular dependencies. Dijkstra's algorithm resolves the difficulty by _discovering_ a valid order on the fly. When all weights are non-negative, the unfinished vertex with the smallest tentative distance already has its final distance (no other path can sneak in with a smaller one), so we can finalize it, and then every state it feeds gets updated. The priority queue is simply the device that picks the next state in a valid order. The same observation, that Dijkstra produces an order in which DP may be run, is used in Chapter 7.

## 10.5 The shortest-path DAG

Take a graph with **positive** weights and compute the distances $d(\cdot)$ from the source. Keep only those edges $(u,v)$ with $d(u)+w(u,v)=d(v)$, the edges that can lie on some shortest path. The resulting graph is a DAG, even if the original had cycles, because along every kept edge $d$ strictly increases (since $w>0$), and a cycle would force it to come back to its starting value.

Many questions about shortest paths now become DP on this DAG: counting the shortest paths, finding the shortest path with the fewest edges among all shortest ones, determining which vertices lie on at least one shortest path, and so on. For example, the number of shortest paths $\text{cnt}(v)$ is $\sum\text{cnt}(u)$ over kept edges $(u,v)$ with $\text{cnt}(s)=1$, evaluated in increasing order of $d$.

## 10.6 Exercises for this chapter

AtCoder Educational DP Contest problem G (Longest Path); CSES _Longest Flight Route_ and _Game Routes_; CSES _Shortest Routes I_ and _II_; CSES _High Score_ (longest path, with the twist of detecting positive cycles reachable on a route to the target).

---

# Chapter 11. Graphs with cycles

Everything so far required the state graph to be acyclic. Real graphs often contain cycles, and then the recurrences become circular: the value at $A$ depends on $B$, which depends on $A$. There are four standard ways out, and a strong graph-DP solver knows them all.

## 11.1 Strategy one: collapse every cycle (strongly connected components)

A **strongly connected component (SCC)** is a maximal set of vertices in which every vertex can reach every other. Two vertices lie in the same SCC exactly when they lie on a common directed cycle. If we **contract** every SCC into a single super-vertex, the resulting graph (the **condensation**) has no cycles. Indeed, a cycle among super-vertices would have merged them into one component. So the condensation is a DAG, and everything from Chapter 3 applies to it.

This is the right tool whenever the question is insensitive to what happens inside a cycle. A classical example: each room has some coins, you walk along one-way corridors, and you may revisit rooms (but collect the coins in a room only once). Inside an SCC you can reach every room, so you can collect all coins there. The value of a component is therefore the sum of its coins, and the problem becomes "find the most valuable path in the DAG of components".

**Finding SCCs with Kosaraju's algorithm.** Run a DFS on the graph and record the vertices in the order in which their DFS calls **finish**. Then process the vertices in **decreasing** finishing time, running DFS on the _reversed_ graph; each tree found by these searches is one SCC.

Why does this work? Consider two components $A$ and $B$ with an edge from $A$ to $B$ in the original graph. The last vertex to finish in $A\cup B$ always belongs to $A$: if the first DFS enters $A$ first, it will still be running in $A$ when it discovers and fully explores $B$, so $A$'s first vertex finishes later than everything in $B$; if it enters $B$ first, it finishes all of $B$ without ever reaching $A$ (there is no edge back), and $A$ finishes later. So decreasing finish order lists components in a topological order of the condensation: the first vertex is in a source component. In the reversed graph, the edges leaving that component now point _into_ it, so a DFS from its vertex cannot escape to any other unvisited component, and it collects exactly one SCC. Repeating this peels the components off one at a time.

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

## 11.2 Strategy two: let Dijkstra supply the order

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

## 11.3 Strategy three: unroll the cycle into the state

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

This pattern, called a **layered graph** or product graph, is enormously general. A state like (vertex, remaining fuel), (vertex, number of tickets), (vertex, parity of steps), (vertex, last color used), or (vertex, set of keys held) turns a problem on a graph with side constraints into an ordinary shortest-path or DP problem on a bigger graph. The price is the size of the state space, so the art is to choose the _smallest_ extra information that makes the future independent of the past.

## 11.4 Strategy four: matrix exponentiation for counting walks

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

## 11.5 Functional graphs

A **functional graph** is a directed graph in which every vertex has exactly one outgoing edge, that is, it is the graph of a function $f:[n]\to[n]$. Each connected component consists of exactly one cycle with trees hanging into it. Typical questions: where do we end up after $k$ applications of $f$, how long before we enter a cycle, how long is the cycle.

For "where after $k$ steps" we use **binary lifting**: let $up[j][v]$ be the vertex reached from $v$ after $2^j$ steps. Then $up[0]=f$ and $up[j][v]=up[j-1][up[j-1][v]]$, and to take $k$ steps we combine the powers of two present in the binary representation of $k$, in $O(\log k)$ time per query after $O(n\log k)$ preprocessing. The memory can be reduced using the cycle structure but this is usually unnecessary. Many "tree with cycle" problems are handled by running ordinary tree DP on the trees hanging into the cycle and then dealing with the cycle separately with prefix sums.

## 11.6 Exercises for this chapter

CSES _Coin Collector_, _Planets and Kingdoms_, _Giant Pizza_ (SCC and 2-SAT); CSES _Investigation_ (counting shortest paths); CSES _Flight Discount_; CSES _Planets Cycles_ and _Planet Queries I_ (functional graphs); CSES _Graph Paths I_ (matrix power).

---

# Sources and credit

Chapters 1 to 9 adapt ideas from the graph articles at [cp-algorithms.com](https://cp-algorithms.com) (breadth-first search, depth-first search, 0-1 BFS, connected components, bipartite check, finding cycles, topological sorting, Dijkstra, Bellman-Ford, Floyd-Warshall, disjoint set union, Kruskal, Prim, bridges, cut points and strongly connected components). The text here is rewritten for beginners. Like the original, it is shared under the Creative Commons Attribution-ShareAlike 4.0 licence.
