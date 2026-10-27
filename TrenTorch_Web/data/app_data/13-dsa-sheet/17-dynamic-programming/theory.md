> Every code block has a Python and a C++ version; use the switch above a block to pick one. Your choice is remembered.

# Introduction (Dynamic programming)

This document teaches dynamic programming from the very first idea to the techniques used in the hardest contests. It assumes only that you can write a loop and a recursive function in C++. Nothing else is needed.

The course is built like a staircase. **Chapter 1 is deliberately gentle**: no heavy math, just the core idea explained with small examples. Chapter 2 adds the classical problems. From Chapter 3 on we move to graphs (DAGs, trees, subsets, cycles), and the mathematics becomes gradually heavier, with proofs and complexity arguments. The last chapters cover expert tools. If you are new, read in order and do not worry when later chapters look harder: every chapter only uses what came before.

All code is C++17 and uses `using ll = long long;`.

---

# Chapter 1. The core idea of dynamic programming

## 1.1 A recursion that is far too slow

Start with the Fibonacci numbers. Each number is the sum of the two before it: 0, 1, 1, 2, 3, 5, 8, 13, 21, ... Written as a function, the rule is $F(n)=F(n-1)+F(n-2)$ with $F(0)=0$ and $F(1)=1$.

The rule is already a recursive program, so the most natural thing is to type it in directly:

```python
def F(n):
    if n <= 1:
        return n
    return F(n - 1) + F(n - 2)
```

```cpp
ll F(int n) {
    if (n <= 1) return n;
    return F(n - 1) + F(n - 2);
}
```

It is correct, and it is terribly slow. Try it on $n=50$ and it will run for minutes or hours. To see why, look at what happens when we ask for $F(5)$. Every call asks two smaller questions, so the calls form a tree:

```
                          F(5)
                  /                  \
              F(4)                    F(3)
            /      \                 /     \
         F(3)      F(2)           F(2)     F(1)
        /    \     /   \          /   \
     F(2)  F(1)  F(1) F(0)     F(1)  F(0)
     /  \
  F(1) F(0)
```

Look closely: $F(3)$ appears twice, $F(2)$ appears three times, and $F(1)$ five times. The program keeps solving the same small questions again and again, and every extra level of the tree doubles the amount of repetition. The number of calls grows like this:

| n | number of calls |
|---|---|
| 10 | 177 |
| 20 | 21,891 |
| 30 | about 2.7 million |
| 40 | about 331 million |

The work roughly multiplies by 1.6 each time $n$ grows by one. This is called **exponential** growth, and it is the enemy of all fast programs.

But notice something. To compute $F(50)$ we only ever need the answers to 51 different questions: $F(0), F(1), \dots, F(50)$. The program is slow not because the problem is hard, but because it forgets what it already knows.

## 1.2 The fix: write the answer down

Here is the whole idea of dynamic programming in one sentence:

> **If you have already solved a subproblem, do not solve it again. Write the answer down and look it up next time.**

We add a notebook (an array) to the function. Before computing, check the notebook. After computing, write the result in it.

```python
memo = [0] * 100
done = [False] * 100

def F(n):
    if n <= 1:
        return n
    if done[n]:
        return memo[n]      # already solved: just read it
    done[n] = True
    memo[n] = F(n - 1) + F(n - 2)
    return memo[n]
```

```cpp
ll memo[100];
bool done[100];

ll F(int n) {
    if (n <= 1) return n;
    if (done[n]) return memo[n];      // already solved: just read it
    done[n] = true;
    return memo[n] = F(n - 1) + F(n - 2);
}
```

Now each $F(k)$ is really computed only once. The first time a value is needed, we do a tiny amount of work. Every later request is answered immediately from the notebook. For $F(50)$ the number of calls drops from tens of billions to around a hundred, and the program finishes instantly.

This trick is called **memoization**. (The word is *memoization*, as in writing a memo, not "memorization".) A recursive solution that uses memoization is called **top-down dynamic programming**: we start from the big question and let the recursion break it into smaller ones.

## 1.3 Three questions to ask about every DP

All dynamic programming solutions, from the simplest to the hardest, are built from the same three ingredients. When you see a new problem, learn to answer these questions before writing any code.

**What is the state?** A *state* is a small description of one subproblem, enough to know exactly which question we are asking. For Fibonacci the state is just the number $n$. Later, states will be things like "position $i$ and money left $m$", or "tree vertex $v$", or "set of cities already visited and the city I am in".

**What is the transition?** The *transition* says how to get the answer of a state from the answers of smaller states. For Fibonacci: the answer for $n$ is the answer for $n-1$ plus the answer for $n-2$.

**In which order, and where does it stop?** Smaller states must be answered before bigger ones that need them, and there must be simple *base cases* that need no further help (for Fibonacci, $n=0$ and $n=1$). The dependencies must never go in a circle: if state $A$ needs $B$, then $B$ must not need $A$.

Once you have these three, the running time is easy to estimate:

> **time ≈ (number of states) × (work done per state)**

For Fibonacci that is about $n$ states with a tiny amount of work each, so the time is proportional to $n$. Whenever you wonder "is my DP fast enough?", compute this product first.

## 1.4 Bottom-up: the same thing with a loop

Instead of recursion, we can fill the notebook ourselves, starting from the smallest states and moving up. This is called **bottom-up dynamic programming**:

```python
dp = [0] * 100
dp[0] = 0
dp[1] = 1
for i in range(2, n + 1):
    dp[i] = dp[i - 1] + dp[i - 2]
```

```cpp
ll dp[100];
dp[0] = 0; dp[1] = 1;
for (int i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
```

Both styles do the same work. Top-down is usually easier to write, because the recursion automatically finds a good order. Bottom-up is a little faster, avoids deep recursion, and makes it easy to save memory. For Fibonacci only the last two values are ever needed, so the whole table can be replaced by two variables:

```python
def fib(n):
    a, b = 0, 1                      # F(0), F(1)
    for i in range(2, n + 1):
        c = a + b
        a = b
        b = c
    # b is now F(n)
    return b
```

```cpp
ll a = 0, b = 1;                      // F(0), F(1)
for (int i = 2; i <= n; i++) { ll c = a + b; a = b; b = c; }
// b is now F(n)
```

A good habit: think top-down first (it matches how you think about the problem), and convert to bottom-up if you need more speed.

## 1.5 A picture to remember: the map of states

Imagine drawing a dot for every state, and an arrow from state $B$ to state $A$ whenever computing $A$ needs the answer of $B$. You get a map of dots and arrows. The rule "no circular dependencies" simply means this map has no loop that comes back to where it started. A map of this kind is called a **DAG** (directed acyclic graph).

So a DP is really a walk over a map of states in a sensible order. In this course we will meet many problems where this map is given to us as part of the input, for example a graph or a tree. Then DP on that graph is exactly the idea you have just learned. You do not need to remember more than this for now.

## 1.6 Your first real problems

### Climbing stairs

You are climbing a staircase with $n$ steps. Each move goes up one step or two steps. In how many different ways can you reach the top?

Think about the last move. You arrived at step $n$ either from step $n-1$ (a one-step move) or from step $n-2$ (a two-step move). So the number of ways to reach step $n$ is the sum of the ways to reach those two steps. That is exactly the Fibonacci rule again:

- **State:** $ways[i]$ = number of ways to reach step $i$.
- **Transition:** $ways[i] = ways[i-1] + ways[i-2]$.
- **Order and base:** go from small $i$ to large; $ways[0]=1$ (we are at the start), $ways[1]=1$.

```python
def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    ways[1] = 1
    for i in range(2, n + 1):
        ways[i] = ways[i - 1] + ways[i - 2]
    return ways[n]

if __name__ == "__main__":
    n = int(input())
    print(climb_stairs(n))
```

```cpp
vector<ll> ways(n + 1);
ways[0] = 1; ways[1] = 1;
for (int i = 2; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2];
```

Notice how the problem was solved by looking at the *last* move. This is the most common way of finding a transition: ask what the final step could have been.

### Fewest coins

You have coins of certain values and a target amount. What is the smallest number of coins that add up exactly to the target? (You may use each coin type as often as you like.)

First, a warning about a tempting wrong idea: always taking the biggest coin that fits is called the *greedy* method, and it can fail. With coins 1, 3, 4 and target 6, greedy takes 4+1+1 (three coins), but 3+3 needs only two.

Use DP instead. Again ask: what was the last coin? If the last coin has value $c$, then before it we had the amount $x-c$, made with as few coins as possible.

- **State:** $f[x]$ = fewest coins to make amount $x$.
- **Transition:** $f[x] = 1 + \min$ of $f[x-c]$ over all coins $c$ with $c \le x$.
- **Order and base:** $x$ from 1 upward; $f[0]=0$.

```python
def fewest_coins(coins, target):
    INF = 10**9
    f = [INF] * (target + 1)
    f[0] = 0
    for x in range(1, target + 1):
        for c in coins:
            if c <= x and f[x - c] != INF:
                f[x] = min(f[x], f[x - c] + 1)
    return f[target]
```

```cpp
const int INF = 1e9;
vector<int> f(target + 1, INF);       // INF means "impossible"
f[0] = 0;
for (int x = 1; x <= target; x++)
    for (int c : coins)
        if (c <= x && f[x - c] != INF)
            f[x] = min(f[x], f[x - c] + 1);
```

There are `target` states and one step per coin for each, so the work is about `target × (number of coins)`.

**Which coins were used?** The table only holds the best count. To print the coins, also remember the choice that won: `choice[x] = c`. Then start at `target`, print `choice[target]`, move to `target - choice[target]`, and repeat until you reach 0. Almost every DP can recover its answer this way.

## 1.7 How to find a DP in a new problem

When you meet a new problem, follow this simple recipe.

First, write the slow recursive solution that tries everything, even if it is hopelessly slow. Second, look at what information each call really needs to continue: this is your state, and anything the future does not depend on should be thrown away. Third, check whether the same states are reached again and again; if yes, DP will help. Fourth, count the states and the work per state to estimate the speed. Fifth, make sure the dependencies never go around in a circle.

The hardest part is choosing the state. If the state forgets something important, you get wrong answers; if it remembers too much, the program is slow. The rest of this course is a collection of good states for many different kinds of problems.

---

# Chapter 2. The classical problems

The problems in this chapter appear (in disguise) inside a large fraction of all DP problems. It is worth understanding each deeply, not just memorizing the code.

## 2.1 Paths in a grid

A robot stands in the top-left corner of an $n\times m$ grid and may only move right or down. Some cells are blocked. In how many ways can it reach the bottom-right corner?

The state is a cell $(i,j)$. The robot can arrive at $(i,j)$ only from above or from the left, so

