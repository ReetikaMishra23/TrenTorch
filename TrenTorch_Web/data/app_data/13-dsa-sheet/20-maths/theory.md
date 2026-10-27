> Every code block has a Python and a C++ version; use the switch above a block to pick one. Your choice is remembered.

# Introduction (Number theory)

This course builds number theory for competitive programming from the ground up. It assumes you can write simple loops and functions in C++17, but it does **not** assume that you already know number theory.

The course is organized like a staircase. **Chapter 1 starts with everyday ideas and small numbers.** We then learn how to count primes and factor numbers, how to use divisors, and only after those ideas feel familiar do we move to modular arithmetic, inverses, and the Chinese Remainder Theorem. The middle chapters build standard contest skills; the later chapters deliberately continue into advanced and Grandmaster-oriented techniques such as deterministic Miller–Rabin, Pollard rho, discrete logarithms, multiplicative functions, floor-division grouping, and NTT. Chapter 1 stays gentle, but the course as a whole does not stop at beginner or intermediate level. Read in order; each chapter explains the words it needs.

Code examples use C++17. Unless a problem says otherwise, assume the input integers are non-negative and watch for overflow when numbers become large.

---

# Chapter 1. Getting comfortable with numbers

Number theory is the part of mathematics that studies whole numbers and the patterns they follow. In programming contests, it often means answering questions such as: Is this number prime? How many numbers divide it? What is the remainder after a very large calculation? Can we solve several remainder conditions at once?

We will begin with the building blocks: factors, multiples, prime numbers, and remainders. You do not need to memorize every formula on the first read.

## 1.1 Factors and multiples

A positive integer $d$ is a **factor** (or divisor) of $n$ if dividing $n$ by $d$ leaves no remainder. We write this as

$$d \mid n.$$

For example, the factors of $12$ are $1,2,3,4,6,12$. Since $12=3\times4$, both $3$ and $4$ are factors of $12$. A **multiple** of $d$ is a number we get by multiplying $d$ by a whole number: the multiples of $4$ include $4,8,12,16,\ldots$.

In code, `%` gives the remainder after division. Therefore `n % d == 0` checks whether `d` is a factor of `n`.

```python
def isDivisible(n, d):
    return n % d == 0
```

```cpp
bool isDivisible(int n, int d) {
    return n % d == 0;
}
```

For positive `d`, this is the basic test behind many number theory algorithms.

## 1.2 Prime numbers

A **prime number** is an integer greater than $1$ whose only positive factors are $1$ and itself. The first few primes are

$$2,3,5,7,11,13,17,19,\ldots$$

The number $1$ is not prime. The number $2$ is the only even prime: any larger even number is divisible by $2$. A number greater than $1$ that is not prime is called **composite**. For example, $12$ is composite because $12=3\times4$.

To test a small number, we can try dividing it by every integer from $2$ up to $n-1$. If any one divides it evenly, the number is composite. This is easy to understand, but we can do better in Chapter 2.

```python
def isPrimeSlow(n):
    if n < 2:
        return False
    for d in range(2, n):
        if n % d == 0:
            return False
    return True
```

```cpp
bool isPrimeSlow(int n) {
    if (n < 2) return false;
    for (int d = 2; d < n; d++)
        if (n % d == 0) return false;
    return true;
}
```

This beginner version is useful for learning the idea; it is not the version to use for large inputs.

## 1.3 Remainders: what `mod` means

When we divide $17$ by $5$, we get $3$ groups of $5$ and $2$ left over. That leftover is the remainder:

$$17 = 3\times5+2,\qquad 17\bmod5=2.$$

The expression $a\bmod m$ means the remainder after dividing $a$ by $m$ (for positive $m$). The remainder is between $0$ and $m-1$ when $a$ is non-negative.

Remainders are useful for clocks. On a 12-hour clock, moving forward 5 hours from 10 gives 3, because $10+5=15$ and $15\bmod12=3$. We can think of the clock as wrapping around after 12.

Two numbers have the same remainder modulo $m$ when their difference is divisible by $m$. For example, $17$ and $2$ have the same remainder modulo $5$. We write

$$17\equiv2\pmod5.$$

Read this as “17 is congruent to 2 modulo 5.” For now, just think “they leave the same remainder.”

## 1.4 Common factors and the GCD

The **greatest common divisor**, shortened to GCD, is the largest positive number that divides two numbers. For instance, the common factors of $18$ and $24$ include $1,2,3,6$, so

$$\gcd(18,24)=6.$$

If the GCD of two positive integers is $1$, they are called **coprime**. For example, $8$ and $15$ are coprime. They do not have to be prime themselves; they only need to share no factor larger than $1$.

The GCD will become especially important when we learn modular inverses. In Chapter 2, we will learn a fast way to calculate it.

## 1.5 A first look at powers and factorials

A power such as $2^5$ means multiplying five copies of $2$:

$$2^5=2\times2\times2\times2\times2=32.$$

A factorial is a product of all positive integers up to a number. It is written with an exclamation mark:

$$5!=1\times2\times3\times4\times5=120.$$

Factorials grow very quickly. Later we will use this observation to answer questions about trailing zeros and how often a prime appears inside a factorial.

## 1.6 Check your understanding

1. List all positive factors of $18$.
2. Is $1$ prime? Explain in one sentence.
3. What is $29\bmod6$?
4. Are $9$ and $20$ coprime?
5. Work out $4!$ by multiplying the numbers in order.

**Answers:** (1) $1,2,3,6,9,18$. (2) No; a prime must be greater than $1$. (3) $5$. (4) Yes, their GCD is $1$. (5) $24$.

---

# Chapter 2. Prime numbers and their factors

Chapter 1 introduced the basic words. Now we turn them into algorithms. The first improvement comes from noticing that factors usually arrive in pairs.

## 2.1 Why checking up to the square root is enough

Suppose $n$ is composite, so $n=a\times b$ for integers $a,b$ greater than $1$. If both $a$ and $b$ were larger than $\sqrt n$, their product would be larger than $n$, which is impossible. So every composite number has a factor no larger than $\sqrt n$.

This means that to test whether $n$ is prime, we only need to try divisors from $2$ through $\sqrt n$.

```python
def isPrime(n):
    if n < 2:
        return False
    for d in range(2, int(n**0.5) + 1):
        if n % d == 0:
            return False
    return True
```

```cpp
bool isPrime(long long n) {
    if (n < 2) return false;
    for (long long d = 2; d * d <= n; d++)
        if (n % d == 0) return false;
    return true;
}
```

The loop condition `d * d <= n` avoids calculating a floating-point square root. For extremely large values, even `d * d` can overflow, so use `d <= n / d` instead.

The running time is $O(\sqrt n)$: roughly, the number of trial divisors grows like the square root of the input.

## 2.2 Count primes in a range: the Sieve of Eratosthenes

Testing every number independently repeats work. If we need all primes up to $N$, it is faster to mark composite numbers in groups. This is called the **Sieve of Eratosthenes**.

