---
name: sheet-word-break
title: 'Word Break'
tags: [dsa-sheet, dynamic-programming, sequences-and-counting]
difficulty: Intermediate
---

## Statement

Return `True` if the string `s` can be **split into a sequence of words from `words`** (words may be reused any number of times).

For `s = "leetcode"` and `words = ["leet", "code"]` the answer is `True`; for `s = "catsandog"` and `words = ["cats", "dog", "sand", "and", "cat"]` it is `False`.

The starter code tries every split without remembering failures. It is correct but too slow on strings that cannot be split.

### Examples

**Example 1**

Input:

```python
word_break('leetcode', ['leet', 'code'])
```

Output:

```text
True
```

**Example 2**

Input:

```python
word_break('catsandog', ['cats', 'dog', 'sand', 'and', 'cat'])
```

Output:

```text
False
```

### Constraints

- `0 <= len(s) <= 20000`
- `0 <= len(words) <= 1000`
- `1 <= len(word) <= 20`, lower-case letters.

## Theory

**Dynamic programming (DP)** solves a problem by combining the answers to smaller versions of the same problem and **remembering** them, so each smaller version is solved only once. It works when the plain recursion keeps asking the same questions (**overlapping subproblems**) and the best answer is built from best answers of smaller parts (**optimal substructure**). The recipe: pick the **state** (what identifies one subproblem), write the **transition** (how a state's answer comes from smaller states), set the **base cases**, and choose the **order**: top-down recursion with a cache, or a bottom-up table. A table often needs only its last row or last few values, which saves memory.

**State:** `can(i)`, whether the first `i` characters can be split. **Transition:** `can(i)` is true if some `j < i` has `can(j)` true **and** `s[j:i]` is a word. **Base case:** `can(0) = True`. **Answer:** `can(len(s))`.

A set makes the word lookup `O(1)` (the substring itself costs `O(length)`). Since words are at most `maxlen` long, only the last `maxlen` positions `j` need to be tried: `O(n × maxlen)`.

The recursion without a cache fails on strings like `"aaaa...b"` with words `["a", "aa", ...]`: it explores an exponential number of ways to split the `a`s before discovering that the `b` cannot be matched.

## Explanation

Put all words in a trie (a tree with one letter per edge and a marker where a word ends). `reachable[i]` says the string can be split up to position `i`. From every reachable `i`, walk down the trie along `s[i], s[i+1], ...`: each time you pass a word-end marker at position `j`, mark `reachable[j + 1]`. The walk stops as soon as the next letter is not in the trie, so it is at most the longest word long.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                    | Variables                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trie = {}`                        | `trie = {}`                                                                                                                                                                           |
| `node = node.setdefault(ch, {})`   | `trie = {'l': {'e': {'e': {}}}}, word = 'leet', node = {}, ch = 'e'`                                                                                                                  |
| `for ch in word:`                  | `trie = {'l': {'e': {'e': {'t': {None: True}}}}, 'c': {}}, word = 'code', ch = 'o'`                                                                                                   |
| `reachable = [True] + [False] * n` | `trie = {'l': {'e': {'e': {'t': {None: True}}}}, 'c': {'o': {'d':..., node = {None: True}, ch = 'e', n = 8, reachable = [True, False, False, False, False, False, False, False, F...` |
| `node = node.get(s[j])`            | `node = {'t': {None: True}}, i = 0, j = 2`                                                                                                                                            |
| `for i in range(n):`               | `node = None, reachable = [True, False, False, False, True, False, False, False, Fa..., i = 2, j = 4`                                                                                 |
| `node = node.get(s[j])`            | `node = {'e': {None: True}}, i = 4, j = 6`                                                                                                                                            |
| `return`                           | `returned = True`                                                                                                                                                                     |

### Complexity

- Time: O(n * L + W). Every start position that can be reached walks down a trie of the words at most `L` letters (`L` = longest word); building the trie costs the total length `W` of all words.
- Space: O(W + n). The trie and the table of reachable positions.
