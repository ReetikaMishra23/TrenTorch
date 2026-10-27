> Every code block has a Python and a C++ version; use the switch above a block to pick one. Your choice is remembered.

# Introduction (Recursion)

This course teaches recursion from the ground up and then develops the ideas used in difficult algorithmic problems. It assumes you can write basic C++17 functions, loops, and conditionals, but it does not assume you understand recursion.

The course is a staircase: first learn what a function call means, then trace recursive calls, prove correctness, reason about complexity, and avoid stack failures. Later chapters cover divide and conquer, recursion on trees and graphs, memoization, recursion with state, and techniques useful in advanced contests.

All code uses C++17. Unless noted otherwise, examples are illustrative snippets that belong inside a program with the required headers and `using namespace std;`.

---

# Chapter 1. What recursion actually is

## 1.1 A function can call another function

A normal function receives inputs, performs work, and returns an answer.

```python
def square(x):
    return x * x
```

```cpp
int square(int x) {
    return x * x;
}
```

When `square(5)` is called, the program remembers that this call is active, evaluates `5 * 5`, returns `25`, and continues where it was called.

There is nothing mysterious about a function calling itself. A recursive function is simply a function whose body calls the same function again.

```python
def sayHello(n):
    if n == 0:
        return
    print("Hello")
    sayHello(n - 1)
```

```cpp
void sayHello(int n) {
    if (n == 0) return;
    cout << "Hello\n";
    sayHello(n - 1);
}
```

Calling `sayHello(3)` prints `Hello` three times. The important part is not the syntax. The important part is that each call solves a smaller version of the same task.

## 1.2 The two ingredients

A useful recursive function normally has two ingredients:

1. **Base case:** a smallest case that can be answered immediately, without another recursive call.
2. **Recursive step:** a rule that reduces the current problem to one or more smaller problems.

For `sayHello(n)`, the base case is `n == 0`. The recursive step prints once and asks `sayHello(n - 1)` to handle the remaining `n - 1` greetings.

If we forget the base case, the function may call itself forever until the program runs out of call-stack space.

```python
def broken(n):
    print(n)
    broken(n - 1)  # no stopping condition
```

```cpp
void broken(int n) {
    cout << n << '\n';
    broken(n - 1); // no stopping condition
}
```

A base case is not decoration. It is part of the algorithm.

## 1.3 Trace the calls by hand

For `sayHello(3)`, the calls look like this:

```text
sayHello(3)
  prints Hello
  calls sayHello(2)
    prints Hello
    calls sayHello(1)
      prints Hello
      calls sayHello(0)
        returns immediately
      returns to sayHello(1)
    returns to sayHello(2)
  returns to sayHello(3)
```

There are two directions to remember:

- **Going down:** calls are created and work before the recursive call is performed.
- **Coming back up:** each call resumes after the recursive call returns.

This second direction explains why code placed after a recursive call runs in reverse order.

```python
def trace(n):
    if n == 0:
        return
    print("enter", n)
    trace(n - 1)
    print("leave", n)
```

```cpp
void trace(int n) {
    if (n == 0) return;
    cout << "enter " << n << '\n';
    trace(n - 1);
    cout << "leave " << n << '\n';
}
```

For `trace(3)`, all `enter` lines appear first (`3, 2, 1`), then `leave` lines (`1, 2, 3`).

## 1.4 A first numerical example: countdown

```python
def countdown(n):
    if n < 0:
        return
    print(n, end=' ')
    countdown(n - 1)
```

```cpp
void countdown(int n) {
    if (n < 0) return;
    cout << n << ' ';
    countdown(n - 1);
}
```

Input `3` prints `3 2 1 0`. The function state is just `n`. Every recursive step decreases it, so it eventually reaches a stopping case.

Notice the measure that decreases: `n`. A good way to check whether recursion terminates is to identify a quantity that moves toward a base case at every step.

## 1.5 Check your understanding

1. What is the base case of `sayHello`?
2. How many times is `sayHello(7)` called, including `sayHello(0)`?
3. Why does `trace(3)` print `leave 1` before `leave 2`?
4. What goes wrong if `n` never changes in the recursive call?

**Answers:** (1) `n == 0`. (2) Eight calls: values 7 down to 0. (3) The deepest call returns first. (4) The same state repeats without progress, eventually exhausting the call stack.

---

# Chapter 2. The call stack: where unfinished calls live

## 2.1 Each call has its own local variables

Consider:

```python
def printDown(n):
    if n == 0:
        return
    print(n, end=' ')
    printDown(n - 1)
```

```cpp
void printDown(int n) {
    if (n == 0) return;
    cout << n << ' ';
    printDown(n - 1);
}
```

When `printDown(3)` calls `printDown(2)`, the first call does not disappear. It is paused, waiting for the second call to finish. Each active call has its own value of `n`.

Conceptually, the call stack contains:

```text
top -> printDown(1), n = 1
       printDown(2), n = 2
       printDown(3), n = 3
```

When `printDown(1)` returns, its stack frame is removed and execution resumes inside `printDown(2)`. This is called **last in, first out** (LIFO), the same rule used by a stack data structure.

## 2.2 Work before and after recursion

The position of an operation relative to the recursive call changes its behavior.

```python
def first(n):
    if n == 0:
        return
    print(n, end=' ')   # before recursion
    first(n - 1)

def second(n):
    if n == 0:
        return
    second(n - 1)
    print(n, end=' ')   # after recursion
```

```cpp
void first(int n) {
    if (n == 0) return;
    cout << n << ' ';   // before recursion
    first(n - 1);
}

void second(int n) {
    if (n == 0) return;
    second(n - 1);
    cout << n << ' ';   // after recursion
}
```

- `first(4)` prints `4 3 2 1`.
- `second(4)` prints `1 2 3 4`.

This is not because the second function runs backward. It reaches the base case first and then prints while calls return.

## 2.3 Returning values

A recursive function can return an answer. Each call can use the answer returned by a smaller call.

```python
def sumTo(n):
    if n <= 0:
        return 0
    return n + sumTo(n - 1)
```

```cpp
int sumTo(int n) {
    if (n <= 0) return 0;
    return n + sumTo(n - 1);
}
```

For `sumTo(4)`:


$$
S(4)=4+S(3)=4+3+S(2)=4+3+2+S(1)=4+3+2+1+S(0)=10.
$$


The return value travels back through the waiting calls. A frequent beginner mistake is to call the function but discard its result:

```python
def wrongSum(n):
    if n <= 0:
        return 0
    wrongSum(n - 1)  # result ignored
    return n         # does not add the smaller sum
```

```cpp
int wrongSum(int n) {
    if (n <= 0) return 0;
    wrongSum(n - 1); // result ignored
    return n;        // does not add the smaller sum
}
```

This function returns `n`, not the sum from `1` to `n`.

## 2.4 Parameters versus global state

Prefer passing the information a function needs as parameters. Global variables can be convenient in contest code, but they make functions harder to reason about and can cause stale state between test cases.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

```cpp
long long factorial(int n) {
    if (n <= 1) return 1;
    return 1LL * n * factorial(n - 1);
}
```

Here the input and output are explicit. The function does not depend on hidden mutable state.

---

# Chapter 3. Designing a recursive solution

When you face a new problem, do not start by writing recursive syntax. Start by defining the problem each call is supposed to solve.

## 3.1 The four-question method

For almost every recursive problem, answer these questions:

