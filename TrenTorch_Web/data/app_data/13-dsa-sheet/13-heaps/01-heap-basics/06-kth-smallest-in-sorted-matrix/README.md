---
name: sheet-kth-smallest-in-sorted-matrix
title: 'Kth Smallest in a Sorted Matrix'
tags: [dsa-sheet, heaps, heap-basics]
difficulty: Intermediate
---

## Statement

`matrix` has every **row sorted** and every **column sorted** in increasing order. Return the **`k`-th smallest** value (counting from 1, repeated values counted separately).

For `[[1, 5, 9], [10, 11, 13], [12, 13, 15]]` and `k = 8` the answer is `13`.

### Examples

**Example 1**

Input:

```python
kth_smallest_matrix([[1, 5, 9], [10, 11, 13], [12, 13, 15]], 8)
```

Output:

```text
13
```

**Example 2**

Input:

```python
kth_smallest_matrix([[-5]], 1)
```

Output:

```text
-5
```

### Constraints

- `1 <= rows, cols <= 300`
- `1 <= k <= rows * cols`
- `-10**9 <= value <= 10**9`

## Theory

A **heap** (priority queue) always gives you the **smallest** item in `O(log n)`, while letting you add items in `O(log n)`. Python's `heapq` module implements a **min-heap** on a plain list: `heappush(h, x)`, `heappop(h)` (the smallest), `h[0]` (peek) and `heapify(h)` (turn a list into a heap in `O(n)`). For a **max-heap** push the negated values.

The smallest value is the top-left cell. After removing a cell, the next candidate is the cell **below** it or the cell **to its right**. Use a min-heap of candidate cells `(value, row, col)`. Start with the first cell of every row (or just cell `(0, 0)`); pop `k - 1` times, and each time push the neighbours of the popped cell: the one to its right in the same row. The `k`-th pop is the answer.

Starting with the first cell of each row and only pushing the cell to the right needs no visited set. The cost is `O((rows + k) log rows)`, far better than sorting all `rows * cols` values when `k` is small.

## Explanation

Binary search on the value, not on an index. For a guess `x`, count how many cells are `<= x`: start at the last column of the first row; for each row, move left while the cell is larger than `x`; what is left of the pointer counts. Because rows and columns are sorted, the pointer only moves left, so a count costs `r + c` steps.

The smallest `x` whose count reaches `k` is the answer, and it is always a value that appears in the matrix. This costs the same for every `k`, whereas popping `k` values from a heap costs `k log r`.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                            | Variables                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `rows, cols = len(matrix), len(matrix[0])` | `cols = 3, rows = 3`                                                                            |
| `lo, hi = matrix[0][0], matrix[-1][-1]`    | `count_at_most = <function kth_smallest_matrix.<locals>.count_at_most at 0..., lo = 1, hi = 15` |
| `mid = (lo + hi) // 2`                     | `mid = 8`                                                                                       |
| `mid = (lo + hi) // 2`                     | `lo = 9, mid = 12`                                                                              |
| `lo = mid + 1`                             | `lo = 13`                                                                                       |
| `hi = mid`                                 | `hi = 14, mid = 14`                                                                             |
| `mid = (lo + hi) // 2`                     | `mid = 13`                                                                                      |
| `return`                                   | `returned = 13`                                                                                 |

### Complexity

- Time: O((r + c) log(max - min)). Binary search on the value; counting the values `<= x` takes one staircase walk of `r + c` steps.
- Space: O(1). A few numbers.