$$\text{ways}(i,j)=\begin{cases}0 & \text{if }(i,j)\text{ is blocked},\\ \text{ways}(i-1,j)+\text{ways}(i,j-1) & \text{otherwise,}\end{cases}$$

with $\text{ways}(0,0)=1$ and out-of-range cells counting as $0$. Filling the table row by row is a valid order because every cell depends only on cells above it or to its left. The time is $O(nm)$.

The same pattern gives the minimum-cost path (replace the sum with $\min$ of the two predecessor costs plus the cost of the cell) or the maximum-gain path, and with a third dimension it handles variations such as "at most $k$ turns".

## 2.2 The 0/1 knapsack problem

You have $n$ items; item $i$ has weight $w_i$ and value $v_i$. A bag can carry total weight at most $W$. Choose a subset of items of maximum total value.

Greedy again fails (taking the item with the best value-per-weight first can leave unusable space). A brute force tries all $2^n$ subsets. The DP idea is to decide items one at a time. After looking at the first $i$ items, all that matters about the choices made so far is how much weight they used. So define

$$dp[i][w]=\text{maximum value using only the first }i\text{ items with total weight at most }w.$$

For item $i$ there are two options: skip it, which leaves $dp[i-1][w]$, or take it (if $w_i\le w$), which gives $v_i+dp[i-1][w-w_i]$. Therefore

$$dp[i][w]=\max\bigl(dp[i-1][w],\ dp[i-1][w-w_i]+v_i\bigr),\qquad dp[0][w]=0.$$

There are $(n+1)(W+1)$ states and $O(1)$ work per state, so the time is $O(nW)$. This is called **pseudo-polynomial**: it is polynomial in the *number* $W$, not in the number of bits needed to write $W$. If $W$ is $10^{9}$ the table is far too large, but see the remark below.

**Squeezing the memory.** Row $i$ depends only on row $i-1$, so one array suffices, provided we update it in the correct direction:

```python
dp = [0] * (W + 1)
for i in range(n):
    for w in range(W, wt[i] - 1, -1):  # note: DOWNWARD
        dp[w] = max(dp[w], dp[w - wt[i]] + val[i])
```

```cpp
vector<ll> dp(W + 1, 0);
for (int i = 0; i < n; i++)
    for (int w = W; w >= wt[i]; w--)          // note: DOWNWARD
        dp[w] = max(dp[w], dp[w - wt[i]] + val[i]);
```

Why downward? When we compute `dp[w]` we read `dp[w - wt[i]]`, and this must still hold the old value from row $i-1$, because item $i$ may be used at most once. Going from large $w$ to small $w$ guarantees that the smaller index has not been overwritten yet. If we went upward, `dp[w - wt[i]]` would already contain row $i$, which means item $i$ could be used twice or more. That is in fact exactly the **unbounded knapsack** (each item available unlimited times), which is solved by the same code with the inner loop going upward. The whole difference between the two problems is the direction of one loop, and now you understand why.

**When $W$ is huge but values are small.** If the values are small instead (say $\sum v_i\le V$), swap the roles: let $dp[i][v]$ be the *minimum weight* needed to obtain value exactly $v$ using the first $i$ items. The time becomes $O(nV)$. Choosing which quantity becomes an index of the table, and which becomes the stored value, is a trick you will use often.

**Subset sum with bitsets.** If we only ask whether a sum is reachable, the table contains booleans, and the transition `dp[w] |= dp[w - wt]` for all $w$ simultaneously is a shift-and-or of a whole bit array. With `std::bitset<N>`:

```python
# Simulate std::bitset<N> with an integer (unbounded, but can be masked if N is known)
reach = 1  # reach[0] = True
for w in wt:
    reach |= reach << w
# If a fixed size N is required, mask with: reach &= (1 << N) - 1
```

```cpp
bitset<N> reach; reach[0] = 1;
for (int i = 0; i < n; i++) reach |= reach << wt[i];
```

The running time is $O(nW/64)$, which is a large practical improvement.

## 2.3 Longest increasing subsequence (LIS)

Given a sequence $a_0,\dots,a_{n-1}$, find the length of the longest subsequence (elements need not be adjacent, but must keep their order) that is strictly increasing.

The first DP has state $i$ meaning "the best subsequence that **ends exactly at** element $i$". It is crucial to include "ends exactly at $i$" in the definition; otherwise we would not know whether $a_i$ can be appended. We obtain

$$L[i]=1+\max\{L[j]: j<i,\ a_j<a_i\}\quad(\text{or }1\text{ if the set is empty}),$$

and the answer is $\max_i L[i]$. There are $n$ states and $O(n)$ transitions, hence $O(n^2)$.

For $n$ up to $10^5$ or $10^6$ we need something better. The key is to change what the table stores. Instead of indexing by the element, index by the **length** and store the best possible tail:

$$d[\ell]=\text{the smallest value that can be the last element of an increasing subsequence of length }\ell.$$

(Smaller is better, because it is easier to extend later.) The array $d$ is strictly increasing. To see this, take any increasing subsequence of length $\ell+1$ ending at value $x$; removing its last element gives a subsequence of length $\ell$ ending at a value smaller than $x$. Hence $d[\ell]<d[\ell+1]$.

Now we process elements from left to right and maintain $d$. When element $x=a_i$ arrives, find the first position $\ell$ with $d[\ell]\ge x$. Then $x$ can extend any subsequence of length $\ell-1$ (whose tail $d[\ell-1]<x$) to one of length $\ell$ with a tail $x\le d[\ell]$, so we set $d[\ell]:=x$. If no such $\ell$ exists, $x$ is larger than every tail and we append it, increasing the LIS length by one. Since $d$ is sorted we find $\ell$ by binary search:

```python
import bisect

d = []                       # d[l] = smallest tail of length l+1
for x in a:
    i = bisect.bisect_left(d, x)   # use bisect_right for non-decreasing
    if i == len(d):
        d.append(x)
    else:
        d[i] = x
lis = len(d)
```

```cpp
vector<int> d;                       // d[l] = smallest tail of length l+1
for (int x : a) {
    auto it = lower_bound(d.begin(), d.end(), x);   // use upper_bound for non-decreasing
    if (it == d.end()) d.push_back(x); else *it = x;
}
int lis = d.size();
```

The time is $O(n\log n)$. A word of caution: the array $d$ after the loop is *not* itself a valid subsequence; it only stores tails. To reconstruct an actual subsequence, remember for every element the index of the element that precedes it, namely the last element stored at position $\ell-1$ when $x$ was inserted at $\ell$.

LIS is a good first example of an important phenomenon: the same DP can often be sped up by observing that a different *representation* of the table has a monotone structure we can exploit with binary search. In Chapter 9 we will see far more powerful versions of this idea.

## 2.4 Two strings: LCS and edit distance

When the input consists of two sequences, a natural state is a pair of prefixes. For the longest common subsequence of strings $s$ and $t$, let $dp[i][j]$ be the LCS length of the first $i$ characters of $s$ and the first $j$ characters of $t$. If the last characters are equal, we can match them; otherwise one of them is unused:

$$dp[i][j]=\begin{cases}dp[i-1][j-1]+1 & s_i=t_j,\\ \max\bigl(dp[i-1][j],\ dp[i][j-1]\bigr) & \text{otherwise.}\end{cases}$$

The edit distance (minimum number of insertions, deletions, and substitutions to turn $s$ into $t$) is similar:

$$dp[i][j]=\min\bigl(dp[i-1][j]+1,\ dp[i][j-1]+1,\ dp[i-1][j-1]+[s_i\ne t_j]\bigr).$$

Both run in $O(|s||t|)$. They show the standard pattern for two-sequence problems: the state is a pair of positions, and the transition looks at the last character of each prefix.

## 2.5 Counting ordered versus unordered ways

A frequent source of wrong answers is not the DP itself but *what is being counted*. Take the coin problem and ask: in how many ways can we form the amount $x$? There are two different questions hiding here. If $1+3$ and $3+1$ count as different (the order of coins matters), we count ordered sequences. If they count as the same (only which coins we use matters), we count combinations.

For ordered sequences, the state is just the amount, and every coin may be the last one:

```python
g = [0] * (x + 1); g[0] = 1
for s in range(1, x + 1):            # amount in the OUTER loop
    for c in coins:
        if c <= s:
            g[s] += g[s - c]
```

```cpp
vector<ll> g(x + 1, 0); g[0] = 1;
for (int s = 1; s <= x; s++)            // amount in the OUTER loop
    for (int c : coins)
        if (c <= s) g[s] += g[s - c];
```

For combinations, swap the loops so that the coin type is outside:

```python
def count_ordered_ways(coins, x):
    # ordered sequences: order of coins matters
    g = [0] * (x + 1)
    g[0] = 1
    for s in range(1, x + 1):            # amount in the OUTER loop
        for c in coins:
            if c <= s:
                g[s] += g[s - c]
    return g[x]


def count_combinations(coins, x):
    # combinations: only which coins we use matters
    g = [0] * (x + 1)
    g[0] = 1
    for c in coins:                     # coin type in the OUTER loop
        for s in range(c, x + 1):
            g[s] += g[s - c]
    return g[x]


if __name__ == "__main__":
    coins = [1, 3, 4]
    x = 6
    print("Ordered ways:", count_ordered_ways(coins, x))
    print("Combinations:", count_combinations(coins, x))
```

```cpp
vector<ll> g(x + 1, 0); g[0] = 1;
for (int c : coins)                     // coin type in the OUTER loop
    for (int s = c; s <= x; s++)
        g[s] += g[s - c];
```

Why does this work? When we process one coin type at a time, every combination is built in exactly one fixed order (all coins of the first type, then the second type, and so on), so it is counted once. When the amount is the outer loop, any order of the same coins is a separate path, so each ordering is counted. Remember this rule: **the outer loop decides what is counted as "different"**.

## 2.6 A summary of patterns

Looking back at the examples, notice how small the repertoire of states is. A single number (Fibonacci, coins) is "how far have I gone". A position plus a resource counter (knapsack) is "how far have I gone, and what do I have left". A pair of positions is used for two sequences. A "ends exactly here" state (LIS) is used when the next choice depends on the last chosen element. Keep these templates in mind: in the rest of the document, the states become more exotic (vertices of trees, subsets of a graph), but the thinking process stays the same.


---

# Chapter 4. DP on trees

A tree is a connected graph without cycles. Once we choose a **root**, every edge gets a natural direction (from parent to child), and the tree becomes a DAG in which each vertex has exactly one predecessor. This makes DP on trees the most pleasant kind: the structure is regular, the order is obvious (children before parents), and subproblems are exactly the **subtrees**.

## 4.1 The template

Root the tree at vertex $1$. For a vertex $v$, the subtree of $v$ consists of $v$ and all of its descendants. A tree DP computes some value $dp[v]$ describing the subtree of $v$, by combining the values of the children of $v$:

