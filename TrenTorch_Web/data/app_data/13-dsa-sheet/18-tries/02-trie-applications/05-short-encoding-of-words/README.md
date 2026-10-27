---
name: sheet-short-encoding-of-words
title: 'Short Encoding of Words'
tags: [dsa-sheet, tries, trie-applications]
difficulty: Advanced
---

## Statement

A set of words is **encoded** by one string `s` that ends with `#` after each word's position: every word `w` must appear in `s` starting at some index `i` and **ending just before a `#`**. So `"time#bell#"` encodes `["time", "bell"]`, and `"time#"` encodes both `"time"` and `"me"` (since `"me"` ends right before the `#` as well). Return the **length of the shortest** such string `s`.

For `["time", "me", "bell"]` the answer is `10` (`"time#bell#"`).

### Examples

**Example 1**

Input:

```python
minimum_length_encoding(['time', 'me', 'bell'])
```

Output:

```text
10
```

**Example 2**

Input:

```python
minimum_length_encoding(['t'])
```

Output:

```text
2
```

### Constraints

- `0 <= len(words) <= 20000`
- `1 <= len(word) <= 7`, lower-case letters.

## Theory

A **trie** (prefix tree) stores a set of words letter by letter: every node is one letter, a word is a path from the root, and words that share a prefix share the start of their path. Each node has up to 26 children (a dictionary `letter -> node` in Python) and a flag that says "a word ends here". Inserting or searching a word of length `L` takes `O(L)` no matter how many words are stored, and a trie answers **prefix** questions ("does any word start with `ab`?") that a plain set of words cannot answer quickly. A node can be a small dictionary: `node = {}`; mark the end of a word with a special key such as `"$"`.

A word can be **absorbed** into a longer word exactly when it is a **suffix** of that word. Words that are not a suffix of any other word must each appear in the encoding with their own `#`. So the answer is the sum of `len(w) + 1` over the words that are not suffixes of another (different) word.

Using a trie of **reversed** words, a word that is a suffix of another is a node on the path of a longer reversed word. After inserting all words reversed, the answer counts the **leaves** of the trie: each leaf is the end of a maximal reversed word and contributes its depth plus 1. (A simpler way with a set: remove all proper suffixes of each word from the set.)

## Explanation

A word needs its own place in the encoding only if it is not a suffix of another word. Insert every distinct word into a trie letter by letter from its END: a word that is a suffix of another one ends inside the other's path, so its node has children. A word whose node is a leaf is not a suffix of any other, and it costs `len(word) + 1` (the `#`).

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line                  | Variables                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `trie = {}`                      | `trie = {}`                                                                                                     |
| `for ch in reversed(word):`      | `ends = [], word = 'bell', node = {}, ch = 'l'`                                                                 |
| `for ch in reversed(word):`      | `trie = {'l': {'l': {'e': {}}}}, ch = 'b'`                                                                      |
| `node = trie`                    | `trie = {'l': {'l': {'e': {'b': {}}}}}, ends = [({}, 4)], word = 'time', node = {'l': {'l': {'e': {'b': {}}}}}` |
| `node = node.setdefault(ch, {})` | `trie = {'l': {'l': {'e': {'b': {}}}}, 'e': {'m': {}}}, node = {}, ch = 'm'`                                    |
| `node = node.setdefault(ch, {})` | `trie = {'l': {'l': {'e': {'b': {}}}}, 'e': {'m': {'i': {'t': {}}}}}, ch = 't'`                                 |
| `node = node.setdefault(ch, {})` | `ends = [({}, 4), ({}, 4)], word = 'me', node = {'m': {'i': {'t': {}}}}, ch = 'e'`                              |
| `return`                         | `returned = 10`                                                                                                 |

### Complexity

- Time: O(S). `S` is the total length of the words: every word is put into a trie of reversed words once; a word that ends at a leaf is not a suffix of another.
- Space: O(S). The trie.
