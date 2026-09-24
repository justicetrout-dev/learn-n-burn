# Builder's Construction Calculator

A browser version of the feet-inch-fraction calculators builders use on job sites.
Open `index.html` in a browser. There is nothing to install or build.

## What it does

- **Feet-inch-sixteenths entry.** The keypad has number keys 0–15. After you press `Inch`, the next number key is sixteenths, reduced automatically: `24 Feet 11 Inch 5` is 24′ 11-5/16″, `2` is 1/8, `4` is 1/4 and `12` is 3/4. On a keyboard, typing `1` then `5` gives 15/16. For other fractions use the `⁄` key: `3 ⁄ 8 Inch` is 3/8″.
- **Feet-inch-fraction math.** Results show at 1/16″ by default. Press the `1/16` key to switch between 1/2 and 1/64.
- **Unit tracking.** Length × length gives area, and area × length gives volume. Adding a length to an area is an error. A plain number added to a length uses that length's unit (5′ + 3 = 8′).
- **Conversions.** Press `Feet`, `Inch`, `Yds`, `m`, `cm`, `mm` or `BdFt` on a result to convert it. Pressing `Feet` or `Inch` a second time switches to decimals.
- **Areas and volumes.** Press a unit key twice or three times: `12 Feet Feet` is 12 sq ft.
- **Right triangles and roofs.** Enter any two of `Rise`, `Run`, `Diag` or `Pitch`, then press one of the others to solve it. Pitch is inches of rise per foot of run. `Deg°` enters or shows pitch as an angle. You can also store a result by pressing a register key right after `=`.
- **Stairs.** Enter the total rise and press `Stair` repeatedly. You get the riser count, riser height, tread count, tread depth, total run and stringer length. Risers are at most 7¾″. Treads are 10″ unless you stored a total `Run`.
- **Circles.** Enter a diameter and press `Circ` repeatedly for circumference, then area.
- **Memory:** `M+`, `M−`, `RCL`, `MC`. There's also √, x², ±, backspace, and a tape of past calculations.
- **Clear:** press `C` once to clear the entry. Press it again to clear everything. A third press resets rise, run, diagonal and pitch.

Keyboard: digits, `+ - * /`, `'` feet, `"` inch, `\` fraction, `Enter`, `Esc`, `Backspace`,
`r`/`n`/`g`/`p` for rise/run/diag/pitch.

## Code

- `calc.js`: the calculator engine, with no DOM code. It works in the browser and in Node.
- `app.js`, `index.html`, `style.css`: the keypad and display.
- `test/calc.test.js`: engine tests. Run them with `npm test` (Node 18+).