```python
g = []  # adjacency list, list of lists

def dfs(v, parent):
    # initialize dp[v] as if v were a leaf
    for u in g[v]:
        if u == parent:
            continue
        dfs(u, v)
        # merge dp[u] into dp[v]
    # finalize dp[v] if needed
```

```cpp
vector<int> g[N];

void dfs(int v, int parent) {
    // initialize dp[v] as if v were a leaf
    for (int u : g[v]) {
        if (u == parent) continue;
        dfs(u, v);
        // merge dp[u] into dp[v]
    }
    // finalize dp[v] if needed
}
```

The number of states is $n$, and every edge is traversed twice, so the total time is $O(n)$ plus whatever the merge costs.

A technical remark for large inputs: a path graph with $10^6$ vertices makes this recursion go $10^6$ levels deep, which can overflow the stack. The robust alternative is to compute a BFS or DFS order once, store each vertex's parent, and process vertices in **reverse** order of discovery. Then every child is processed before its parent, and no recursion is used.

## 4.2 The simplest example: subtree sizes and depths

Let $sz[v]$ be the number of vertices in the subtree of $v$. A subtree consists of $v$ itself and the subtrees of its children, so

$$sz[v]=1+\sum_{u\in\text{children}(v)}sz[u].$$

The sizes are the basic tool in almost every later tree algorithm: they tell us how the tree splits, and they drive complexity arguments.

## 4.3 Maximum independent set on a tree

An **independent set** is a set of vertices no two of which are adjacent. Find the maximum size of an independent set in a tree. (On general graphs the problem is NP-hard. Trees make it easy.)

The difficulty is that the decision at $v$ constrains its children, so the state must remember what $v$ did. We therefore use two values per vertex:

$$\begin{aligned}in[v]&=\text{best in the subtree of }v\text{ if }v\text{ is chosen},\\ out[v]&=\text{best in the subtree of }v\text{ if }v\text{ is not chosen}.\end{aligned}$$

If $v$ is chosen, none of its children may be, so each child contributes $out[u]$. If $v$ is not chosen, each child is free, and contributes the better of its two options:

$$in[v]=1+\sum_{u}out[u],\qquad out[v]=\sum_{u}\max\bigl(in[u],\,out[u]\bigr).$$

```python
g = []
in_ = []
out = []

def dfs(v, p):
    in_[v] = 1
    out[v] = 0
    for u in g[v]:
        if u == p:
            continue
        dfs(u, v)
        in_[v] += out[u]
        out[v] += max(in_[u], out[u])
# answer: max(in_[root], out[root])
```

```cpp
void dfs(int v, int p) {
    in[v] = 1; out[v] = 0;
    for (int u : g[v]) {
        if (u == p) continue;
        dfs(u, v);
        in[v]  += out[u];
        out[v] += max(in[u], out[u]);
    }
}
// answer: max(in[root], out[root])
```

The lesson is the one from Section 3.3 again: **add to the state whatever the parent needs to know about the child's decision**. The same two-state pattern solves minimum vertex cover, maximum matching on trees (the state records whether $v$ is already matched to a child), and counting the number of proper colorings of the tree with $k$ colors (state: the color of $v$, or just "same as parent or not").

## 4.4 Longest path (diameter): answers that bend at the top

The **diameter** of a tree is the length of its longest path. A path in a rooted tree has a unique highest vertex $v$ (the vertex closest to the root). From $v$ the path goes down along at most two different child branches. This suggests defining

$$down[v]=\text{the length of the longest path that starts at }v\text{ and goes only downward},$$

so that $down[v]=\max_u(1+down[u])$ over children $u$, with $down[v]=0$ for a leaf. The best path whose highest vertex is $v$ uses the two largest values among $\{1+down[u]\}$, and the answer is the maximum over all $v$ of that sum.

```python
diameter = 0

def dfs(v, p):
    global diameter
    best1 = 0
    best2 = 0  # two largest (1 + down[u])
    for u in g[v]:
        if u == p:
            continue
        dfs(u, v)
        c = down[u] + 1
        if c > best1:
            best2 = best1
            best1 = c
        elif c > best2:
            best2 = c
    down[v] = best1
    diameter = max(diameter, best1 + best2)
```

```cpp
int diameter = 0;
void dfs(int v, int p) {
    int best1 = 0, best2 = 0;                 // two largest (1 + down[u])
    for (int u : g[v]) {
        if (u == p) continue;
        dfs(u, v);
        int c = down[u] + 1;
        if (c > best1) { best2 = best1; best1 = c; }
        else if (c > best2) best2 = c;
    }
    down[v] = best1;
    diameter = max(diameter, best1 + best2);
}
```

This idea is general and extremely useful: when the object we seek is a **path**, the state describes a one-sided half-path (going down from $v$), while the final answer is formed at the top vertex by gluing two such halves. The state and the answer are not the same quantity. You will see this pattern in many hard problems (maximum weighted path, path with a constraint on the number of special vertices, and so on).

## 4.5 Tree knapsack: merging two tables

Now a harder example. Each vertex $v$ has a value $a_v$. We want to choose exactly $j$ vertices that form a connected piece containing the root, maximizing the total value; and we need the answer for **every** $j\le K$.

Define $dp[v][j]$ as the best total value of a connected set containing $v$, consisting of exactly $j$ vertices of the subtree of $v$. A child can contribute any number $t\ge0$ of vertices (with $t=0$ meaning we take nothing from it). Processing the children one by one, we merge the table of the child into the table of $v$. After the merge, the new table is obtained by trying all splits of $j$ into "what $v$'s current table has" and "what the child provides":

$$dp[v][j+t]\leftarrow\max\bigl(dp[v][j+t],\ dp[v][j]+dp[u][t]\bigr).$$

This is exactly the 0/1 knapsack structure from Section 2.2, only with one "item group" per child, and again $j$ must be iterated downward (or the merge must write to a fresh array) so that the same child is not used twice.

```python
def dfs(v, p):
    sz[v] = 1
    dp[v][1] = a[v]                           # all other entries of dp[v] start at -INF
    for u in g[v]:
        if u == p:
            continue
        dfs(u, v)
        for j in range(min(sz[v], K), 0, -1):
            for t in range(1, min(sz[u], K - j) + 1):
                dp[v][j + t] = max(dp[v][j + t], dp[v][j] + dp[u][t])
        sz[v] += sz[u]
```

```cpp
void dfs(int v, int p) {
    sz[v] = 1;
    dp[v][1] = a[v];                           // all other entries of dp[v] start at -INF
    for (int u : g[v]) {
        if (u == p) continue;
        dfs(u, v);
        for (int j = min(sz[v], K); j >= 1; j--)
            for (int t = 1; t <= min(sz[u], K - j); t++)
                dp[v][j + t] = max(dp[v][j + t], dp[v][j] + dp[u][t]);
        sz[v] += sz[u];
    }
}
```

**Why is the total time only $O(nK)$ and not $O(nK^2)$?** The merge of a child of size $b$ into the partial table of size $a$ costs about $\min(a,K)\cdot\min(b,K)$. First suppose $K=n$ (no cap). Then the cost is $a\cdot b$, which is the number of pairs $(x,y)$ with $x$ in the already-merged part and $y$ in the child's subtree. Each pair of vertices of the tree is counted in exactly one merge, namely at their lowest common ancestor. Therefore the total cost is at most $\binom{n}{2}$, that is, $O(n^2)$. This is a remarkable fact: the naive-looking triple nesting is quadratic and not cubic.

With the cap $K$ we get $O(nK)$ by the following argument. Call a partial component *big* if its size is at least $K$, otherwise *small*. A merge of two small components costs at most $a\cdot b$ (pair counting), and the pairs are charged to the merged vertices; but once a component reaches size $K$ it is big, so a vertex participates in such "small–small" merges only until its component reaches $K$ vertices, and it is charged at most $K$ in total ($O(nK)$ in all). A merge of a small component of size $b<K$ into a big one costs $K\cdot b$, which charges $K$ to each vertex of the small component; after that merge the vertex is part of a big component and will never again be on the small side, so each vertex is charged at most $K$ once more. Finally, a merge of two big components costs $K^2$; since big components are disjoint and each contains at least $K$ vertices, and every such merge reduces their number by one, there are at most $n/K$ of them in total, costing $O(nK)$. Summing up, the whole procedure takes $O(nK)$.

## 4.6 Counting with tree DP

Tree DP combines naturally with counting. For instance, the number of ways to color the tree with $k$ colors so that adjacent vertices differ is $k(k-1)^{n-1}$ (choose the root's color, then each other vertex avoids its parent's color), and with additional constraints (some vertices forced to take certain colors) we use $dp[v][c]$ = number of valid colorings of the subtree of $v$ with $v$ colored $c$:

$$dp[v][c]=\prod_{u\in\text{children}(v)}\ \sum_{c'\ne c}dp[u][c'].$$

Products appear instead of sums because the children's subtrees are independent once the color of $v$ is fixed. This "independence of the children given the parent" is the fundamental property that makes tree DP work, and it is the reason why DP is easy on trees but hard on general graphs: in a general graph, two neighbors of $v$ may be connected to each other by another route, so their choices are no longer independent.

## 4.7 Exercises for this chapter

AtCoder Educational DP Contest problem P (Independent Set, counting colorings); CSES *Subordinates*, *Tree Diameter*, *Tree Matching*; Codeforces 161D (*Distance in Tree*, count pairs at distance exactly $K$, with $dp[v][d]$ = number of vertices at depth $d$ below $v$); Codeforces 815C (*Karen and Supermarket*, a tree knapsack). Verify the problem statements before assigning, since this list comes from memory.


---

# Chapter 5. Rerooting: the answer for every root

## 5.1 The problem

A tree DP answers a question about the tree **as seen from one chosen root**. A surprisingly large family of problems asks the question for *every* vertex as the root. A typical example is the following: for each vertex $v$, compute

$$S(v)=\sum_{u}\operatorname{dist}(v,u),$$

the sum of distances from $v$ to all other vertices. Running the DP once per root takes $O(n)$ per root and $O(n^2)$ in total, which is too slow for $n=2\cdot10^5$. The technique of **rerooting** (also called "up and down DP" or "tree DP with all roots") solves it in $O(n)$.

The idea is to compute the answer for the root $1$ by an ordinary DP, and then to *move the root* along each edge, updating the answer in constant time instead of recomputing it.

## 5.2 The easy case: a quantity that can be updated by arithmetic

First compute, with root $1$,

$$sz[v]\ \text{(subtree size)},\qquad down[v]=\sum_{u\in\text{subtree}(v)}\operatorname{dist}(v,u).$$

The recurrence for $down$ follows from the observation that every vertex in the subtree of a child $c$ is one step farther from $v$ than from $c$:

