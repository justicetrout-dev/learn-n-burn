# Builder's Construction Calculator

A browser version of the feet-inch-fraction calculators builders use on job sites.
Open `index.html` in a browser. There is nothing to install or build.

## What it does

- **Feet mode (the default), like the Jobber.** Type the feet digits, then one key for inches (0–11), then one key for sixteenths (0–15). The keypad has single keys for 10–15 so that each of these is one press. `1 0 0 0` shows 10′-0 0/16. `2 4 5 10` shows 24′-5 10/16 while you type and simplifies to 24′-5 5/8″ when you press `=`. Like the Jobber, Feet mode has no plain numbers. `×` and `÷` work in feet and answer with a length: `1 0 0 0 × 2 0` = 1′-8″ (10 × 0.1667 ft). To divide by 3, enter 3′: `1 0 0 0 ÷ 3 0 0` = 3′-4″.
- **FT/DEC** switches to plain decimal numbers. In either mode you can put a unit key after the digits instead: `12 Feet`, `24 Feet 11 Inch 5` (24′-11 5/16″) (after `Inch`, the next number key is sixteenths), `3 ⁄ 8 Inch`, `2 m`.
- **Feet-inch-fraction math.** Results show at 1/16″ by default. Press the `1/16` key to switch between 1/2 and 1/64.
- **Unit tracking (DEC mode).** Length × length gives area, and area × length gives volume. Adding a length to an area is an error. A plain number added to a length uses that length's unit (5′ + 3 = 8′).
- **Conversions.** Press `Feet`, `Inch`, `Yds`, `m`, `cm`, `mm` or `BdFt` on a result to convert it. Pressing `Feet` or `Inch` a second time switches to decimals.
- **Areas and volumes.** Press a unit key twice or three times: `12 Feet Feet` is 12 sq ft.
- **Right triangles and roofs.** Enter any two of `Rise`, `Run`, `Slope` or `Pitch`, then press one of the others to solve it. `Slope` is the slope length (the diagonal), like the Jobber's SLP key: `1 0 0 0 Rise 5 0 0 0 Run Slope` = 50′-11 7/8″. Pitch is inches of rise per foot of run. `Deg°` enters or shows pitch as an angle. You can also store a result by pressing a register key right after `=`.
- **Stairs.** Enter the total rise and press `Stair` repeatedly. You get the riser count, riser height, tread count, tread depth, total run and stringer length. Risers are at most 7¾″. Treads are 10″ unless you stored a total `Run`.
- **Circles.** Enter a diameter and press `Circ` repeatedly for circumference, then area.
- **Memory:** `M+`, `M−`, `RCL`, `MC`. There's also √, x², ±, backspace, and a tape of past calculations.
- **Clear:** press `C` once to clear the entry. Press it again to clear everything. A third press resets rise, run, slope and pitch.

Keyboard: digits, `+ - * /`, `'` feet, `"` inch, `\` fraction, `Enter`, `Esc`, `Backspace`,
`r`/`n`/`s`/`p` for rise/run/slope/pitch.

## Code

- `calc.js`: the calculator engine, with no DOM code. It works in the browser and in Node.
- `app.js`, `index.html`, `style.css`: the keypad and display.
- `test/calc.test.js`: engine tests. Run them with `npm test` (Node 18+).