1. **Meaning:** What exactly does `solve(state)` promise to return or accomplish?
2. **Base case:** Which smallest states can be answered directly?
3. **Reduction:** How does the answer depend on smaller states?
4. **Progress:** Why does every recursive path eventually reach a base case?

For `sumTo(n)`, the meaning is “return the sum of integers from 1 through `n`.” The base case is `n <= 0`, whose sum is zero. The reduction is `n + sumTo(n - 1)`. The state decreases by one.

Writing down the meaning prevents a common error: the code may look plausible but the function's actual meaning changes halfway through.

## 3.2 Factorial

Factorial is defined by


$$
n! = 1\cdot2\cdot3\cdots n,\qquad 0!=1.
$$


Separate the last factor:


$$
n! = n\cdot(n-1)!.
$$


That identity directly gives the recursive solution:

```python
def factorial(n):
    if n < 0:
        raise ValueError("factorial requires n >= 0")
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

```cpp
long long factorial(int n) {
    if (n < 0) throw invalid_argument("factorial requires n >= 0");
    if (n <= 1) return 1;
    return 1LL * n * factorial(n - 1);
}
```

For non-negative `n`, the time is $O(n)$, and the maximum recursion depth is $O(n)$. The result overflows `long long` quickly; recursion does not solve numeric overflow.

## 3.3 Power

To compute $a^n$, one simple recurrence is


$$
a^n=a\cdot a^{n-1},\quad a^0=1.
$$


```python
def powerLinear(a, n):
    if n == 0:
        return 1
    return a * powerLinear(a, n - 1)
```

```cpp
long long powerLinear(long long a, int n) {
    if (n == 0) return 1;
    return a * powerLinear(a, n - 1);
}
```

This uses $O(n)$ multiplications and $O(n)$ stack space. Later, divide-and-conquer will reduce the number of multiplications to $O(\log n)$.

## 3.4 Fibonacci: a correct definition can still be slow

The Fibonacci sequence is defined by


$$
F(0)=0,\quad F(1)=1,\quad F(n)=F(n-1)+F(n-2).
$$


```python
def fibSlow(n):
    if n <= 1:
        return n
    return fibSlow(n - 1) + fibSlow(n - 2)
```

```cpp
long long fibSlow(int n) {
    if (n <= 1) return n;
    return fibSlow(n - 1) + fibSlow(n - 2);
}
```

This matches the mathematical definition. But it recomputes the same values repeatedly. `fibSlow(5)` asks for `fibSlow(3)` in two different branches. The call tree grows exponentially; the time is $O(\varphi^n)$, commonly bounded as $O(2^n)$. This is an important lesson: a recursive definition does not automatically imply an efficient algorithm.

Memoization fixes the repeated work:

```python
# This matches the mathematical definition. But it recomputes the same values repeatedly.
# fibSlow(5) asks for fibSlow(3) in two different branches.
# The call tree grows exponentially; the time is O(phi^n), commonly bounded as O(2^n).
# This is an important lesson: a recursive definition does not automatically imply an efficient algorithm.
def fibSlow(n):
    if n <= 1:
        return n
    return fibSlow(n - 1) + fibSlow(n - 2)


# Memoization fixes the repeated work.
def fibMemo(n, memo):
    if n <= 1:
        return n
    if memo[n] != -1:
        return memo[n]
    memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo)
    return memo[n]
```

```cpp
long long fibMemo(int n, vector<long long>& memo) {
    if (n <= 1) return n;
    if (memo[n] != -1) return memo[n];
    return memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
}
```

Call it with a vector of size `n + 1` initialized to `-1`. Every state is computed once, giving $O(n)$ time and $O(n)$ memory. This is the bridge between recursion and dynamic programming.

## 3.5 Euclid's GCD as recursion

The identity


$$
\gcd(a,b)=\gcd(b,a\bmod b)
$$


gives a natural recursive function:

```python
def gcdRec(a, b):
    if b == 0:
        return a
    return gcdRec(b, a % b)
```

```cpp
long long gcdRec(long long a, long long b) {
    if (b == 0) return a;
    return gcdRec(b, a % b);
}
```

Each call makes the second argument smaller in a strong way. The time is $O(\log \min(a,b))$ for positive inputs, and the recursion depth is logarithmic. This is an example where recursion expresses the mathematical proof very clearly.

---

# Chapter 4. Correctness: why recursive code works

A program should not merely pass examples. We want a reason that it works for every valid input.

## 4.1 Induction and recursion are partners

Mathematical induction proves a statement by showing:

1. it holds for a base case;
2. if it holds for a smaller case, it holds for the next case.

Recursive algorithms often follow exactly this structure.

For `sumTo(n)`, assume the function correctly returns the sum through `n - 1`. The function returns `n + sumTo(n - 1)`, which is therefore the sum through `n`. The base case `sumTo(0) = 0` is correct. By induction, every non-negative input is handled correctly.

## 4.2 A proof template

For a recursive function `solve(s)`:

- State the intended meaning precisely.
- Show every base case returns the correct answer.
- Assume recursive calls correctly solve their smaller states.
- Show the transition combines those answers into the correct answer for `s`.
- Show recursive calls are valid and terminate.

This is often called a **strong induction** argument when a state can depend on several smaller states.

## 4.3 Termination is a separate proof

Correctness and termination are related but not identical. A function might have the right formula but recurse forever due to a bug.

A common termination measure is a non-negative integer that strictly decreases with every recursive call. Examples include:

- `n` in `solve(n - 1)`;
- the length of an unprocessed string;
- the number of remaining choices;
- the size of a search interval.

For graph recursion, a measure may not decrease numerically along every edge. Instead, we can mark visited vertices or use a structural property such as a tree having no cycles.

## 4.4 The danger of a wrong base case

```python
def sumWrong(n):
    if n == 1:
        return 0  # wrong: sum from 1 to 1 is 1
    return n + sumWrong(n - 1)
```

```cpp
int sumWrong(int n) {
    if (n == 1) return 0; // wrong: sum from 1 to 1 is 1
    return n + sumWrong(n - 1);
}
```

The recurrence is fine for larger values, but the base case changes the meaning and makes every answer one too small. Always test the smallest valid inputs manually.

---

# Chapter 5. Recursion and complexity

## 5.1 Linear recursion

If each call does constant work and makes one call on `n - 1`, then


$$
T(n)=T(n-1)+O(1),
$$


so $T(n)=O(n)$. There are `n` active calls in the worst case, so stack space is $O(n)$.

Examples: factorial, sum from 1 to `n`, printing a sequence recursively.

## 5.2 Binary recursion

If each call creates two calls on inputs around `n - 1`, a recurrence may be


$$
T(n)=2T(n-1)+O(1),
$$


which grows exponentially. Naive Fibonacci has this shape (with a slightly more precise recurrence $T(n)=T(n-1)+T(n-2)+O(1)$).

The number of recursive calls matters. “The function is short” does not mean it is fast.

## 5.3 Divide-and-conquer recursion

If each call makes two subproblems of size $n/2$ and does $O(n)$ extra work, then


$$
T(n)=2T(n/2)+O(n)=O(n\log n).
$$


Merge sort is the classic example. The recursion tree has about $\log n$ levels, and the total work per level is $O(n)$.

## 5.4 Count states and repeated work

For a recursion that can reach the same state many times, distinguish:

- **Call count:** how many function invocations occur without caching;
- **Distinct states:** how many different inputs or states exist;
- **Work per state:** how much work is done when computing one state.

Memoization often changes exponential call count into `number of states × work per state`.

---

# Chapter 6. Divide and conquer

Divide and conquer solves a problem by splitting it into smaller independent problems, solving them recursively, then combining the results.

## 6.1 Binary search

Suppose a sorted array contains `x`. Checking every element is $O(n)$. Binary search checks the middle and discards half the remaining interval.

```python
def binarySearchRec(a, x, left, right):
    if left > right:
        return -1
    mid = left + (right - left) // 2

    if a[mid] == x:
        return mid
    if a[mid] < x:
        return binarySearchRec(a, x, mid + 1, right)
    return binarySearchRec(a, x, left, mid - 1)