Start by treating every number from $2$ to $N$ as possibly prime. The first unmarked number is $2$, so mark its multiples $4,6,8,\ldots$ as composite. The next unmarked number is $3$, so mark $6,9,12,\ldots$. Continue. Any number still unmarked is prime.

```python
def sieve(n):
    prime = [True] * (n + 1)
    if n >= 0:
        prime[0] = False
    if n >= 1:
        prime[1] = False

    for p in range(2, n + 1):
        if p * p > n:
            break
        if not prime[p]:
            continue
        for x in range(p * p, n + 1, p):
            prime[x] = False
    return prime
```

```cpp
vector<bool> sieve(int n) {
    vector<bool> prime(n + 1, true);
    if (n >= 0) prime[0] = false;
    if (n >= 1) prime[1] = false;

    for (int p = 2; 1LL * p * p <= n; p++) {
        if (!prime[p]) continue;
        for (long long x = 1LL * p * p; x <= n; x += p)
            prime[(int)x] = false;
    }
    return prime;
}
```

Why start marking from $p^2$? Smaller multiples such as $2p$ or $3p$ have already been marked by smaller prime factors. The sieve runs in $O(N\log\log N)$ time and uses $O(N)$ memory, making it practical for large ranges.

## 2.3 Prime factorization

A **prime factorization** writes an integer as a product of primes. For example,

$$60=2\times2\times3\times5=2^2\cdot3\cdot5.$$

The exponents tell us how many times each prime appears. Every integer greater than $1$ has exactly one prime factorization, apart from the order of factors. This is why prime factorization is such a useful summary of a number.

The beginner method is trial division: try small divisors, divide them out as many times as possible, then continue. If the remaining number is greater than $1$, it is itself prime.

```python
def factorize(n):
    factors = []
    p = 2
    while p <= n // p:
        if n % p != 0:
            p += 1
            continue
        count = 0
        while n % p == 0:
            n //= p
            count += 1
        factors.append((p, count))
        p += 1
    if n > 1:
        factors.append((n, 1))
    return factors
```

```cpp
vector<pair<long long, int>> factorize(long long n) {
    vector<pair<long long, int>> factors;
    for (long long p = 2; p <= n / p; p++) {
        if (n % p != 0) continue;
        int count = 0;
        while (n % p == 0) {
            n /= p;
            count++;
        }
        factors.push_back({p, count});
    }
    if (n > 1) factors.push_back({n, 1});
    return factors;
}
```

For example, the output for $60$ is $(2,2),(3,1),(5,1)$, meaning $2^2\cdot3^1\cdot5^1$. This method is good for moderate inputs. Factoring a huge integer is a different, much harder task; advanced options are introduced in Chapter 8.

## 2.4 Count the divisors

Prime factorization gives a neat way to count all positive divisors without listing them. If

$$n=p_1^{a_1}p_2^{a_2}\cdots p_k^{a_k},$$

then a divisor may use each prime $p_i$ between $0$ and $a_i$ times. Therefore the number of positive divisors is

$$\tau(n)=(a_1+1)(a_2+1)\cdots(a_k+1).$$

For example, $60=2^2\cdot3^1\cdot5^1$, so it has

$$(2+1)(1+1)(1+1)=12$$

positive divisors. This is much faster and less error-prone than checking each integer when factorization is already available.

## 2.5 Sum the divisors

Using the same factorization, the sum of all positive divisors is

$$\sigma(n)=(1+p_1+\cdots+p_1^{a_1})\cdots(1+p_k+\cdots+p_k^{a_k}).$$

For $12=2^2\cdot3$, this becomes

$$(1+2+4)(1+3)=7\times4=28,$$

which matches $1+2+3+4+6+12=28$. The reason for multiplying the sums is that every divisor is built by independently choosing a power for each prime.

## 2.6 Practice

1. Use trial division to decide whether $97$ is prime.
2. Find the prime factorization of $84$.
3. How many positive divisors does $72=2^3\cdot3^2$ have?
4. Find the sum of positive divisors of $12$.

**Answers:** (1) Prime. (2) $2^2\cdot3\cdot7$. (3) $(3+1)(2+1)=12$. (4) $28$.

---

# Chapter 3. The GCD and how to compute it quickly

## 3.1 The Euclidean algorithm

Trying every possible common factor is slow for large numbers. The **Euclidean algorithm** uses one simple observation: the common divisors of $a$ and $b$ are exactly the common divisors of $b$ and the remainder when $a$ is divided by $b$.

If $a=qb+r$, then any number that divides both $a$ and $b$ also divides $r=a-qb$. The reverse is also true. Thus

$$\gcd(a,b)=\gcd(b,a\bmod b).$$

Repeat this step until the second number becomes zero. The first number is the GCD.

```python
def gcd(a, b):
    while b != 0:
        r = a % b
        a = b
        b = r
    return a
```

```cpp
long long gcd(long long a, long long b) {
    while (b != 0) {
        long long r = a % b;
        a = b;
        b = r;
    }
    return a;
}
```

For example, to compute $\gcd(48,18)$:

$$48=2\cdot18+12,\quad 18=1\cdot12+6,\quad 12=2\cdot6+0.$$

So $\gcd(48,18)=6$. The algorithm is extremely fast: its running time is $O(\log\min(a,b))$.

## 3.2 The least common multiple

The **least common multiple** (LCM) is the smallest positive integer divisible by both inputs. For example, the multiples of $6$ and $8$ first meet at $24$, so $\operatorname{lcm}(6,8)=24$.

For positive integers,

$$\gcd(a,b)\cdot\operatorname{lcm}(a,b)=a\cdot b.$$

Thus we can calculate the LCM using the GCD. Divide first to reduce the risk of overflow:

```python
def gcd(a, b):
    while b != 0:
        r = a % b
        a = b
        b = r
    return a

def lcm(a, b):
    return a // gcd(a, b) * b
```

```cpp
long long lcm(long long a, long long b) {
    return a / gcd(a, b) * b;
}
```

This assumes the result fits in `long long` and the inputs are positive. If the result can be too large, the program needs an overflow check or a wider integer type.

## 3.3 Extended Euclid: finding useful coefficients

The extended Euclidean algorithm finds more than the GCD. It also finds integers $x$ and $y$ satisfying

$$ax+by=\gcd(a,b).$$

For example, $6=2\cdot18-1\cdot30$, so $x=-1,y=2$ is one valid pair for $a=30,b=18$. These numbers may be negative; that is completely fine.

Why do we care? This identity lets us solve certain equations and find modular inverses. We will use it in Chapter 5, after modular arithmetic is familiar.

```python
def extended_gcd(a, b, x, y):
    if b == 0:
        x[0] = 1
        y[0] = 0
        return a
    x1 = [0]
    y1 = [0]
    g = extended_gcd(b, a % b, x1, y1)
    x[0] = y1[0]
    y[0] = x1[0] - (a // b) * y1[0]
    return g
```

```cpp
long long extended_gcd(long long a, long long b,
                       long long &x, long long &y) {
    if (b == 0) {
        x = 1;
        y = 0;
        return a;
    }
    long long x1, y1;
    long long g = extended_gcd(b, a % b, x1, y1);
    x = y1;
    y = x1 - (a / b) * y1;
    return g;
}
```

