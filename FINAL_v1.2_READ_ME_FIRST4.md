# PERSONAL FITNESS APP — FINAL FILE SET

## Read these files in this order

1. FINAL\_v1.2\_PERSONAL\_FITNESS\_APP\_MASTER\_SPECIFICATION4.md
Source of truth for user profile, goals, nutrition, recipes, weekly food schedule,
recovery, tracking, milestones, and app behavior.
2. FINAL\_v1.2\_PERSONAL\_FITNESS\_WORKOUT\_PROGRAM\_SPECIFICATION4.md
Source of truth for the weekly workout program, exercise prescriptions, RIR,
progression, recovery, substitutions, and training logic.
3. FINAL\_v1.2\_PERSONAL\_FITNESS\_APP\_TECHNICAL\_SPECIFICATION4.md
Source of truth for app architecture, data models, implementation rules, UI,
recommendation engines, and acceptance tests.

## Important distinctions

* CORE = expected foundation
* SCHEDULED = planned for a specific day
* OPTIONAL = useful only when needed; never treat skipping it as failure
* SUBSTITUTE = acceptable replacement when the preferred option is unavailable
* CONFIRMED = directly recovered workout information
* HISTORICAL RECONSTRUCTION = reconstructed final workout details where the original
exercise-by-exercise source was unavailable
* CUSTOM = later user edits

## Build principle

The app must be mobile-first, simple, flexible, and non-punitive.
It should make daily decisions easier rather than forcing unnecessary complexity.