$$down[v]=\sum_{c\in\text{children}(v)}\bigl(down[c]+sz[c]\bigr).$$

Then $S(1)=down[1]$. Now suppose we know $S(v)$ for some vertex $v$, and let $c$ be a child of $v$. How does the sum change if we move the root from $v$ to $c$? The $sz[c]$ vertices inside the subtree of $c$ become one step closer, and the remaining $n-sz[c]$ vertices become one step farther away. Therefore

$$S(c)=S(v)-sz[c]+\bigl(n-sz[c]\bigr)=S(v)+n-2\,sz[c].$$

A second DFS carries this out from the top:

```python
# Global variables (to be initialized before calling)
g = []      # adjacency list, 1-indexed
sz = []     # subtree sizes
down = []   # down values
S = []      # answer for each node
n = 0       # number of nodes

def dfs1(v, p):
    sz[v] = 1
    down[v] = 0
    for c in g[v]:
        if c != p:
            dfs1(c, v)
            sz[v] += sz[c]
            down[v] += down[c] + sz[c]

def dfs2(v, p):
    for c in g[v]:
        if c != p:
            S[c] = S[v] + n - 2 * sz[c]
            dfs2(c, v)

# Example usage:
# n = 5
# g = [[] for _ in range(n + 1)]
# g[1].extend([2, 3])
# g[2].extend([1, 4, 5])
# g[3].append(1)
# g[4].append(2)
# g[5].append(2)
# sz = [0] * (n + 1)
# down = [0] * (n + 1)
# S = [0] * (n + 1)
# dfs1(1, 0)
# S[1] = down[1]
# dfs2(1, 0)
# print(S[1:])
```

```cpp
void dfs1(int v, int p) {
    sz[v] = 1; down[v] = 0;
    for (int c : g[v]) if (c != p) {
        dfs1(c, v);
        sz[v] += sz[c];
        down[v] += down[c] + sz[c];
    }
}
void dfs2(int v, int p) {
    for (int c : g[v]) if (c != p) {
        S[c] = S[v] + n - 2 * sz[c];
        dfs2(c, v);
    }
}
// dfs1(1, 0); S[1] = down[1]; dfs2(1, 0);
```

This is the whole technique in miniature: a first pass moves information **up** the tree (children to parents), and a second pass moves information **down** (parents to children), and the answer at each vertex combines both.

## 5.3 Thinking in terms of messages

To handle harder cases, we need a cleaner mental model. Imagine that each edge of the tree carries two **messages**, one in each direction. The message from $c$ to its parent $v$, which we call $\text{up}(c)$, summarizes everything in the subtree of $c$, so it is exactly what the ordinary DP computes. The message from $v$ down to its child $c$, which we call $\text{down}(c)$, summarizes everything *outside* the subtree of $c$ as seen from $c$, that is, the whole rest of the tree hanging from $v$ (which includes $v$'s parent side and $v$'s other children).

Now the answer for a vertex $v$ is the combination of the messages received from all of its neighbors: the children (their $\text{up}$ messages) and the parent (its $\text{down}$ message). If $\oplus$ is the combining operation (sum, max, product, and so on), then

$$ans(v)=\bigoplus_{c\in\text{children}(v)}\text{msg}(c\to v)\ \oplus\ \text{msg}(\text{parent}(v)\to v).$$

The message that $v$ sends to a child $c$ must contain *everything $v$ knows except what came from $c$*. So

$$\text{msg}(v\to c)=\text{finish}\Bigl(\bigoplus_{c'\ne c}\text{msg}(c'\to v)\ \oplus\ \text{msg}(\text{parent}(v)\to v)\Bigr).$$

Here finish is the small function that turns "everything $v$ knows" into a message (for the distance example, it adds one edge). If $\oplus$ is a sum, "everything except $c$" is simply the total minus the contribution of $c$: this is why the distance example allowed a subtraction. But if $\oplus$ is a maximum, we cannot subtract. We need another way to compute "the combination of all children except one".

## 5.4 The general case: prefix and suffix combinations

Suppose $v$ has children $c_1,c_2,\dots,c_k$ with messages $m_1,\dots,m_k$ and the message from the parent is $m_0$. We want, for every $i$, the combination of everything except $m_i$. The trick is to precompute **prefix** and **suffix** combinations:

$$P_i=m_1\oplus\cdots\oplus m_i,\qquad Q_i=m_i\oplus\cdots\oplus m_k,$$

and then use $P_{i-1}\oplus Q_{i+1}\oplus m_0$. This needs only associativity of $\oplus$ (and an identity element), not invertibility, and costs $O(k)$ time for a vertex with $k$ children, hence $O(n)$ in total.

As an example, let us compute for every vertex $v$ the **eccentricity**, the distance to the farthest vertex. Let $down[v]$ be the longest path downward from $v$ (computed by ordinary DP) and let $up[v]$ be the length of the longest path that starts at $v$ and first goes to its parent. For a child $c$ of $v$, the longest path from $c$ going up first goes to $v$ and then either continues upward from $v$ ($up[v]$), or descends into another child $c'\ne c$ of $v$ ($1+down[c']$):

$$up[c]=1+\max\Bigl(up[v],\ \max_{c'\ne c}\bigl(1+down[c']\bigr)\Bigr).$$

The inner maximum over $c'\ne c$ is exactly the "all except one" quantity:

```python
def dfs1(v, p):
    down[v] = 0
    for c in g[v]:
        if c != p:
            dfs1(c, v)
            down[v] = max(down[v], down[c] + 1)

def dfs2(v, p):
    ch = []
    for c in g[v]:
        if c != p:
            ch.append(c)
    k = len(ch)
    pre = [0] * (k + 2)
    suf = [0] * (k + 2)
    for i in range(k):
        pre[i + 1] = max(pre[i], 1 + down[ch[i]])
    for i in range(k - 1, -1, -1):
        suf[i] = max(suf[i + 1], 1 + down[ch[i]])
    for i in range(k):
        c = ch[i]
        others = max(pre[i], suf[i + 1])
        up[c] = 1 + max(up[v], others)
        dfs2(c, v)

# up[root] = 0;  ecc[v] = max(down[v], up[v])
```

```cpp
void dfs1(int v, int p) {
    down[v] = 0;
    for (int c : g[v]) if (c != p) { dfs1(c, v); down[v] = max(down[v], down[c] + 1); }
}

void dfs2(int v, int p) {
    vector<int> ch;
    for (int c : g[v]) if (c != p) ch.push_back(c);
    int k = ch.size();
    vector<int> pre(k + 2, 0), suf(k + 2, 0);        // 0 is the identity for max (values >= 0)
    for (int i = 0; i < k; i++)      pre[i + 1] = max(pre[i], 1 + down[ch[i]]);
    for (int i = k - 1; i >= 0; i--) suf[i]     = max(suf[i + 1], 1 + down[ch[i]]);
    for (int i = 0; i < k; i++) {
        int c = ch[i];
        int others = max(pre[i], suf[i + 1]);          // best among all siblings except c
        up[c] = 1 + max(up[v], others);
        dfs2(c, v);
    }
}
// up[root] = 0;  ecc[v] = max(down[v], up[v])
```

In prefix notation `pre[i]` covers children $0..i-1$ and `suf[i+1]` covers children $i+1..k-1$, so together they cover everyone except child $i$.

## 5.5 A recipe

Whenever a problem says "for every vertex, compute $X$ assuming the tree is rooted there", follow these steps. First decide what a vertex has to tell its parent (this is the usual DP state, and it becomes the up-message). Second decide how a vertex combines messages from several neighbors and which operation is involved. Third write the down-message as "combine everything except the child's own message, plus the parent's message, then finish". Fourth, if the operation has no inverse, use prefix and suffix combinations. The whole thing is two DFS passes and $O(n)$ time provided combining takes constant time per message.

A subtle point: the state in rerooting problems is sometimes richer than a single number. For example, when the DP stores the two largest child values (to compute the diameter at the top), the "all except one" version must keep the **top three** values at a vertex, because removing one of the top two leaves the third as a candidate. Always ask: *what is the smallest summary from which I can still delete one child's contribution?*

## 5.6 Exercises for this chapter

AtCoder Educational DP Contest problem V (*Subtree*, a modular product with a non-invertible operation, which forces prefix and suffix products); CSES *Tree Distances* (eccentricity), Codeforces 1092F (*Tree with Maximum Cost*), Codeforces 1187E (*Tree Painting*).

---

# Chapter 6. Bitmask DP and subsets of vertices

## 6.1 When the state is a set

Some problems force us to remember *which* objects we have already used, for example which cities a salesman has visited. If the number of objects $n$ is small (typically $n\le 20$), we can store any subset of them as an integer whose binary representation says which objects belong to it. This is called a **bitmask**. There are $2^n$ subsets, so a DP over subsets has at least $2^n$ states, which is fine up to about $n=20$ or $22$.

The operations you will use constantly are these:

```python
mask | (1 << i)          # add element i
mask & ~(1 << i)         # remove element i
(mask >> i) & 1          # test membership of i
bin(mask).count('1')     # size of the set (popcount)
mask & (mask - 1)        # clear the lowest set bit
```

```cpp
mask | (1 << i)          // add element i
mask & ~(1 << i)         // remove element i
(mask >> i) & 1          // test membership of i
__builtin_popcount(mask) // size of the set
mask & (mask - 1)        // clear the lowest set bit
```

## 6.2 Hamiltonian paths and the travelling salesman problem

A **Hamiltonian path** visits every vertex of a graph exactly once. Deciding whether one exists, or counting them, is NP-hard in general, and bitmask DP gives the best known exact algorithms in practice. The key is to notice that the only things the future depends on are *which vertices have been visited* and *where we currently are*. Define

$$dp[S][v]=\text{number of paths that visit exactly the vertices of }S\text{ and end at }v\ (v\in S).$$

Starting from the single-vertex path, $dp[\{s\}][s]=1$, a path ending at $v$ is extended by an edge $(v,u)$ to a vertex $u\notin S$:

$$dp[S\cup\{u\}][u]\mathrel{+}=dp[S][v]\qquad\text{for every edge }(v,u),\ u\notin S.$$

The number of Hamiltonian paths from $s$ to $t$ is $dp[V][t]$. For the **travelling salesman problem** (visit all cities once, and minimize total cost) we replace the count by a minimum and add the edge cost:

$$dp[S\cup\{u\}][u]=\min\bigl(dp[S\cup\{u\}][u],\ dp[S][v]+w(v,u)\bigr).$$

