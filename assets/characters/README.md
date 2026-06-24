# Character image slots

Add replaceable PNG assets in the following paths. The game will automatically use them; until then it displays a safe initial-based fallback.

- `balance/icon.png`, `balance/bust.png`, `balance/full.png`
- `power/icon.png`, `power/bust.png`, `power/full.png`
- `technique/icon.png`, `technique/bust.png`, `technique/full.png`

## Phase G-3.5 sprite frames

The shot overlay uses the five `swing/` frames below only when every frame for the selected character loads successfully. If even one is missing, it automatically falls back to the `full.png` CSS animation.

- `{balance,power,technique}/swing/swing_01_address.png`
- `{balance,power,technique}/swing/swing_02_backswing.png`
- `{balance,power,technique}/swing/swing_03_top.png`
- `{balance,power,technique}/swing/swing_04_impact.png`
- `{balance,power,technique}/swing/swing_05_follow.png`

Putt frames are optional. When all four are available, the same overlay uses them; otherwise its compact CSS putt animation remains active.

- `{balance,power,technique}/putt/putt_01_address.png`
- `{balance,power,technique}/putt/putt_02_stroke.png`
- `{balance,power,technique}/putt/putt_03_impact.png`
- `{balance,power,technique}/putt/putt_04_follow.png`
