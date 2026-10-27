---
name: sheet-sliding-window-median
title: 'Sliding Window Median'
tags: [dsa-sheet, heaps, two-heaps-and-scheduling]
difficulty: Mastery
---

## Statement

A window of size `k` slides over `nums` one position at a time. Return the **median of each window**: the middle value for an odd `k`, or the average of the two middle values for an even `k`, as decimals.

For `nums = [1, 3, -1, -3, 5, 3, 6, 7]` and `k = 3` the answer is `[1.0, -1.0, -1.0, 3.0, 5.0, 6.0]`.

The starter code sorts every window from scratch. It is correct but too slow when windows are large.

### Examples

**Example 1**

Input:

```python
median_sliding_window([1, 3, -1, -3, 5, 3, 6, 7], 3)
```

Output:

```text
[1.0, -1.0, -1.0, 3.0, 5.0, 6.0]
```

**Example 2**

Input:

```python
median_sliding_window([1, 2, 3, 4, 2, 3, 1, 4, 2], 3)
```

Output:

```text
[2.0, 3.0, 3.0, 3.0, 2.0, 3.0, 2.0]
```

### Constraints

- `1 <= k <= len(nums) <= 100000`
- `-10**9 <= nums[i] <= 10**9`

## Theory

A **heap** (priority queue) always gives you the **smallest** item in `O(log n)`, while letting you add items in `O(log n)`. Python's `heapq` module implements a **min-heap** on a plain list: `heappush(h, x)`, `heappop(h)` (the smallest), `h[0]` (peek) and `heapify(h)` (turn a list into a heap in `O(n)`). For a **max-heap** push the negated values.

Keep the window's values **in sorted order** and read the middle. When the window slides, one value leaves and one enters. A **sorted list** with `bisect` does exactly that: `bisect.insort` inserts the new value, and `bisect_left` finds the old value to delete with `del`. List insertion and deletion shift elements, but that is a fast `memmove` in C, so it is quick in practice for the sizes here: `O(k)` per move with a tiny constant.

The textbook solution uses **two heaps with lazy deletion** (a heap cannot remove an arbitrary element, so you mark values as deleted and discard them only when they reach the top); it gives `O(n log k)`. The sorted list approach is shorter and just as good here.

## Explanation

Keep two heaps: `small` (a max-heap) with the lower half of the window and `large` (a min-heap) with the upper half, so the median is at the top of one or both. Adding a value goes to the half it belongs to and the heaps are rebalanced to differ in size by at most one.

A heap cannot remove an arbitrary value cheaply, so a value that leaves the window is only counted in a `delayed` table, and the live sizes are adjusted at once. When a delayed value reaches the top of its heap it is popped for real.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                                             | Variables                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `small = []  # max-heap of the lower half (stored negated)` | `small = []`                                                                                                                                                                                                                                           |
| `def balance():`                                            | `large = [], delayed = {}, size = [0, 0], clean = <function median_sliding_window.<locals>.clean at 0x00000..., balance = <function median_sliding_window.<locals>.balance at 0x000...`                                                                |
| `add(x)`                                                    | `small = [-1], size = [1, 0], add = <function median_sliding_window.<locals>.add at 0x000002B..., remove = <function median_sliding_window.<locals>.remove at 0x0000..., median = <function median_sliding_window.<locals>.median at 0x0000..., x = 1` |
| `out = [median()]`                                          | `small = [-1, 1], large = [3], size = [2, 1], x = -1, out = [1.0]`                                                                                                                                                                                     |
| `add(nums[i])`                                              | `small = [1, 3], large = [3, 5], delayed = {1: 0}, size = [2, 2], out = [1.0, -1.0], i = 4`                                                                                                                                                            |
| `remove(nums[i - k])`                                       | `small = [-3, 3], large = [5], delayed = {1: 0, 3: 0, -1: 0}, size = [2, 1], out = [1.0, -1.0, -1.0], i = 5`                                                                                                                                           |
| `out.append(median())`                                      | `small = [-5, 3, -3], large = [6], delayed = {1: 0, 3: 0, -1: 0, -3: 1}, out = [1.0, -1.0, -1.0, 3.0, 5.0], i = 6`                                                                                                                                     |
| `return`                                                    | `returned = [1.0, -1.0, -1.0, 3.0, 5.0, 6.0]`                                                                                                                                                                                                          |

### Complexity

- Time: O(n log n). Two heaps hold the lower and upper half of the window, and values that left the window are removed lazily when they reach the top.
- Space: O(n). The two heaps and the table of pending removals.