```python
# count Hamiltonian paths from vertex 0 to vertex n-1
dp = [[0] * n for _ in range(1 << n)]
dp[1][0] = 1
for S in range(1, 1 << n):
    for v in range(n):
        if not (S & (1 << v)) or not dp[S][v]:
            continue
        for u in range(n):
            if not (S & (1 << u)) and adj[v][u]:
                dp[S | (1 << u)][u] = (dp[S | (1 << u)][u] + dp[S][v]) % MOD
# answer: dp[(1 << n) - 1][n - 1]
```

```cpp
// count Hamiltonian paths from vertex 0 to vertex n-1
vector<vector<ll>> dp(1 << n, vector<ll>(n, 0));
dp[1][0] = 1;
for (int S = 1; S < (1 << n); S++)
    for (int v = 0; v < n; v++) {
        if (!(S >> v & 1) || !dp[S][v]) continue;
        for (int u = 0; u < n; u++)
            if (!(S >> u & 1) && adj[v][u])
                dp[S | 1 << u][u] = (dp[S | 1 << u][u] + dp[S][v]) % MOD;
    }
// answer: dp[(1 << n) - 1][n - 1]
```

There are $2^n\cdot n$ states and $n$ transitions per state, so the time is $O(2^n n^2)$ and the memory $O(2^n n)$. Compare this with the $n!$ of the brute force: for $n=20$ that is $2.4\cdot10^{18}$ versus about $4\cdot10^8$.

Notice the order: every transition goes from a mask to a strictly larger mask (we add one bit). Therefore iterating over masks in increasing numeric order is automatically a valid topological order of the state graph. This is true for all subset DPs that only ever add elements.

## 6.3 Assignment-type problems: using popcount as the row index

Suppose $n$ people must be assigned to $n$ tasks, one each, and person $i$ doing task $j$ costs $c_{ij}$. Minimize the total. A direct state $(i,S)$ with $S$ the set of tasks already taken looks like $n\cdot2^n$ states, but notice that person $i$ is determined by the number of tasks already assigned: if people are processed in order, then $i=|S|$. So the state is just $S$:

$$dp[S]=\min_{j\in S}\Bigl(dp[S\setminus\{j\}]+c_{|S|-1,\ j}\Bigr).$$

The time is $O(2^n n)$. This kind of compression, where one part of the state is a function of another, appears constantly. (The problem is also solved in $O(n^3)$ by the Hungarian algorithm, but the bitmask approach is more flexible when there are extra constraints.)

## 6.4 Iterating over submasks, and why it costs $3^n$

Some problems split the set into two parts and need all possible splits, for example "partition the vertices into groups, each of which has some cost". The recurrence is

$$dp[S]=\min_{\emptyset\ne T\subseteq S}\bigl(dp[S\setminus T]+cost[T]\bigr).$$

There is a classic loop that enumerates all non-empty submasks $T$ of $S$ in decreasing order:

```python
for S in range(1 << n):
    T = S
    while T > 0:
        dp[S] = min(dp[S], dp[S ^ T] + cost[T])
        T = (T - 1) & S
```

```cpp
for (int S = 0; S < (1 << n); S++)
    for (int T = S; T > 0; T = (T - 1) & S)
        dp[S] = min(dp[S], dp[S ^ T] + cost[T]);
```

Why does the trick `T = (T - 1) & S` work? Subtracting one from $T$ flips the lowest set bit and sets all lower bits; ANDing with $S$ removes any bits that are not in $S$. The result is the next smaller submask of $S$.

The total number of pairs $(S,T)$ with $T\subseteq S$ equals $3^n$. To see this, note that each element has exactly three possible roles: it is not in $S$, it is in $S$ but not in $T$, or it is in both. Algebraically,

$$\sum_{S}2^{|S|}=\sum_{k=0}^{n}\binom{n}{k}2^k=(1+2)^n=3^n.$$

So this DP costs $O(3^n)$, practical up to $n\approx16$ to $18$.

## 6.5 Sum over subsets (SOS DP)

Sometimes we need, for every mask $S$, the aggregate of a function over all of its submasks:

$$F[S]=\sum_{T\subseteq S}a[T].$$

Doing this by enumerating submasks costs $3^n$. There is a beautiful $O(n2^n)$ method. Process the bits one at a time. After handling bits $0,\dots,i$, let $F_i[S]$ be the sum of $a[T]$ over all $T\subseteq S$ such that $T$ and $S$ agree in all bits above $i$ (so $T$ may differ from $S$ only by having some of the bits $0..i$ turned off). Clearly $F_{-1}[S]=a[S]$ and $F_{n-1}=F$. To go from $F_{i-1}$ to $F_i$ consider whether bit $i$ is set in $S$. If it is not, then $T$ also has it off, so nothing changes. If it is set, $T$ may have bit $i$ on (these are counted in $F_{i-1}[S]$) or off (these are counted in $F_{i-1}[S\setminus\{i\}]$). Hence

$$F_i[S]=F_{i-1}[S]+\begin{cases}F_{i-1}[S\setminus\{i\}]&i\in S,\\0&i\notin S.\end{cases}$$

```python
for i in range(n):
    for S in range(1 << n):
        if (S >> i) & 1:
            F[S] += F[S ^ (1 << i)]
```

```cpp
for (int i = 0; i < n; i++)
    for (int S = 0; S < (1 << n); S++)
        if (S >> i & 1) F[S] += F[S ^ (1 << i)];
```

Running this in place is valid, because the update of $F[S]$ reads $F[S\setminus\{i\}]$, a mask without bit $i$, which is not modified in round $i$. The same method computes sums over supersets (flip the condition and the direction), and with subtraction instead of addition it can be inverted. It is the subset analogue of a prefix sum over each of $n$ binary dimensions.

## 6.6 Broken profile DP

Grid problems with a small width and a large length, for example counting the ways to tile an $n\times m$ board with dominoes where $m\le10$ and $n$ may be as large as $1000$, use another bitmask idea. We process the cells one by one in row-major order, and keep as the state a bitmask of width $m$ called the **profile**, which records which of the cells on the "frontier" are already covered.

Concretely, when we are about to decide cell $(i,j)$, bit $k$ of the mask refers to cell $(i,k)$ for $k\ge j$ and to cell $(i+1,k)$ for $k<j$. In other words, the mask describes the $m$ cells that come next in the processing order. Each bit says whether that cell is already occupied by a domino placed earlier. At cell $(i,j)$ there are three possibilities:

- If bit $j$ is set, the current cell is already covered. We simply clear the bit (the position will now refer to the cell below, $(i+1,j)$, which is free) and move on.
- Otherwise we may place a **vertical** domino covering $(i,j)$ and $(i+1,j)$ (if $i+1<n$), which sets bit $j$ (it will refer to the cell below once we move on).
- Otherwise we may place a **horizontal** domino covering $(i,j)$ and $(i,j+1)$, allowed if $j+1<m$ and bit $j+1$ is not set, which sets bit $j+1$.

```python
# number of domino tilings of an n x m board (m small)
dp = [0] * (1 << m)
dp[0] = 1
for i in range(n):
    for j in range(m):
        nd = [0] * (1 << m)
        for mask in range(1 << m):
            if not dp[mask]:
                continue
            if (mask >> j) & 1:
                nd[mask ^ (1 << j)] += dp[mask]
            else:
                if i + 1 < n:
                    nd[mask | (1 << j)] += dp[mask]
                if j + 1 < m and not ((mask >> (j + 1)) & 1):
                    nd[mask | (1 << (j + 1))] += dp[mask]
        dp = nd
# answer: dp[0]
```

```cpp
// number of domino tilings of an n x m board (m small)
vector<ll> dp(1 << m, 0), nd(1 << m);
dp[0] = 1;
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++) {
        fill(nd.begin(), nd.end(), 0);
        for (int mask = 0; mask < (1 << m); mask++) {
            if (!dp[mask]) continue;
            if (mask >> j & 1) {
                nd[mask ^ (1 << j)] += dp[mask];
            } else {
                if (i + 1 < n) nd[mask | (1 << j)] += dp[mask];
                if (j + 1 < m && !(mask >> (j + 1) & 1)) nd[mask | (1 << (j + 1))] += dp[mask];
            }
        }
        swap(dp, nd);
    }
// answer: dp[0]
```

There are $nm$ steps, each touching $2^m$ masks with $O(1)$ work, so the time is $O(nm\,2^m)$. The older formulation "process a whole row at a time" enumerates compatible pairs of row masks and costs much more, so the cell-by-cell version is the one to learn. As a sanity check, a $2\times 2$ board has $2$ tilings and a $4\times4$ board has $36$.

The idea generalizes: whenever the effect of a placed piece reaches only a bounded distance ahead of the current position in the processing order, a bitmask of the width of that "reach" is a complete state. This is used for tilings with other shapes, colorings with adjacency constraints, and many grid-based counting problems.

## 6.7 Exercises for this chapter

CSES *Elevator Rides*, *Hamiltonian Flights*, *Counting Tilings*; AtCoder Educational DP Contest problems O (*Matching*, assignment) and U (*Grouping*, the $3^n$ DP); Codeforces 165E (*Compatible Numbers*) for SOS DP.


---

# Chapter 8. Advanced techniques for large trees

In Chapter 4 each vertex combined tables from its children in a way that visited every vertex once. In harder problems the information to merge is large, for example "the set of colors in the subtree", and merging naively is quadratic. This chapter introduces three tools that bring such problems back to near-linear time.

## 8.1 Small-to-large merging

**Problem.** Every vertex has a color. For every vertex $v$, report the number of distinct colors in the subtree of $v$.

The natural solution keeps a set of colors $S_v$ for each subtree and merges the children's sets into the parent's. If we copy every child's set into a fresh set, a path graph makes us copy $1,2,\dots,n$ elements, that is $O(n^2)$ work. The remedy is a simple rule: **always insert the smaller set into the larger one, and reuse the larger one's memory** (so that nothing needs to be copied for it).

```python
import sys
sys.setrecursionlimit(1000000)

# Example graph and data
N = 6
g = [[] for _ in range(N)]
edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5)]
for a, b in edges:
    g[a].append(b)
    g[b].append(a)

color = [1, 2, 1, 3, 2, 1]  # colors of vertices 0..5

S = [None] * N
ans = [0] * N

def dfs(v, p):
    S[v] = {color[v]}
    for u in g[v]:
        if u == p:
            continue
        dfs(u, v)
        # Small-to-large merge: ensure S[v] is the larger set
        if len(S[u]) > len(S[v]):
            S[v], S[u] = S[u], S[v]
        S[v].update(S[u])
    ans[v] = len(S[v])

if __name__ == "__main__":
    dfs(0, -1)
    print("Distinct colors in each subtree:")
    for i in range(N):
        print(f"Vertex {i}: {ans[i]}")
```

