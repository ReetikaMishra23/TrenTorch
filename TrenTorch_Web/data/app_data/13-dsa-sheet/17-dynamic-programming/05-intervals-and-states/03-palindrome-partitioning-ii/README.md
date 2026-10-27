---
name: sheet-palindrome-partitioning-ii
title: 'Palindrome Partitioning: Fewest Cuts'
tags: [dsa-sheet, dynamic-programming, intervals-and-states]
difficulty: Advanced
---

## Statement

Return the **fewest cuts** needed to split `s` into pieces that are all **palindromes**. A string that is already a palindrome needs `0` cuts.

For `"aab"` the answer is `1` (`"aa" | "b"`).

The starter code re-checks pieces and repeats work. It is correct but too slow for long strings.

### Examples

**Example 1**

Input:

```python
min_cut_palindromes('aab')
```

Output:

```text
1
```

**Example 2**

Input:

```python
min_cut_palindromes('ab')
```

Output:

```text
1
```

### Constraints

- `0 <= len(s) <= 1000`
- Lower-case letters.

## Theory

**Dynamic programming (DP)** solves a problem by combining the answers to smaller versions of the same problem and **remembering** them, so each smaller version is solved only once. It works when the plain recursion keeps asking the same questions (**overlapping subproblems**) and the best answer is built from best answers of smaller parts (**optimal substructure**). The recipe: pick the **state** (what identifies one subproblem), write the **transition** (how a state's answer comes from smaller states), set the **base cases**, and choose the **order**: top-down recursion with a cache, or a bottom-up table. A table often needs only its last row or last few values, which saves memory.

Two tables work together. First, `pal[i][j]`, whether `s[i..j]` is a palindrome, filled by **expanding from the centre** or by `pal[i][j] = s[i] == s[j] and pal[i + 1][j - 1]`. Second, `cuts[j]`, the fewest cuts for the prefix `s[:j + 1]`: if the whole prefix is a palindrome it is `0`, else `cuts[j] = min(cuts[i - 1] + 1)` over `i` such that `s[i..j]` is a palindrome.

Both tables are `O(n²)`. Precomputing `pal` is what removes the repeated palindrome checks.

## Explanation

`cuts[i]` is the fewest cuts for the first `i` letters, starting from the worst case `i - 1` (cut between every letter) and `cuts[0] = -1`. Instead of a table of which substrings are palindromes, grow every palindrome around its centre (odd and even). Each palindrome `s[l..r]` that is found says: the first `r + 1` letters can be done with `cuts[l] + 1` cuts. Centres are processed from left to right, so `cuts[l]` is already final when it is used.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                                                | Variables                                               |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `n = len(s)`                                                   | `n = 3`                                                 |
| `for left, right in ((centre, centre), (centre, centre + 1)):` | `cuts = [-1, 0, 1, 2], centre = 0, left = 0, right = 0` |
| `for left, right in ((centre, centre), (centre, centre + 1)):` | `right = 1`                                             |
| `right += 1`                                                   | `cuts = [-1, 0, 0, 2], left = -1, right = 2`            |
| `left -= 1`                                                    | `centre = 1, left = 0, right = 1`                       |
| `for centre in range(n):`                                      | `centre = 2, left = 1, right = 2`                       |
| `left -= 1`                                                    | `cuts = [-1, 0, 0, 1]`                                  |
| `return`                                                       | `returned = 1`                                          |

### Complexity

- Time: O(n^2). Every palindromic substring is found by growing around its centre, and each one updates a single cell.
- Space: O(n). One array of cuts.
