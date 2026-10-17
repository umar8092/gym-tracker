# Gym Tracker

A personal gym log. Pick today's muscle, log reps and kg for every set, and track progress.

Live: https://umar8092.github.io/gym-tracker/

- Today dashboard with the Mon-Fri plan, streak and weight goal
- Workout pages with a set logger (kg in 0.5 steps), last-session numbers, and a form guide per exercise
- Calendar of trained and missed days, progress charts, and an editable plan
- 3D rotatable form guides for the shoulder exercises (other muscles to follow)

Data is saved in the browser (localStorage). Use Plan > Export backup to keep a copy.

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
Tests (need Chrome and Playwright): `node tests/shots.js`, `node tests/flow.js`.