```

```cpp
int binarySearchRec(const vector<int>& a, int x, int left, int right) {
    if (left > right) return -1;
    int mid = left + (right - left) / 2;

    if (a[mid] == x) return mid;
    if (a[mid] < x) return binarySearchRec(a, x, mid + 1, right);
    return binarySearchRec(a, x, left, mid - 1);
}
```

Call with `left = 0` and `right = (int)a.size() - 1`. The interval shrinks by about half each time, giving $O(\log n)$ time and $O(\log n)$ stack space.

**Invariant:** if `x` exists in the array, it remains inside the current search interval. The sorted order is what makes discarding half safe.

## 6.2 Merge sort

Merge sort splits an array into two halves, sorts both recursively, and merges the sorted halves.

```python
def mergeSort(a, l, r):
    # half-open interval [l, r)
    if r - l <= 1:
        return
    m = l + (r - l) // 2
    mergeSort(a, l, m)
    mergeSort(a, m, r)

    merged = []
    i, j = l, m
    while i < m and j < r:
        if a[i] <= a[j]:
            merged.append(a[i])
            i += 1
        else:
            merged.append(a[j])
            j += 1
    while i < m:
        merged.append(a[i])
        i += 1
    while j < r:
        merged.append(a[j])
        j += 1
    a[l:r] = merged
```

```cpp
void mergeSort(vector<int>& a, int l, int r) {
    if (r - l <= 1) return;  // half-open interval [l, r)
    int m = l + (r - l) / 2;
    mergeSort(a, l, m);
    mergeSort(a, m, r);

    vector<int> merged;
    merged.reserve(r - l);
    int i = l, j = m;
    while (i < m && j < r) {
        if (a[i] <= a[j]) merged.push_back(a[i++]);
        else merged.push_back(a[j++]);
    }
    while (i < m) merged.push_back(a[i++]);
    while (j < r) merged.push_back(a[j++]);
    copy(merged.begin(), merged.end(), a.begin() + l);
}
```

Call `mergeSort(a, 0, a.size())`. The half-open interval `[l, r)` contains `r - l` elements and makes empty intervals easy to represent.

Time is $O(n\log n)$, auxiliary memory is $O(n)$, and recursion depth is $O(\log n)$. Merge sort is stable here because equal elements from the left half are taken first.

## 6.3 Divide and conquer versus dynamic programming

Divide and conquer usually creates independent subproblems. Dynamic programming is especially useful when subproblems overlap and the same state would otherwise be solved many times. Naive Fibonacci has overlap; merge sort does not meaningfully recompute the same interval.

---

# Chapter 7. Recursion on arrays, strings, and trees

## 7.1 Reverse a string recursively

One way is to print the last character, then recurse on the prefix. Another is to swap endpoints and move inward.

```python
def reverseRange(s, l, r):
    if l >= r:
        return
    s[l], s[r] = s[r], s[l]
    reverseRange(s, l + 1, r - 1)
```

```cpp
void reverseRange(string& s, int l, int r) {
    if (l >= r) return;
    swap(s[l], s[r]);
    reverseRange(s, l + 1, r - 1);
}
```

Call `reverseRange(s, 0, (int)s.size() - 1)`. There are $O(n)$ swaps and $O(n)$ recursion depth. For very long strings, an iterative loop avoids stack use.

## 7.2 Sum an array

```python
def sumArray(a, i):
    if i == len(a):
        return 0
    return a[i] + sumArray(a, i + 1)
```

```cpp
long long sumArray(const vector<int>& a, int i) {
    if (i == (int)a.size()) return 0;
    return a[i] + sumArray(a, i + 1);
}
```

The meaning is “sum elements from index `i` to the end.” The base case is the empty suffix. The function has $O(n)$ time and $O(n)$ stack space. This example is useful for learning but a loop is usually preferable in production code.

## 7.3 Tree recursion

A tree is naturally recursive: every node has child subtrees, and each child subtree is itself a tree.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value = value
        self.left = left
        self.right = right


def size(root):
    if not root:
        return 0
    return 1 + size(root.left) + size(root.right)
```

```cpp
struct Node {
    int value;
    Node* left = nullptr;
    Node* right = nullptr;
};

int size(Node* root) {
    if (!root) return 0;
    return 1 + size(root->left) + size(root->right);
}
```

The answer for a node is one (the node itself) plus the sizes of its left and right subtrees. Every node is visited once, so time is $O(n)$; stack space is $O(h)$, where `h` is the tree height. A skewed tree can have height $n$, so recursion depth is not always logarithmic.

## 7.4 Traversals

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value = value
        self.left = left
        self.right = right

def preorder(root):
    if root is None:
        return
    print(root.value, end=' ')
    preorder(root.left)
    preorder(root.right)

def inorder(root):
    if root is None:
        return
    inorder(root.left)
    print(root.value, end=' ')
    inorder(root.right)

def postorder(root):
    if root is None:
        return
    postorder(root.left)
    postorder(root.right)
    print(root.value, end=' ')
```

```cpp
void preorder(Node* root) {
    if (!root) return;
    cout << root->value << ' ';
    preorder(root->left);
    preorder(root->right);
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->value << ' ';
    inorder(root->right);
}

void postorder(Node* root) {
    if (!root) return;
    postorder(root->left);
    postorder(root->right);
    cout << root->value << ' ';
}
```

The names describe when the node is processed relative to its children. In a binary search tree, inorder traversal prints values in sorted order, assuming the usual BST ordering rule.

## 7.5 Graph recursion and visited states

Graphs may contain cycles, so recursion cannot simply follow every neighbor forever.

```python
def dfs(v, adj, seen):
    seen[v] = True
    for u in adj[v]:
        if not seen[u]:
            dfs(u, adj, seen)
```

```cpp
void dfs(int v, const vector<vector<int>>& adj, vector<char>& seen) {
    seen[v] = true;
    for (int u : adj[v]) {
        if (!seen[u]) dfs(u, adj, seen);
    }
}
```

Mark a vertex before recursing into its neighbors. Marking it only after all children finish can cause infinite recursion on a cycle. The time is $O(V+E)$ with adjacency lists. Stack depth can reach $O(V)$, so iterative DFS may be safer for very deep graphs.

---

# Chapter 8. Memoization and the bridge to dynamic programming

## 8.1 Cache answers by state

Memoization stores the answer once it has been computed. The cache key must contain every piece of information that can change the answer.

```python
def ways(n, memo):
    if n < 0:
        return 0
    if n == 0:
        return 1
    if memo[n] != -1:
        return memo[n]
    memo[n] = ways(n - 1, memo) + ways(n - 2, memo)
    return memo[n]
