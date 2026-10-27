---
name: sheet-longest-word-built-one-letter-at-a-time
title: 'Longest Word Built Letter by Letter'
tags: [dsa-sheet, tries, trie-basics]
difficulty: Intermediate
---

## Statement

Return the **longest word** in `words` such that **every prefix** of it (`w[:1]`, `w[:2]`, ..., and the word itself) is also in `words`. If several are longest, return the **smallest in dictionary order**. If there is none, return `""`.

For `["w", "wo", "wor", "worl", "world"]` the answer is `"world"`; for `["a", "banana", "app", "appl", "ap", "apply", "apple"]` it is `"apple"`.

### Examples

**Example 1**

Input:

```python
longest_word(['w', 'wo', 'wor', 'worl', 'world'])
```

Output:

```text
'world'
```

**Example 2**

Input:

```python
longest_word(['a', 'banana', 'app', 'appl', 'ap', 'apply', 'apple'])
```

Output:

```text
'apple'
```

### Constraints

- `0 <= len(words) <= 30000`
- `1 <= length <= 30`, lower-case letters.

## Theory

A **trie** (prefix tree) stores a set of words letter by letter: every node is one letter, a word is a path from the root, and words that share a prefix share the start of their path. Each node has up to 26 children (a dictionary `letter -> node` in Python) and a flag that says "a word ends here". Inserting or searching a word of length `L` takes `O(L)` no matter how many words are stored, and a trie answers **prefix** questions ("does any word start with `ab`?") that a plain set of words cannot answer quickly. A node can be a small dictionary: `node = {}`; mark the end of a word with a special key such as `"$"`.

A word is "buildable" when each of its prefixes is itself a word. Put the words in a trie with the end markers. A word qualifies when **every node on its path is marked as a word end**. Walk the trie with a DFS that **only enters children that are word ends**; the deepest node reached (breaking ties alphabetically by visiting children in order) is the answer.

A simpler way with a set: sort the words, and keep a set `built`; a word is built if its prefix without the last letter is in `built` (or it has length 1). Sorting also gives the alphabetical tie-break. `O(n log n)`.

## Explanation

A word can be built one letter at a time if its prefix without the last letter can be built (the empty string always can). So handle the words from the shortest length to the longest: a word of length `L` is good when `word[:-1]` is a good word of length `L - 1`. Collect the good words of each length in a set; stop when a length has none, since nothing longer can be built. The answer is the smallest word in the last non-empty group, which is both longest and alphabetically first.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                                                    | Variables                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `by_length = {}`                                                   | `by_length = {}`                                                                       |
| `for word in set(words):`                                          | `by_length = {3: ['wor'], 4: ['worl']}, word = 'wo'`                                   |
| `by_length.setdefault(len(word), []).append(word)`                 | `by_length = {3: ['wor'], 4: ['worl'], 2: ['wo'], 5: ['world'], 1: ['w']}, word = 'w'` |
| `built.update(good)`                                               | `built = {'', 'w'}, best = '', length = 1, good = ['w']`                               |
| `best = min(good)`                                                 | `built = {'', 'wo', 'w'}, best = 'wo', length = 2, good = ['wo']`                      |
| `length += 1`                                                      | `built = {'', 'wor', 'wo', 'w'}, best = 'wor', length = 4, good = ['wor']`             |
| `good = [w for w in by_length.get(length, ()) if w[:-1] in built]` | `built = {'', 'wor', 'wo', 'worl', 'w'}, best = 'worl', length = 5, good = ['world']`  |
| `return`                                                           | `returned = 'world'`                                                                   |

### Complexity

- Time: O(W). Words are grouped by length and checked shortest first; each check is one hash lookup of the word without its last letter (`W` = total length of the words).
- Space: O(W). The set of words and the groups.
