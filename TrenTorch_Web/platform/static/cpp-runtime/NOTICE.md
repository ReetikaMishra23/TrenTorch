# C++ runtime (clang compiled to WebAssembly)

These files let the DSA IDE compile and run C++ in the browser. They are third-party builds and are
not modified here; they are copied unchanged from the `@live-codes/clang-wasm` 0.3.0 npm package
(MIT, https://www.npmjs.com/package/@live-codes/clang-wasm).

| File | What it is | SHA-256 |
| --- | --- | --- |
| `clang.wasm.gz` | Clang 22.1.8 (LLVM revision `ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`) built for `wasm32-wasi` | `b1174438d9a67b7ff11e623541b9a0572c024a9e798084b9b021dd9da2da0874` |
| `lld.wasm.gz` | `wasm-ld` from the same LLVM build | `f842a9b5df3c6d326f0260bfd313c11c2e22bc8b8ae0387deede9a4af55779cd` |
| `sysroot.tar.gz` | libc++ and wasi-libc headers and libraries (no exceptions, no threads) | `195e8083bace1baf86014f134a210db354cd77825988eaac7d262161cf496c4f` |

The hashes are the ones the package itself pins (`src/asset-receipts.js`). The package's `memfs.wasm.gz`
is not used: the worker serves the sysroot from memory through the WASI shim in `rust-vendor/`.

Licences: LLVM is Apache-2.0 WITH LLVM-exception (`LICENSE.llvm.txt`); the sysroot also contains
wasi-libc and libc++ under Apache-2.0, MIT, BSD and CC0 terms (`THIRD-PARTY-NOTICES.md`).

The files are gzipped on disk and decompressed in the worker (`processes/code-execution/cpp-worker.ts`),
not served with `Content-Encoding`, so any static host can serve them as they are. Each is under
Cloudflare Pages' 25 MiB per-file limit.

## Updating

Fetch a newer `@live-codes/clang-wasm`, copy the three files from `assets/bin/`, check their SHA-256
against its `src/asset-receipts.js`, update the table above, and run
`processes/code-execution/cpp-toolchain.spec.ts`. A different LLVM release may use a different resource
directory (`/lib/clang/<major>`); `RESOURCE_DIR` in `cpp-toolchain.ts` must match.