```

```cpp
long long ways(int n, vector<long long>& memo) {
    if (n < 0) return 0;
    if (n == 0) return 1;
    if (memo[n] != -1) return memo[n];
    return memo[n] = ways(n - 1, memo) + ways(n - 2, memo);
}
```

This computes the number of ways to reach step `n` using steps of size one or two. The state is `n`, because the future depends only on how many steps remain.

## 8.2 When the state needs more information

Suppose a robot moves through a grid. The number of ways to finish does not depend only on the row; it depends on both row and column. The state must be `(r, c)`. If movement also depends on a limited resource, the state may need to include the remaining resource.

A cache with an incomplete key silently combines different subproblems and produces incorrect results.

## 8.3 Memoization versus tabulation

- **Memoization:** top-down; start with the requested state and recursively compute dependencies.
- **Tabulation:** bottom-up; choose an order and fill states so dependencies are ready.

Memoization can be easier to derive and may skip unreachable states. Tabulation avoids recursive overhead and stack limits, and often offers better memory layout. Both rely on the same state and transition.

---

# Chapter 9. Recursion patterns used in advanced problems

## 9.1 Backtracking is recursion plus undo

Backtracking explores a choice, recursively explores what follows, then restores the state so another choice can be tried. It is covered in a companion course, but the core pattern is:

```python
def search(state):
    if isComplete(state):
        recordAnswer(state)
        return

    for c in validChoices(state):
        apply(state, c)
        search(state)
        undo(state, c)
```

```cpp
void search(State& state) {
    if (isComplete(state)) {
        recordAnswer(state);
        return;
    }

    for (Choice c : validChoices(state)) {
        apply(state, c);
        search(state);
        undo(state, c);
    }
}
```

The `undo` step is essential when multiple branches share the same mutable state.

## 9.2 Divide-and-conquer on answer space

Binary search on the answer is not always recursion, but it uses the same reduction principle: a monotonic condition lets us discard half the candidates. For a predicate `ok(x)` that changes from false to true, we can find the first true value by maintaining an interval containing the boundary.

## 9.3 Recursion with bitmasks

For a small set of `n` objects, a bitmask can represent which objects have been used. A state might be `(mask, last)`, where `mask` records chosen objects and `last` records the current endpoint. There are $2^n$ masks and up to `n` last vertices, so a dynamic program can have $O(n2^n)$ states. This appears in subset DP and Hamiltonian path problems.

## 9.4 Meet in the middle

When brute force over `n` choices costs $2^n$, but `n` is around 40, split the choices into two halves. Enumerate $2^{n/2}$ possibilities per half and combine them. This is a recursive/decomposition mindset that can reduce an infeasible exponential search to roughly $O(2^{n/2})$ memory and work per half, plus combination costs.

## 9.5 Tail recursion and iterative conversion

A function is tail-recursive when the recursive call is the final operation:

```python
def sumTail(n, acc=0):
    if n == 0:
        return acc
    return sumTail(n - 1, acc + n)
```

```cpp
long long sumTail(int n, long long acc = 0) {
    if (n == 0) return acc;
    return sumTail(n - 1, acc + n);
}
```

C++ does not guarantee tail-call optimization. Do not assume this uses constant stack space. It can be converted to a loop:

```python
def sumIterative(n):
    acc = 0
    while n > 0:
        acc += n
        n -= 1
    return acc
```

```cpp
long long sumIterative(int n) {
    long long acc = 0;
    while (n > 0) acc += n--;
    return acc;
}
```

---

# Chapter 10. Stack limits, pitfalls, and debugging (recursion)

## 10.1 Stack overflow

Every active recursive call needs stack space. If depth is `n`, stack memory is usually $O(n)$. A recursion of depth several hundred thousand may crash depending on environment and frame size.

Consider an iterative version when:
- input can create a very deep chain;
- recursion depth depends on adversarial input;
- each frame contains large local arrays;
- the language or judge has a strict stack limit.

## 10.2 Missing or incorrect base case

Always test the smallest inputs and boundary states. For factorial, test `0` and `1`. For binary search, test an empty array and a one-element array. For tree traversal, test a null root.

## 10.3 Off-by-one errors

Write down the meaning of each parameter. Does `n` mean the number of elements, the last index, or an exclusive endpoint? Half-open intervals `[l, r)` are often easier because their length is exactly `r - l`.

## 10.4 Accidental exponential work

A function that branches into two calls may have exponential runtime. Draw a small call tree and count repeated states. If the same state appears multiple times, consider memoization or a different recurrence.

## 10.5 Mutating shared state

If a recursive call modifies a vector, string, board, or set, decide whether that change should persist. If the call explores one branch only, it may need to undo its modifications before returning.

## 10.6 Debugging checklist

For a recursive function, write down:
- the exact meaning of one call;
- the base case and its answer;
- the smaller state passed to every recursive call;
- whether the recursive call's return value is used;
- whether local state is restored;
- the maximum depth;
- the number of distinct states and calls.

---

# Chapter 11. Practice ladder (recursion)

Try these in order. For each problem, write the meaning of the function before coding.

## Beginner

1. Print integers from `n` down to `1`.
2. Print integers from `1` up to `n`.
3. Compute the sum of digits of a non-negative integer.
4. Count digits recursively.
5. Compute factorial.
6. Compute $a^n$ using linear recursion.
7. Reverse a string.
8. Find the maximum element in an array recursively.

## Intermediate

9. Implement recursive binary search.
10. Implement merge sort.
11. Compute GCD recursively.
12. Generate all subsequences of a string.
13. Traverse a binary tree in preorder, inorder, and postorder.
14. Find the height and size of a binary tree.
15. Use memoization to compute Fibonacci.
16. Count paths through a grid with obstacles.

## Advanced

17. Solve Tower of Hanoi and derive its move count.
18. Implement fast exponentiation recursively.
19. Use recursion plus memoization for minimum coin change.
20. Solve subset sum with memoized states.
21. Find connected components with DFS; then convert DFS to iterative form.
22. Solve a small Hamiltonian path problem with subset DP.
23. Compare naive recursion, memoization, and bottom-up DP on the same problem.
24. Find a recursive algorithm whose depth is linear and redesign it to avoid stack overflow.

## Grandmaster-oriented extensions

25. Prove the recurrence and complexity of divide-and-conquer DP before implementing it.
26. Study recursion trees and the Master Theorem for recurrences such as $T(n)=aT(n/b)+f(n)$.
27. Explore centroid decomposition: recursively remove a centroid, then process the remaining components.
28. Study divide-and-conquer optimization and identify the monotonicity property it requires.
29. Learn recursion on persistent data structures, where old versions remain available.
30. Compare recursion-based segment tree operations with iterative segment trees and analyze constant factors.

These final tasks require additional topics; they are listed as a direction for further study rather than fully developed here.

---

# Chapter 12. Final mental model (recursion)

Recursion is not a special kind of loop. It is a way to define a problem in terms of smaller versions of itself.

A strong recursive solution has:
- a precise state and meaning;
- correct base cases;
- a transition that reduces the problem;
- a termination argument;
- a correctness proof, often by induction;
- a realistic analysis of calls, work, and stack depth.

When repeated states appear, memoization can transform recursion into dynamic programming. When subproblems are independent, divide and conquer can organize the work. When a problem requires trying choices and undoing them, backtracking is the natural next step.

Do not memorize code first. Learn to explain what one call means, what smaller question it asks, and why the returned answer is sufficient.

# Introduction (Backtracking)

This course teaches backtracking from zero and builds toward the search techniques used in difficult programming contests. It assumes basic C++17 knowledge and familiarity with functions and vectors. The companion *Recursion in C++* course explains the call stack and recursive correctness in more detail; this document briefly rebuilds the ideas it needs.

Backtracking is not merely “recursion that tries things.” It is a disciplined way to explore a search space, reject choices that cannot lead to a valid answer, and restore state so that other choices can be explored correctly.

---

# Chapter 1. The idea: build a solution one decision at a time

## 1.1 A small problem

Suppose we have the numbers `{1, 2, 3}` and want to print every subset. Each number has two choices: include it or exclude it. The full search tree is:

```text
                         {}
                  / include 1   \ exclude 1
                {1}              {}
              /     \          /     \
          +2         -2      +2       -2
        {1,2}       {1}      {2}       {}
        /   \       /  \     /  \     /  \
     +3/-3 ...    ...      ...       ...
