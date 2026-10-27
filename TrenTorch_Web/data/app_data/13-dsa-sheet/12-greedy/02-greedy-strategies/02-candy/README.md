---
name: sheet-candy
title: 'Distribute Candy'
tags: [dsa-sheet, greedy, greedy-strategies]
difficulty: Advanced
---

## Statement

Children stand in a line with ratings `ratings[i]`. Every child gets **at least one** candy, and a child with a **higher rating than a neighbour** must get **more candies than that neighbour**. Return the **fewest candies** needed.

For `[1, 0, 2]` the answer is `5` (candies `2, 1, 2`).

### Examples

**Example 1**

Input:

```python
candy([1, 0, 2])
```

Output:

```text
5
```

**Example 2**

Input:

```python
candy([1, 2, 2])
```

Output:

```text
4
```

### Constraints

- `0 <= len(ratings) <= 200000`
- `0 <= ratings[i] <= 10**9`

## Theory

A **greedy** algorithm builds the answer step by step and, at each step, takes the choice that looks best **right now**, without ever going back. It is fast and simple, but it is only correct when the problem has a structure that makes local choices safe. The hard part is the **proof**: show that the greedy choice can always be part of some best answer.

There are two rules, one for each neighbour, and they can conflict: a child can be higher than the left neighbour **and** than the right one. Handle each direction in its own pass, then combine:

1. **Left to right**: if `ratings[i] > ratings[i - 1]`, then `give[i] = give[i - 1] + 1`, else 1.
2. **Right to left**: if `ratings[i] > ratings[i + 1]`, then `give[i] = max(give[i], give[i + 1] + 1)`.

The `max` satisfies both rules at once, and each child gets the least that works. Total: the sum. `O(n)`.

## Explanation

Walk once and treat the ratings as a series of rising runs and falling runs. Give 1 candy to the first child. For each next child:

- Rating higher than the previous: `up` grows by one and the child gets `1 + up` candies (one more than before in the rising run).
- Equal rating: the run resets and the child gets 1.
- Lower rating: `down` grows by one and the child gets `1 + down` (the falling run counts candies backwards from its end). If the falling run has become as long as the rising run before it (`peak`), the child at the top of the hill needs one more candy than we gave, which the formula already counted once, so subtract one.

Only the lengths of the current runs are kept, so no array of candies is needed.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line         | Variables                               |
| ----------------------- | --------------------------------------- |
| `n = len(ratings)`      | `n = 3`                                 |
| `up = down = peak = 0`  | `total = 1, up = 0, down = 0, peak = 0` |
| `for i in range(1, n):` | `i = 1`                                 |
| `total += 1 + down`     | `total = 3, down = 1`                   |
| `for i in range(1, n):` | `i = 2`                                 |
| `down = 0`              | `up = 1, down = 0`                      |
| `peak = up`             | `peak = 1`                              |
| `return`                | `returned = 5`                          |

### Complexity

- Time: O(n). One pass; the candies in a rising run and in a falling run are summed as arithmetic series, so no per-child array is needed.
- Space: O(1). A few counters.