The recursive step follows the same remainders as ordinary Euclid, then rewrites the previous answer in terms of the original $a$ and $b$. You can treat this code as a tool at first; the important idea is what equation it guarantees.

## 3.4 When does an integer equation have a solution?

Consider

$$ax+by=c,$$

where $x$ and $y$ must be integers. A solution exists exactly when $\gcd(a,b)$ divides $c$.

For example, $6x+10y=14$ has a solution because $\gcd(6,10)=2$ divides $14$. But $6x+10y=15$ has no integer solution, because every sum $6x+10y$ is even.

This is the central result for linear Diophantine equations. In later problems, it helps us decide whether a target can be made from repeated steps of two different sizes.

---

# Chapter 4. Modular arithmetic and fast powers

## 4.1 Working with remainders safely

For positive modulus $m$, modular arithmetic keeps only the remainder after division by $m$. The following rules hold:

$$ (a+b)\bmod m = ((a\bmod m)+(b\bmod m))\bmod m,$$

$$ (ab)\bmod m = ((a\bmod m)(b\bmod m))\bmod m.$$

In plain language, we can reduce the numbers before adding or multiplying, and then reduce the result again. This is useful when the true answer is too large to store.

For example, to find $123\times456\bmod7$, first reduce: $123\bmod7=4$ and $456\bmod7=1$. So the final remainder is $4\times1\bmod7=4$.

A practical caution: in C++, multiplying two `long long` values may overflow **before** `% m` is applied. Use a type wide enough for the product or a safe modular multiplication method when the values are very large.

## 4.2 Fast exponentiation

Suppose we want to calculate $3^{1000}\bmod 1{,}000{,}000{,}007$. Multiplying by $3$ a thousand times works, but the **binary exponentiation** method needs only $O(\log n)$ multiplications.

The key observation is that squares quickly build large powers: $a^2$, $a^4$, $a^8$, and so on. Write the exponent in binary and multiply only the powers corresponding to its set bits. For instance,

$$a^{13}=a^8\cdot a^4\cdot a.$$

```python
def modPow(a, e, mod):
    result = 1 % mod
    a %= mod
    while e > 0:
        if e & 1:
            result = result * a % mod
        a = a * a % mod
        e >>= 1
    return result
```

```cpp
long long modPow(long long a, long long e, long long mod) {
    long long result = 1 % mod;
    a %= mod;
    while (e > 0) {
        if (e & 1) result = result * a % mod;
        a = a * a % mod;
        e >>= 1;
    }
    return result;
}
```

This version assumes each product fits in `long long`; for a modulus near $10^9+7$, signed 64-bit multiplication is enough. For larger moduli, use a safe multiplication routine. The loop is fast because the exponent is halved at each iteration.

## 4.3 What does congruence really allow us to do?

Writing $a\equiv b\pmod m$ means $m$ divides $a-b$. If $a\equiv b\pmod m$ and $c\equiv d\pmod m$, then

$$a+c\equiv b+d\pmod m,\qquad ac\equiv bd\pmod m.$$

So we may add, subtract, and multiply congruences. Division is different: it is **not always allowed**. For example, $2\cdot1\equiv2\cdot3\pmod4$ because both sides have remainder $2$, but cancelling the $2$ would claim $1\equiv3\pmod4$, which is false. Chapter 5 explains when division has a valid replacement.

---

# Chapter 5. Modular inverses and Euler's totient function

## 5.1 What is a modular inverse?

In ordinary arithmetic, dividing by $a$ is the same as multiplying by $1/a$. Modular arithmetic needs a similar number. A **modular inverse** of $a$ modulo $m$ is a number $x$ for which

$$ax\equiv1\pmod m.$$

For example, the inverse of $3$ modulo $7$ is $5$, since $3\cdot5=15\equiv1\pmod7$. Therefore division by $3$ modulo $7$ can be performed by multiplying by $5$.

An inverse exists exactly when $\gcd(a,m)=1$. If $a$ and $m$ share a factor larger than $1$, no multiple of $a$ can leave remainder $1$ modulo $m$.

## 5.2 Find an inverse with Extended Euclid

Extended Euclid gives us $ax+my=\gcd(a,m)$. If $a$ and $m$ are coprime, the right side is $1$, so

$$ax+my=1\quad\Longrightarrow\quad ax\equiv1\pmod m.$$

That means $x$ is an inverse. Since answers are commonly stored from $0$ to $m-1$, normalize it with `((x % m) + m) % m`.

```python
def extended_gcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x1, y1 = extended_gcd(b, a % b)
    x = y1
    y = x1 - (a // b) * y1
    return g, x, y

def modInverse(a, m):
    g, x, y = extended_gcd(a, m)
    if g != 1:
        return -1  # no inverse
    return (x % m + m) % m
```

```cpp
long long modInverse(long long a, long long m) {
    long long x, y;
    long long g = extended_gcd(a, m, x, y);
    if (g != 1) return -1; // no inverse
    return (x % m + m) % m;
}
```

Here `-1` is used to report that no inverse exists. Do not use it as if it were a real inverse.

## 5.3 Euler's totient function

Euler's totient function, written $\phi(n)$, counts the integers from $1$ to $n$ that are coprime to $n$. For example, the numbers from $1$ to $8$ that are coprime to $8$ are $1,3,5,7$, so $\phi(8)=4$.

If $p$ is prime, all numbers from $1$ to $p-1$ are coprime to it, and $\phi(p)=p-1$. More generally, using the distinct prime factors of $n$,

$$\phi(n)=n\prod_{p\mid n}\left(1-\frac1p\right).$$

For $n=12$, its distinct prime factors are $2$ and $3$, so

$$\phi(12)=12\left(1-\frac12\right)\left(1-\frac13\right)=4.$$

This formula comes from removing the numbers divisible by each prime factor. It can be calculated from prime factorization in time about $O(\sqrt n)$ using trial division.

## 5.4 Fermat's little theorem and inverses modulo a prime

A useful theorem says that if $p$ is prime and $a$ is not divisible by $p$, then

$$a^{p-1}\equiv1\pmod p.$$

Multiplying both sides by the inverse of $a$, or equivalently rearranging the power, gives

$$a^{-1}\equiv a^{p-2}\pmod p.$$

This gives a fast inverse when the modulus is prime: compute `modPow(a, p - 2, p)`. Remember the conditions: the modulus must be prime, and $a$ must not be divisible by it. For a non-prime modulus, use Extended Euclid or prove that another method applies.

## 5.5 Factorials and binomial coefficients modulo a prime

Many counting problems use the binomial coefficient

$$\binom nk=\frac{n!}{k!(n-k)!},$$

which counts ways to choose $k$ objects from $n$. Under a prime modulus $p$, if $n<p$, we can precompute factorials and inverse factorials. Then

$$\binom nk\equiv n!\,(k!)^{-1}\,((n-k)!)^{-1}\pmod p.$$

The denominator cannot be divided by directly; we multiply by its modular inverse. This method is common when many binomial coefficient queries share the same prime modulus.

