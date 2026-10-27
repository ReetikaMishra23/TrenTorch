---
name: sheet-stream-of-characters
title: 'Stream of Characters'
tags: [dsa-sheet, tries, trie-applications]
difficulty: Advanced
---

## Statement

Letters of `stream` arrive one by one. After **each** letter, report whether **some suffix of the letters received so far is one of the `words`**.

For `words = ["cd", "f", "kl"]` and `stream = "abcdefghijkl"` the answer is `[False, False, False, True, False, True, False, False, False, False, False, True]`.

The starter code tries every word after every letter. It is correct but too slow for many words and long streams.

### Examples

**Example 1**

Input:

```python
stream_checker(['cd', 'f', 'kl'], 'abcdefghijkl')
```

Output:

```text
[False, False, False, True, False, True, False, False, False, False, False, True]
```

**Example 2**

Input:

```python
stream_checker(['a'], 'ba')
```

Output:

```text
[False, True]
```

### Constraints

- `0 <= len(words) <= 2000`
- `1 <= len(word) <= 10`
- `0 <= len(stream) <= 100000`
- Lower-case letters.

## Theory

A **trie** (prefix tree) stores a set of words letter by letter: every node is one letter, a word is a path from the root, and words that share a prefix share the start of their path. Each node has up to 26 children (a dictionary `letter -> node` in Python) and a flag that says "a word ends here". Inserting or searching a word of length `L` takes `O(L)` no matter how many words are stored, and a trie answers **prefix** questions ("does any word start with `ab`?") that a plain set of words cannot answer quickly. A node can be a small dictionary: `node = {}`; mark the end of a word with a special key such as `"$"`.

You are asked about the **end** of the stream, while a trie matches **starts** of words. Reverse the words: insert each word **reversed** into a trie. Then, after each new letter, walk the trie along the stream **backwards** (the newest letter first). If the walk reaches a node marked as a word end, some suffix of the stream is a word.

Words are at most `maxlen` long, so look back at most `maxlen` letters: `O(maxlen)` per letter instead of `O(words)`.

## Explanation

Aho-Corasick turns the list of words into one automaton that is fed one letter at a time and always knows the longest suffix of the stream that is a prefix of some word. Build a trie of the words; a node `fail` link points to the node for the longest proper suffix that is also in the trie (found breadth first), and a node is marked as an end if its word, or any word reachable through `fail` links, ends there.

For each letter of the stream, follow `fail` links until a node has an edge for the letter, step along it, and report whether the node is marked. Every step forward is paid for by at most one `fail` step later, so each letter is O(1) amortised.

### Worked example

The solution run on example 1, one step at a time. The values are recorded from the real code.

| After this line           | Variables                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goto = [{}]`             | `goto = [{}]`                                                                                                                                                                                        |
| `for ch in word:`         | `goto = [{'c': 1}, {}], fail = [0, 0], ends = [False, False], word = 'cd', node = 1, ch = 'd', child = 1`                                                                                            |
| `fail.append(0)`          | `goto = [{'c': 1}, {'d': 2}, {}, {}], fail = [0, 0, 0, 0], ends = [False, False, True], word = 'f', node = 0, ch = 'f', child = None`                                                                |
| `child = len(goto) - 1`   | `goto = [{'c': 1, 'f': 3}, {'d': 2}, {}, {}, {}], fail = [0, 0, 0, 0, 0], ends = [False, False, True, True, False], word = 'kl', ch = 'k', child = 4`                                                |
| `node = queue.popleft()`  | `goto = [{'c': 1, 'f': 3, 'k': 4}, {'d': 2}, {}, {}, {'l': 5}, {}], fail = [0, 0, 0, 0, 0, 0], ends = [False, False, True, True, False, True], node = 1, ch = 'l', child = 5, queue = deque([3, 4])` |
| `out.append(ends[state])` | `node = 5, ch = 'a', queue = deque([]), f = 0, out = [False], state = 0`                                                                                                                             |
| `out.append(ends[state])` | `ch = 'f', out = [False, False, False, True, False, True], state = 3`                                                                                                                                |
| `return`                  | `returned = [False, False, False, True, False, True, False, False, Fa...`                                                                                                                            |

### Complexity

- Time: O(W + n). Aho-Corasick automaton: building it costs the total word length `W`, and each of the `n` stream letters takes O(1) amortised.
- Space: O(W). The automaton, one state per letter of the words.
