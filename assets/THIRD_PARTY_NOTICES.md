# Third-party notices

JavaScript libraries vendored in `src/report/assets/` are copied to
`web-private/assets/` or `web-public/assets/` when the report website is
generated (`python -m src.report.generate`, optionally with `--mode private` or
`--mode public`).

## ApexCharts 4.7.0

| | |
|---|---|
| **File** | `apexcharts.min.js` |
| **Use** | Historical price chart on the company details page (`company.html`) |
| **Homepage** | https://apexcharts.com |
| **Source** | https://github.com/apexcharts/apexcharts.js (tag `v4.7.0`) |
| **License** | MIT (full text below) |

### Version pin

This project pins **4.7.0** — the last release in the 4.x line under MIT.

ApexCharts **5.2.0 and later** use a revenue-based license
(https://apexcharts.com/license/). LewyTrader stays on 4.7.0 to keep a clear,
permissive MIT license for public hosting and open-source distribution.

The minified bundle header also states the version and copyright:

```text
ApexCharts v4.7.0
(c) 2018-2025 ApexCharts
Released under the MIT License.
```

### MIT License

```
The MIT License (MIT)

Copyright (c) 2018 ApexCharts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