```

There are $2^n$ subsets of an `n`-element set because each element independently has two choices.

A backtracking algorithm explores these decisions recursively. At a leaf, it has decided every element and can report one complete subset.

## 1.2 The three steps

A basic backtracking search follows this pattern:

1. **Choose** one option.
2. **Explore** the consequences of that choice recursively.
3. **Undo** the choice so the next option starts from the correct state.

The undo step is often called *backtracking*. It is what lets one mutable vector or board represent many branches of the search tree without copying the entire state at every call.

## 1.3 First complete implementation: all subsets

```python
def generateSubsets(i, a, chosen):
    if i == len(a):
        print("{ ", end="")
        for x in chosen:
            print(x, end=" ")
        print("}")
        return

    # Choice 1: include a[i].
    chosen.append(a[i])
    generateSubsets(i + 1, a, chosen)

    # Undo the include choice.
    chosen.pop()

    # Choice 2: exclude a[i].
    generateSubsets(i + 1, a, chosen)

if __name__ == "__main__":
    a = [1, 2, 3]
    chosen = []
    generateSubsets(0, a, chosen)
```

```cpp
#include <bits/stdc++.h>
using namespace std;

void generateSubsets(int i, const vector<int>& a, vector<int>& chosen) {
    if (i == (int)a.size()) {
        cout << "{ ";
        for (int x : chosen) cout << x << ' ';
        cout << "}\n";
        return;
    }

    // Choice 1: include a[i].
    chosen.push_back(a[i]);
    generateSubsets(i + 1, a, chosen);

    // Undo the include choice.
    chosen.pop_back();

    // Choice 2: exclude a[i].
    generateSubsets(i + 1, a, chosen);
}

int main() {
    vector<int> a = {1, 2, 3};
    vector<int> chosen;
    generateSubsets(0, a, chosen);
}
```

The state is `i` plus the current `chosen` subset. The base case means “all decisions have been made.” Every internal call makes two branches. Time is $O(n2^n)$ if printing each subset of average size $O(n)$; the search tree itself has $O(2^n)$ nodes. Auxiliary recursion depth is $O(n)$, excluding output storage.

## 1.4 Why undo matters

Imagine removing `chosen.pop_back()`. After the branch that includes `a[i]` finishes, the next branch is supposed to exclude it—but the element remains in `chosen`. Results from different branches contaminate one another.

A reliable rule: whenever a recursive branch changes shared mutable state, identify the exact inverse operation and perform it after the recursive call.

---

# Chapter 2. A systematic way to design backtracking

Before coding, answer five questions.

1. **What does one state represent?** For example, `i` means the first `i` elements have already been decided.
2. **What choices are available?** Include or exclude, place a number, choose a neighbor, assign a color, and so on.
3. **When is a solution complete?** All elements processed, target reached, all queens placed, or all vertices assigned.
4. **When can a branch be rejected early?** A partial sum exceeds the target, two queens attack each other, or a partial assignment violates a constraint.
5. **What state must be undone?** A vector insertion, board placement, visited mark, sum update, or used-character flag.

This produces a general skeleton:

```python
def search(state):
    if is_complete(state):
        save_answer(state)
        return

    for choice in choices(state):
        if not is_allowed(state, choice):
            continue

        apply(state, choice)
        search(state)
        undo(state, choice)
```

```cpp
void search(State& state) {
    if (isComplete(state)) {
        saveAnswer(state);
        return;
    }

    for (Choice choice : choices(state)) {
        if (!isAllowed(state, choice)) continue;

        apply(state, choice);
        search(state);
        undo(state, choice);
    }
}
```

The skeleton is not a drop-in implementation because `State`, `Choice`, and the helper functions depend on the problem. It is a checklist for constructing the algorithm.

---

# Chapter 3. Subsets and combinations

## 3.1 Generate subsets with include/exclude

The implementation in Chapter 1 generates all subsets. Its tree has $2^n$ leaves, so generating all subsets is necessarily exponential in `n`: the output alone contains $2^n$ subsets.

If the problem asks only whether a target sum is reachable, we may not need to generate every subset. This observation leads to pruning and dynamic programming.

## 3.2 Combinations of exactly `k` elements

We can choose `k` elements from `1..n` in increasing order. The increasing-order rule avoids generating the same combination in different orders.

```python
def chooseK(next, n, k, cur, ans):
    if len(cur) == k:
        ans.append(cur.copy())
        return

    need = k - len(cur)
    for x in range(next, n - need + 2):
        cur.append(x)
        chooseK(x + 1, n, k, cur, ans)
        cur.pop()
```

```cpp
void chooseK(int next, int n, int k,
             vector<int>& cur, vector<vector<int>>& ans) {
    if ((int)cur.size() == k) {
        ans.push_back(cur);
        return;
    }

    int need = k - (int)cur.size();
    for (int x = next; x <= n - need + 1; ++x) {
        cur.push_back(x);
        chooseK(x + 1, n, k, cur, ans);
        cur.pop_back();
    }
}
```

Why stop at `n - need + 1`? If we choose a number larger than that, too few values remain to fill the combination. This is pruning based on a simple feasibility bound.

The number of answers is $\binom nk$. Since every answer has length `k`, outputting all of them takes at least $\Omega(k\binom nk)$ time. Backtracking is appropriate because the output itself may be large.

## 3.3 Avoid duplicate combinations when values repeat

If the input is `{1, 1, 2}` and we want unique subsets by value, naïve include/exclude can print the same value-subset more than once. Sort the input, then skip equal choices at the same recursion depth:

```python
def uniqueSubsets(start, a, cur, ans):
    ans.append(cur.copy())
    for i in range(start, len(a)):
        if i > start and a[i] == a[i - 1]:
            continue
        cur.append(a[i])
        uniqueSubsets(i + 1, a, cur, ans)
        cur.pop()
```

```cpp
void uniqueSubsets(int start, const vector<int>& a,
                   vector<int>& cur, vector<vector<int>>& ans) {
    ans.push_back(cur);

    for (int i = start; i < (int)a.size(); ++i) {
        if (i > start && a[i] == a[i - 1]) continue;
        cur.push_back(a[i]);
        uniqueSubsets(i + 1, a, cur, ans);
        cur.pop_back();
    }
}
```

The condition `i > start` is important. Equal values are skipped only when they would create duplicate branches at the current level. Equal values can still appear in the same subset when they occur at different positions.

---

# Chapter 4. Permutations

## 4.1 What is a permutation?

A permutation arranges all elements in an order. For `n` distinct elements there are $n!$ permutations. This grows quickly: $10! = 3,628,800$, while $15!$ is already over a trillion.

## 4.2 Backtracking with a used array

```python
def permute(a, used, cur, ans):
    if len(cur) == len(a):
        ans.append(cur[:])
        return

    for i in range(len(a)):
        if used[i]:
            continue

        used[i] = True
        cur.append(a[i])

        permute(a, used, cur, ans)

        cur.pop()
        used[i] = False