```cpp
set<int>* S[N];
int ans[N];

void dfs(int v, int p) {
    S[v] = new set<int>{color[v]};
    for (int u : g[v]) {
        if (u == p) continue;
        dfs(u, v);
        if (S[u]->size() > S[v]->size()) swap(S[u], S[v]);   // O(1) pointer swap
        for (int x : *S[u]) S[v]->insert(x);                 // move the smaller one
    }
    ans[v] = S[v]->size();
}
```

**Why is this fast?** Fix one element $x$ and watch how many times it is *moved*. It is moved only when the set containing it is the smaller of the two merged sets, and after the merge it lives in a set of at least twice the size. Sizes cannot exceed $n$, so a single element is moved at most $\log_2n$ times. With $n$ elements in total, the number of insertions is $O(n\log n)$; each insertion into a balanced tree costs $O(\log n)$, giving $O(n\log^2n)$ overall, or $O(n\log n)$ with hash sets.

This "charge the cost to the elements of the smaller side" argument is one of the most important complexity arguments in the field. It appears in union–find with union by size, in merging data structures, and in the "DSU on tree" (also known as Sack) technique, which achieves the same result with arrays instead of sets: process the light children first and clear their data, then process the heavy child and keep its data, then re-add the light children's elements into it. A vertex belongs to at most $\log n$ light subtrees on its way to the root, which gives the $O(n\log n)$ bound.

## 8.2 Centroid decomposition

**Problem type.** Count or optimize over **all paths** in a tree: for example, count the pairs of vertices at distance exactly $K$.

A path has no natural "top" except with respect to a root, and the tree DP of Chapter 4 handles distances only if $K$ is small. A different idea is to divide and conquer on the tree. A **centroid** of a tree with $n$ vertices is a vertex whose removal splits the tree into components of at most $n/2$ vertices each. Every tree has a centroid: start anywhere and repeatedly move to a neighbor whose side has more than $n/2$ vertices; this walk cannot go back and must end.

The algorithm is the following. Find the centroid $c$ of the current component. Count all paths that **pass through $c$**: such a path consists of one half-path in one branch and another in a different branch (or ends at $c$). Then delete $c$ and recurse into each remaining component. Every path of the original tree is counted exactly once, namely at the first centroid that lies on it.

The recursion depth is $O(\log n)$, since each component is at most half of its parent. At each level the components are disjoint, so the total work per level is linear in $n$ if counting paths through the centroid takes time linear in the size of the component. Overall: $O(n\log n)$.

For counting pairs at distance exactly $K$ through $c$: let $cnt[d]$ be the number of vertices at depth $d$ (from $c$) in the branches processed so far, initialized with $cnt[0]=1$ for $c$ itself. For each new branch, first query: for every vertex at depth $d$ in this branch add $cnt[K-d]$ to the answer; only then add the branch's vertices to $cnt$. This ordering guarantees that the two endpoints lie in different branches.

```python
# Centroid decomposition for counting pairs at distance exactly K
# Global variables (must be initialized before use):
#   g: adjacency list, list of lists of ints
#   sz: list of ints, size n
#   removed_: list of bools, size n
#   K: target distance (int)
#   total: accumulator for answer (int)

sz = []
removed_ = []
total = 0
g = []
K = 0

def calc_size(v, p):
    sz[v] = 1
    for u in g[v]:
        if u != p and not removed_[u]:
            sz[v] += calc_size(u, v)
    return sz[v]

def find_centroid(v, p, tot):
    for u in g[v]:
        if u != p and not removed_[u] and sz[u] * 2 > tot:
            return find_centroid(u, v, tot)
    return v

def collect(v, p, depth, out):
    out.append(depth)
    for u in g[v]:
        if u != p and not removed_[u]:
            collect(u, v, depth + 1, out)

def solve(entry):
    global total
    tot = calc_size(entry, -1)
    c = find_centroid(entry, -1, tot)
    removed_[c] = True
    cnt = [0] * (tot + 1)
    cnt[0] = 1                 # vertices at depth d seen so far
    maxd = 0
    for u in g[c]:
        if removed_[u]:
            continue
        depths = []
        collect(u, c, 1, depths)
        for d in depths:
            if d <= K and K - d <= maxd:
                total += cnt[K - d]
        for d in depths:
            cnt[d] += 1
            if d > maxd:
                maxd = d
    for u in g[c]:
        if not removed_[u]:
            solve(u)
```

```cpp
int sz[N]; bool removed_[N]; ll total = 0;
vector<int> g[N];

int calc_size(int v, int p) {
    sz[v] = 1;
    for (int u : g[v]) if (u != p && !removed_[u]) sz[v] += calc_size(u, v);
    return sz[v];
}
int find_centroid(int v, int p, int tot) {
    for (int u : g[v]) if (u != p && !removed_[u] && sz[u] * 2 > tot) return find_centroid(u, v, tot);
    return v;
}
void collect(int v, int p, int depth, vector<int>& out) {
    out.push_back(depth);
    for (int u : g[v]) if (u != p && !removed_[u]) collect(u, v, depth + 1, out);
}
void solve(int entry) {
    int tot = calc_size(entry, -1);
    int c = find_centroid(entry, -1, tot);
    removed_[c] = true;
    vector<ll> cnt(tot + 1, 0); cnt[0] = 1;                 // vertices at depth d seen so far
    int maxd = 0;
    for (int u : g[c]) {
        if (removed_[u]) continue;
        vector<int> depths; collect(u, c, 1, depths);
        for (int d : depths) if (d <= K && K - d <= maxd) total += cnt[K - d];
        for (int d : depths) { cnt[d]++; maxd = max(maxd, d); }
    }
    for (int u : g[c]) if (!removed_[u]) solve(u);
}
```

Beyond this counting problem, centroid decomposition solves "nearest marked vertex" queries with updates, path queries with constraints on length or weight (combined with sorting or a Fenwick tree to get $O(n\log^2n)$), and many problems of the form "count paths with some property that depends on the two halves". It is useful to think of it as a DP whose state is "a component and its centroid" and whose transitions cross the centroid.

## 8.3 A few more tools worth knowing

**Heavy–light decomposition (HLD).** Split the tree into vertical chains: every vertex picks its child with the largest subtree as the *heavy* child, and the edges to the others are *light*. Any root-to-vertex path crosses only $O(\log n)$ light edges (each light edge at least halves the subtree size), so a path is a union of $O(\log n)$ chain segments. Combined with a segment tree this answers path and subtree queries with updates in $O(\log^2n)$. A particularly neat consequence is **dynamic DP**: if the tree DP transition at each vertex is a fixed small matrix (for example in $(\max,+)$ algebra), the DP value of a chain is a product of matrices, a segment tree maintains these products, and a point update that changes one vertex's weight is processed in $O(\log^2n)$.

**Virtual (auxiliary) tree.** If a query involves only $k$ marked vertices of a huge tree, one can build the compressed tree of the marked vertices and their pairwise lowest common ancestors (it has at most $2k-1$ vertices) in $O(k\log k)$, and run the tree DP on that small tree. This makes the total cost proportional to the sum of the $k$'s over all queries instead of $n$ per query.

**Convex merging.** If $dp[v][\cdot]$ is a concave (or convex) function of the size index, merging two children is a Minkowski sum of two convex sequences, which can be done by merging their slope sequences in sorted order, i.e. in linear time (or with mergeable heaps in $O(\log n)$ amortized). This turns an $O(nK)$ tree knapsack into near-linear time for problems where concavity can be proved, and it is the tree analogue of the optimization theory of the next chapter.

## 8.4 Exercises for this chapter

Codeforces 600E (*Lomsat gelral*, small-to-large or DSU on tree); CSES *Fixed-Length Paths I* and *II* (centroid decomposition); CSES *Distinct Colors* (small-to-large). Verify problem details before assigning, since the list is from memory.


---

# Chapter 9. Optimizing a DP

Suppose you have found a correct DP, but it has too many transitions. This chapter explains four classical techniques that speed up certain recurrences by a whole factor of $n$. All four rely on **structure in the cost function**, and none of them works without it. The skill is to recognize the structure, to be able to prove (or at least test) that it holds, and then to apply the matching technique.

Throughout, you should keep in mind that these optimizations apply to many problems that are not graph problems, for example splitting a sequence into groups. They matter for graph DP because a path or a chain in a tree is a sequence, and chains arise constantly as the "heavy paths" of Chapter 8 or as depth levels.

## 9.1 The shape of the recurrences

Let us fix two shapes.

The first is the **layered partition DP**. You split a sequence of length $n$ into $m$ groups, and a group covering positions $k..j$ has cost $C(k,j)$:

$$dp(i,j)=\min_{0\le k\le j}\Bigl(dp(i-1,k-1)+C(k,j)\Bigr).$$

Here $dp(i,j)$ is the minimum total cost for the first $j+1$ elements split into $i$ groups. There are $m\cdot n$ states and up to $n$ transitions each, so $O(mn^2)$.

The second is the **interval DP**. A segment $[i,j]$ is split at a point $k$ into two smaller segments, and combining has cost $C(i,j)$:

$$dp[i][j]=\min_{i\le k<j}\bigl(dp[i][k]+dp[k+1][j]\bigr)+C(i,j),\qquad dp[i][i]=0.$$

There are $O(n^2)$ states and $O(n)$ transitions, so $O(n^3)$.

Both optimizations below look at the **optimal split point** $opt$, the value of $k$ that attains the minimum, and show that $opt$ moves monotonically as the state moves. If we know it moves monotonically, we do not have to look at all $k$.

## 9.2 The quadrangle inequality

The condition that guarantees monotonicity is expressed through the cost function. We say $C$ satisfies the **quadrangle inequality (QI)** if for all $a\le b\le c\le d$,

$$C(a,c)+C(b,d)\ \le\ C(a,d)+C(b,c).$$

An informal reading: *nested* intervals $[b,c]\subseteq[a,d]$ together cost at least as much as two *crossing* intervals $[a,c]$ and $[b,d]$. A cost like $C(k,j)=(S_j-S_{k-1})^2$, the square of a range sum with non-negative elements, satisfies QI. The cost $C(k,j)=\text{(sum of range)}$ satisfies it with equality. A cost like "the range maximum" often does not. In a contest, you generally either recognize a known family of costs, or prove it by expanding the four terms, or you write a brute force and test the monotonicity of $opt$ on random inputs.

## 9.3 Divide and conquer optimization

**Claim.** For the layered partition DP, if $C$ satisfies QI, then $opt(i,j)\le opt(i,j+1)$: moving the right end of the last group to the right never moves its left end to the left.

*Proof sketch.* Write $f(k)=dp(i-1,k-1)$. Let $j<j'$, let $p=opt(i,j)$ and $q=opt(i,j')$, and resolve ties by taking the smallest minimizer. Suppose, for contradiction, that $q<p$. Then $q<p\le j<j'$. Since $p$ is the smallest minimizer for $j$ and $q<p$, we have strictly $f(p)+C(p,j)<f(q)+C(q,j)$. Since $q$ minimizes for $j'$, we have $f(q)+C(q,j')\le f(p)+C(p,j')$. Adding these two inequalities and cancelling $f(p)+f(q)$ gives

