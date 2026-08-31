import type {
  DayOfWeek,
  Exercise,
  ExercisePrescription,
  FoodAction,
  Recipe,
  UserProfile,
  WorkoutDay,
} from '../models/types'

export const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  age: 22,
  sex: 'Male',
  heightCm: 190.5,
  currentWeightKg: 60,
  goalWeightKg: 85,
  experience: 'Some training experience',
  trainingPreference: 'Calisthenics-focused, with weights available',
  environment: 'Hostel with changing mess menu',
  equipment: 'Gym and weights available; calisthenics preferred',
  wakeTime: '07:30',
  classStart: '09:00',
  classEnd: '16:00',
  milkPowderSubstitute: true,
  usesCreatine: true,
  usesWhey: true,
  calorieTargetMin: 2900,
  calorieTargetMax: 3100,
  proteinTargetMin: 110,
  proteinTargetMax: 125,
  waterGoalMl: 3000,
  digestionMode: false,
  onboardingComplete: false,
}

/** Weekly food / supplement actions from Master Spec §5–6 */
export function buildFoodActions(): FoodAction[] {
  const actions: FoodAction[] = []
  let n = 0
  const id = (prefix: string) => `${prefix}-${++n}`

  const everyDayCore = (
    name: string,
    timeWindow: string,
    sortOrder: number,
    extras: Partial<FoodAction> = {},
  ): FoodAction => ({
    id: id('food'),
    name,
    dayOfWeek: null,
    timeWindow,
    category: 'CORE',
    sortOrder,
    ...extras,
  })

  // Morning water
  actions.push(
    everyDayCore('Morning water (300–400 ml)', 'Morning', 10, {
      quantity: '300–400',
      unit: 'ml',
    }),
  )

  // Anabolic bowl
  actions.push(
    everyDayCore('Anabolic bowl', 'Breakfast', 20, {
      notes: '40–60 g oats · banana · 1 tbsp PB · 200–250 ml milk',
      allowsMilkPowderSub: true,
    }),
  )

  // Hostel breakfast
  actions.push(
    everyDayCore('Hostel breakfast', 'Breakfast', 30, {
      notes: 'Prioritize eggs, milk, curd, paneer when available',
    }),
  )

  // Lunch
  actions.push(
    everyDayCore('Hostel lunch', 'Lunch', 40, {
      notes: 'Rice, dal, vegetables, chapati if desired · available protein',
    }),
  )

  // Dinner
  actions.push(
    everyDayCore('Hostel dinner', 'Dinner', 70, {
      notes: 'Rice/chapati, dal, available protein, vegetables',
    }),
  )

  // Pre-workout banana — training days default
  const trainingDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday']
  for (const day of trainingDays) {
    actions.push({
      id: id('food'),
      name: 'Pre-workout banana',
      dayOfWeek: day,
      timeWindow: 'Afternoon',
      category: day === 'Saturday' ? 'SCHEDULED' : 'CORE',
      sortOrder: 50,
      isTrainingDayOnly: true,
      notes: 'Default simple pre-workout option',
    })
  }

  // Creatine every day
  for (const day of [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ] as DayOfWeek[]) {
    actions.push({
      id: id('food'),
      name: 'Creatine 3–5 g',
      dayOfWeek: day,
      timeWindow: 'Supplements',
      category: 'SCHEDULED',
      quantity: '3–5',
      unit: 'g',
      sortOrder: 60,
      notes: 'Consistency over timing. Do not double if missed.',
    })
  }

  // Whey if needed — training days
  for (const day of trainingDays) {
    actions.push({
      id: id('food'),
      name: 'Whey (if needed for protein)',
      dayOfWeek: day,
      timeWindow: 'Supplements',
      category: 'OPTIONAL',
      sortOrder: 61,
      notes: 'Convenience tool — not mandatory after every workout',
    })
  }

  // Scheduled chicken / kebab
  const chickenDays: { day: DayOfWeek; name: string; qty: string; measure?: FoodAction['chickenMeasure'] }[] = [
    {
      day: 'Monday',
      name: 'Bone-in grilled chicken with dinner',
      qty: '300–350 g bone-in',
      measure: 'BONE_IN',
    },
    {
      day: 'Wednesday',
      name: 'Chicken kebab with dinner',
      qty: '150 g',
    },
    {
      day: 'Friday',
      name: 'Chicken kebab with dinner',
      qty: '150 g',
    },
    {
      day: 'Saturday',
      name: 'Bone-in grilled chicken with dinner',
      qty: '300–350 g bone-in',
      measure: 'BONE_IN',
    },
    {
      day: 'Sunday',
      name: 'Bone-in grilled chicken with dinner',
      qty: '300–350 g bone-in',
      measure: 'BONE_IN',
    },
  ]
  for (const c of chickenDays) {
    actions.push({
      id: id('food'),
      name: c.name,
      dayOfWeek: c.day,
      timeWindow: 'Dinner',
      category: 'SCHEDULED',
      quantity: c.qty,
      sortOrder: 75,
      chickenMeasure: c.measure,
      notes: c.measure === 'BONE_IN' ? 'Bone-in weight ≠ edible meat weight' : undefined,
    })
  }

  // Optional night food
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]) {
    actions.push({
      id: id('food'),
      name: 'Night milk / curd (if useful)',
      dayOfWeek: day,
      timeWindow: 'Night',
      category: 'OPTIONAL',
      sortOrder: 90,
      allowsMilkPowderSub: true,
      notes: 'Only if hungry, dinner was small, or calories needed',
    })
  }

  // Optional fiber rotation
  const fiber: { day: DayOfWeek; name: string }[] = [
    { day: 'Monday', name: 'Optional: mixed nuts OR no seed' },
    { day: 'Tuesday', name: 'Optional: chia ~5 g' },
    { day: 'Wednesday', name: 'Optional: prepared sprouts 50–100 g' },
    { day: 'Thursday', name: 'Optional: ground flax ~5 g' },
    { day: 'Friday', name: 'Optional: mixed nuts OR no seed' },
    { day: 'Saturday', name: 'Optional: sprouts OR mixed nuts' },
  ]
  for (const f of fiber) {
    actions.push({
      id: id('food'),
      name: f.name,
      dayOfWeek: f.day,
      timeWindow: 'Breakfast',
      category: 'OPTIONAL',
      sortOrder: 25,
      notes: 'Do not stack with other high-fiber additions',
    })
  }

  // Optional ghee
  actions.push({
    id: id('food'),
    name: 'Optional ghee (~5 g) with dinner',
    dayOfWeek: null,
    timeWindow: 'Dinner',
    category: 'OPTIONAL',
    sortOrder: 80,
    notes: 'Only when useful for calories',
  })

  // Wednesday optional banana snack (master §6)
  actions.push({
    id: id('food'),
    name: 'Banana snack (if useful)',
    dayOfWeek: 'Wednesday',
    timeWindow: 'Afternoon',
    category: 'OPTIONAL',
    sortOrder: 50,
    notes: 'Useful for calories on recovery day — not compulsory',
  })

  // Sunday optional walk + banana
  actions.push({
    id: id('food'),
    name: 'Optional light walking',
    dayOfWeek: 'Sunday',
    timeWindow: 'Afternoon',
    category: 'OPTIONAL',
    sortOrder: 55,
  })
  actions.push({
    id: id('food'),
    name: 'Afternoon snack / banana (if useful)',
    dayOfWeek: 'Sunday',
    timeWindow: 'Afternoon',
    category: 'OPTIONAL',
    sortOrder: 52,
    notes: 'Only if useful for calories',
  })

  return actions
}