```

```cpp
void permute(const vector<int>& a, vector<char>& used,
             vector<int>& cur, vector<vector<int>>& ans) {
    if (cur.size() == a.size()) {
        ans.push_back(cur);
        return;
    }

    for (int i = 0; i < (int)a.size(); ++i) {
        if (used[i]) continue;

        used[i] = true;
        cur.push_back(a[i]);

        permute(a, used, cur, ans);

        cur.pop_back();
        used[i] = false;
    }
}
```

At each depth, choose one unused element for the next position. The `used` array enforces the constraint that each input position is used exactly once.

The recursion depth is $O(n)$. There are $n!$ leaves, and copying each completed permutation costs $O(n)$, so time to materialize all permutations is $O(n\cdot n!)$.

## 4.3 In-place swapping

An alternative is to fix one position at a time by swapping a candidate into that position:

```python
def permuteInPlace(a, pos):
    if pos == len(a):
        print(*a)
        return

    for i in range(pos, len(a)):
        a[pos], a[i] = a[i], a[pos]
        permuteInPlace(a, pos + 1)
        a[pos], a[i] = a[i], a[pos]
```

```cpp
void permuteInPlace(vector<int>& a, int pos) {
    if (pos == (int)a.size()) {
        for (int x : a) cout << x << ' ';
        cout << '\n';
        return;
    }

    for (int i = pos; i < (int)a.size(); ++i) {
        swap(a[pos], a[i]);
        permuteInPlace(a, pos + 1);
        swap(a[pos], a[i]); // restore
    }
}
```

The second swap restores the array to the state expected by the next branch. This pattern is compact, but it is easier to accidentally forget the undo operation.

## 4.4 Unique permutations

If values repeat, sorting plus skipping duplicates at the same level prevents repeated arrangements:

```python
def uniquePermute(a, used, cur, ans):
    if len(cur) == len(a):
        ans.append(cur[:])
        return

    for i in range(len(a)):
        if used[i]:
            continue
        if i > 0 and a[i] == a[i-1] and not used[i-1]:
            continue

        used[i] = True
        cur.append(a[i])
        uniquePermute(a, used, cur, ans)
        cur.pop()
        used[i] = False
```

```cpp
void uniquePermute(const vector<int>& a, vector<char>& used,
                   vector<int>& cur, vector<vector<int>>& ans) {
    if (cur.size() == a.size()) {
        ans.push_back(cur);
        return;
    }

    for (int i = 0; i < (int)a.size(); ++i) {
        if (used[i]) continue;
        if (i > 0 && a[i] == a[i - 1] && !used[i - 1]) continue;

        used[i] = true;
        cur.push_back(a[i]);
        uniquePermute(a, used, cur, ans);
        cur.pop_back();
        used[i] = false;
    }
}
```

The duplicate condition says: when two equal copies are available, use the earlier copy first in a permutation branch. This avoids generating equivalent permutations that differ only by swapping identical copies.

---

# Chapter 5. Pruning: stop exploring impossible branches

Brute-force search explores every possible choice. Backtracking becomes useful when constraints let us prove that some partial choices cannot lead to a valid answer.

## 5.1 Subset sum with positive numbers

Given positive integers and a target `T`, find subsets whose sum equals `T`.

```python
def subsetSum(i, a, target, sum, cur, ans):
    if sum == target:
        ans.append(cur.copy())
        return
    if sum > target:
        return  # valid because all remaining values are positive
    if i == len(a):
        return

    cur.append(a[i])
    subsetSum(i + 1, a, target, sum + a[i], cur, ans)
    cur.pop()

    subsetSum(i + 1, a, target, sum, cur, ans)
```

```cpp
void subsetSum(int i, const vector<int>& a, int target, int sum,
               vector<int>& cur, vector<vector<int>>& ans) {
    if (sum == target) {
        ans.push_back(cur);
        return;
    }
    if (sum > target) return; // valid because all remaining values are positive
    if (i == (int)a.size()) return;

    cur.push_back(a[i]);
    subsetSum(i + 1, a, target, sum + a[i], cur, ans);
    cur.pop_back();

    subsetSum(i + 1, a, target, sum, cur, ans);
}
```

The pruning rule `sum > target` is valid only because all values are positive. If negative values are allowed, a later negative value might bring the sum back down, so this prune could discard valid answers.

This illustrates the most important rule about pruning: **a prune must be justified by a proof**, not just by intuition.

## 5.2 Bound-based pruning

Suppose the current sum is `sum`, the target is `T`, and all remaining values are non-negative. If `sum` already exceeds `T`, stop. If we can calculate the maximum additional sum possible and `sum + maxRemaining < T`, we can also stop because the target cannot be reached.

The general idea is to compute a lower or upper bound on what any continuation can achieve. If the bound proves that no continuation can satisfy the goal, the whole branch is unnecessary.

## 5.3 Order choices carefully

The order in which candidates are tried does not normally change correctness, but it can change how quickly a useful answer is found. For optimization problems, exploring promising choices early may help establish a strong incumbent answer, which then enables more pruning.

Do not confuse “good heuristic order” with correctness: the algorithm must still explore every branch not ruled out by a valid bound if it is required to prove optimality.

---

# Chapter 6. Grid paths and maze search

## 6.1 Find a path through a maze

Suppose `'.'` is an open cell and `'#'` is a wall. We want a path from a start cell to a destination. A recursive DFS can try the four directions, marking cells that are on the current path.

```python
def findPath(r, c, grid, onPath, path, tr, tc):
    n = len(grid)
    m = len(grid[0])
    if r < 0 or r >= n or c < 0 or c >= m:
        return False
    if grid[r][c] == '#' or onPath[r][c]:
        return False

    onPath[r][c] = True
    path.append((r, c))

    if r == tr and c == tc:
        return True

    dr = [-1, 1, 0, 0]
    dc = [0, 0, -1, 1]
    for d in range(4):
        if findPath(r + dr[d], c + dc[d], grid, onPath, path, tr, tc):
            return True

    path.pop()
    onPath[r][c] = False
    return False
```

```cpp
bool findPath(int r, int c, const vector<string>& grid,
              vector<vector<char>>& onPath,
              vector<pair<int,int>>& path, int tr, int tc) {
    int n = grid.size(), m = grid[0].size();
    if (r < 0 || r >= n || c < 0 || c >= m) return false;
    if (grid[r][c] == '#' || onPath[r][c]) return false;

    onPath[r][c] = true;
    path.push_back({r, c});

    if (r == tr && c == tc) return true;

    const int dr[4] = {-1, 1, 0, 0};
    const int dc[4] = {0, 0, -1, 1};
    for (int d = 0; d < 4; ++d) {
        if (findPath(r + dr[d], c + dc[d], grid, onPath, path, tr, tc))
            return true;
    }

    path.pop_back();
    onPath[r][c] = false; // undo: allow this cell in another branch
    return false;
}
```

This returns as soon as it finds one path. The `onPath` array prevents cycles along the current branch. If you want to explore every simple path, return values and undo logic must be arranged to continue after finding each solution.

**Important distinction:** for ordinary reachability in a graph, a global `visited` array is usually correct and efficient. For enumerating all simple paths, a cell may need to be unmarked when backtracking so that a different path can use it. The right marking strategy depends on the question.

## 6.2 Enumerating paths versus finding shortest paths

Backtracking can enumerate simple paths, but the number of simple paths may be exponential. If the task asks for the shortest path in an unweighted grid, BFS is usually the right algorithm: it finds a shortest path in $O(V+E)$ rather than enumerating all paths. Choose backtracking because the problem requires exploring choices or satisfying constraints—not merely because the input is a grid.

---

# Chapter 7. N-Queens

## 7.1 The problem

Place `n` queens on an `n × n` chessboard so that no two queens attack each other. A queen attacks along its row, column, and diagonals.

Place one queen per row. Once the queens in rows `0..r-1` are placed safely, try each column in row `r` that does not conflict with earlier queens. If no column works, the current branch fails and the algorithm returns to the previous row.

## 7.2 Direct board checking

A simple solution stores the chosen column for each row:

```python
def safe(col, row, c):
    for r in range(row):
        if col[r] == c:
            return False
        if abs(col[r] - c) == abs(r - row):
            return False
    return True

