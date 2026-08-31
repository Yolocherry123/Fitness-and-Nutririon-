# PERSONAL FITNESS APP — TECHNICAL & IMPLEMENTATION SPECIFICATION

# 1. PURPOSE

Build a mobile-first personal fitness application based on:
- PERSONAL_FITNESS_APP_MASTER_SPECIFICATION.md
- PERSONAL_FITNESS_WORKOUT_PROGRAM_SPECIFICATION.md

If files conflict:
1. Source-confirmed user data takes priority.
2. Master nutrition/lifestyle rules govern food behavior.
3. Workout Program governs training behavior.
4. Reconstructed workout sections remain editable.

---

# 2. PRODUCT PRINCIPLES

The app must be:
- simple,
- fast,
- mobile-first,
- personalized,
- flexible,
- non-punitive.

Do not turn optional optimization into mandatory complexity.

---

# 3. PRIMARY NAVIGATION

Recommended tabs:

1. Today
2. Plan
3. Workout
4. Progress
5. Review

Secondary:
- Recipes
- Settings
- Data / Backup

---

# 4. TODAY SCREEN

Show only today's important actions.

Sections:
- Date/day
- Bodyweight prompt
- Today's workout/recovery
- Morning food
- Lunch
- Afternoon/pre-workout
- Supplements
- Dinner addition
- Optional night food
- Daily completion

Highlight:
- CORE
- SCHEDULED
- OPTIONAL

Do not visually score skipped optional items as failure.

---

# 5. WEEKLY PLAN SCREEN

Seven day cards.

Each card:
- day
- workout/rest type
- major food addition
- key supplement action
- completion status

Today is automatically highlighted.

Click card → full daily plan.

---

# 6. FOOD SYSTEM

Data categories:

FoodAction:
- id
- name
- dayOfWeek nullable
- timeWindow
- category: CORE | SCHEDULED | OPTIONAL | SUBSTITUTE
- quantity
- unit
- notes
- completion status

The app must support:
- flexible mess meals,
- substitutions,
- optional calorie tools,
- milk powder as a milk substitute.

---

# 7. WORKOUT DATA MODEL

WorkoutPlan:
- id
- name
- version
- activeFrom

WorkoutDay:
- id
- day
- workoutName
- type: TRAINING | ACTIVE_RECOVERY | REST

Exercise:
- id
- name
- sourceStatus: CONFIRMED | RECONSTRUCTED | CUSTOM

ExercisePrescription:
- sets
- repMin
- repMax
- targetRIRMin
- targetRIRMax
- restSecondsSuggested

WorkoutSession:
- date
- workoutPlanVersion
- status
- notes

SetLog:
- exerciseId
- setNumber
- load
- reps
- rir
- completed

WarmupSet:
- optional separate logging

---

# 8. BODYWEIGHT MODEL

BodyweightEntry:
- date
- weightKg
- conditionsNote optional

Computed:
- 7-day average
- weekly average
- week-over-week change

Never overreact to one weigh-in.

---

# 9. PROGRESSION ENGINE

Inputs:
- recent exercise performance
- rep range
- load
- RIR
- completion quality

Output:
- maintain,
- attempt more reps,
- increase load/difficulty,
- review fatigue.

Do not recommend increasing load after every set.

---

# 10. NUTRITION ADJUSTMENT ENGINE

Inputs:
- bodyweight trend
- consistency
- sufficient data availability
- current calorie target

Output:
- maintain
- add approximately 100–150 kcal/day
- reduce approximately 100–150 kcal/day
- insufficient data

Every output includes:
- recommendation
- reason
- confidence / data sufficiency

---

# 11. COMPLETION SCORING

Separate:

CORE SCORE
SCHEDULED SCORE
OPTIONAL LOG

Overall consistency should be based primarily on CORE and relevant SCHEDULED actions.

Do not lower the score merely because:
- nuts were skipped,
- whey was unnecessary,
- chia/flax was skipped,
- ghee was not used.

---

# 12. MISSED EVENT HANDLING

Missed meal:
- offer substitute
- do not force compensation

Missed workout:
- reschedule/skip/manual choice
- avoid stacking hard sessions

Missed weigh-in:
- continue normally

Missed creatine:
- resume normal dose
- do not double automatically

---

# 13. WEEKLY REVIEW

Show:
- average bodyweight
- weekly change
- workouts completed
- nutrition consistency
- creatine consistency
- sleep consistency
- strength progression

Then generate:
- Continue
OR
- Increase calories
OR
- Reduce calories
OR
- Collect more data

Always explain why.

---

# 14. PLAN VERSIONING

Never destroy historical data when a plan changes.

PlanVersion:
- id
- createdAt
- effectiveDate
- reason
- archived boolean

Historical workouts remain connected to the plan version used at that time.

---

# 15. BACKUP / EXPORT