export const WORKOUT_DAYS: WorkoutDay[] = [
  {
    id: 'wd-mon',
    day: 'Monday',
    workoutName: 'Upper Body A',
    type: 'TRAINING',
    sourceNote: 'SOURCE-CONFIRMED',
  },
  {
    id: 'wd-tue',
    day: 'Tuesday',
    workoutName: 'Lower Body A',
    type: 'TRAINING',
    sourceNote: 'SOURCE-CONFIRMED',
  },
  {
    id: 'wd-wed',
    day: 'Wednesday',
    workoutName: 'Active Recovery',
    type: 'ACTIVE_RECOVERY',
    sourceNote: 'SOURCE-CONFIRMED',
  },
  {
    id: 'wd-thu',
    day: 'Thursday',
    workoutName: 'Upper Body B',
    type: 'TRAINING',
    sourceNote: 'HISTORICAL RECONSTRUCTION',
  },
  {
    id: 'wd-fri',
    day: 'Friday',
    workoutName: 'Lower Body B',
    type: 'TRAINING',
    sourceNote: 'HISTORICAL RECONSTRUCTION',
  },
  {
    id: 'wd-sat',
    day: 'Saturday',
    workoutName: 'Calisthenics + Skills + Core',
    type: 'TRAINING',
    sourceNote: 'HISTORICAL RECONSTRUCTION (focus confirmed)',
  },
  {
    id: 'wd-sun',
    day: 'Sunday',
    workoutName: 'Full Rest',
    type: 'REST',
    sourceNote: 'SOURCE-CONFIRMED',
  },
]