def queens(row, n, col, solutions):
    if row == n:
        solutions[0] += 1
        return
    for c in range(n):
        if not safe(col, row, c):
            continue
        col[row] = c
        queens(row + 1, n, col, solutions)
        col[row] = -1
```

```cpp
bool safe(const vector<int>& col, int row, int c) {
    for (int r = 0; r < row; ++r) {
        if (col[r] == c) return false;
        if (abs(col[r] - c) == abs(r - row)) return false;
    }
    return true;
}

void queens(int row, int n, vector<int>& col,
            long long& solutions) {
    if (row == n) {
        ++solutions;
        return;
    }

    for (int c = 0; c < n; ++c) {
        if (!safe(col, row, c)) continue;
        col[row] = c;
        queens(row + 1, n, col, solutions);
        col[row] = -1;
    }
}
```

The diagonal test follows from geometry: two squares `(r1,c1)` and `(r2,c2)` share a diagonal exactly when $|r_1-r_2|=|c_1-c_2|$. This version checks up to `row` previous queens for each candidate.

## 7.3 Faster conflict tracking

For a square at row `r`, column `c`, its two diagonal identifiers can be represented by:

- `r - c` for one diagonal direction;
- `r + c` for the other.

These values are constant along each diagonal. Track used columns and diagonals in boolean arrays:

```python
def queensFast(r, n, col, usedCol, diag1, diag2, count):
    if r == n:
        count[0] += 1
        return

    for c in range(n):
        d1 = r - c + n - 1
        d2 = r + c
        if usedCol[c] or diag1[d1] or diag2[d2]:
            continue

        col[r] = c
        usedCol[c] = diag1[d1] = diag2[d2] = True

        queensFast(r + 1, n, col, usedCol, diag1, diag2, count)

        usedCol[c] = diag1[d1] = diag2[d2] = False
        col[r] = -1
```

```cpp
void queensFast(int r, int n, vector<int>& col,
                vector<char>& usedCol,
                vector<char>& diag1, vector<char>& diag2,
                long long& count) {
    if (r == n) {
        ++count;
        return;
    }

    for (int c = 0; c < n; ++c) {
        int d1 = r - c + n - 1;
        int d2 = r + c;
        if (usedCol[c] || diag1[d1] || diag2[d2]) continue;

        col[r] = c;
        usedCol[c] = diag1[d1] = diag2[d2] = true;

        queensFast(r + 1, n, col, usedCol, diag1, diag2, count);

        usedCol[c] = diag1[d1] = diag2[d2] = false;
        col[r] = -1;
    }
}
```

The conflict test becomes $O(1)$. The search remains exponential in the worst case, but avoiding repeated checks significantly improves practical performance.

## 7.4 Symmetry

Reflecting a valid board horizontally creates another valid board. For counting solutions, symmetry can sometimes reduce work by restricting the first queen to half of the first row and multiplying counts appropriately, with careful handling of the middle column for odd `n`. Symmetry reductions are powerful but must be derived for the exact quantity being counted.

---

# Chapter 8. Constraint satisfaction: coloring and Sudoku

## 8.1 Graph coloring

Given an undirected graph, assign each vertex one of `k` colors so adjacent vertices have different colors. This is a classic constraint-satisfaction problem.

```python
def colorGraph(v, n, k, adj, color):
    if v == n:
        return True
    for c in range(1, k + 1):
        ok = True
        for u in adj[v]:
            if color[u] == c:
                ok = False
                break
        if not ok:
            continue
        color[v] = c
        if colorGraph(v + 1, n, k, adj, color):
            return True
        color[v] = 0
    return False
