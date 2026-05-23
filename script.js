const demoCards = [
  { low: "Silent", high: "Loud" },
  { low: "Ordinary", high: "Legendary" },
  { low: "Tiny", high: "Huge" },
  { low: "Casual", high: "Formal" },
  { low: "Ancient", high: "Futuristic" },
  { low: "Harmless", high: "Dangerous" },
  { low: "Simple", high: "Complicated" },
  { low: "Boring", high: "Thrilling" },
  { low: "Messy", high: "Neat" },
  { low: "Cheap", high: "Expensive" },
  { low: "Private", high: "Public" },
  { low: "Soft", high: "Hard" },
  { low: "Unlucky", high: "Lucky" },
  { low: "Weak", high: "Powerful" },
  { low: "Temporary", high: "Permanent" },
  { low: "Natural", high: "Artificial" },
  { low: "Polite", high: "Rude" },
  { low: "Cold", high: "Hot" },
  { low: "Realistic", high: "Absurd" },
  { low: "Predictable", high: "Surprising" },
  { low: "Relaxing", high: "Stressful" },
  { low: "Traditional", high: "Experimental" },
  { low: "Underrated", high: "Overrated" },
  { low: "Flexible", high: "Rigid" },
  { low: "Low effort", high: "High effort" },
  { low: "Introverted", high: "Extroverted" },
  { low: "Honest", high: "Deceptive" },
  { low: "Childish", high: "Mature" },
  { low: "Mild", high: "Intense" },
  { low: "Forgettable", high: "Iconic" },
  { low: "Slow", high: "Fast" },
  { low: "Practical", high: "Impractical" },
  { low: "Clean", high: "Dirty" },
  { low: "Rare", high: "Common" },
  { low: "Calm", high: "Chaotic" },
  { low: "Sensible", high: "Ridiculous" }
];

const defaultTeams = [
  { name: "Commies", score: 0, color: "#ff3e49" },
  { name: "Fascists", score: 0, color: "#ffd33d" },
  { name: "Libtards", score: 0, color: "#38c8ff" }
];

const storageKey = "wavelength-local-game-state-v2";
const app = document.querySelector("#app");

const freshState = () => ({
  screen: "setup",
  teams: defaultTeams.map((team) => ({ ...team })),
  targetScore: 10,
  cooperative: false,
  activeTeam: 0,
  round: null,
  usedCardIndexes: [],
  roundNumber: 0,
  message: ""
});

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.teams) && saved.teams.length > 0) {
      return normalizeState(saved);
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
  return freshState();
}