$$C(p,j)+C(q,j')<C(q,j)+C(p,j').$$

But QI applied to $a=q\le b=p\le c=j\le d=j'$ states $C(q,j)+C(p,j')\le C(q,j')+C(p,j)$, a contradiction. $\square$

**The algorithm.** Within one layer $i$, compute $dp(i,j)$ for the middle index $j=\text{mid}$ by scanning all candidates $k$ in the current allowed range $[\text{optl},\text{optr}]$, and find the best $opt$. By monotonicity, all $j<\text{mid}$ have their optimum in $[\text{optl},opt]$, and all $j>\text{mid}$ in $[opt,\text{optr}]$. So we recurse on both halves with the reduced ranges:

```python
def compute(i, l, r, optl, optr):
    # computes dp[i][l..r], knowing that the optimal k for each of them lies in [optl, optr]
    if l > r:
        return
    mid = (l + r) // 2
    best = (10**18, -1)
    for k in range(optl, min(mid, optr) + 1):
        best = min(best, (dp[i - 1][k - 1] + C(k, mid), k))
    dp[i][mid] = best[0]
    compute(i, l, mid - 1, optl, best[1])
    compute(i, mid + 1, r, best[1], optr)

# for each layer i = 1..m:  compute(i, 0, n - 1, 0, n - 1)
```

```cpp
// computes dp[i][l..r], knowing that the optimal k for each of them lies in [optl, optr]
void compute(int i, int l, int r, int optl, int optr) {
    if (l > r) return;
    int mid = (l + r) / 2;
    pair<ll, int> best = {LLONG_MAX, -1};
    for (int k = optl; k <= min(mid, optr); k++)
        best = min(best, {dp[i - 1][k - 1] + C(k, mid), k});
    dp[i][mid] = best.first;
    compute(i, l, mid - 1, optl, best.second);
    compute(i, mid + 1, r, best.second, optr);
}
// for each layer i = 1..m:  compute(i, 0, n - 1, 0, n - 1);
```

(Use a suitable value of $dp[i-1][-1]$, typically $0$ for $i=1$ and $\infty$ otherwise.)

**Complexity.** The recursion depth is $O(\log n)$. At a fixed depth, the subproblems cover disjoint ranges of $j$, and their $k$-ranges $[\text{optl},\text{optr}]$ overlap only at endpoints, so the total number of candidates scanned at that depth is at most $n+(\text{number of subproblems at that depth})=O(n)$. Hence one layer costs $O(n\log n)$ and the whole DP $O(mn\log n)$, instead of $O(mn^2)$. Note that the cost function $C(k,j)$ must be evaluable in $O(1)$, which usually means precomputing prefix sums.

This optimization can be applied only when each layer depends on the *previous layer only*, since we compute a layer completely before moving on. It is the standard tool for "split an array into $m$ groups to minimize the sum of group costs".

## 9.4 Knuth's optimization

For the interval DP, a stronger condition gives a stronger result. Suppose $C$ satisfies QI and is also **monotone on intervals**: $C(b,c)\le C(a,d)$ whenever $a\le b\le c\le d$. Then the optimal split points satisfy

$$opt[i][j-1]\ \le\ opt[i][j]\ \le\ opt[i+1][j].$$

This says that the optimal split point of $[i,j]$ is sandwiched between those of the two intervals one element shorter. (The proof is an induction on the length of the interval, using QI exactly as in the proof above, with one more step; see the cp-algorithms article for the details.) So when computing $dp[i][j]$ we only have to scan $k$ from $opt[i][j-1]$ to $opt[i+1][j]$:

```python
INF = 10**18

for i in range(n):
    dp[i][i] = 0
    opt[i][i] = i

for length in range(2, n + 1):
    for i in range(n - length + 1):
        j = i + length - 1
        dp[i][j] = INF
        for k in range(opt[i][j - 1], min(j - 1, opt[i + 1][j]) + 1):
            v = dp[i][k] + dp[k + 1][j] + C(i, j)
            if v < dp[i][j]:
                dp[i][j] = v
                opt[i][j] = k
```

```cpp
for (int i = 0; i < n; i++) { dp[i][i] = 0; opt[i][i] = i; }
for (int len = 2; len <= n; len++)
    for (int i = 0; i + len - 1 < n; i++) {
        int j = i + len - 1;
        dp[i][j] = INF;
        for (int k = opt[i][j - 1]; k <= min(j - 1, opt[i + 1][j]); k++) {
            ll v = dp[i][k] + dp[k + 1][j] + C(i, j);
            if (v < dp[i][j]) { dp[i][j] = v; opt[i][j] = k; }
        }
    }
```

**Complexity.** Fix the length $len$. The cost of the scans for all $i$ is $\sum_i\bigl(opt[i+1][j]-opt[i][j-1]+1\bigr)$ with $j=i+len-1$. Both $opt[i+1][j]$ and $opt[i][j-1]$ are entries for intervals of length $len-1$ (the first starts at $i+1$, the second at $i$), so the sum telescopes to at most $n+n$. Over $n$ different lengths the total is $O(n^2)$, a gain of a factor $n$ over the naive $O(n^3)$.

Knuth's optimization is the key to problems such as building an optimal binary search tree, optimally merging adjacent piles of stones with a cost depending on the sum of the segment, and many "cut a stick" problems.

## 9.5 The convex hull trick

Now a third kind of structure, which comes not from a cost satisfying an inequality but from a cost that is a **product**. Consider

$$dp[i]=\min_{j<i}\Bigl(dp[j]+b_j\cdot a_i\Bigr)\ (+\text{terms depending only on }i).$$

For each $j$, the expression $dp[j]+b_j\cdot x$ is a **line** in $x$, with slope $b_j$ and intercept $dp[j]$. The value $dp[i]$ is the lowest point among all these lines at $x=a_i$, that is, the **lower envelope** of the lines evaluated at one point. The lower envelope of a set of lines is a convex piecewise linear function, and a line that never appears on it can be discarded forever.

The typical case is that slopes arrive in monotone order (say $b_j$ is decreasing in $j$) and the queries $a_i$ also arrive in monotone order (increasing). Then we maintain the hull in a deque. When adding a new line $l_3$ with the smallest slope, we remove the last line $l_2$ of the hull if it is no longer necessary. With $l_1$ the line before $l_2$ and slopes $m_1>m_2>m_3$, line $l_2$ is useless exactly when $l_3$ overtakes $l_1$ no later than $l_2$ does, that is, when the intersection point of $l_1,l_3$ is not to the right of the intersection point of $l_1,l_2$:

$$\frac{b_3-b_1}{m_1-m_3}\ \le\ \frac{b_2-b_1}{m_1-m_2}\iff (b_3-b_1)(m_1-m_2)\le(b_2-b_1)(m_1-m_3).$$

(Here $b$ denotes an intercept; both denominators are positive, so we may cross-multiply.) For queries with increasing $x$, the best line moves toward the smaller slopes, so we pop the front of the deque while the second line is at least as good at $x$.

```python
from collections import deque

class Line:
    def __init__(self, m, c):
        self.m = m
        self.c = c

    def eval(self, x):
        return self.m * x + self.c

hull = deque()

def useless(l1, l2, l3):
    return (l3.c - l1.c) * (l1.m - l2.m) <= (l2.c - l1.c) * (l1.m - l3.m)

def add_line(l):
    # slopes must be added in decreasing order
    while len(hull) >= 2 and useless(hull[-2], hull[-1], l):
        hull.pop()
    hull.append(l)

def query(x):
    # x must be non-decreasing between calls
    while len(hull) >= 2 and hull[0].eval(x) >= hull[1].eval(x):
        hull.popleft()
    return hull[0].eval(x)
```

```cpp
struct Line { ll m, c; ll eval(ll x) const { return m * x + c; } };
deque<Line> hull;

bool useless(const Line& l1, const Line& l2, const Line& l3) {
    return (__int128)(l3.c - l1.c) * (l1.m - l2.m) <= (__int128)(l2.c - l1.c) * (l1.m - l3.m);
}
void add_line(Line l) {                       // slopes must be added in decreasing order
    while (hull.size() >= 2 && useless(hull[hull.size() - 2], hull.back(), l)) hull.pop_back();
    hull.push_back(l);
}
ll query(ll x) {                              // x must be non-decreasing between calls
    while (hull.size() >= 2 && hull[0].eval(x) >= hull[1].eval(x)) hull.pop_front();
    return hull[0].eval(x);
}
```

Each line enters and leaves the deque once, so the whole DP costs $O(n)$ instead of $O(n^2)$. The `__int128` guards against overflow in the cross-multiplication, which is a very common source of silent wrong answers.

**When the monotonicity fails.** If slopes are not sorted, or queries are not monotone, there are two standard remedies. One is to keep the hull in a balanced structure and binary search in it, for $O(\log n)$ per operation. The other, which is simpler to write and almost always preferred, is the **Li Chao tree**. It is a segment tree over the range of possible query points $x$. Each node stores one line, the one that is lowest at the midpoint of the node's interval among the lines that have reached it. When inserting a new line, compare it with the stored line at the midpoint; the better one stays, and the worse one can be better only on one side (two lines cross at most once), so it is pushed down into that single child. A query walks from the root to the leaf of $x$ and takes the minimum of the stored lines on the way. Insert and query both cost $O(\log X)$.

```python
class Line:
    def __init__(self, m=0, b=0):
        self.m = m
        self.b = b

    def eval(self, x):
        return self.m * x + self.b


class LiChao:
    INF = 4 * 10**18

    class Node:
        def __init__(self, ln):
            self.ln = ln
            self.l = -1
            self.r = -1

    def __init__(self, lo, hi):
        self.lo = lo
        self.hi = hi
        self.t = [self.Node(Line(0, self.INF))]

    def add(self, nw, v, l, r):
        m = (l + r) // 2
        lef = nw.eval(l) < self.t[v].ln.eval(l)
        mid = nw.eval(m) < self.t[v].ln.eval(m)
        if mid:
            self.t[v].ln, nw = nw, self.t[v].ln
        if l == r:
            return
        if lef != mid:                       # the loser can still win on the left half
            if self.t[v].l == -1:
                self.t[v].l = len(self.t)
                self.t.append(self.Node(Line(0, self.INF)))
            self.add(nw, self.t[v].l, l, m)
        else:                                # ... or on the right half
            if self.t[v].r == -1:
                self.t[v].r = len(self.t)
                self.t.append(self.Node(Line(0, self.INF)))
            self.add(nw, self.t[v].r, m + 1, r)

    def query(self, x, v, l, r):
        res = self.t[v].ln.eval(x)
        if l == r:
            return res
        m = (l + r) // 2
        if x <= m and self.t[v].l != -1:
            return min(res, self.query(x, self.t[v].l, l, m))
        if x > m and self.t[v].r != -1:
            return min(res, self.query(x, self.t[v].r, m + 1, r))
        return res
```

```cpp
struct LiChao {
    struct Node { Line ln; int l = -1, r = -1; };
    vector<Node> t; ll lo, hi;
    static constexpr ll INF = (ll)4e18;
    LiChao(ll lo, ll hi) : lo(lo), hi(hi) { t.push_back({Line{0, INF}}); }
    void add(Line nw, int v, ll l, ll r) {
        ll m = (l + r) >> 1;
        bool lef = nw.eval(l) < t[v].ln.eval(l);
        bool mid = nw.eval(m) < t[v].ln.eval(m);
        if (mid) swap(t[v].ln, nw);
        if (l == r) return;
        if (lef != mid) {                       // the loser can still win on the left half
            if (t[v].l == -1) { t[v].l = t.size(); t.push_back({Line{0, INF}}); }
            add(nw, t[v].l, l, m);
        } else {                                // ... or on the right half
            if (t[v].r == -1) { t[v].r = t.size(); t.push_back({Line{0, INF}}); }
            add(nw, t[v].r, m + 1, r);
        }
    }
    ll query(ll x, int v, ll l, ll r) {
        ll res = t[v].ln.eval(x);
        if (l == r) return res;
        ll m = (l + r) >> 1;
        if (x <= m && t[v].l != -1) return min(res, query(x, t[v].l, l, m));
        if (x >  m && t[v].r != -1) return min(res, query(x, t[v].r, m + 1, r));
        return res;
    }
};
// usage: LiChao lc(lo, hi); lc.add(line, 0, lo, hi); lc.query(x, 0, lo, hi);
```

On trees, when the DP transition runs along root-to-vertex paths, the hull must be rolled back on the way up. Li Chao trees support this naturally by recording what each insertion changed.

## 9.6 The Aliens trick (Lagrangian relaxation)

A last technique deals with a different difficulty: a DP that has an **extra dimension $k$** (exactly $k$ groups, exactly $k$ chosen items), where the answer as a function of $k$ is convex. Let $f(k)$ be the optimum value with exactly $k$ groups. Computing the whole table costs a factor $k$. The idea is to remove the dimension by charging a fixed price per group.

For a penalty $\lambda$, define $h(\lambda)=\min_k\bigl(f(k)+\lambda k\bigr)$, which is the value of an unconstrained problem where each group costs an extra $\lambda$. This problem has no dimension $k$ and is often solvable by a simple DP (frequently combined with the convex hull trick). Along with the value, the DP also records how many groups the optimum uses, $c(\lambda)$, choosing the smallest such count on ties. As $\lambda$ increases groups become more expensive, so $c(\lambda)$ is non-increasing. By convexity of $f$, for the smallest integer $\lambda$ with $c(\lambda)\le K$, the target $K$ is among the optimal counts, and therefore

$$f(K)=h(\lambda)-\lambda K.$$

(A check of the claim: for integer-valued $f$, the minimality of $\lambda$ gives $f(K+1)-f(K)+\lambda\le0$, so by convexity the objective is non-increasing up to $K+1$; together with $c(\lambda)\le K$ this places $K$ inside the interval of optimal counts.) We find $\lambda$ by **binary search**, so the total time is $O(\log C)$ times the cost of the unconstrained DP.

```python
# solve(lambda) -> {value of min over all k of f(k) + lambda * k, smallest optimal k}
BIG = 10**18  # range of lambda, depends on the problem
lo = -BIG
hi = BIG
while lo < hi:
    mid = lo + (hi - lo) // 2  # careful with negative numbers
    if solve(mid)[1] <= K:
        hi = mid
    else:
        lo = mid + 1
answer = solve(lo)[0] - lo * K
```

```cpp
// solve(lambda) -> {value of min over all k of f(k) + lambda * k, smallest optimal k}
ll lo = -BIG, hi = BIG;                       // range of lambda, depends on the problem
while (lo < hi) {
    ll mid = lo + (hi - lo) / 2;              // careful with negative numbers
    if (solve(mid).second <= K) hi = mid; else lo = mid + 1;
}
ll answer = solve(lo).first - lo * K;
```

The two traps are ties (the tie-breaking rule must be applied consistently inside `solve`) and the proof of convexity, which is often the hard part of the problem. Contest experts frequently *guess* convexity and confirm it by brute force on small cases.

## 9.7 Choosing the right technique

A compact decision guide follows. The question to ask is "what is the structure of the transition?".

| Recurrence | Needed property | Technique | Time |
|---|---|---|---|
| $dp(i,j)=\min_k\bigl(dp(i-1,k-1)+C(k,j)\bigr)$ | QI for $C$ (monotone $opt$) | Divide and conquer | $O(mn\log n)$ |
| $dp[i][j]=\min_k\bigl(dp[i][k]+dp[k+1][j]\bigr)+C(i,j)$ | QI and monotone $C$ | Knuth | $O(n^2)$ |
| $dp[i]=\min_j\bigl(dp[j]+b_ja_i\bigr)$ | none (lines) | Convex hull trick, Li Chao tree | $O(n)$ or $O(n\log n)$ |
| "exactly $k$ groups", convex in $k$ | convexity of $f(k)$ | Aliens trick | $O(\log C)\times$ inner DP |
| $dp[i]=\min_j\bigl(dp[j]+C(j,i)\bigr)$ (1D) | QI | Monotone queue or offline D&C | $O(n\log n)$ |

## 9.8 Exercises for this chapter

AtCoder Educational DP Contest problem Z (*Frog 3*, Li Chao tree or hull trick); Codeforces 321E (*Ciel and Gondolas*) and 868F (*Yet Another Minimization Problem*) for divide and conquer; Codeforces 319C (*Kalila and Dimna*) for the hull trick; UVa 10304 (*Optimal Binary Search Tree*) for Knuth; IOI 2016 *Aliens* and Codeforces 739E (*Gosha is Hunting*) for the Aliens trick. Check the statements before assigning.

---

# Chapter 10. Becoming fluent

You now have the entire toolbox. What separates a good solver from a great one is not knowing more tricks but being fluent in a way of *thinking*. This last chapter collects that way of thinking, together with the practical habits that prevent most mistakes.

## 10.1 A procedure for any new problem

Begin by deciding what object you are optimizing over: a sequence, a tree, a DAG, a general graph, a set of at most about twenty items. This choice suggests a family of states. For sequences use positions and counters; for trees use subtrees and, if the answer must be known for every root, the rerooting messages; for DAGs use vertices with a topological order; for general graphs look for a way to remove cycles (condensation, shortest-path order, layering); and for small sets use bitmasks.

Next write the recurrence, and check the three ingredients of Section 1.3: is the state complete (does it determine the future?), is there a valid order, and what are the base cases? Then compute the complexity as states times transitions. If it is too slow, look at the structure of the transition (Chapter 9), or at what the state is carrying that it does not need, or at whether a different quantity could be moved into the table index (Section 2.2).

## 10.2 The most common mistakes

Almost all wrong answers in DP come from a small number of causes. The first is an **incomplete state**: the recurrence silently uses a piece of history that the state does not contain, for example in tree independent-set DP forgetting to record whether the parent is chosen. The second is a **wrong order**, such as iterating the knapsack capacity upward when each item may be used only once (Section 2.2), or putting the Floyd–Warshall intermediate vertex in the inner loop (Section 3.4). The third is a **wrong base case or initial value**, particularly using $0$ where $-\infty$ or $+\infty$ is needed ("impossible" must differ from "zero"). The fourth is **overflow**: use `long long`, take the modulus after every multiplication, and remember that adding two "infinity" values can overflow, so test for infinity before adding. The fifth is **double counting** when counting objects, controlled by the loop order as in Section 2.5. And the last is an optimization applied without checking its precondition.

## 10.3 How to test

Write a brute force first, even if it is exponential, and run both programs on thousands of small random inputs and compare. For optimizations such as divide and conquer or Knuth, test directly that the optimal split point is monotone on random data, because if it is not, the technique silently gives wrong answers. When a DP is wrong, print the table for a tiny input and verify one cell by hand.

## 10.4 Complexity summary

| Technique | Time |
|---|---|
| Memoized DP (general) | states $\times$ transitions |
| DP on a DAG | $O(V+E)$ |
| Bellman–Ford, Floyd–Warshall | $O(VE)$, $O(V^3)$ |
| Tree DP | $O(n)$ |
| Tree knapsack with cap $K$ | $O(nK)$ |
| Rerooting | $O(n)$ |
| Bitmask TSP, Hamiltonian path | $O(2^nn^2)$ |
| Submask enumeration | $O(3^n)$ |
| SOS DP | $O(n2^n)$ |
| Broken profile DP | $O(nm2^m)$ |
| SCC condensation | $O(V+E)$ |
| Matrix power | $O(n^3\log k)$ |
| Small-to-large | $O(n\log n)$ to $O(n\log^2n)$ |
| Centroid decomposition | $O(n\log n)$ to $O(n\log^2n)$ |
| Divide and conquer optimization | $O(mn\log n)$ |
| Knuth optimization | $O(n^2)$ |
| Convex hull trick (monotone), Li Chao | $O(n)$, $O(n\log n)$ |

## 10.5 A practice path

Work through the problem sets in this order, and do not move on until you can solve the previous group without looking at a solution. Start with the AtCoder Educational DP Contest, problems A to F (frogs, knapsack, LCS), then G and H (DAG and grid). Continue with I to N (probability and interval DP), then P and V (trees and rerooting), O and U (bitmasks), S and T (digit and permutation DPs), and finish with Z (Li Chao tree). Alongside, solve the CSES "Dynamic Programming", "Graph Algorithms" and "Tree Algorithms" sections in order. Then move to Codeforces problems rated 2000 to 2600 tagged *dp*, *trees*, *bitmasks*, *graphs*, and choose the optimization problems of Chapter 9 last. Keep a notebook of *states* (not code): for every problem you solve, write the state in one line. After a hundred problems you will notice that the same fifty states keep appearing, and that is exactly what fluency means.

## 10.6 The final word

Dynamic programming is a single idea, saving the answers to overlapping subproblems, applied to a very rich family of structures. In this document we have seen it on sequences, on DAGs, on trees from every root, on subsets, on cyclic graphs through condensation and layered graphs, and finally in accelerated form through monotonicity and geometry. When you meet a problem that looks new, ask the three questions of Section 1.3: what is the state, what is the transition, and what is the order. Almost always one of the structures in this course will answer them.