```

```cpp
bool colorGraph(int v, int n, int k,
                const vector<vector<int>>& adj,
                vector<int>& color) {
    if (v == n) return true;

    for (int c = 1; c <= k; ++c) {
        bool ok = true;
        for (int u : adj[v]) {
            if (color[u] == c) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;

        color[v] = c;
        if (colorGraph(v + 1, n, k, adj, color)) return true;
        color[v] = 0;
    }
    return false;
}
```

This assigns vertices in fixed order. The worst-case search is $O(k^V \cdot E)$ under a simple bound, so it is useful only for relatively small instances or when pruning is strong.

## 8.2 Improve the order: most constrained variable

If one vertex has many already-colored neighbors, it may have fewer available colors. Choosing the most constrained unassigned vertex first can reveal contradictions earlier. This is called a minimum-remaining-values heuristic in constraint programming.

Heuristics do not change the set of valid solutions. They change the order in which the search tree is explored.

## 8.3 Sudoku as a constraint problem

For each empty cell, candidates are digits not already present in its row, column, or 3×3 box. Choose an empty cell, try each candidate, recurse, and undo on failure.

A strong solver chooses the empty cell with the fewest candidates. If any empty cell has zero candidates, the branch is impossible and can be rejected immediately. If a cell has one candidate, that forced choice should be made without trying alternatives.

The same architecture applies to crossword filling, exact-cover puzzles, scheduling with constraints, and small assignment problems.

---

# Chapter 9. Branch and bound for optimization

Backtracking can search for all feasible solutions, but optimization problems often ask for the best feasible solution. **Branch and bound** adds an upper or lower bound on the best result a branch can still achieve.

## 9.1 The basic principle

Suppose we are maximizing a score. Let `best` be the best complete solution found so far. If an upper bound on every completion of the current partial solution is at most `best`, then this branch cannot improve the answer and can be skipped.

The bound must be optimistic: it must never underestimate the best achievable score if we are maximizing. Otherwise we might prune the true optimum.

## 9.2 Example: assignment choices

Suppose each remaining task can contribute at most `maxPossible[i]`. If the current score plus the sum of all remaining maxima is no greater than `best`, there is no reason to continue that branch. This bound may be loose, but it is safe.

A tighter bound often prunes more branches at the cost of extra computation. The practical design goal is to spend less time calculating the bound than the search time it saves.

## 9.3 Incumbent solutions

Finding a good complete solution early improves pruning because it raises `best` in a maximization problem. Greedy algorithms or local heuristics can be used to find an initial feasible solution, but they do not prove optimality by themselves. Branch and bound uses the incumbent together with valid bounds to prove that no better solution exists.

---

# Chapter 10. Bitmask search and subset DP

## 10.1 Represent a subset as bits

If there are at most a few dozen objects—and often at most 20–25 for exponential DP—represent a subset using an integer bitmask. Bit `i` is one if object `i` is selected.

```python
def contains(mask, i):
    return bool(mask & (1 << i))

def addElement(mask, i):
    return mask | (1 << i)

def removeElement(mask, i):
    return mask & ~(1 << i)
```

```cpp
bool contains(int mask, int i) {
    return mask & (1 << i);
}

int addElement(int mask, int i) {
    return mask | (1 << i);
}

int removeElement(int mask, int i) {
    return mask & ~(1 << i);
}
```

For a set of `n` objects, there are $2^n$ masks. A recursive state can be the mask alone, or a mask plus extra information such as the last chosen vertex.

Use an unsigned or sufficiently wide type when shifting high bits. `1 << i` uses a signed `int`; for larger bit positions prefer `1ULL << i` and a 64-bit mask.

## 10.2 Hamiltonian paths

A Hamiltonian path visits every vertex exactly once. A brute-force permutation search considers $n!$ vertex orders. A subset DP can reduce this to $O(n^2 2^n)$ states/transitions for small `n`.

Let `dp[mask][v]` mean a Hamiltonian path exists that visits exactly the vertices in `mask` and ends at `v`. To extend it to `u`, require an edge `v -> u` and that `u` is not already in `mask`. The state count is $O(n2^n)$, and trying next vertices gives $O(n^2 2^n)$ time.

This is a useful point where raw backtracking leads naturally to dynamic programming: many different orders may reach the same `(mask, last)` state.

---

# Chapter 11. Search order, duplicate handling, and state restoration

## 11.1 Make state changes local and visible

For every mutation, pair it with its undo operation nearby:

```python
used[x] = True
path.append(x)

dfs(...)  # recursive call

path.pop()
used[x] = False
```

```cpp
used[x] = true;
path.push_back(x);

dfs(...);

path.pop_back();
used[x] = false;
```

This visual pairing makes bugs easier to spot. If a function has multiple early returns, ensure each return either intentionally preserves the state or performs the necessary cleanup first.

## 11.2 Pass by reference or copy?

Passing a vector by reference avoids copying it at every recursive call, but means every branch shares the same mutable object and must undo changes. Passing by value creates a separate copy for each call, which is simpler but can cost a great deal of time and memory.

For small prototypes, copying can make the logic easier. For performance-sensitive code, reference plus undo is common. Another option is to pass compact immutable state (such as a bitmask) by value.

## 11.3 Canonical order prevents duplicates

If the same mathematical solution can be reached in multiple orders, enforce a canonical rule:
- choose indices in increasing order for combinations;
- sort values and skip equal candidates at the same recursion depth;
- fix a starting vertex when rotations represent the same cycle;
- normalize equivalent states before storing them.

Duplicate prevention is not just a speed optimization. In counting problems, duplicates change the answer.

---

# Chapter 12. Complexity and when backtracking is appropriate

## 12.1 Search-tree size

If every state has branching factor `b` and maximum depth `d`, a full tree may contain


$$
1+b+b^2+\cdots+b^d = O(b^d)
$$


nodes when `b > 1`. A few additional operations per node do not change the exponential nature of the search.

Examples:
- all subsets: $O(2^n)$ nodes;
- all permutations: $O(n!)$ leaves;
- coloring with `k` colors: up to $k^n$ assignments;
- N-Queens: much less than $n^n$ in practice due to constraints, but still a hard exponential search.

Always distinguish the number of search nodes from the output size. If the task asks to print every permutation, at least $n!$ outputs must be produced.

## 12.2 Backtracking or dynamic programming?

Use backtracking when:
- you need to enumerate solutions;
- constraints make many branches invalid early;
- `n` is small;
- the state space has little overlap or you can prune effectively.

Use dynamic programming when:
- many branches reach the same state;
- you need counts, feasibility, minimum cost, or maximum value;
- the number of distinct states is manageable.

Use BFS or Dijkstra when:
- the goal is shortest path under the corresponding edge-weight assumptions.

Use greedy algorithms when a proof shows a locally chosen option can be part of an optimal solution.

A good contest solution often combines methods: backtracking with memoization, branch and bound, bitmasks, or a greedy upper bound.

---

# Chapter 13. Common bugs and how to test them (backtracking)

## 13.1 Missing undo

Symptom: outputs contain elements from previous branches. Check every `push_back`, `used[x] = true`, board assignment, sum update, and visited mark.

## 13.2 Wrong pruning condition

Symptom: some valid solutions disappear. Ask: “Can any possible continuation make this branch valid again?” For subset sum with negative numbers, `sum > target` is not a safe prune.

## 13.3 Wrong completion condition

For combinations, `cur.size() == k` is complete. For permutations, it is usually `cur.size() == n`. For subset generation, every element must be decided, including elements that were excluded.

## 13.4 Duplicate results

Symptom: the same answer appears multiple times. Sort and skip duplicates at the right recursion depth, or impose an ordering rule that gives each answer one representation.

## 13.5 Testing only one case

Test the smallest input, no-solution input, exactly-one-solution input, repeated values, and a case that triggers every prune. If possible, compare your result with a brute-force implementation on random tiny inputs.

---

# Chapter 14. Practice ladder (backtracking)

## Beginner

1. Generate all subsets of `{1, ..., n}`.
2. Generate all binary strings of length `n`.
3. Generate all combinations of size `k`.
4. Generate permutations of distinct elements.
5. Generate unique permutations when values repeat.
6. Find any subset summing to a target.

## Intermediate

7. Solve maze path finding and print one path.
8. Count paths in a grid with obstacles.
9. Solve N-Queens for small `n`.
10. Determine whether a graph can be colored with `k` colors.
11. Generate balanced parentheses with `n` pairs.
12. Solve Sudoku using minimum-remaining-values selection.
13. Find all unique combinations that sum to a target.
14. Compare copying state versus apply/undo on the same search.

## Advanced

15. Implement branch and bound for a small assignment or knapsack instance.
16. Solve Hamiltonian path with plain backtracking and then subset DP.
17. Count simple paths between two vertices in a small graph.
18. Use pruning bounds in a subset-sum problem with positive numbers.
19. Generate permutations while avoiding forbidden adjacent pairs.
20. Use symmetry to reduce N-Queens search while preserving the count.

## Grandmaster-oriented extensions

21. Study meet-in-the-middle for subset sum with `n` near 40.
22. Study exact cover and Algorithm X for constraint-heavy combinatorial search.
23. Explore Dancing Links as an efficient reversible data structure for exact cover.
24. Study profile DP for tilings and grid problems with small width.
25. Explore branch-and-bound for TSP with a provable lower bound.
26. Learn how bitset operations accelerate subset reachability.
27. Compare memoized search, branch and bound, and meet-in-the-middle on the same problem family.
28. Study adversarial inputs and why worst-case search remains exponential even when pruning is effective on typical inputs.

These are advanced directions; each deserves its own chapter when studied seriously.

---

# Chapter 15. Final mental model (backtracking)

Backtracking is a systematic exploration of a decision tree. A correct implementation makes choices, explores consequences, and restores state. A strong implementation also rejects impossible branches early using rules that can be proved safe.

When approaching a new problem:

1. Define the partial solution represented by one call.
2. List the possible next choices.
3. State the exact completion condition.
4. State the constraints that reject a branch.
5. Pair every mutation with an undo operation.
6. Estimate the search-tree size.
7. Look for repeated states that suggest memoization.
8. Look for valid bounds that enable branch and bound.
9. Compare against a brute-force checker on small random cases.

Do not start by trying to invent clever pruning. First make a correct, understandable search. Then prove and add one optimization at a time.