Support eventually:
- JSON export/import
- CSV progress export where useful
- local backup
- restore

The architecture should not lock the user's data into one unrecoverable state.

---

# 16. ONBOARDING

Initial setup:
1. Confirm age/height/current weight/goal.
2. Confirm equipment.
3. Confirm training preference.
4. Confirm typical schedule.
5. Confirm supplements used.
6. Confirm whether milk powder substitute is needed.
7. Confirm calorie target as starting value.

All values remain editable later.

---

# 17. NOTIFICATIONS

Only useful reminders.

Possible:
- morning bodyweight prompt
- workout reminder
- creatine reminder
- weekly review
- optional meal-prep reminder

All reminders:
- configurable
- disableable

Do not spam the user.

---

# 18. RECIPE LIBRARY

Each recipe should contain:
- ingredients
- quantities
- preparation
- category
- optional substitutions
- storage guidance
- estimated nutrition only when reliable enough

Recipes:
- Standard Anabolic Bowl
- Milk-Powder Milk
- Air-Fryer Chicken
- Chicken Kebab Meal
- Peanut Butter Sandwich
- Simple Protein Shake

---

# 19. DESIGN SYSTEM

Use:
- clean cards
- large readable text
- obvious checkboxes
- minimal typing
- quick logging
- progress bars

Prioritize:
"Can I understand what I need to do today in 10 seconds?"

---

# 20. SAFETY

The app should not diagnose medical conditions.

For concerning symptoms:
- display appropriate caution
- recommend stopping unsafe activity
- suggest professional evaluation where appropriate

---

# 21. DEVELOPMENT PRIORITIES

## Phase 1 — Essential
- Today
- Weekly Plan
- Weekly Food Plan
- Workout logging
- bodyweight logging
- progress chart
- weekly review

## Phase 2 — Intelligence
- progression recommendations
- calorie adjustment logic
- missed-workout logic
- completion scoring

## Phase 3 — Quality of life
- recipe library
- reminders
- plan versions
- export/import
- backup

---

# FINAL IMPLEMENTATION RULE

The application should preserve flexibility.

CORE actions should guide consistency.
SCHEDULED actions should appear on the correct days.
OPTIONAL tools should help solve a problem, never create unnecessary obligations.


---

# 22. IMPROVED PRODUCT LOGIC — RECOMMENDATION PRIORITY

The recommendation engine must avoid showing too many suggestions.

Maximum default recommendation hierarchy:

1. One primary action
2. One secondary action
3. Optional alternatives

Example:
Primary: "Complete today's planned meals."
Secondary: "Use the scheduled chicken serving at dinner."
Optional alternatives: "If protein is still short, use whey."

---

# 23. DATA CONFIDENCE

Computed recommendations should include an internal confidence state:

- HIGH — enough consistent data
- MEDIUM — useful but incomplete data
- LOW — insufficient data

For LOW confidence:
- avoid strong calorie changes,
- ask for more consistent logging.

The UI can use plain language rather than exposing technical confidence labels.

---

# 24. NUTRITION ESTIMATION RULE

Hostel mess nutrition is variable.

The app must support:
- exact logging when information is known,
- approximate meal logging when only rough information is known,
- checklist-only completion when macros cannot be estimated reliably.

Do not present hostel calorie estimates as precise facts.

---

# 25. OFFLINE-FIRST LOGGING

Core daily actions should work with minimal friction and ideally without requiring constant network access.

Priority offline data:
- workout logs
- bodyweight
- checklist completion
- notes

Sync/backup can occur later.

---

# 26. AUDITABLE RECOMMENDATIONS

For every automated recommendation, store:

- recommendation type
- date
- input data window
- reason
- previous target
- new target if changed

This makes the system understandable and prevents mysterious automatic changes.

---

# 27. RESET / EDIT CONTROLS

The user must be able to:
- edit a logged meal,
- undo a completion,
- correct bodyweight,
- change an exercise log,
- edit calorie targets,
- archive a plan version.

Do not make the app irreversible.

---

# 28. DASHBOARD RULE

The Today screen should answer only:

1. What should I do now?
2. What is important later today?
3. Am I generally on track?

Detailed analytics belong on Progress and Review screens.

---

# 29. IMPLEMENTATION ACCEPTANCE TESTS

Before considering the app complete, verify:

- Today highlights the correct day.
- Monday–Sunday food additions appear on correct days.
- Optional foods do not reduce core completion.
- Rest days retain nutrition and creatine logic.
- Milk powder can substitute for milk.
- Bone-in chicken can be logged distinctly from edible meat.
- Upper A and Lower A display as confirmed exercises.
- Reconstructed Upper B/Lower B are clearly labeled/editable.
- A missed workout does not automatically create unsafe catch-up sessions.
- A missed creatine dose does not recommend doubling.
- Calorie changes require sufficient trend data.
- Historical logs survive plan edits.
