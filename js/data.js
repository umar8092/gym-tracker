/* Plan and exercise data. Adding an exercise = adding an object here.
   equip: 'Barbell' | 'Dumbbells' | 'Bodyweight' | 'Machine'. confirm:true = needs the user to confirm the gym has it.
   mus: primary (p) and helping (s) muscle region ids, see muscle.js. fig: optional 3D pose data for the engine. */
(function () {
  var SLOW = { up: 2.6, top: 0.8, down: 3.6, bottom: 0.8 };

  var MUSCLES = {
    chest:     { name: 'Chest',     day: 1, blurb: 'Pressing and fly movements for the chest, with the front shoulder and triceps helping.' },
    back:      { name: 'Back',      day: 2, blurb: 'Pulling movements for the lats and mid-back, with biceps and rear shoulder helping.' },
    legs:      { name: 'Legs',      day: 3, blurb: 'Thighs, glutes, hamstrings and calves. The biggest muscles, so the most effort.' },
    shoulders: { name: 'Shoulders', day: 4, blurb: 'Front, side and rear shoulder. Control matters more than weight here.' },
    arms:      { name: 'Arms',      day: 5, blurb: 'Biceps on the front of the arm, triceps on the back, plus the forearm.' }
  };
  var ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms'];

  var EX = [
    /* ---------------- CHEST ---------------- */
    { id: 'barbell-bench-press', fig: {"startText": "Bar resting on your lower chest, forearms vertical, elbows about 60 to 70 degrees out from your sides, feet flat on the floor.", "endText": "Arms nearly straight with the bar over your shoulders. Do not lock your elbows hard.", "labels": {"up": "Press up", "top": "Pause", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'chest', name: 'Barbell bench press', equip: 'Barbell',
      target: 'Builds the whole chest. Front shoulder and triceps help.',
      sets: 4, reps: '8-10',
      how: 'Lie on a flat bench with your eyes under the bar and your feet flat on the floor. Grip a little wider than your shoulders. Lower the bar to your mid-chest with control, then press it back up over your shoulders.',
      avoid: 'Bouncing the bar off your chest or lifting your hips off the bench. Use a spotter or the rack safety arms for heavy sets.',
      mus: { view: 'front', p: ['pec_up', 'pec_low'], s: ['delt_ant', 'triceps'], main: 'Chest (pectoralis major)', help: 'Front shoulder, triceps' } },
    { id: 'incline-dumbbell-press', fig: {"startText": "Dumbbells at the sides of your upper chest, forearms vertical, palms facing forward, back against the incline pad.", "endText": "Arms nearly straight, dumbbells above your shoulders and slightly closer together.", "labels": {"up": "Press up", "top": "Pause", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'chest', name: 'Incline dumbbell press', equip: 'Dumbbells',
      target: 'Focuses on the upper chest.',
      sets: 3, reps: '10-12',
      how: 'Set the bench to a low incline (about 30 degrees). Hold the dumbbells at chest height with palms facing forward. Press up until your arms are nearly straight, then lower slowly.',
      avoid: 'Setting the bench too steep. It turns into a shoulder press.',
      mus: { view: 'front', p: ['pec_up'], s: ['pec_low', 'delt_ant', 'triceps'], main: 'Upper chest (upper pectoralis major)', help: 'Lower chest, front shoulder, triceps' } },
    { id: 'dumbbell-fly', fig: {"startText": "Arms open wide with a soft bend in your elbows and a stretch across your chest. Palms face up.", "endText": "Dumbbells together above your chest, palms facing each other, elbows still slightly bent.", "labels": {"up": "Hug up", "top": "Squeeze", "down": "Open slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'chest', name: 'Dumbbell fly', equip: 'Dumbbells',
      target: 'Stretches and squeezes the chest.',
      sets: 3, reps: '12-15',
      how: 'Lie on a flat bench with the dumbbells above your chest, palms facing each other. Keep a soft bend in your elbows. Open your arms out wide until you feel a stretch across the chest, then bring them back up along the same arc.',
      avoid: 'Straightening your arms fully or going lower than feels comfortable. Use lighter weights than the press.',
      mus: { view: 'front', p: ['pec_up', 'pec_low'], s: ['delt_ant'], main: 'Chest (pectoralis major)', help: 'Front shoulder' } },
    { id: 'push-up', fig: {"startText": "Chest a few centimetres above the floor, elbows about 45 degrees from your body, body in one straight line from head to heels.", "endText": "Arms nearly straight, body still in one straight line from head to heels.", "labels": {"up": "Push up", "top": "Pause", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'chest', name: 'Push-up', equip: 'Bodyweight',
      target: 'Chest, with triceps and core working to keep you straight.',
      sets: 3, reps: '8-15',
      how: 'Hands slightly wider than your shoulders, body in one straight line from head to heels. Lower your chest toward the floor with elbows about 45 degrees from your body, then press back up. Stop each set 2 reps before your form breaks.',
      avoid: 'Sagging hips or flaring your elbows straight out to the sides.',
      mus: { view: 'front', p: ['pec_up', 'pec_low'], s: ['delt_ant', 'triceps', 'abs'], main: 'Chest (pectoralis major)', help: 'Front shoulder, triceps, abs' } },
    { id: 'machine-chest-press', fig: {"startText": "Handles level with your mid-chest, elbows just behind your body, back against the pad.", "endText": "Arms nearly straight, handles in front of your chest. Do not lock your elbows hard.", "labels": {"up": "Press forward", "top": "Pause", "down": "Return slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'chest', name: 'Machine chest press', equip: 'Machine', look: 'A seat with a back pad and two handles at chest height that you push away from you. A stack of weights sits behind.',
      target: 'A guided press for the chest.',
      sets: 3, reps: '12',
      how: 'Adjust the seat so the handles are level with your mid-chest. Press forward until your arms are nearly straight, then return slowly without letting the weights touch down.',
      avoid: 'Shrugging your shoulders up or letting the weight stack slam.',
      mus: { view: 'front', p: ['pec_up', 'pec_low'], s: ['delt_ant', 'triceps'], main: 'Chest (pectoralis major)', help: 'Front shoulder, triceps' } },

    /* ---------------- BACK ---------------- */
    { id: 'barbell-row', fig: {"startText": "Hinged forward with a flat back and the bar hanging at arm’s length below your shoulders.", "endText": "Bar touching your lower ribs, elbows pulled back past your body, shoulder blades squeezed together.", "labels": {"up": "Row up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'back', name: 'Barbell bent-over row', equip: 'Barbell',
      target: 'Builds the middle of the back and the lats.',
      sets: 4, reps: '8-10',
      how: 'Feet shoulder-width apart. Hinge at the hips until your torso is about 45 degrees, back flat, bar hanging below your shoulders. Pull the bar to your lower ribs, squeeze your shoulder blades together, then lower slowly.',
      avoid: 'Rounding your back or jerking the weight up with your hips.',
      mus: { view: 'back', p: ['lats', 'trap_mid'], s: ['delt_post', 'infra', 'back_low'], main: 'Lats and middle back (latissimus dorsi, middle traps, rhomboids)', help: 'Rear shoulder, biceps, lower back' } },
    { id: 'one-arm-dumbbell-row', fig: {"startText": "One hand and one knee on the bench, back flat, dumbbell hanging at arm’s length.", "endText": "Dumbbell pulled to your hip with your elbow close to your side and your back still flat.", "labels": {"up": "Row up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'back', name: 'One-arm dumbbell row', equip: 'Dumbbells',
      target: 'Works one side of the back at a time.',
      sets: 3, reps: '10 each arm',
      how: 'Put one knee and the same-side hand on a bench, other foot on the floor, back flat. Let the dumbbell hang under your shoulder. Pull it toward your hip with your elbow close to your side, then lower slowly.',
      avoid: 'Twisting your body to heave the weight up.',
      mus: { view: 'back', p: ['lats', 'trap_mid'], s: ['delt_post', 'teres'], main: 'Lats and middle back', help: 'Rear shoulder, biceps' } },
    { id: 'pull-up', fig: {"startText": "Hanging with arms nearly straight, shoulders pulled slightly down, knees bent behind you.", "endText": "Chin above the bar, elbows pointing down toward your hips.", "labels": {"up": "Pull up", "top": "Hold", "down": "Lower slowly", "bottom": "Hang"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'back', name: 'Pull-up (or assisted)', equip: 'Bodyweight', look: 'A high horizontal bar, or an assisted pull-up machine with a knee pad you kneel or stand on.',
      target: 'The classic lat builder. Needs a pull-up bar.',
      sets: 3, reps: '6-10',
      how: 'Hang from the bar with an overhand grip a little wider than your shoulders. Pull your chest toward the bar by driving your elbows down, then lower all the way with control. If it is too hard, use an assisted machine or a band.',
      avoid: 'Kicking, swinging, or stopping halfway down.',
      mus: { view: 'back', p: ['lats'], s: ['teres', 'trap_low', 'delt_post'], main: 'Lats (latissimus dorsi)', help: 'Biceps, rear shoulder, lower traps' } },
    { id: 'lat-pulldown', fig: {"startText": "Arms stretched overhead, hands wider than your shoulders, seated with your thighs under the pads.", "endText": "Bar at your upper chest, elbows pointing down, shoulder blades pulled down and back.", "labels": {"up": "Pull down", "top": "Squeeze", "down": "Return slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'back', name: 'Lat pulldown', equip: 'Machine', look: 'A seat with thigh pads and a long bar hanging overhead from a cable. A stack of weights sits behind.',
      target: 'A guided version of the pull-up.',
      sets: 3, reps: '10-12',
      how: 'Sit with your thighs under the pads. Grip the bar a little wider than your shoulders. Pull it down to your upper chest while leaning back slightly, then let it rise slowly until your arms are straight.',
      avoid: 'Pulling the bar behind your neck or leaning back to swing the weight.',
      mus: { view: 'back', p: ['lats'], s: ['teres', 'trap_mid', 'delt_post'], main: 'Lats (latissimus dorsi)', help: 'Biceps, middle back, rear shoulder' } },
    { id: 'seated-cable-row', fig: {"startText": "Seated tall with arms stretched forward holding the handle, knees slightly bent.", "endText": "Handle at your stomach, elbows pulled back close to your body, chest up.", "labels": {"up": "Row back", "top": "Squeeze", "down": "Return slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'back', name: 'Seated cable row', equip: 'Machine', look: 'A low cable with a handle, foot plates, and a seat that faces the weight stack.',
      target: 'Middle back thickness with steady tension.',
      sets: 3, reps: '12',
      how: 'Sit tall with your feet on the plates and a slight bend in your knees. Pull the handle to your belly, squeezing your shoulder blades together, then return slowly.',
      avoid: 'Rocking your torso back and forth.',
      mus: { view: 'back', p: ['trap_mid', 'lats'], s: ['delt_post', 'infra'], main: 'Middle back and lats', help: 'Rear shoulder, biceps' } },

    /* ---------------- LEGS ---------------- */
    { id: 'barbell-squat', fig: {"startText": "Bottom of the squat: thighs at least level with the floor, knees pointing the same way as your toes, back flat, bar on your upper back.", "endText": "Standing tall with the bar still on your upper back. Do not lock your knees hard.", "labels": {"up": "Stand up", "top": "Pause", "down": "Lower slowly", "bottom": "Bottom"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Barbell back squat', equip: 'Barbell',
      target: 'The main leg builder: thighs and glutes.',
      sets: 4, reps: '8-10',
      how: 'Rest the bar across your upper back, not on your neck. Feet about shoulder-width, toes slightly out. Tighten your stomach, sit your hips back and down until your thighs are at least parallel to the floor (or as deep as you can with a flat back), then drive up through your whole foot.',
      avoid: 'Knees caving in, heels lifting, or rounding your lower back. Use the rack safety bars.',
      mus: { view: 'front', p: ['quad', 'glute'], s: ['ham', 'calf', 'back_low'], main: 'Thighs and glutes (quadriceps, gluteus maximus)', help: 'Hamstrings, calves, lower back' } },
    { id: 'romanian-deadlift', fig: {"startText": "Hips pushed back, back flat, bar hanging just below your knees, knees only slightly bent.", "endText": "Standing tall with the bar at your thighs and your glutes squeezed.", "labels": {"up": "Stand up", "top": "Squeeze", "down": "Hinge back slowly", "bottom": "Bottom"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Romanian deadlift', equip: 'Barbell',
      target: 'The back of the thigh and the glutes. Works with a barbell or dumbbells.',
      sets: 3, reps: '10',
      how: 'Stand holding the bar at your thighs with soft knees. Push your hips back and slide the bar down your legs, keeping your back flat, until you feel a stretch behind your thighs (around knee height). Squeeze your glutes to stand tall.',
      avoid: 'Rounding your back or bending your knees into a squat.',
      mus: { view: 'back', p: ['ham', 'glute'], s: ['back_low'], main: 'Back of the thigh and glutes (hamstrings, gluteus maximus)', help: 'Lower back, forearms (grip)' } },
    { id: 'dumbbell-walking-lunge', fig: {"startText": "Bottom of the lunge: front thigh level with the floor, back knee just above it, chest up.", "endText": "Standing tall in the split stance. Step the back foot forward to start the next rep.", "labels": {"up": "Drive up", "top": "Pause", "down": "Lower slowly", "bottom": "Bottom"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Dumbbell walking lunge', equip: 'Dumbbells',
      target: 'Thighs and glutes, one leg at a time.',
      sets: 3, reps: '10 each leg',
      how: 'Hold a dumbbell in each hand at your sides. Take a long step forward, lower your back knee toward the floor, then push through your front foot to step into the next lunge.',
      avoid: 'Short steps, your front knee caving in, or leaning far forward.',
      mus: { view: 'front', p: ['quad', 'glute'], s: ['ham', 'calf'], main: 'Thighs and glutes', help: 'Hamstrings, calves' } },
    { id: 'leg-press', fig: {"startText": "Knees bent to about 90 degrees, feet flat on the platform, lower back against the pad.", "endText": "Legs nearly straight with your knees not locked and your hips still on the seat.", "labels": {"up": "Press away", "top": "Pause", "down": "Return slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Leg press', equip: 'Machine', look: 'A reclined seat and a big foot plate that you push away. Either loaded with plates or run by a weight stack.',
      target: 'A supported way to load the thighs.',
      sets: 3, reps: '12',
      how: 'Place your feet shoulder-width apart in the middle of the platform. Lower until your knees are around 90 degrees, then press up without locking your knees.',
      avoid: 'Locking out your knees or letting your hips lift off the seat.',
      mus: { view: 'front', p: ['quad'], s: ['glute', 'ham'], main: 'Thighs (quadriceps)', help: 'Glutes, hamstrings' } },
    { id: 'leg-curl', fig: {"startText": "Lying face down with your legs straight and the roller pad just above your heels.", "endText": "Heels pulled toward your glutes with your hips still flat on the bench.", "labels": {"up": "Curl up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Leg curl', equip: 'Machine', look: 'A padded bench or seat with a roller pad that sits just behind your ankles.',
      target: 'Isolates the back of the thigh.',
      sets: 3, reps: '12',
      how: 'Set the pad just above your heels. Curl your heels toward your glutes, pause, then lower slowly.',
      avoid: 'Lifting your hips or swinging the weight.',
      mus: { view: 'back', p: ['ham'], s: ['calf'], main: 'Back of the thigh (hamstrings)', help: 'Calves' } },
    { id: 'dumbbell-calf-raise', fig: {"startText": "Heels lowered below the step for a full stretch in your calves.", "endText": "Up on the balls of your feet as high as you can, calves squeezed.", "labels": {"up": "Rise", "top": "Squeeze", "down": "Lower slowly", "bottom": "Stretch"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'legs', name: 'Standing dumbbell calf raise', equip: 'Dumbbells',
      target: 'Builds the calves.',
      sets: 4, reps: '15',
      how: 'Hold a dumbbell in each hand, standing with the balls of your feet on a step if you can. Rise as high as you can on your toes, pause, then lower until you feel a full stretch.',
      avoid: 'Bouncing, or cutting the range short at the top or bottom.',
      mus: { view: 'back', p: ['calf'], s: [], main: 'Calves (gastrocnemius, soleus)', help: 'Nothing major. This one is a pure calf move.' } },

    /* ---------------- SHOULDERS (3D figures) ---------------- */
    { id: 'overhead-press', muscle: 'shoulders', name: 'Overhead press', equip: 'Dumbbells',
      target: 'Works the front and side of the shoulder.',
      sets: 4, reps: '10-12',
      how: 'Hold the dumbbells at shoulder height with palms facing forward. Press straight up until your arms are nearly straight, then lower slowly.',
      avoid: 'Arching your lower back.',
      mus: { view: 'front', p: ['delt_ant', 'delt_lat'], s: ['triceps', 'pec_up', 'trap_up'], main: 'Front and side shoulder (anterior and lateral deltoids)', help: 'Triceps, upper chest, upper traps' },
      fig: {
        U: [[0.28, -0.88, 0.38], [0.88, 0.10, 0.45], [-0.03, 1, 0.04]],
        F: [[0.02, 1, 0.02], [-0.15, 0.98, 0.06], [-0.03, 1, 0]],
        N: [[0, 0, 1], [0, 0, 1]],
        hl: 'delt', cam: { span: 232, ty: 106, tz: 0 }, yaw: -22, timing: SLOW,
        labels: { up: 'Press up', top: 'Pause', down: 'Lower slowly', bottom: 'Ready' },
        startText: 'Dumbbells at shoulder height with palms facing forward. Elbows sit just below your wrists.',
        endText: 'Arms nearly straight overhead, dumbbells above your shoulders. Don’t lock your elbows hard.'
      } },
    { id: 'lateral-raise', muscle: 'shoulders', name: 'Lateral raise', equip: 'Dumbbells',
      target: 'Works the side of the shoulder, which gives width.',
      sets: 3, reps: '12-15',
      how: 'Start with the dumbbells at your sides. Lift your arms out until they reach shoulder height, with a small bend in your elbows. Lead with your elbows.',
      avoid: 'Swinging your body or lifting above shoulder height.',
      mus: { view: 'front', p: ['delt_lat'], s: ['trap_up'], main: 'Side shoulder (lateral deltoid)', help: 'Upper traps' },
      fig: {
        U: [[0.12, -0.99, 0], [0.72, -0.68, 0.12], [0.95, 0.08, 0.28]],
        F: [[0.06, -0.97, 0.2], [0.72, -0.66, 0.2], [0.88, -0.2, 0.36]],
        N: [[-1, 0, 0], [0, -1, 0]],
        hl: 'delt', cam: { span: 214, ty: 98, tz: 0 }, yaw: -22, timing: SLOW,
        labels: { up: 'Lift', top: 'Pause', down: 'Lower slowly', bottom: 'Ready' },
        startText: 'Arms down at your sides with the dumbbells beside your thighs and a small bend in the elbows.',
        endText: 'Arms out to the sides at shoulder height, elbows slightly bent and a touch higher than your hands.'
      } },
    { id: 'front-raise', muscle: 'shoulders', name: 'Front raise', equip: 'Dumbbells',
      target: 'Works the front of the shoulder.',
      sets: 3, reps: '12',
      how: 'Let the dumbbells hang in front of your thighs. Raise them straight forward to about eye level, turning your wrists so the dumbbells end upright, then lower slowly. Stop at shoulder height if eye level feels uncomfortable.',
      avoid: 'Leaning back to swing the weight up.',
      mus: { view: 'front', p: ['delt_ant'], s: ['pec_up', 'delt_lat'], main: 'Front shoulder (anterior deltoid)', help: 'Upper chest, side shoulder' },
      fig: {
        U: [[-0.17, -0.95, 0.25], [-0.05, -0.52, 0.85], [-0.12, 0.42, 0.9]],
        F: [[0, -0.97, 0.25], [-0.08, -0.5, 0.86], [-0.25, 0.45, 0.85]],
        N: [[0, 0, -1], [-1, 0, 0]],
        hl: 'delt', cam: { span: 214, ty: 98, tz: 14 }, yaw: 62, timing: SLOW,
        labels: { up: 'Lift', top: 'Pause', down: 'Lower slowly', bottom: 'Ready' },
        startText: 'Dumbbells held in front of your thighs with your arms straight down.',
        endText: 'Arms raised straight in front of you to about eye level, hands slightly closer together, dumbbells held upright.'
      } },
    { id: 'bent-over-rear-fly', muscle: 'shoulders', name: 'Bent-over rear fly', equip: 'Dumbbells',
      target: 'Works the back of the shoulder, which many people skip.',
      sets: 3, reps: '12',
      how: 'Hinge forward at the hips with a flat back and soft knees. Let the dumbbells hang, then open your arms wide and squeeze your shoulder blades together.',
      avoid: 'Rounding your back. Use lighter weights than the other moves.',
      mus: { view: 'back', p: ['delt_post'], s: ['trap_mid', 'infra'], main: 'Rear shoulder (posterior deltoid)', help: 'Mid-back (rhomboids and middle traps), rear rotator cuff' },
      fig: {
        bendDeg: 65,
        U: [[0.03, -1, 0.02], [0.72, -0.69, -0.02], [0.98, 0.08, -0.1]],
        F: [[0.02, -1, 0.03], [0.7, -0.7, 0], [0.95, -0.05, -0.1]],
        N: [[-1, 0, 0], [0, -1, 0]],
        hl: 'delt', cam: { span: 204, ty: 96, tz: 22 }, yaw: 158,
        timing: { up: 2.6, top: 1.0, down: 3.6, bottom: 0.8 },
        labels: { up: 'Open wide', top: 'Squeeze', down: 'Lower slowly', bottom: 'Ready' },
        startText: 'Hinged forward at the hips with a flat back. Arms hang straight down under your chest.',
        endText: 'Arms open wide to shoulder height with your shoulder blades squeezed together.'
      } },
    { id: 'arnold-press', muscle: 'shoulders', name: 'Arnold press', equip: 'Dumbbells',
      target: 'Works the front and side of the shoulder, with the rear shoulder helping.',
      sets: 3, reps: '10-12',
      how: 'Start with the dumbbells in front of your shoulders, palms facing you. As you press up, turn your palms to face forward. Reverse the turn as you lower.',
      avoid: 'Arching your lower back or rushing the wrist turn.',
      mus: { view: 'front', p: ['delt_ant', 'delt_lat'], s: ['delt_post', 'triceps', 'pec_up', 'trap_up'], main: 'Front and side shoulder (anterior and lateral deltoids)', help: 'Rear shoulder, triceps, upper chest, upper traps' },
      fig: {
        U: [[-0.2, -0.85, 0.5], [0.88, 0.10, 0.45], [-0.03, 1, 0.04]],
        F: [[-0.1, 0.92, 0.4], [-0.15, 0.98, 0.06], [-0.03, 1, 0]],
        N: [[0, 0, -1], [-1, 0, 0], [0, 0, 1]],
        hl: 'delt', cam: { span: 232, ty: 106, tz: 0 }, yaw: -22,
        timing: { up: 3.0, top: 0.8, down: 3.8, bottom: 0.8 },
        labels: { up: 'Press and turn', top: 'Pause', down: 'Lower and turn back', bottom: 'Ready' },
        startText: 'Dumbbells in front of your upper chest with palms facing you and elbows pointing down and forward.',
        endText: 'Arms nearly straight overhead with your palms facing forward. Don’t lock your elbows hard.'
      } },

    /* ---------------- ARMS ---------------- */
    { id: 'barbell-curl', fig: {"startText": "Standing tall with the bar at your thighs and your elbows tucked at your sides.", "endText": "Bar curled up to your shoulders with your elbows still at your sides.", "labels": {"up": "Curl up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Barbell curl', equip: 'Barbell',
      target: 'The main biceps builder.',
      sets: 3, reps: '10',
      how: 'Stand tall holding the bar with an underhand grip, hands shoulder-width apart. Keep your elbows pinned at your sides. Curl the bar up to shoulder height, then lower slowly.',
      avoid: 'Swinging your back to heave the weight up.',
      mus: { view: 'front', p: ['biceps'], s: ['forearm'], main: 'Front of the upper arm (biceps)', help: 'Forearm' } },
    { id: 'hammer-curl', fig: {"startText": "Dumbbells at your sides with your palms facing each other.", "endText": "Dumbbells curled toward your shoulders, palms still facing each other, elbows at your sides.", "labels": {"up": "Curl up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Dumbbell hammer curl', equip: 'Dumbbells',
      target: 'Biceps and the muscle underneath it, plus the forearm.',
      sets: 3, reps: '12',
      how: 'Hold the dumbbells at your sides with palms facing each other. Curl them up without turning your wrists, keeping your elbows at your sides, then lower slowly.',
      avoid: 'Letting your elbows drift forward or swinging your body.',
      mus: { view: 'front', p: ['biceps', 'forearm'], s: [], main: 'Front of the upper arm and forearm (biceps, brachialis, brachioradialis)', help: 'Mostly the arm alone' } },
    { id: 'close-grip-bench', fig: {"startText": "Bar touching your lower chest, hands about shoulder-width apart, elbows tucked close to your sides.", "endText": "Arms nearly straight with the bar over your chest.", "labels": {"up": "Press up", "top": "Pause", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Close-grip bench press', equip: 'Barbell',
      target: 'A heavy triceps move.',
      sets: 3, reps: '8-10',
      how: 'Lie on a flat bench and grip the bar about shoulder-width apart. Keep your elbows tucked close to your sides as you lower the bar to your lower chest, then press up.',
      avoid: 'Hands very close together, which strains the wrists.',
      mus: { view: 'back', p: ['triceps'], s: ['pec_low', 'delt_ant'], main: 'Back of the upper arm (triceps)', help: 'Chest, front shoulder' } },
    { id: 'overhead-triceps-extension', fig: {"startText": "Dumbbell lowered behind your head, elbow pointing up and close to your ear.", "endText": "Arm nearly straight overhead with the dumbbell above your head.", "labels": {"up": "Extend up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Overhead dumbbell triceps extension', equip: 'Dumbbells',
      target: 'Stretches and works all of the triceps.',
      sets: 3, reps: '12',
      how: 'Hold one dumbbell in one hand with your arm straight overhead. Keeping your upper arm close to your ear, bend your elbow to lower the dumbbell behind your head, then straighten your arm. Do the same number of sets with each arm.',
      avoid: 'Flaring your elbows out or arching your lower back.',
      mus: { view: 'back', p: ['triceps'], s: [], main: 'Back of the upper arm (triceps)', help: 'Mostly the arm alone' } },
    { id: 'lying-triceps-extension', fig: {"startText": "Bar lowered toward your forehead with your upper arms vertical. Only your elbows bend.", "endText": "Arms nearly straight with the bar above your shoulders.", "labels": {"up": "Extend up", "top": "Squeeze", "down": "Lower slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Lying triceps extension', equip: 'Barbell',
      target: 'Isolates the triceps. Works with a barbell or dumbbells.',
      sets: 3, reps: '10',
      how: 'Lie on a flat bench holding the weight over your chest with straight arms. Bend only your elbows to lower it toward your forehead, then straighten your arms again.',
      avoid: 'Moving your upper arms or going too heavy. Start light.',
      mus: { view: 'back', p: ['triceps'], s: [], main: 'Back of the upper arm (triceps)', help: 'Mostly the arm alone' } },
    { id: 'cable-pushdown', fig: {"startText": "Elbows pinned to your sides, forearms level with the floor, hands at chest height.", "endText": "Arms straight down with the handle by your thighs and your elbows still at your sides.", "labels": {"up": "Push down", "top": "Squeeze", "down": "Return slowly", "bottom": "Ready"}, "timing": {"up": 2.6, "top": 0.8, "down": 3.6, "bottom": 0.8}}, muscle: 'arms', name: 'Cable triceps pushdown', equip: 'Machine', look: 'A tall cable machine with a high pulley and a rope or short bar attached.',
      target: 'A smooth, guided triceps move.',
      sets: 3, reps: '12',
      how: 'Stand facing the cable with your elbows pinned to your sides. Push the handle down until your arms are straight, then let it rise slowly to chest height.',
      avoid: 'Leaning over the handle or letting your elbows lift.',
      mus: { view: 'back', p: ['triceps'], s: [], main: 'Back of the upper arm (triceps)', help: 'Mostly the arm alone' } }
  ];

  var byId = {};
  EX.forEach(function (e) { byId[e.id] = e; });

  // user-made exercises (from Store): replaces the previous set, keeps the built-in list untouched
  function setCustom(map) {
    for (var i = EX.length - 1; i >= 0; i--) { if (EX[i].custom) { delete byId[EX[i].id]; EX.splice(i, 1); } }
    Object.keys(map || {}).forEach(function (id) {
      var c = map[id], e = { id: id, custom: true, muscle: c.muscle, name: c.name, equip: c.equip, sets: c.sets, reps: c.reps, timed: !!c.timed, target: 'Your own exercise.', how: '', avoid: '', mus: null };
      EX.push(e); byId[id] = e;
    });
  }

  window.Data = {
    setCustom: setCustom,
    MUSCLES: MUSCLES, ORDER: ORDER, EX: EX, byId: byId,
    // JS getDay(): 1 = Monday ... 5 = Friday
    planFor: function (jsDay) {
      for (var i = 0; i < ORDER.length; i++) { if (MUSCLES[ORDER[i]].day === jsDay) { return ORDER[i]; } }
      return null;
    },
    exercisesFor: function (muscle) { return EX.filter(function (e) { return e.muscle === muscle; }); }
  };
})();