---

# Chapter 6. The Chinese Remainder Theorem

## 6.1 Combining two remainder conditions

Imagine being told that a number leaves remainder $2$ when divided by $3$, and remainder $3$ when divided by $5$. Which number could it be? The numbers that leave remainder $2$ modulo $3$ are $2,5,8,11,14,17,\ldots$. Among them, $8$ leaves remainder $3$ modulo $5$, so one solution is $8$.

We write the conditions as

$$x\equiv2\pmod3,\qquad x\equiv3\pmod5.$$

Because $3$ and $5$ are coprime, the Chinese Remainder Theorem (CRT) says there is exactly one solution modulo $15=3\cdot5$. Here the solutions are $8,23,38,\ldots$, all equivalent modulo $15$.

## 6.2 The main idea behind CRT

When the moduli are pairwise coprime, a system of remainder conditions has one solution modulo the product of all the moduli. “Pairwise coprime” means every pair of moduli has GCD $1$.

For two conditions

$$x\equiv a\pmod m,\qquad x\equiv b\pmod n,$$

with $\gcd(m,n)=1$, write $x=a+mt$. Then

$$mt\equiv b-a\pmod n.$$

Because $m$ has an inverse modulo $n$, we can solve for $t$, and then recover $x$. This connects CRT directly to modular inverses from Chapter 5.

Here is a small, deliberately direct implementation for coprime moduli. It searches for the merge factor, so it is meant to make the idea visible rather than handle huge moduli efficiently:

```python
def crtSmall(a, m, b, n):
    # Assumes gcd(m, n) == 1 and small m, n.
    a = (a % m + m) % m
    b = (b % n + n) % n
    for t in range(n):
        x = a + m * t
        if x % n == b:
            return x  # solution in [0, m*n)
    return -1  # unreachable when the assumptions hold
```

```cpp
long long crtSmall(long long a, long long m,
                   long long b, long long n) {
    // Assumes gcd(m, n) == 1 and small m, n.
    a = (a % m + m) % m;
    b = (b % n + n) % n;
    for (long long t = 0; t < n; ++t) {
        long long x = a + m * t;
        if (x % n == b) return x; // solution in [0, m*n)
    }
    return -1; // unreachable when the assumptions hold
}
```

For production contest code, replace the loop with an extended-Euclid-based merge and check overflow in $mn$.

## 6.3 What if the moduli are not coprime?

Coprimality is an easy condition that guarantees a solution, but it is not required for every system. For example, $x\equiv1\pmod4$ and $x\equiv3\pmod6$ do have a solution ($x=9$). But $x\equiv1\pmod4$ and $x\equiv2\pmod6$ do not: the first condition makes $x$ odd, while the second makes it even.

For two possibly non-coprime moduli, a solution exists exactly when

$$a\equiv b\pmod{\gcd(m,n)}.$$

The full implementation has to handle this case carefully, as well as possible overflow in the combined modulus. Start with coprime moduli until the basic idea is comfortable.

---

# Chapter 7. Large numbers and stronger techniques

The algorithms so far work well for many contest constraints. Some tasks, however, contain numbers too large for trial division or ask us to compute powers with huge exponents. This chapter introduces the main ideas used for those cases. The purpose here is to explain when each tool is needed; the deeper primality-testing implementation appears in Chapter 10, while Pollard rho and baby-step giant-step are best studied with a dedicated implementation exercise.

## 7.1 Is a large number prime?

Trial division up to $\sqrt n$ is excellent for moderate $n$, but becomes too slow when $n$ has many digits. A common next step is **Miller–Rabin primality testing**. It uses modular exponentiation and number-theory facts to quickly identify composite numbers. A single test can occasionally label a composite number as “probably prime,” but repeating the test with carefully chosen bases makes the error extremely small; for the full 64-bit integer range, a known set of deterministic bases can make it exact.

The important learning order is: first understand primes and square-root testing, then fast modular powers, and only then Miller–Rabin. The latter is not magic—it reuses tools already learned.

## 7.2 Finding prime factors of very large integers

Trial division may take too long when a number is very large and its prime factors are not small. **Pollard's rho** is a randomized factor-finding method that can often find a non-trivial factor much faster. In practice, it is usually combined with a primality test: first check whether the number is prime, then try to split it into smaller factors.

These methods are more sensitive to implementation details than the earlier chapters. Treat them as advanced tools to learn after modular multiplication and primality testing are understood.

## 7.3 Modular multiplication when products overflow

Even if `a` and `b` each fit in 64 bits, their product may not. Yet modular exponentiation needs the result of $ab\bmod m$. Possible approaches include a wider integer type such as `__int128` where supported, or a carefully implemented repeated-doubling method. The correct choice depends on the language and the maximum values in the problem.

Never assume `(a * b) % mod` is safe merely because the final remainder is small. The multiplication happens before the remainder operation.

## 7.4 Discrete logarithm: reversing a power

You know how to find $a^x\bmod m$ for a given exponent $x$. The **discrete logarithm** problem asks the reverse question: given $a$, $b$, and $m$, find an exponent $x$ such that

$$a^x\equiv b\pmod m.$$

A standard technique is **baby-step giant-step**, which trades memory for time and can solve many instances in about $O(\sqrt m)$ steps. This is an advanced topic because it requires careful handling of modular inverses and cases where no solution exists. A full implementation should validate any candidate and separately handle cases where $a$ and $m$ are not coprime. The central implementation structure is to store the small powers in a hash table, then look them up while generating giant steps.

---

# Chapter 8. Counting with factorials and powers

## 8.1 Trailing zeros of a factorial

A trailing zero is a zero at the end of a written number, such as the one in $120$. Every trailing zero comes from a factor of $10=2\cdot5$. In a factorial, factors of $2$ are much more common than factors of $5$, so the number of trailing zeros is determined by how many factors of $5$ appear in the product.

For example, $10!=1\cdot2\cdots10$ contains two multiples of $5$ (namely $5$ and $10$), and therefore has two trailing zeros.

For any $n$,

$$Z(n!)=\left\lfloor\frac n5\right\rfloor+\left\lfloor\frac n{25}\right\rfloor+\left\lfloor\frac n{125}\right\rfloor+\cdots,$$

stopping when the denominator is greater than $n$. The extra terms matter because numbers such as $25$ contain two factors of $5$, and $125$ contains three.

```python
def trailingZeros(n):
    answer = 0
    while n > 0:
        n //= 5
        answer += n
    return answer
```

```cpp
long long trailingZeros(long long n) {
    long long answer = 0;
    while (n > 0) {
        n /= 5;
        answer += n;
    }
    return answer;
}
```

The same idea counts the power of any prime $p$ in $n!$ by adding $\lfloor n/p\rfloor+\lfloor n/p^2\rfloor+\cdots$.

## 8.2 Huge Fibonacci numbers

Fibonacci numbers are defined by

$$F_0=0,\quad F_1=1,\quad F_n=F_{n-1}+F_{n-2}.$$

