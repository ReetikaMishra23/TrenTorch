// bits/stdc++.h for the in-browser clang (libc++ has no such header). Everything a DSA solution
// usually needs; <thread>, <mutex>, <atomic>, <regex> and <fstream> are left out (no threads or
// files in the browser).
#ifndef TRENTORCH_BITS_STDCPP_H
#define TRENTORCH_BITS_STDCPP_H

#include <algorithm>
#include <any>
#include <array>
#include <bitset>
#include <cassert>
#include <cctype>
#include <cerrno>
#include <cfloat>
#include <chrono>
#include <climits>
#include <cmath>
#include <complex>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <deque>
#include <forward_list>
#include <functional>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <list>
#include <map>
#include <memory>
#include <numbers>
#include <numeric>
#include <optional>
#include <queue>
#include <random>
#include <ranges>
#include <ratio>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <variant>
#include <vector>

// GCC extensions that competitive-programming code leans on and libc++ does not have.
namespace std {
template <class A, class B>
constexpr auto __gcd(A a, B b) {
    return std::gcd(a, b);
}
template <class T>
constexpr int __lg(T x) {
    return static_cast<int>(sizeof(unsigned long long) * 8 - 1 - __builtin_clzll(static_cast<unsigned long long>(x)));
}
}  // namespace std

#endif