function normalizeState(saved) {
  const teams = saved.teams.map((team, index) => ({
    name: team.name || defaultTeams[index]?.name || `Team ${index + 1}`,
    score: Number(team.score) || 0,
    color: team.color || defaultTeams[index]?.color || "#38c8ff"
  }));
  return {
    ...freshState(),
    ...saved,
    teams,
    activeTeam: Math.min(saved.activeTeam || 0, teams.length - 1),
    cooperative: teams.length === 1 ? true : Boolean(saved.cooperative)
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function setState(next) {
  state = { ...state, ...next };
  saveState();
  render();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickCardIndex() {
  if (state.usedCardIndexes.length >= demoCards.length) {
    state.usedCardIndexes = [];
  }

  const available = demoCards
    .map((_, index) => index)
    .filter((index) => !state.usedCardIndexes.includes(index));
  return available[randomInt(0, available.length - 1)];
}

function startRound() {
  const cardIndex = pickCardIndex();
  const round = {
    cardIndex,
    target: randomInt(0, 100),
    guess: "",
    callerTeams: state.cooperative ? [] : state.teams.map((_, index) => index).filter((index) => index !== state.activeTeam),
    callerIndex: 0,
    opponentGuesses: {},
    opponentGuess: null,
    scored: null
  };
  state.usedCardIndexes = [...state.usedCardIndexes, cardIndex];
  state.roundNumber += 1;
  setState({ round, screen: "handoff-clue", message: "" });
}

function scoreGuess(guess, target) {
  const distance = Math.abs(guess - target);
  if (distance <= 2) return 4;
  if (distance <= 4) return 3;
  if (distance <= 8) return 2;
  return 0;
}

function callerPoint(guess, target, opponentGuess, teamPoints) {
  if (state.cooperative || teamPoints === 4 || target === guess || !opponentGuess) return 0;
  const correct = target > guess ? "higher" : "lower";
  return opponentGuess === correct ? 1 : 0;
}

function endRound() {
  const active = state.activeTeam;
  const guess = Number(state.round.guess);
  const teamPoints = scoreGuess(guess, state.round.target);
  const callerScores = {};
  state.round.callerTeams.forEach((teamIndex) => {
    callerScores[teamIndex] = callerPoint(guess, state.round.target, state.round.opponentGuesses[teamIndex], teamPoints);
  });

  const teams = state.teams.map((team, index) => {
    if (index === active) return { ...team, score: team.score + teamPoints };
    if (callerScores[index]) return { ...team, score: team.score + callerScores[index] };
    return team;
  });

  const scored = { teamPoints, callerScores, distance: Math.abs(guess - state.round.target) };
  setState({ teams, round: { ...state.round, scored }, screen: "reveal" });
}

function nextTeamIndex(index) {
  return (index + 1) % state.teams.length;
}

function leaderScore() {
  return Math.max(...state.teams.map((team) => team.score));
}

function hasWinner() {
  if (state.cooperative) return state.roundNumber >= 5 || state.teams[0].score >= state.targetScore;
  const leaders = state.teams.filter((team) => team.score >= state.targetScore);
  if (!leaders.length) return false;
  const topScore = leaderScore();
  return state.teams.filter((team) => team.score === topScore).length === 1;
}

function nextTurn() {
  if (hasWinner()) {
    setState({ screen: "game-over" });
    return;
  }

  const active = state.activeTeam;
  const scoredFour = state.round?.scored?.teamPoints === 4;
  const stillBehind = state.teams[active].score < leaderScore();
  const nextTeam = state.cooperative || (scoredFour && stillBehind) ? active : nextTeamIndex(active);
  setState({
    activeTeam: nextTeam,
    round: null,
    screen: "next-round",
    message: scoredFour && stillBehind && !state.cooperative ? "Catch-up turn: same team plays again." : ""
  });
}

function resetGame() {
  localStorage.removeItem(storageKey);
  state = freshState();
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function isPluralTeam(team) {
  const name = team.name.trim().toLowerCase().replace(/^the\s+/, "");
  if (["commies", "fascists", "libtards", "people", "children", "crew", "police"].includes(name)) return true;
  const lastWord = name.split(/\s+/).pop() || "";
  if (/\b(team|squad|group|club|mob|side|party|person|player|guy|girl|man|woman)\b/.test(lastWord)) return false;
  return /s$/.test(lastWord) && !/(ss|us|is)$/.test(lastWord);
}

function verb(team, singular, plural) {
  return isPluralTeam(team) ? plural : singular;
}

function possessive(team) {
  return isPluralTeam(team) ? "their" : "its";
}

function activeColor() {
  return state.teams[state.activeTeam]?.color || "#38c8ff";
}

function currentCallerTeam() {
  if (!state.round?.callerTeams?.length) return null;
  return state.teams[state.round.callerTeams[state.round.callerIndex]];
}

function topbar() {
  return `
    <div class="topbar" style="--accent:${activeColor()}">
      <div class="brand">
        <strong>Wavelength</strong>
      </div>
      <button class="button secondary" data-action="reset">Reset</button>
    </div>
  `;
}

function scoreboard() {
  return `
    <section class="scoreboard" aria-label="Scoreboard">
      ${state.teams.map((team, index) => `
        <div class="score ${index === state.activeTeam ? "active" : ""}" style="--team-color:${team.color}">
          <b>${escapeHtml(team.name)}</b>
          <span>${team.score}</span>
        </div>
      `).join("")}
    </section>
  `;
}

function spectrum(card) {
  return `
    <section class="spectrum" aria-label="Spectrum card">
      <div class="endpoint">
        <span>0</span>
        <strong>${escapeHtml(card.low)}</strong>
      </div>
      <div class="spectrum-line">to</div>
      <div class="endpoint">
        <span>100</span>
        <strong>${escapeHtml(card.high)}</strong>
      </div>
    </section>
  `;
}

function pointOnGauge(value, radius = 95) {
  const angle = (-180 + value * 1.8) * Math.PI / 180;
  return {
    x: 120 + radius * Math.cos(angle),
    y: 130 + radius * Math.sin(angle)
  };
}

function arcPath(startValue, endValue, radius = 95) {
  const start = pointOnGauge(startValue, radius);
  const end = pointOnGauge(endValue, radius);
  const largeArc = endValue - startValue > 50 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function tick(value) {
  const outer = pointOnGauge(value, 103);
  const inner = pointOnGauge(value, value % 25 === 0 ? 84 : 91);
  const label = pointOnGauge(value, 69);
  const major = value % 25 === 0;
  return `
    <line class="gauge-tick ${major ? "major" : ""}" x1="${outer.x.toFixed(1)}" y1="${outer.y.toFixed(1)}" x2="${inner.x.toFixed(1)}" y2="${inner.y.toFixed(1)}"></line>
    ${major ? `<text class="gauge-label" x="${label.x.toFixed(1)}" y="${(label.y + 4).toFixed(1)}">${value}</text>` : ""}
  `;
}

function needle(value, className) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const end = pointOnGauge(value, 76);
  return `
    <line class="gauge-needle ${className}" x1="120" y1="130" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"></line>
    <circle class="gauge-hub ${className}" cx="120" cy="130" r="10"></circle>
  `;
}

function dial({ target = null, guess = null, showBands = false } = {}) {
  const bands = target === null || !showBands ? "" : `
    <path class="gauge-band-two" d="${arcPath(Math.max(0, target - 8), Math.min(100, target + 8), 95)}"></path>
    <path class="gauge-band-three" d="${arcPath(Math.max(0, target - 4), Math.min(100, target + 4), 95)}"></path>
    <path class="gauge-band-four" d="${arcPath(Math.max(0, target - 2), Math.min(100, target + 2), 95)}"></path>
  `;
  return `
    <section class="gauge" aria-label="0 to 100 odometer">
      <svg viewBox="0 0 240 155" role="img" aria-label="Numerical odometer from 0 to 100">
        <path class="gauge-shell" d="M 18 130 A 102 102 0 0 1 222 130 L 192 130 A 72 72 0 0 0 48 130 Z"></path>
        <path class="gauge-arc" d="${arcPath(0, 100, 95)}"></path>
        ${bands}
        ${[0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100].map(tick).join("")}
        ${needle(guess, "guess")}
        ${needle(target, "target")}
      </svg>
    </section>
  `;
}

function setupTeamRows(teams, cooperative) {
  return teams.map((team, index) => `
    <div class="team-row" style="--team-color:${team.color}">
      <div class="swatch" style="background:${team.color}" aria-hidden="true"></div>
      <label>Team ${index + 1} name
        <input id="team-${index}" value="${escapeHtml(team.name)}" maxlength="24" ${cooperative && index > 0 ? "disabled" : ""}>
      </label>
      <button class="button secondary" data-action="remove-team" data-index="${index}" ${cooperative || teams.length <= 2 ? "disabled" : ""} aria-label="Remove ${escapeHtml(team.name)}">-</button>
    </div>
  `).join("");
}

function setupScreen() {
  const setupTeams = state.cooperative ? [state.teams[0] || defaultTeams[0]] : state.teams;
  return `
    ${topbar()}
    <section class="panel stack" style="--accent:${activeColor()}">
      <h1>Wavelength.</h1>
      <p>One clue-giver sees a secret target number from 0 to 100, gives a spoken clue, then their team tries to guess the number.</p>
      <label class="toggle-row">
        <span>
          <strong>One-team cooperative mode</strong>
          <span class="fine">Skip higher/lower calls and chase the target score together.</span>
        </span>
        <input id="cooperative" type="checkbox" ${state.cooperative ? "checked" : ""}>
      </label>
      <div class="input-grid">
        ${setupTeamRows(setupTeams, state.cooperative)}
        <button class="button secondary" data-action="add-team" ${state.cooperative || state.teams.length >= 3 ? "disabled" : ""}>Add team</button>
        <label>Play to
          <input id="target-score" type="number" min="4" max="30" value="${state.targetScore}">
        </label>
      </div>
      <ul class="rules-list">
        <li>Guess within 2 of the target number for 4 points.</li>
        <li>Guess within 4 for 3 points, or within 8 for 2 points.</li>
        <li>In multi-team games, every other team calls whether the target number is lower or higher than the guess. Each correct call scores 1 point, unless the guessing team scores 4.</li>
      </ul>
      <button class="button" data-action="save-setup">Start game</button>
    </section>
  `;
}

function handoffClueScreen() {
  const team = state.teams[state.activeTeam];
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack center" style="--accent:${team.color}">
      <h2>${escapeHtml(team.name)} ${verb(team, "chooses", "choose")} a clue-giver.</h2>
      <p>Pass the phone to the clue-giver. Everyone else should look away before the target number is revealed.</p>
      <button class="button" data-action="show-secret">I am the clue-giver</button>
    </section>
  `;
}

function secretScreen() {
  const card = demoCards[state.round.cardIndex];
  const team = state.teams[state.activeTeam];
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack center" style="--accent:${team.color}">
      <div class="status-line">Clue-giver only: hidden information</div>
      ${spectrum(card)}
      <div>
        <p>Target number</p>
        <div class="target-number">${state.round.target}</div>
      </div>
      ${dial({ target: state.round.target, showBands: true })}
      <p>Give one spoken clue that points your team toward the target number. When the clue has been given, press <strong>Clue given</strong> to hide the secret information, then pass the phone back to your team.</p>
      <div class="actions two">
        <button class="button secondary" data-action="reroll">New card and number</button>
        <button class="button" data-action="hide-secret">Clue given</button>
      </div>
    </section>
  `;
}

function teamGuessScreen() {
  const card = demoCards[state.round.cardIndex];
  const team = state.teams[state.activeTeam];
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack" style="--accent:${team.color}">
      <div class="status-line">${escapeHtml(team.name)} ${verb(team, "guesses", "guess")}. The clue-giver stays silent.</div>
      ${spectrum(card)}
      ${dial()}
      <label>Team guess, 0 to 100
        <input id="team-guess" type="number" inputmode="numeric" min="0" max="100" value="${escapeHtml(state.round.guess)}" placeholder="50">
      </label>
      <div class="actions two">
        <button class="button secondary" data-action="back-secret">Back</button>
        <button class="button" data-action="lock-guess">Lock guess</button>
      </div>
    </section>
  `;
}

function opponentScreen() {
  const card = demoCards[state.round.cardIndex];
  const active = state.teams[state.activeTeam];
  const caller = currentCallerTeam();
  const remaining = state.round.callerTeams.length - state.round.callerIndex - 1;
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack" style="--accent:${caller.color}">
      <div class="status-line">${escapeHtml(caller.name)}: is the target number lower or higher?</div>
      ${spectrum(card)}
      <div class="result-grid">
        <div class="result-box">
          <span>${escapeHtml(active.name)} ${verb(active, "guessed", "guessed")}</span>
          <strong>${state.round.guess}</strong>
        </div>
        <div class="result-box">
          <span>Target number</span>
          <strong>?</strong>
        </div>
      </div>
      <p>${remaining ? `${remaining} other ${remaining === 1 ? "team gets" : "teams get"} a call after this.` : "This is the final higher/lower call before the reveal."}</p>
      ${dial({ guess: Number(state.round.guess) })}
      <div class="actions two">
        <button class="button secondary" data-action="opponent-lower">Lower</button>
        <button class="button" data-action="opponent-higher">Higher</button>
      </div>
    </section>
  `;
}

function revealScreen() {
  const card = demoCards[state.round.cardIndex];
  const active = state.teams[state.activeTeam];
  const guess = Number(state.round.guess);
  const { teamPoints, callerScores, distance } = state.round.scored;
  const callerBoxes = state.round.callerTeams.map((teamIndex) => {
    const team = state.teams[teamIndex];
    return `
      <div class="result-box">
        <span>${escapeHtml(team.name)}</span>
        <strong>+${callerScores[teamIndex] || 0}</strong>
      </div>
    `;
  }).join("");
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack" style="--accent:${active.color}">
      <div class="status-line">Reveal</div>
      ${spectrum(card)}
      <div class="center">
        <p>Target number</p>
        <div class="target-number">${state.round.target}</div>
      </div>
      ${dial({ target: state.round.target, guess, showBands: true })}
      <div class="result-grid">
        <div class="result-box">
          <span>${escapeHtml(active.name)} ${verb(active, "guessed", "guessed")}</span>
          <strong>${guess}</strong>
        </div>
        <div class="result-box">
          <span>Distance</span>
          <strong>${distance}</strong>
        </div>
        <div class="result-box">
          <span>${escapeHtml(active.name)}</span>
          <strong>+${teamPoints}</strong>
        </div>
        ${state.cooperative ? "" : callerBoxes}
      </div>
      <button class="button" data-action="next-turn">Continue</button>
    </section>
  `;
}

function nextRoundScreen() {
  const team = state.teams[state.activeTeam];
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack center" style="--accent:${team.color}">
      <h2>${escapeHtml(team.name)} ${verb(team, "is", "are")} up.</h2>
      ${state.message ? `<p>${escapeHtml(state.message)}</p>` : "<p>Choose a new clue-giver for the next round.</p>"}
      <button class="button" data-action="start-round">Start round</button>
    </section>
  `;
}

function gameOverScreen() {
  const sorted = [...state.teams].sort((a, b) => b.score - a.score);
  const finalScore = state.teams.map((team) => `${escapeHtml(team.name)} ${team.score}`).join(", ");
  const heading = state.cooperative ? `Final score: ${state.teams[0].score}` : `${escapeHtml(sorted[0].name)} ${verb(sorted[0], "wins", "win")}.`;
  return `
    ${topbar()}
    ${scoreboard()}
    <section class="panel stack center" style="--accent:${sorted[0].color}">
      <h1>${heading}</h1>
      <p>${finalScore}.</p>
      <div class="actions two">
        <button class="button secondary" data-action="reset">New game</button>
        <button class="button" data-action="same-teams">Same teams</button>
      </div>
    </section>
  `;
}

function render() {
  const screens = {
    setup: setupScreen,
    "handoff-clue": handoffClueScreen,
    secret: secretScreen,
    "team-guess": teamGuessScreen,
    opponent: opponentScreen,
    reveal: revealScreen,
    "next-round": nextRoundScreen,
    "game-over": gameOverScreen
  };
  app.innerHTML = screens[state.screen]();
}

function validateGuess(value) {
  if (value === "" || value === null) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) return null;
  return number;
}

function saveSetup() {
  const cooperative = document.querySelector("#cooperative")?.checked || false;
  const sourceTeams = cooperative ? [state.teams[0] || defaultTeams[0]] : state.teams;
  const teams = sourceTeams.map((team, index) => ({
    ...team,
    name: document.querySelector(`#team-${index}`)?.value.trim() || team.name,
    score: 0
  }));
  const targetScore = Math.min(30, Math.max(4, Number(document.querySelector("#target-score").value) || 10));
  setState({
    teams,
    cooperative,
    targetScore,
    activeTeam: 0,
    usedCardIndexes: [],
    roundNumber: 0,
    round: null,
    screen: "next-round",
    message: ""
  });
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const action = button?.dataset.action;
  if (!action) return;

  if (action === "reset" && confirm("Start over?")) {
    resetGame();
  }

  if (action === "add-team") {
    const usedColors = state.teams.map((team) => team.color);
    const next = defaultTeams.find((team) => !usedColors.includes(team.color)) ||
      { name: `Team ${state.teams.length + 1}`, score: 0, color: "#38c8ff" };
    setState({ teams: [...state.teams, { ...next, score: 0 }] });
  }

  if (action === "remove-team") {
    const index = Number(button.dataset.index);
    const teams = state.teams.filter((_, teamIndex) => teamIndex !== index);
    setState({ teams, activeTeam: 0 });
  }

  if (action === "save-setup") {
    saveSetup();
  }
  if (action === "start-round") {
    startRound();
  }
  if (action === "show-secret") {
    setState({ screen: "secret" });
  }

  if (action === "reroll") {
    const cardIndex = pickCardIndex();
    state.usedCardIndexes = [...state.usedCardIndexes, cardIndex];
    setState({ round: { ...state.round, cardIndex, target: randomInt(0, 100), guess: "", opponentGuess: null } });
  }

  if (action === "hide-secret") {
    setState({ screen: "team-guess" });
  }
  if (action === "back-secret") setState({ screen: "secret" });

  if (action === "lock-guess") {
    const guess = validateGuess(document.querySelector("#team-guess").value);
    if (guess === null) {
      alert("Enter a whole number from 0 to 100.");
      return;
    }
    state.round = { ...state.round, guess, opponentGuess: null };
    if (state.cooperative) {
      endRound();
    } else {
      setState({ round: state.round, screen: "opponent" });
    }
  }

  if (action === "opponent-lower" || action === "opponent-higher") {
    const opponentGuess = action === "opponent-lower" ? "lower" : "higher";
    const currentTeamIndex = state.round.callerTeams[state.round.callerIndex];
    const opponentGuesses = { ...state.round.opponentGuesses, [currentTeamIndex]: opponentGuess };
    const nextCallerIndex = state.round.callerIndex + 1;
    state.round = { ...state.round, opponentGuesses, opponentGuess, callerIndex: nextCallerIndex };
    if (nextCallerIndex < state.round.callerTeams.length) {
      setState({ round: state.round, screen: "opponent" });
    } else {
      endRound();
    }
  }

  if (action === "next-turn") {
    nextTurn();
  }

  if (action === "same-teams") {
    setState({
      teams: state.teams.map((team) => ({ ...team, score: 0 })),
      activeTeam: 0,
      round: null,
      usedCardIndexes: [],
      roundNumber: 0,
      message: "",
      screen: "next-round"
    });
  }
});

app.addEventListener("change", (event) => {
  if (event.target.id !== "cooperative") return;
  setState({
    cooperative: event.target.checked,
    teams: event.target.checked ? [state.teams[0] || defaultTeams[0]] : defaultTeams.map((team, index) => state.teams[index] || { ...team }),
    activeTeam: 0
  });
});

app.addEventListener("input", (event) => {
  if (event.target.id !== "team-guess") return;
  const value = event.target.value;
  const guess = validateGuess(value);
  if (value === "" || guess !== null) {
    state.round = { ...state.round, guess: value };
    saveState();
  }
});

render();