interface ExDef {
  id: string
  name: string
  sourceStatus: Exercise['sourceStatus']
  dayId: string
  sets: number
  repMin: number
  repMax: number
  rirMin: number
  rirMax: number
  rest: number
  perSide?: boolean
  isSkill?: boolean
  isCoreCircuit?: boolean
  allowsVariationChoice?: boolean
  variationOptions?: string[]
  notes?: string
  order: number
}

const EX_DEFS: ExDef[] = [
  // Upper A — CONFIRMED
  { id: 'ex-pushups', name: 'Push-Ups', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 8, repMax: 15, rirMin: 2, rirMax: 2, rest: 90, order: 1 },
  { id: 'ex-ohp', name: 'Barbell Overhead Press', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 6, repMax: 10, rirMin: 2, rirMax: 2, rest: 150, order: 2 },
  { id: 'ex-bor', name: 'Bent-Over Row', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, order: 3 },
  { id: 'ex-dfp', name: 'Dumbbell Floor Press', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, order: 4 },
  { id: 'ex-face', name: 'Band Face Pull', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 12, repMax: 20, rirMin: 2, rirMax: 2, rest: 75, order: 5 },
  { id: 'ex-curl', name: 'Dumbbell Curl', sourceStatus: 'CONFIRMED', dayId: 'wd-mon', sets: 3, repMin: 8, repMax: 15, rirMin: 1, rirMax: 2, rest: 75, order: 6 },

  // Lower A — CONFIRMED
  { id: 'ex-bsquat', name: 'Back Squat', sourceStatus: 'CONFIRMED', dayId: 'wd-tue', sets: 3, repMin: 6, repMax: 10, rirMin: 2, rirMax: 2, rest: 180, order: 1 },
  { id: 'ex-rdl', name: 'Romanian Deadlift', sourceStatus: 'CONFIRMED', dayId: 'wd-tue', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 150, order: 2 },
  { id: 'ex-goblet', name: 'Goblet Squat', sourceStatus: 'CONFIRMED', dayId: 'wd-tue', sets: 3, repMin: 10, repMax: 15, rirMin: 2, rirMax: 2, rest: 120, order: 3 },
  { id: 'ex-rlunge', name: 'Reverse Lunge', sourceStatus: 'CONFIRMED', dayId: 'wd-tue', sets: 3, repMin: 8, repMax: 12, rirMin: 2, rirMax: 2, rest: 120, perSide: true, order: 4 },
  { id: 'ex-calf', name: 'Calf Raise', sourceStatus: 'CONFIRMED', dayId: 'wd-tue', sets: 4, repMin: 12, repMax: 20, rirMin: 1, rirMax: 2, rest: 75, order: 5 },

  // Upper B — RECONSTRUCTED
  { id: 'ex-pullups', name: 'Pull-Ups / Assisted Pull-Ups', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-thu', sets: 3, repMin: 5, repMax: 10, rirMin: 1, rirMax: 2, rest: 150, order: 1 },
  { id: 'ex-dips', name: 'Dips / Assisted Dips', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-thu', sets: 3, repMin: 6, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, order: 2 },
  { id: 'ex-oarow', name: 'One-Arm Dumbbell Row', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-thu', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 90, perSide: true, order: 3 },
  {
    id: 'ex-incline',
    name: 'Dumbbell Incline Press OR Feet-Elevated Push-Ups',
    sourceStatus: 'RECONSTRUCTED',
    dayId: 'wd-thu',
    sets: 3,
    repMin: 8,
    repMax: 12,
    rirMin: 1,
    rirMax: 2,
    rest: 120,
    allowsVariationChoice: true,
    variationOptions: ['Dumbbell Incline Press', 'Feet-Elevated Push-Ups'],
    order: 4,
  },
  { id: 'ex-latraise', name: 'Dumbbell Lateral Raise', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-thu', sets: 3, repMin: 12, repMax: 20, rirMin: 1, rirMax: 2, rest: 75, order: 5 },
  { id: 'ex-hammer', name: 'Hammer Curl', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-thu', sets: 3, repMin: 8, repMax: 15, rirMin: 1, rirMax: 2, rest: 75, order: 6 },

  // Lower B — RECONSTRUCTED
  {
    id: 'ex-frontsq',
    name: 'Front Squat OR Goblet Squat',
    sourceStatus: 'RECONSTRUCTED',
    dayId: 'wd-fri',
    sets: 3,
    repMin: 8,
    repMax: 12,
    rirMin: 1,
    rirMax: 2,
    rest: 150,
    allowsVariationChoice: true,
    variationOptions: ['Front Squat', 'Goblet Squat'],
    order: 1,
  },
  { id: 'ex-hipthrust', name: 'Hip Thrust / Barbell Glute Bridge', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-fri', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, order: 2 },
  { id: 'ex-bss', name: 'Bulgarian Split Squat', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-fri', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, perSide: true, order: 3 },
  { id: 'ex-hamcurl', name: 'Hamstring Curl Variation', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-fri', sets: 3, repMin: 10, repMax: 15, rirMin: 1, rirMax: 2, rest: 90, order: 4 },
  { id: 'ex-scalves', name: 'Standing Calf Raise', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-fri', sets: 4, repMin: 12, repMax: 20, rirMin: 1, rirMax: 2, rest: 75, order: 5 },

  // Saturday — RECONSTRUCTED (focus confirmed)
  {
    id: 'ex-skill',
    name: 'Skill Practice (primary)',
    sourceStatus: 'RECONSTRUCTED',
    dayId: 'wd-sat',
    sets: 1,
    repMin: 1,
    repMax: 1,
    rirMin: 2,
    rirMax: 3,
    rest: 60,
    isSkill: true,
    allowsVariationChoice: true,
    variationOptions: ['Handstand progression', 'L-sit progression', 'Muscle-up progression'],
    notes: '10–20 min before fatigue-heavy work. Choose ONE primary skill.',
    order: 1,
  },
  { id: 'ex-sat-pull', name: 'Pull-Up Practice', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-sat', sets: 3, repMin: 5, repMax: 10, rirMin: 1, rirMax: 2, rest: 150, order: 2 },
  { id: 'ex-sat-dips', name: 'Dips', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-sat', sets: 3, repMin: 6, repMax: 12, rirMin: 1, rirMax: 2, rest: 120, order: 3 },
  { id: 'ex-sat-pu', name: 'Push-Up Variation', sourceStatus: 'RECONSTRUCTED', dayId: 'wd-sat', sets: 3, repMin: 8, repMax: 20, rirMin: 1, rirMax: 2, rest: 90, order: 4 },
  {
    id: 'ex-core',
    name: 'Core Circuit (choose 2–3)',
    sourceStatus: 'RECONSTRUCTED',
    dayId: 'wd-sat',
    sets: 3,
    repMin: 8,
    repMax: 15,
    rirMin: 2,
    rirMax: 3,
    rest: 60,
    isCoreCircuit: true,
    allowsVariationChoice: true,
    variationOptions: ['Hanging knee/leg raise', 'Plank', 'Hollow-body hold', 'L-sit progression'],
    notes: 'Do not train every core exercise to failure.',
    order: 5,
  },
]

export function buildExercises(): Exercise[] {
  return EX_DEFS.map((e) => ({
    id: e.id,
    name: e.name,
    sourceStatus: e.sourceStatus,
    isSkill: e.isSkill,
    isCoreCircuit: e.isCoreCircuit,
    allowsVariationChoice: e.allowsVariationChoice,
    variationOptions: e.variationOptions,
    notes: e.notes,
  }))
}

export function buildPrescriptions(): ExercisePrescription[] {
  return EX_DEFS.map((e) => ({
    id: `rx-${e.id}`,
    exerciseId: e.id,
    workoutDayId: e.dayId,
    order: e.order,
    sets: e.sets,
    repMin: e.repMin,
    repMax: e.repMax,
    targetRIRMin: e.rirMin,
    targetRIRMax: e.rirMax,
    restSecondsSuggested: e.rest,
    perSide: e.perSide,
    notes: e.notes,
  }))
}

export const RECIPES: Recipe[] = [
  {
    id: 'recipe-anabolic-bowl',
    name: 'Standard Anabolic Bowl',
    category: 'Breakfast',
    ingredients: ['Oats', 'Banana', 'Peanut butter', 'Milk or milk-powder milk'],
    quantities: ['40–60 g', '1 medium', '1 tbsp', '200–250 ml'],
    preparation:
      'Combine oats with milk (or milk prepared from milk powder per package instructions). Top with sliced banana and peanut butter. Optional: choose ONE of mixed nuts (10–15 g), chia (~5 g), or ground flax (~5 g) — do not stack.',
    substitutions: ['Milk powder + water per package instructions when fresh milk unavailable'],
    storage:
      'If prepared ahead, refrigerate in a clean airtight container. Do not leave milk-based bowls at room temperature all day.',
    nutritionNote: 'Estimates vary with brand and exact portions; treat as a flexible CORE meal.',
  },
  {
    id: 'recipe-milk-powder',
    name: 'Milk-Powder Milk',
    category: 'Substitute',
    ingredients: ['Milk powder', 'Clean water'],
    quantities: ['Per package instructions', 'Per package instructions'],
    preparation:
      'Mix milk powder with clean water using the ratio on your package. Brands differ — do not invent a universal scoop ratio.',
    substitutions: [],
    storage: 'Prepare fresh when possible. Refrigerate promptly if made ahead.',
  },
  {
    id: 'recipe-airfryer-chicken',
    name: 'Air-Fryer Grilled Chicken',
    category: 'Scheduled protein',
    ingredients: ['Chicken', 'Seasoning/spices', 'Optional small amount of oil'],
    quantities: ['As planned (e.g. 300–350 g bone-in)', 'To taste', 'As needed'],
    preparation:
      'Season chicken. Air-fry until thoroughly cooked. Log as bone-in, breast, thigh, or cooked edible meat — bone-in weight is not edible meat weight.',
    substitutions: ['Oven grill if air fryer unavailable'],
    storage: 'Refrigerate leftovers promptly. Reheat thoroughly.',
    nutritionNote: 'Distinguish measurement type when logging.',
  },
  {
    id: 'recipe-kebab',
    name: 'Chicken Kebab Meal',
    category: 'Scheduled protein',
    ingredients: ['Chicken kebab'],
    quantities: ['~150 g planned (editable)'],
    preparation: 'Use as scheduled Wednesday/Friday dinner protein addition. Edit actual quantity because composition varies.',
    substitutions: ['Other available chicken if kebab unavailable'],
    storage: 'Consume fresh when possible; refrigerate leftovers.',
  },
  {
    id: 'recipe-pb-sandwich',
    name: 'Peanut Butter Sandwich',
    category: 'Calorie tool',
    ingredients: ['Bread', 'Peanut butter'],
    quantities: ['2 slices', '1–2 tbsp'],
    preparation: 'Spread peanut butter on bread. Use as an OPTIONAL calorie tool when needed — not every day automatically.',
    substitutions: ['Banana + peanut butter if bread unavailable'],
    storage: 'Prepare fresh.',
  },
  {
    id: 'recipe-protein-shake',
    name: 'Simple Protein Shake',
    category: 'Supplement',
    ingredients: ['Whey', 'Milk or milk-powder milk (optional)', 'Banana (optional)', 'Oats OR peanut butter (optional calorie add)'],
    quantities: ['1 scoop (per label)', 'As desired', '1 if useful', 'Choose ONE if calories needed'],
    preparation:
      'Blend or shake whey with liquid. Add banana/oats/PB only when specifically needed for calories. Do not force a large shake if dinner is imminent and targets are covered.',
    substitutions: ['Water if milk unavailable'],
    storage: 'Consume soon after preparing.',
  },
]