Their values become huge quickly, so problems often ask for $F_n\bmod m$. A loop can calculate them in $O(n)$ time using only two previous values. If $n$ itself is enormous, **fast doubling** computes them in $O(\log n)$ time by using identities that relate $F_{2k}$ and $F_{2k+1}$ to $F_k$ and $F_{k+1}$.

The fast-doubling identities are

$$F_{2k}=F_k(2F_{k+1}-F_k),\qquad F_{2k+1}=F_k^2+F_{k+1}^2.$$

When working modulo $m$, reduce the results modulo $m$ at each step and normalize negative intermediate values if needed. This technique is a useful example of how familiar recurrence relations can be accelerated using algebra.

## 8.3 Binomial coefficients and factorial prime powers

If a problem asks for the largest $x$ such that $p^x$ divides $n!$, count the number of factors of $p$ in the factorial:

$$v_p(n!)=\left\lfloor\frac np\right\rfloor+\left\lfloor\frac n{p^2}\right\rfloor+\cdots.$$

Here $v_p(n!)$ simply means “how many copies of the prime $p$ are contained in the product $n!$.” If $k$ is composite, factor it into primes and compare the available powers for each factor to determine the largest $x$ such that $k^x\mid n!$.

This is a direct extension of the trailing-zero idea: instead of only counting groups of $10$, we count the prime factors required by a more general number.

---

# Chapter 9. Putting the ideas together

This chapter is a revision guide rather than a new algorithm chapter, so it deliberately focuses on recognition, common mistakes, and practice order instead of adding more code.

## 9.1 How to choose the right tool

When a number theory problem appears, begin with the shape of the question. If it asks whether a number is prime and the number is moderate, use square-root trial division. If it asks for every prime up to a limit, use the sieve. If it asks for factors or divisor counts, factorize the number. If it involves repeated powers modulo a number, use binary exponentiation.

If the problem asks for division modulo $m$, first ask whether the divisor has an inverse—that is, whether its GCD with $m$ is $1$. If several remainder conditions must hold together, look at CRT. If the input numbers are extremely large, consider Miller–Rabin, Pollard's rho, or a safe modular multiplication routine, but only after the simpler building blocks are understood.

## 9.2 Common mistakes

- Treating $1$ as prime. Prime numbers must be greater than $1$.
- Checking every possible divisor when checking only through $\sqrt n$ is enough.
- Trying to divide by a number modulo $m$ without checking that a modular inverse exists.
- Using Fermat's inverse formula when the modulus is not prime, or when the number is divisible by the prime modulus.
- Assuming `(a * b) % mod` cannot overflow because the remainder is small.
- Forgetting that factorials contain extra copies of primes such as $5$ in $25$, $125$, and higher powers.
- Using CRT's simple product-modulus form without checking that the moduli are pairwise coprime.

## 9.3 A gradual practice roadmap

Work through the subjects in this order: prime checking and simple factors; sieve and factorization; GCD and LCM; divisor count and divisor sum; modular arithmetic and binary exponentiation; extended Euclid and modular inverse; Euler's totient and Fermat's little theorem; CRT; trailing zeros and factorial prime powers; then Miller–Rabin, Pollard's rho, and discrete logarithms.

For each topic, start with a tiny example you can solve by hand. Then implement the simplest algorithm, test edge cases such as $0$, $1$, or a prime input, and only then move to the faster version. The goal is not to memorize a page of formulas: it is to understand what each formula counts, why the algorithm stops, and what conditions must be true for it to work.

---

# Chapter 10. Fast primality testing and integer factorization

The earlier chapters work well when numbers are small or when every integer up to a limit can be preprocessed. Harder contest problems may give a single integer close to the 64-bit limit. At that size, checking every divisor or building a sieve up to the number is impossible. We need algorithms whose running time depends on the number of digits rather than on the number itself.

## 10.1 The Miller–Rabin idea

Fermat's little theorem says that if $p$ is prime and $a$ is not divisible by $p$, then

$$a^{p-1}\equiv 1\pmod p.$$

A composite number can sometimes pass this test, so Fermat's test alone is not a reliable primality test. Miller–Rabin strengthens it by writing

$$n-1=d\cdot 2^s,\qquad d\text{ odd},$$

and checking a sequence of modular powers. For a prime $n$, each tested base must satisfy either $a^d\equiv1\pmod n$ or one of the repeated squares must become $-1\pmod n$. If a base fails, $n$ is definitely composite. If many bases pass, $n$ is a probable prime; for 64-bit integers, a known set of bases makes the test deterministic.

The important implementation detail is safe modular multiplication. The product $a\cdot b$ can overflow a signed 64-bit integer even when both inputs are below $n$. Use `__int128` when the compiler supports it, or a carefully implemented overflow-safe multiplication routine.

```python
def mul_mod(a, b, mod):
    return (a * b) % mod

def pow_mod(a, e, mod):
    r = 1
    while e:
        if e & 1:
            r = mul_mod(r, a, mod)
        a = mul_mod(a, a, mod)
        e >>= 1
    return r
```

```cpp
using u64 = unsigned long long;
using u128 = __uint128_t;

u64 mul_mod(u64 a, u64 b, u64 mod) {
    return (u128)a * b % mod;
}

u64 pow_mod(u64 a, u64 e, u64 mod) {
    u64 r = 1;
    while (e) {
        if (e & 1) r = mul_mod(r, a, mod);
        a = mul_mod(a, a, mod);
        e >>= 1;
    }
    return r;
}
```

This is the multiplication and exponentiation foundation, not a complete primality test by itself. When implementing Miller–Rabin, handle $n<2$, small primes, even values, and the special case where a tested base is divisible by $n$.

## 10.2 Pollard's rho: finding a factor without checking all factors

Miller–Rabin tells us whether a number is prime, but a composite number still needs to be split. Pollard's rho generates a sequence such as

$$x_{i+1}=(x_i^2+c)\bmod n$$

and compares two positions in the sequence. If the sequence behaves differently modulo a hidden factor of $n$ than modulo $n$ itself, a GCD may reveal a non-trivial factor. The method is randomized, so one attempt can fail; restart with a new seed or constant when it does.

A practical factorization pipeline is: remove small prime factors, test whether the remaining number is prime with Miller–Rabin, and otherwise split it with Pollard's rho, then recursively factor both pieces. Sort the resulting prime factors and combine equal ones into powers.

Pollard's rho is not a magic constant-time algorithm. Its expected performance depends on the size of the smallest prime factor, and implementations need careful handling of overflow, random seeds, and failed attempts. For competitive programming, practice it together with GCD, modular multiplication, and primality testing rather than as a standalone trick.

## 10.3 Segmented sieve

If the task asks for primes in an interval $[L,R]$ where $R$ is large but $R-L$ is manageable, a full sieve up to $R$ may use too much memory. First generate all primes up to $\sqrt R$. Then create a boolean array for the interval and mark multiples of each base prime, beginning at

$$\max\left(p^2,\left\lceil\frac Lp\right\rceil p\right).$$

The $p^2$ term prevents us from marking the prime $p$ itself when it lies in the interval. This technique is useful when $R$ is very large but the interval width is perhaps a few million.

## 10.4 When this chapter is useful

