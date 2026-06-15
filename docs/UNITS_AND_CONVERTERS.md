# Units And Converters

Infinite Flight Connect API values are close to the simulator's internal representation. That means some states do not use the units, direction, or value ranges that a normal cockpit overlay, dashboard, or automation script might want to display.

`ifc-node` includes `ValueConverters` to make those cases explicit at the call site.

## Why Converters Exist

Some Infinite Flight values are non-standard from the perspective of JavaScript application code:

- A state can expose a simulator-native control value instead of a 0-100 UI percentage.
- A value can use metres where an aviation display normally uses feet.
- A value can use metres per minute while a pilot-facing display normally uses feet per minute.
- A state can have an inverted or offset range.

Keeping conversion in named helper functions makes code easier to audit. It also prevents magic numbers from spreading through application code.

## Throttle

The throttle helpers convert between Infinite Flight's raw throttle representation and a percentage suitable for UI.

```ts
import { ValueConverters } from "ifc-node";

const raw = ValueConverters.percentToThrottle(80);
await client.set("aircraft/0/engines/0/throttle", raw);

const displayed = ValueConverters.throttleToPercent(raw);
```

`percentToThrottle` clamps input to the 0-100 range before converting it.

## Vertical Speed

The vertical speed helpers convert between feet per minute and metres per minute.

```ts
const mpm = ValueConverters.fpmToMpm(1_800);
const fpm = ValueConverters.mpmToFpm(mpm);
```

## Best Practices

- Name converted values clearly, such as `rawThrottle`, `throttlePercent`, `verticalSpeedFpm`, or `verticalSpeedMpm`.
- Convert at the boundary between your application and Infinite Flight.
- Store values internally in the unit your application uses most often.
- Check the live manifest before assuming a state exists for the current aircraft.
- Prefer adding a converter to this package over repeating a one-off formula in multiple apps.

