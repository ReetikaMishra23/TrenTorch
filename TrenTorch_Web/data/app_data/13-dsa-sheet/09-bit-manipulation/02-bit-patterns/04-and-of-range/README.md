---
name: sheet-and-of-range
title: 'Bitwise AND of a Range'
tags: [dsa-sheet, bit-manipulation, bit-patterns]
difficulty: Advanced
---

## Statement

Return the bitwise AND of **every number from `left` to `right`** (both included).

The starter code ands the numbers one by one. It is correct but far too slow for big ranges.

### Examples

**Example 1**

Input:

```python
and_of_range(5, 7)
```

Output:

```text
4
```

**Example 2**

Input:

```python
and_of_range(0, 0)
```

Output:

```text
0
```

### Constraints

- `0 <= left <= right < 2**31`

## Theory

AND keeps a bit only if **every** number has it. Look at what happens to the numbers between `left` and `right`: as you count up, the low bits keep flipping from 0 to 1 and back, so any bit that changes anywhere in the range is `0` in the answer.

What survives is the **common binary prefix** of `left` and `right`: the leading bits on which they agree. The bits after the first difference all vary somewhere in the range.

So shift both numbers right until they are equal, counting the shifts, then shift the common value back left. `O(log n)` time.

## Explanation

Every number between `left` and `right` shares the bits of their common prefix; below the highest bit where `left` and `right` differ, some number in the range has a `0` in every position, so the AND clears them. The highest differing bit is `(left ^ right).bit_length()`, so shift the common prefix back into place: `left >> shift << shift`.

### Complexity

- Time: O(1). The common prefix of `left` and `right` is everything above their highest differing bit, found with one XOR and `bit_length()`.
- Space: O(1). A few integers.