Use a normal sieve when the maximum value is small enough to store. Use a segmented sieve for a narrow interval with a large endpoint. Use Miller–Rabin for primality of isolated large integers, and Pollard's rho when their prime factors are also needed. These methods form a standard advanced number theory toolkit.

---

# Chapter 11. Multiplicative functions and Möbius inversion

This chapter introduces functions defined on positive integers. The notation may look abstract at first, but the main examples are familiar: the number of divisors, the sum of divisors, and Euler's totient function.

## 11.1 Multiplicative functions

A function $f$ is **multiplicative** if $f(1)=1$ and

$$f(ab)=f(a)f(b)\quad\text{whenever }\gcd(a,b)=1.$$

The coprime condition matters. For example, the divisor-counting function $\tau(n)$ is multiplicative, but in general $\tau(ab)\ne\tau(a)\tau(b)$ when $a$ and $b$ share a prime factor.

If the prime factorization is

$$n=p_1^{e_1}p_2^{e_2}\cdots p_k^{e_k},$$

then the divisor count is

$$\tau(n)=\prod_{i=1}^{k}(e_i+1),$$

and the divisor sum is

$$\sigma(n)=\prod_{i=1}^{k}(1+p_i+p_i^2+\cdots+p_i^{e_i}).$$

Euler's totient function is also multiplicative, with

$$\phi(n)=n\prod_{p\mid n}\left(1-\frac1p\right).$$

These formulas show why prime factorization is so useful: once the exponents are known, several different questions become easy.

## 11.2 The Möbius function

The Möbius function $\mu(n)$ is defined as follows. If a prime square divides $n$, then $\mu(n)=0$. Otherwise, if $n$ is a product of $k$ distinct primes, then $\mu(n)=(-1)^k$. Also, $\mu(1)=1$.

For example, $\mu(6)=1$ because $6=2\cdot3$ has two distinct prime factors; $\mu(30)=-1$ because it has three; and $\mu(12)=0$ because $2^2\mid12$.

A key identity is

$$\sum_{d\mid n}\mu(d)=\begin{cases}1,&n=1,\\0,&n>1.\end{cases}$$

This identity is a way to cancel out contributions from numbers with common factors. It leads to Möbius inversion.

## 11.3 Möbius inversion, gently

Suppose two functions satisfy

$$F(n)=\sum_{d\mid n}f(d).$$

Then we can recover the original function using

$$f(n)=\sum_{d\mid n}\mu(d)F\left(\frac nd\right).$$

Think of $F(n)$ as a total that combines contributions from all divisors. Möbius inversion undoes that accumulation. It is useful for counting coprime pairs, primitive objects, and objects whose repetition or common divisor must be removed.

For example, the number of integers $1\le k\le n$ that are coprime to $n$ can be written as

$$\phi(n)=\sum_{d\mid n}\mu(d)\frac nd.$$

For implementation, a linear sieve can compute the smallest prime factor, $\mu(n)$, and $\phi(n)$ for all $n\le N$ in $O(N)$ time. The core skill is maintaining each number's smallest prime factor and distinguishing whether a new prime repeats a factor already present.

This compact version computes the Möbius function and totient together. It is included as a template; the explanation of why each branch works is the important part.

```python
def linearSieveFunctions(n, phi, mu):
    lp = [0] * (n + 1)
    primes = []
    phi[:] = [0] * (n + 1)
    mu[:] = [0] * (n + 1)
    if n >= 1:
        phi[1] = 1
        mu[1] = 1

    for i in range(2, n + 1):
        if lp[i] == 0:
            lp[i] = i
            primes.append(i)
            phi[i] = i - 1
            mu[i] = -1
        for p in primes:
            if p > lp[i] or p * i > n:
                break
            x = p * i
            lp[x] = p
            if p == lp[i]:
                phi[x] = phi[i] * p
                mu[x] = 0
                break
            phi[x] = phi[i] * (p - 1)
            mu[x] = -mu[i]
    return lp
```

```cpp
vector<int> linearSieveFunctions(int n, vector<int>& phi,
                                vector<int>& mu) {
    vector<int> lp(n + 1), primes;
    phi.assign(n + 1, 0);
    mu.assign(n + 1, 0);
    if (n >= 1) phi[1] = mu[1] = 1;

    for (int i = 2; i <= n; ++i) {
        if (lp[i] == 0) {
            lp[i] = i;
            primes.push_back(i);
            phi[i] = i - 1;
            mu[i] = -1;
        }
        for (int p : primes) {
            if (p > lp[i] || 1LL * p * i > n) break;
            int x = p * i;
            lp[x] = p;
            if (p == lp[i]) {
                phi[x] = phi[i] * p;
                mu[x] = 0;
                break;
            }
            phi[x] = phi[i] * (p - 1);
            mu[x] = -mu[i];
        }
    }
    return lp;
}
```

## 11.4 Dirichlet convolution

For arithmetic functions $f$ and $g$, define their Dirichlet convolution by

$$(f*g)(n)=\sum_{d\mid n}f(d)g\left(\frac nd\right).$$

# Chapter 12. Primitive roots, discrete logarithms, and modular equations

## 12.1 Powers modulo a number

Look at the powers of $a$ modulo $m$:

$$a^0,a^1,a^2,a^3,\ldots\pmod m.$$

If $\gcd(a,m)=1$, these powers eventually repeat and cycle through the invertible residues. The smallest positive integer $k$ for which $a^k\equiv1\pmod m$ is called the **multiplicative order** of $a$ modulo $m$.

For example, powers of $2$ modulo $7$ are $1,2,4,1,2,4,\ldots$, so the order of $2$ modulo $7$ is $3$. The order divides $\phi(m)$; this is a consequence of the group structure of invertible residues.

## 12.2 Primitive roots

A primitive root modulo $m$ is a number whose powers generate every residue that is coprime to $m$. In the prime modulus case, a number $g$ is a primitive root modulo prime $p$ when its order is $p-1$.

Here is the simple order-checking loop for a prime modulus, assuming the distinct prime factors of $p-1$ are already known:

```python
def isPrimitiveRoot(g, p, primeFactorsOfPMinus1):
    for q in primeFactorsOfPMinus1:
        if pow(g, (p - 1) // q, p) == 1:
            return False
    return True
```

```cpp
bool isPrimitiveRoot(long long g, long long p,
                     const vector<long long>& primeFactorsOfPMinus1) {
    for (long long q : primeFactorsOfPMinus1) {
        if (modPow(g, (p - 1) / q, p) == 1) return false;
    }
    return true;
}
```

This uses the `modPow` function from Chapter 4. Each prime factor needs to be checked only once. The condition is that, for every distinct prime divisor $q$ of $p-1$,

$$g^{(p-1)/q}\not\equiv1\pmod p.$$

If all checks pass, the order cannot be a proper divisor of $p-1$, so it must equal $p-1$. This method connects prime factorization with modular powers.

Primitive roots exist modulo $m$ exactly for $m=1,2,4,p^k,$ or $2p^k$, where $p$ is an odd prime. You do not need this classification in the first pass, but it becomes important when a problem asks whether all invertible residues can be represented as powers of one number.

## 12.3 Discrete logarithm and baby-step giant-step

The **discrete logarithm problem** asks for an integer $x$ satisfying

$$a^x\equiv b\pmod m.$$

Unlike ordinary logarithms, there is no general direct formula. A simple search tests every exponent, but that can take $O(m)$ time. Baby-step giant-step reduces this to about $O(\sqrt m)$ time and memory when the basic coprime setup applies.

Let $s=\lceil\sqrt m\rceil$. Write $x=qs+r$ with $0\le r<s$. Then

$$a^{qs+r}\equiv b\pmod m\quad\Longrightarrow\quad a^r\equiv b(a^{-s})^q\pmod m.$$

Store the values $a^r$ for all small $r$ in a hash table, then try the giant steps $b(a^{-s})^q$. A collision gives a candidate exponent, which should always be verified in the original equation. Non-coprime cases need additional reduction logic; do not apply this basic version blindly.

## 12.4 General linear congruences

Consider

$$ax\equiv b\pmod m.$$

Let $g=\gcd(a,m)$. A solution exists exactly when $g\mid b$. If this condition holds, divide the equation and modulus by $g$ to get

$$\frac ag x\equiv\frac bg\pmod{\frac mg},$$

where the new coefficient is coprime to the new modulus. Now a modular inverse can solve the reduced equation. There are generally $g$ solutions modulo the original $m$ when a solution exists. This is a useful bridge between GCD, inverses, and modular equations.

---

# Chapter 13. Advanced CRT, factorials modulo a prime, and binomial coefficients

## 13.1 CRT when moduli are not coprime

The familiar CRT version assumes pairwise coprime moduli. For two congruences

$$x\equiv a\pmod m,\qquad x\equiv b\pmod n,$$

a solution exists exactly when

$$a\equiv b\pmod{\gcd(m,n)}.$$

When a solution exists, it is unique modulo $\operatorname{lcm}(m,n)$. This generalized version is useful when constraints overlap rather than being independent. Combine two equations at a time, use extended Euclid to solve for the merge, and be careful with overflow in the combined modulus.

## 13.2 Factorials modulo a prime

For a prime $p$, ordinary factorial values become zero modulo $p$ once $n\ge p$, because the product contains a factor of $p$. Yet binomial coefficients can still be nonzero because prime factors may cancel between numerator and denominator before reducing modulo $p$.

For $n<p$, the standard formula is

$$\binom nk\equiv n!\,(k!)^{-1}\,((n-k)!)^{-1}\pmod p.$$

This works because each factorial in the denominator is nonzero modulo $p$ and therefore has an inverse. Precompute factorials and inverse factorials to answer many queries in constant time after linear preprocessing.

## 13.3 Lucas's theorem

When $n$ or $k$ is at least $p$, factorial-and-inverse-factorial tables up to $p-1$ are not enough. Write $n$ and $k$ in base $p$:

$$n=n_0+n_1p+n_2p^2+\cdots,\qquad k=k_0+k_1p+k_2p^2+\cdots.$$

Lucas's theorem states

$$\binom nk\equiv\prod_i\binom{n_i}{k_i}\pmod p.$$

Each digit-level binomial coefficient has digits smaller than $p$, so the previous factorial tables can compute it. If any $k_i>n_i$, that factor is zero and the whole answer is zero. This is an important pattern: a huge combinatorial input becomes several small independent calculations in base $p$.

## 13.4 Prime-power moduli

When the modulus is $p^e$ rather than a prime, modular inverses alone are not enough to evaluate factorial ratios, because some factors are divisible by $p$. Separate each integer into its power of $p$ and its part coprime to $p$. Count the total exponent of $p$ with Legendre's formula,

$$v_p(n!)=\sum_{i\ge1}\left\lfloor\frac{n}{p^i}\right\rfloor,$$

then compute the remaining coprime product modulo $p^e$. The exact implementation depends on whether $n$ is smaller or larger than the modulus and whether many queries share the same prime power. Treat this as an advanced topic: first be fully comfortable with ordinary factorials modulo a prime. An implementation checklist is: (1) compute the exponent of $p$ in each factorial; (2) multiply only the factors not divisible by $p$ modulo $p^e$; (3) use inverses only for products coprime to $p^e$; (4) combine the exponent and unit part at the end. Do not use the simple prime-modulus factorial formula here.

---

# Chapter 14. Floor sums and quotient grouping

A common advanced pattern is a sum involving integer division, for example

$$S(n)=\sum_{i=1}^{n}\left\lfloor\frac ni\right\rfloor.$$

Computing every term takes $O(n)$ time. But the quotient $\lfloor n/i\rfloor$ stays constant over long ranges. If its value at $i$ is $q$, the last index with that same quotient is

$$r=\left\lfloor\frac nq\right\rfloor.$$

So the entire interval $[i,r]$ contributes $(r-i+1)q$. Jump directly to $r+1$ instead of moving one index at a time:

```python
def sumFloor(n):
    ans = 0
    l = 1
    while l <= n:
        q = n // l
        r = n // q
        ans += q * (r - l + 1)
        l = r + 1
    return ans
```

```cpp
long long sumFloor(long long n) {
    long long ans = 0;
    for (long long l = 1, r; l <= n; l = r + 1) {
        long long q = n / l;
        r = n / q;
        ans += q * (r - l + 1);
    }
    return ans;
}
```

There are only $O(\sqrt n)$ distinct quotient ranges: for small indices there are few indices, and for large indices the quotient is small. The same idea appears in divisor summatory problems, counting lattice points, and sums of arithmetic functions. Before using the code, verify the exact range and whether products such as $q(r-l+1)$ can overflow.

A more difficult family asks for

$$\sum_{i=1}^{n} f\left(i,\left\lfloor\frac ni\right\rfloor\right)$$

or nested floor sums. The key first step is still to group intervals on which the quotient is unchanged. More advanced solutions combine quotient grouping with memoization, recurrences, or a sieve for arithmetic functions.

---

# Chapter 15. Diophantine equations and continued fractions

## 15.1 Integer solutions to a linear equation

A linear Diophantine equation asks for integer solutions of

$$ax+by=c.$$

Let $g=\gcd(a,b)$. An integer solution exists exactly when $g\mid c$. Extended Euclid finds one solution to $ax+by=g$; multiplying both coefficients by $c/g$ gives a solution for $c$.

If $(x_0,y_0)$ is one solution and $g>0$, every integer solution is

$$x=x_0+\frac bg t,\qquad y=y_0-\frac ag t,\qquad t\in\mathbb Z.$$

If the problem requires $x,y\ge0$ or bounds on the variables, convert those conditions into an interval for $t$. Many contest tasks that sound like “buy exactly this amount using two package sizes” are this equation plus bounds.

## 15.2 Continued fractions

A continued fraction represents a number through repeated integer parts and reciprocals:

$$[a_0;a_1,a_2,\ldots]=a_0+\frac1{a_1+\frac1{a_2+\cdots}}.$$

For rational numbers, the Euclidean algorithm produces a finite continued fraction. Its convergents are rational approximations that are unusually good for their denominator size. In contests, continued fractions can appear in rational approximation, fraction comparison, and problems involving the best approximation under a bound. The Euclidean algorithm directly gives the terms; this function records them for $a\ge0$ and $b>0$:

```python
def continuedFraction(a, b):
    terms = []
    while b != 0:
        terms.append(a // b)
        r = a % b
        a = b
        b = r
    return terms
```

```cpp
vector<long long> continuedFraction(long long a, long long b) {
    vector<long long> terms;
    while (b != 0) {
        terms.push_back(a / b);
        long long r = a % b;
        a = b;
        b = r;
    }
    return terms;
}
```

For example, `continuedFraction(13, 5)` returns `{2, 1, 1, 2}`, representing $13/5=[2;1,1,2]$.

You do not need to master the full theory immediately. First understand that the Euclidean algorithm repeatedly separates quotient and remainder; continued fractions record those quotients. Then learn how to generate convergents using

$$p_i=a_i p_{i-1}+p_{i-2},\qquad q_i=a_i q_{i-1}+q_{i-2}.$$

Handle signs and zero carefully when implementing the Euclidean algorithm for rational inputs.

---

# Chapter 16. Polynomial multiplication: FFT and NTT

Some number theory problems ask for the coefficients of a product of two polynomials. If

$$A(x)=\sum_{i=0}^{n-1}a_ix^i,\qquad B(x)=\sum_{j=0}^{m-1}b_jx^j,$$

then the coefficient of $x^k$ in $A(x)B(x)$ is

$$c_k=\sum_{i+j=k}a_i b_j.$$

The direct method takes $O(nm)$ time. The Fast Fourier Transform (FFT) evaluates the polynomials at carefully chosen complex roots of unity, multiplies the values, then transforms back. This reduces the time to $O(N\log N)$ for a padded size $N$.

The Number Theoretic Transform (NTT) uses modular arithmetic instead of floating-point complex numbers. It requires a modulus with suitable roots of unity, commonly a prime of the form $p=c\cdot2^k+1$, and a primitive root. For transform length $N$, we need an element of order $N$ modulo $p$. After pointwise multiplication, the inverse transform uses the inverse root and the modular inverse of $N$.

**NTT implementation stages:** choose a power-of-two length $N$ at least $n+m-1$; verify $N\mid(p-1)$; derive a root of order $N$; bit-reverse the indices; run iterative butterfly stages; multiply transformed coefficients pointwise; run the inverse stages using the inverse root; then multiply each coefficient by $N^{-1}\pmod p$. This is intentionally a stage-by-stage guide rather than a universal copy-paste implementation, since the modulus, root and supported length must agree.

A full NTT implementation is lengthy and depends on the chosen modulus and supported transform length, so this course gives the algorithm's essential stages rather than a copy-paste universal function: pad both coefficient arrays to a suitable power of two, transform both arrays, multiply corresponding entries modulo $p$, apply the inverse transform, and scale by $N^{-1}\pmod p$. Before coding, verify that $N\mid(p-1)$ and that the selected root has order exactly $N$.

A full NTT listing is modulus-specific, so this section explains the stages rather than pretending one short snippet is safe for every modulus and length. FFT implementations must manage floating-point rounding errors; NTT implementations must verify the modulus supports the required length and must prevent overflow during multiplication. For exact integer convolution, coefficient bounds may require multiple moduli and the Chinese Remainder Theorem to reconstruct the true coefficients.

This chapter connects several earlier topics: primitive roots supply transform roots, modular inverses build the inverse transform, and CRT can combine results from multiple moduli. It is advanced algebraic machinery, but each part rests on concepts already introduced.

---

# Chapter 17. GM-level problem-solving workflow

Grandmaster-level work is not a single algorithm. It is the ability to identify which mathematical structure a problem is hiding, prove the key observation, and implement it safely under constraints. For number theory, practice the following progression.

First, learn to recognize the object being counted: prime factors, divisors, coprime pairs, residues, orders of powers, or solutions to an equation. Next, derive a small formula by hand and test it on small values. Then estimate the limits: $O(n)$ may be too slow for a huge endpoint, while $O(\sqrt n)$, $O(\log n)$, or expected sublinear factorization may be suitable. Finally, prove the edge cases and check integer overflow before coding.

A useful advanced checklist is:

- **Large integer?** Consider deterministic Miller–Rabin, Pollard rho, and safe multiplication.
- **A sum over divisors?** Look for multiplicativity, Möbius inversion, or a linear sieve.
- **A huge exponent?** Consider binary exponentiation, multiplicative order, or discrete logarithms.
- **Several modular conditions?** Use CRT, including compatibility checks for non-coprime moduli.
- **A binomial coefficient with a large index?** Check Lucas's theorem or prime-power factorial methods.
- **A sum containing $\lfloor n/i\rfloor$?** Look for quotient grouping.
- **Polynomial coefficients?** Consider FFT/NTT and whether exact reconstruction is needed.

## 17.1 Suggested ladder of practice

1. **Foundation:** prime test, GCD/LCM, sieve, factorization, divisor count, and trailing zeros.
2. **Intermediate:** binary exponentiation, extended Euclid, modular inverse, Euler's totient, and CRT.
3. **Advanced:** linear sieve, Möbius function, multiplicative functions, linear congruences, primitive roots, and factorials modulo a prime.
4. **Expert:** Miller–Rabin, Pollard rho, generalized CRT, Lucas theorem, quotient grouping, and Diophantine equations with constraints.
5. **Grandmaster-oriented:** discrete logarithm, prime-power binomial methods, continued fractions, summatory arithmetic functions, FFT/NTT, and problems combining several of these ideas.

For each level, solve problems that require applying the technique in a new setting, not only implementing the standard template. Keep a notebook of the main idea, conditions under which it works, complexity, and the bug you encountered. That habit is more valuable than memorizing code.

## 17.2 A note on the meaning of GM level

No document alone guarantees a Codeforces Grandmaster rating; that level requires substantial contest practice across many topics, not just number theory. This course now extends to GM-oriented number theory techniques, but it should be used alongside difficult problems, editorials, and timed contests. Some topics—especially Pollard rho, prime-power factorials, summatory functions, and NTT—deserve separate deep study after this overview.

---

# Extended reference map

The [CP-Algorithms algebra index](https://github.com/cp-algorithms/cp-algorithms/tree/main/src/algebra) contains further articles that can be studied alongside the chapters above: [primality tests](https://cp-algorithms.com/algebra/primality_tests.html), [linear sieve](https://cp-algorithms.com/algebra/prime-sieve-linear.html), [Möbius function and related divisor techniques](https://cp-algorithms.com/algebra/divisors.html), [discrete logarithm](https://cp-algorithms.com/algebra/discrete-log.html), [primitive roots](https://cp-algorithms.com/algebra/primitive-root.html), [continued fractions](https://cp-algorithms.com/algebra/continued-fractions.html), and [FFT](https://cp-algorithms.com/algebra/fft.html). Use these for deeper proofs and implementation variants after learning the core idea here.
