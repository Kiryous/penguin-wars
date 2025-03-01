// Fix for iOS Safari 100vh viewport issue
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

// Initial setup
setViewportHeight();
window.addEventListener("resize", function () {
  setViewportHeight();
  if (!penguinLastLaunchedTimestamp) {
    resetPositions();
  }
});

// Game initialization
document.addEventListener("DOMContentLoaded", initGame);
window.addEventListener("load", initGame); // Additional initialization on full load

// Gameplay constants
const RESET_IN_FROM_LAUNCH = 1000; // Time in ms to reset the penguin if it's idle
const MAX_SLOW_MOVEMENT_TIME = 2000; // Maximum time in ms to allow slow movement before reset
const ENEMIES_MIN_SPAWN_DELAY = 200; // Minimum spawn delay
const ENEMIES_BASE_SPAWN_DELAY = 700; // Base spawn delay
const ENEMIES_BASE_COUNT = 5;
const ENEMIES_BASE_SPEED = 0.5;

// Global variables
let penguin;
let waitingPenguin;
let slingshot;
let slingshotBandLeft;
let slingshotBandRight;
let enemies = [];
let score = 0;
let penguinLastLaunchedTimestamp = false;
let isDragging = false;
let initialPenguinPos = { x: 0, y: 0 };
let restPosition = { x: 0, y: 0 };
let dragStartPos = { x: 0, y: 0 };
let currentPos = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let penguinLastTimestamp = 0; // Separate timestamp for penguin physics
let gameLastTimestamp = 0; // Separate timestamp for game updates
let animationFrameId = null;
let gameAnimationFrameId = null; // Separate animation frame ID for game updates
let debugMode = false;
let touchMarker;
let baseHealth = 100; // Base health
let currentWave = 1; // Current wave number
let enemiesInWave = ENEMIES_BASE_COUNT; // Number of enemies in current wave
let waveInProgress = false; // Flag to track if a wave is in progress
let enemySpawnInterval = null; // Interval for spawning enemies
let activePenguinClone = null; // Active penguin clone being launched
let penguinCloneCount = 0; // Number of penguin clones
let lastDragDistance = null; // Last drag distance for the slingshot
// Variables for sound effects
let lastStretchMagnitude = 0; // Track the last stretch magnitude for sound effects
let lastStretchSoundTime = 0; // Track when the last stretch sound was played
let isMuted = false; // Track if audio is muted
let penguinSunk = false; // Flag to track if penguin is sunk in water
let slowMovementTime = 0; // Track how long the penguin has been moving slowly
let gamePaused = false; // Flag to track if the game is paused
let penguinsAvailable = 5; // Start with 5 penguins per wave
let isPenguinSwitchInProgress = false; // Flag to track if a penguin switch is in progress

// Physics constants
const GRAVITY = 0.5;
const BOUNCE_FACTOR = 0.7;
const FRICTION = 0.98;
const PENGUIN_RADIUS = 20;
const ENEMY_RADIUS = 17.5;
const ELASTICITY = 15;
const MIN_EXPLOSION_SPEED = 8; // Minimum speed required for enemies to explode
const BASE_DAMAGE_PER_ENEMY = 10; // Damage each enemy deals to the base

// Level generation constants
const ENEMY_TYPES = [
  { emoji: "🚢", name: "cargo ship", points: 100, size: 1.5 },
  { emoji: "⛵", name: "sailboat", points: 120, size: 1.3 },
  { emoji: "🛥️", name: "speedboat", points: 150, size: 1.4 },
  { emoji: "🦭", name: "seal", points: 180, size: 1.0 },
  { emoji: "🦈", name: "shark", points: 250, size: 1.6 },
  { emoji: "🏊‍♂️", name: "swimmer", points: 200, size: 0.9 },
];

const PENGUIN_TYPES = [
  { emoji: "🐧", name: "penguin", points: 100, size: 1.0 },
  { emoji: "🐧", name: "penguin", points: 100, size: 1.0 },
  { emoji: "🐧", name: "penguin", points: 100, size: 1.0 },
  { emoji: "🐧", name: "penguin", points: 100, size: 1.0 },
  { emoji: "🐧", name: "penguin", points: 100, size: 1.0 },
];

const FORMATIONS = [
  "standard", // Scattered targets
  "pyramid", // Pyramid formation
  "wall", // Wall formation
  "floating", // Targets at different heights
  "random", // Completely random positions
];

const DIFFICULTY_LEVELS = [
  { name: "easy", targetCount: { min: 3, max: 5 }, speedFactor: 1.0 },
  { name: "medium", targetCount: { min: 4, max: 7 }, speedFactor: 1.2 },
  { name: "hard", targetCount: { min: 6, max: 9 }, speedFactor: 1.5 },
];

// Current level settings
let currentDifficulty = 0; // 0: easy, 1: medium, 2: hard
let currentLevel = 1;

// Function to set favicon using static files
function setFavicon(type) {
  const favicon = document.getElementById("favicon");

  if (type === "explosion") {
    favicon.href = "/favicons/explosion-favicon.png";
  } else if (type === "right") {
    favicon.href = "/favicons/penguin-right-favicon.png";
  } else if (type === "left") {
    favicon.href = "/favicons/penguin-left-favicon.png";
  }
}

// Function to update favicon based on penguin direction
function updateFaviconDirection() {
  // Check if explosion is active
  if (document.getElementById("favicon").dataset.explosionActive === "true") {
    return; // Don't update direction during explosion
  }
  const penguinEmoji = penguin.querySelector(".js-penguin-emoji");
  // Determine if penguin is facing right based on class
  const isFacingRight = penguinEmoji.classList.contains("face-right");
  setFavicon(isFacingRight ? "right" : "left");
}

function initGame() {
  // Get DOM elements
  penguin = document.getElementById("penguin");
  waitingPenguin = document.getElementById("waiting-penguin");
  slingshot = document.getElementById("slingshot");
  slingshotBandLeft = document.getElementById("slingshot-band-left");
  slingshotBandRight = document.getElementById("slingshot-band-right");
  touchMarker = document.getElementById("touch-marker");

  // Set initial penguin favicon - initially facing right
  setFavicon("right");

  // Set initial position for penguin - position it precisely at the top center of the slingshot
  const slingshotRect = slingshot.getBoundingClientRect();
  restPosition = {
    x: slingshotRect.left + slingshotRect.width / 2 - penguin.offsetWidth / 2,
    y: slingshotRect.top - penguin.offsetHeight + 10, // Add a small overlap to make it look like it's on the slingshot
  };

  // Make sure the waiting penguin's div has the correct transform
  const waitingPenguinDiv = waitingPenguin.querySelector(".js-penguin-emoji");
  if (waitingPenguinDiv) {
    waitingPenguinDiv.classList.add("face-right");
  } else {
    // If the div doesn't exist for some reason, recreate it
    waitingPenguin.innerHTML =
      '<div class="face-right js-penguin-emoji">🐧</div>';
  }

  // Apply random animation delay to waiting penguin
  applyRandomJumpDelay();

  // Reset game state
  resetPenguin();
  resetGameState();

  // Add event listeners for mouse/touch
  penguin.addEventListener("mousedown", startDrag, { passive: false });
  penguin.addEventListener("touchstart", startDrag, { passive: false });

  document.addEventListener("mousemove", onDrag, { passive: false });
  document.addEventListener("touchmove", onDrag, { passive: false });

  // Add global event listeners for mouse/touch release
  // This ensures the penguin is launched even if the mouse is released outside the penguin element
  document.addEventListener("mouseup", (e) => {
    if (isDragging) {
      endDrag(e);
    }
  });

  document.addEventListener("touchend", (e) => {
    if (isDragging) {
      endDrag(e);
    }
  });

  // Add event listener for restart button
  document
    .getElementById("restart-button")
    .addEventListener("click", restartGame);

  // Add event listener for play again button
  document
    .getElementById("play-again-button")
    .addEventListener("click", restartGame);

  // Add event listeners for pause and resume buttons
  document.getElementById("pause-button").addEventListener("click", pauseGame);
  document
    .getElementById("resume-button")
    .addEventListener("click", resumeGame);

  // Add event listener for mute button
  document.getElementById("mute-button").addEventListener("click", toggleMute);

  // Initialize mute button to show correct icon (unmuted by default)
  document.getElementById("mute-button").textContent = "🔊";

  const queryParams = new URLSearchParams(window.location.search);
  if (queryParams.get("debug")) {
    const debugToggle = document.getElementById("debug-toggle");
    debugToggle.style.display = "block";
    debugToggle.addEventListener("click", toggleDebug);
  }

  // Start debug info updates
  updateDebugInfo();

  // Start the first wave
  startNextWave();
}

function resetGameState() {
  // Reset game variables
  score = 0;
  baseHealth = 100;
  currentWave = 1;
  enemiesInWave = ENEMIES_BASE_COUNT; // Updated to match our new base enemy count
  waveInProgress = false;
  gameOver = false;
  gameEnding = false;

  // Clear any existing enemies
  clearEnemies();

  // Update UI
  document.getElementById("score").textContent = score;
  document.getElementById("wave-number").textContent = currentWave;
  document.getElementById("health-bar").style.width = "100%";
  document.getElementById("game-over-overlay").style.display = "none";

  // Clear any existing spawn intervals
  if (enemySpawnInterval) {
    clearInterval(enemySpawnInterval);
    enemySpawnInterval = null;
  }
}

function clearEnemies() {
  // Remove all enemy elements from the DOM
  enemies.forEach((enemy) => {
    enemy.element.remove();
  });
  enemies = [];

  // Stop the game animation loop when clearing enemies
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
}

function startDrag(e) {
  e.preventDefault();

  if (penguinLastLaunchedTimestamp || gameOver) return;

  isDragging = true;
  const penguinRect = penguin.getBoundingClientRect();
  dragStartPos = {
    x: penguinRect.left + penguinRect.width / 2,
    y: penguinRect.top + penguinRect.height / 2,
  };

  // Remove the animation class when dragging starts
  penguin.classList.remove("slingshot-penguin-animate");
  penguin.classList.add("dragging");

  // Set initial penguin position for elastic calculations
  initialPenguinPos = {
    x: parseInt(penguinRect.left) || restPosition.x,
    y: parseInt(penguinRect.top) || restPosition.y,
  };

  // Show slingshot bands
  slingshotBandLeft.style.display = "block";
  slingshotBandRight.style.display = "block";

  // Show and position touch marker
  const touchX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
  const touchY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
  updateTouchMarker(touchX, touchY);

  // Initialize the drag distance
  const slingshotRect = slingshot.getBoundingClientRect();
  const slingshotCenterX = slingshotRect.left + slingshotRect.width / 2;
  const slingshotTopY = slingshotRect.top;

  lastDragDistance = {
    x: touchX - slingshotCenterX,
    y: touchY - slingshotTopY,
  };
}

function onDrag(e) {
  e.preventDefault();

  if (!isDragging) return;

  // Get drag position based on event type
  const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
  const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;

  // Update touch marker position
  updateTouchMarker(clientX, clientY);

  // Calculate new position
  const slingshotRect = slingshot.getBoundingClientRect();
  const slingshotCenterX = slingshotRect.left + slingshotRect.width / 2;
  const slingshotTopY = slingshotRect.top;

  // Limit drag distance for reasonable gameplay
  const dragDistance = {
    x: clientX - slingshotCenterX,
    y: clientY - slingshotTopY,
  };

  // Calculate magnitude of drag
  const magnitude = Math.sqrt(
    dragDistance.x * dragDistance.x + dragDistance.y * dragDistance.y
  );
  const maxMagnitude = 150; // Maximum drag distance

  // Play stretching sound when the magnitude changes significantly
  // Only play sound if it's been at least 300ms since the last sound to avoid too many sounds
  const currentTime = Date.now();
  if (
    Math.abs(magnitude - lastStretchMagnitude) > 10 &&
    currentTime - lastStretchSoundTime > 300
  ) {
    playSound("stretch");
    lastStretchMagnitude = magnitude;
    lastStretchSoundTime = currentTime;
  }

  // Limit the drag to be mostly to the left and down from the slingshot
  // This ensures proper slingshot behavior
  if (dragDistance.x > 50) {
    // Limit rightward drag
    dragDistance.x = 50;
  }

  if (magnitude > maxMagnitude) {
    dragDistance.x = (dragDistance.x / magnitude) * maxMagnitude;
    dragDistance.y = (dragDistance.y / magnitude) * maxMagnitude;
  }

  // Calculate new penguin position
  currentPos = {
    x: slingshotCenterX + dragDistance.x - PENGUIN_RADIUS,
    y: slingshotTopY + dragDistance.y - PENGUIN_RADIUS,
  };

  // Update penguin position
  penguin.style.transform = `translate(${currentPos.x}px, ${currentPos.y}px)`;

  // Update slingshot bands
  updateSlingshotBands(
    currentPos.x + PENGUIN_RADIUS,
    currentPos.y + PENGUIN_RADIUS
  );

  // Store the drag distance for use in endDrag
  lastDragDistance = dragDistance;
}

function updateSlingshotBands(penguinX, penguinY) {
  const slingshotRect = slingshot.getBoundingClientRect();
  const slingshotTopCenterX = slingshotRect.left + slingshotRect.width / 2;
  const slingshotTopY = slingshotRect.top;

  // Calculate distances for the left band
  const leftBandStartX = slingshotRect.left;
  const leftBandStartY = slingshotTopY;
  const leftDx = penguinX - leftBandStartX;
  const leftDy = penguinY - leftBandStartY;
  const leftLength = Math.sqrt(leftDx * leftDx + leftDy * leftDy);
  const leftAngle = Math.atan2(leftDy, leftDx) - Math.PI / 2;

  // Calculate distances for the right band
  const rightBandStartX = slingshotRect.right;
  const rightBandStartY = slingshotTopY;
  const rightDx = penguinX - rightBandStartX;
  const rightDy = penguinY - rightBandStartY;
  const rightLength = Math.sqrt(rightDx * rightDx + rightDy * rightDy);
  const rightAngle = Math.atan2(rightDy, rightDx) - Math.PI / 2;

  // Update left band
  slingshotBandLeft.style.height = `${leftLength}px`;
  slingshotBandLeft.style.transform = `translate(0px, 0px) rotate(${leftAngle}rad)`;
  slingshotBandLeft.style.transformOrigin = "0 0";

  // Update right band
  slingshotBandRight.style.height = `${rightLength}px`;
  slingshotBandRight.style.transform = `translate(0px, 0px) rotate(${rightAngle}rad)`;
  slingshotBandRight.style.transformOrigin = "100% 0";
}

function endDrag(e) {
  if (!isDragging) return;

  isDragging = false;
  penguin.classList.remove("dragging");
  // Hide touch marker
  touchMarker.style.display = "none";

  // Calculate velocity based on drag distance
  const slingshotRect = slingshot.getBoundingClientRect();
  const slingshotCenterX = slingshotRect.left + slingshotRect.width / 2;
  const slingshotTopY = slingshotRect.top;

  // Use the stored drag distance if available, otherwise calculate it
  let dragDistance;
  if (lastDragDistance) {
    dragDistance = lastDragDistance;
    console.log("Using stored drag distance:", dragDistance);
  } else {
    dragDistance = {
      x: currentPos.x + PENGUIN_RADIUS - slingshotCenterX,
      y: currentPos.y + PENGUIN_RADIUS - slingshotTopY,
    };
    console.log("Calculated drag distance:", dragDistance);
  }

  console.log("Drag distance:", dragDistance);

  // Launch penguin in the opposite direction of drag with proper physics
  // The further you pull, the more power you get
  const pullDistance = Math.sqrt(
    dragDistance.x * dragDistance.x + dragDistance.y * dragDistance.y
  );

  console.log("Pull distance:", pullDistance);

  // Only launch if the pull distance is significant enough
  if (pullDistance < 5) {
    // Pull distance too small, reset penguin without launching
    console.log("Launch canceled: Pull distance too small");
    resetPenguin();
    return;
  }

  const powerFactor = Math.min(pullDistance / 50, 3); // Cap the power factor

  velocity = {
    x: (-dragDistance.x / ELASTICITY) * powerFactor,
    y: (-dragDistance.y / ELASTICITY) * powerFactor,
  };

  console.log("Initial velocity:", velocity);

  // Ensure minimum launch velocity
  const minLaunchSpeed = 3;
  const currentSpeed = Math.sqrt(
    velocity.x * velocity.x + velocity.y * velocity.y
  );

  if (currentSpeed < minLaunchSpeed) {
    // Scale up velocity to ensure minimum launch speed
    const scaleFactor = minLaunchSpeed / currentSpeed;
    velocity.x *= scaleFactor;
    velocity.y *= scaleFactor;

    console.log("Velocity boosted:", velocity);
  }

  // Play launch sound
  playSound("launch");

  // Hide slingshot bands
  slingshotBandLeft.style.display = "none";
  slingshotBandRight.style.display = "none";

  // CHANGE: Clone the penguin for launch
  const penguinClone = document.createElement("div");
  penguinClone.id = "penguin-clone" + penguinCloneCount;
  penguinCloneCount++;
  penguinClone.className = "js-penguin-clone";
  penguinClone.style.position = "absolute";
  penguinClone.style.transform = `translate(${currentPos.x}px, ${currentPos.y}px)`;
  penguinClone.style.zIndex = "3";
  penguinClone.style.fontSize = penguin.style.fontSize || "40px";

  // Copy the penguin emoji and its facing direction
  const penguinEmoji = penguin.querySelector(".js-penguin-emoji");
  const penguinCloneEmoji = document.createElement("div");
  penguinCloneEmoji.className = penguinEmoji.className;
  penguinCloneEmoji.textContent = penguinEmoji.textContent;
  penguinCloneEmoji.classList.add("js-penguin-emoji-clone");
  penguinClone.appendChild(penguinCloneEmoji);

  document.getElementById("game-area").appendChild(penguinClone);

  // Reset the original penguin back to the slingshot but make it invisible
  penguin.style.transform = `translate(${restPosition.x}px, ${restPosition.y}px)`;
  penguin.style.opacity = "0"; // Hide the original penguin
  currentPos = { x: restPosition.x, y: restPosition.y };

  // Store the active penguin clone in a global variable
  activePenguinClone = penguinClone;

  // Start physics simulation
  penguinLastLaunchedTimestamp = performance.now();
  penguinLastTimestamp = performance.now(); // Use penguin-specific timestamp
  animationFrameId = requestAnimationFrame(updatePhysics);

  console.log("Physics simulation started, t=" + penguinLastTimestamp);

  // Clear the stored drag distance
  lastDragDistance = null;
}

function updatePhysics(timestamp) {
  // Don't update if game is paused
  if (gamePaused) {
    animationFrameId = requestAnimationFrame(updatePhysics);
    return;
  }

  console.log(
    "updatePhysics called t=" +
      timestamp +
      "; penguinLastTimestamp=" +
      penguinLastTimestamp
  );

  // Calculate elapsed time
  const deltaTime = timestamp - penguinLastTimestamp;
  penguinLastTimestamp = timestamp;

  // Scale time factor to keep physics consistent regardless of frame rate
  const timeScale = deltaTime / 16; // Normalized to 60fps

  // Get the active penguin clone
  const penguinClones = document.querySelectorAll(".js-penguin-clone");
  penguinClone = penguinClones[penguinClones.length - 1];
  if (penguinClones.length === 0) {
    // No active clone, cancel animation
    console.log("No active penguin clone found, cancelling physics");
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    return;
  }

  // Update position based on velocity
  const newX = currentPos.x + velocity.x * timeScale;
  const newY = currentPos.y + velocity.y * timeScale;

  console.log("New position:", { x: newX, y: newY });
  console.log("Current velocity:", velocity);

  // Check for collision with ground
  const gameRect = document.getElementById("game-area").getBoundingClientRect();
  const groundY = gameRect.height;

  // Get slingshot position to determine if we should apply left wall collision
  const slingshotRect = slingshot.getBoundingClientRect();
  const slingshotX = slingshotRect.left;

  // Check for wall collisions
  if (newX < 0 && slingshotX < newX) {
    // Left wall collision - only apply if penguin is to the right of the slingshot
    velocity.x = -velocity.x * BOUNCE_FACTOR;
    // Ensure a minimum bounce velocity to prevent getting stuck
    if (Math.abs(velocity.x) < 2) {
      velocity.x = 2; // Minimum rightward velocity after left wall collision
    }
    currentPos.x = 0;
  } else if (newX + PENGUIN_RADIUS * 2 > gameRect.width) {
    // Right wall collision
    velocity.x = -velocity.x * BOUNCE_FACTOR;
    // Ensure a minimum bounce velocity to prevent getting stuck
    if (Math.abs(velocity.x) < 2) {
      velocity.x = -2; // Minimum leftward velocity after right wall collision
    }
    currentPos.x = gameRect.width - PENGUIN_RADIUS * 2;
  } else {
    currentPos.x = newX;
  }

  const sunkLineY = groundY - 100;
  // Check for ground collision, but only if we're not in gameEnding mode
  // During gameEnding, let the penguin fall through the ground
  if (newY + PENGUIN_RADIUS > sunkLineY && !gameEnding) {
    // Instead of bouncing, let the penguin sink below the ground
    // Store that the penguin is now below ground
    if (!penguinSunk) {
      penguinSunk = true;
      console.log("Penguin has sunk below the surface");

      // Apply some damping to the velocity for a more natural sinking effect
      velocity.y *= 0.5;
      velocity.x *= 0.7;
    }

    // Continue applying physics but with increased resistance
    currentPos.y = newY;
    velocity.y *= 0.95; // Slow down vertical velocity more aggressively
    velocity.x *= 0.9; // Slow down horizontal velocity more aggressively

    // Calculate how deep the penguin is below the ground
    const sinkDepth = currentPos.y + PENGUIN_RADIUS * 2 - groundY;
    // Calculate opacity based on depth - fade out as it sinks deeper
    const maxSinkDepth = PENGUIN_RADIUS * 4; // How deep before fully invisible
    const opacity = Math.max(0, 1 - sinkDepth / maxSinkDepth);

    // Apply fading effect
    penguinClone.style.opacity = opacity.toString();
  } else {
    currentPos.y = newY;
    // Reset the sunk flag if penguin is above ground
    if (penguinSunk && newY + PENGUIN_RADIUS * 2 <= groundY) {
      penguinSunk = false;
      penguinClone.style.opacity = "1"; // Reset opacity when above ground
    }
    // Apply gravity - increase gravity when game is ending for a faster fall
    velocity.y += gameEnding ? GRAVITY * 1.5 * timeScale : GRAVITY * timeScale;
  }

  // Apply friction to slow down the penguin
  velocity.x *= FRICTION;

  // Update penguin clone position
  penguinClone.style.transform = `translate(${currentPos.x}px, ${currentPos.y}px)`;

  // If game is ending, make sure penguin clone is visible above the overlay
  if (gameEnding) {
    penguinClone.style.zIndex = "101";
    // Add a trail effect during game ending for more visual impact
    createFallingTrail(
      currentPos.x + PENGUIN_RADIUS,
      currentPos.y + PENGUIN_RADIUS
    );
  } else {
    penguinClone.style.zIndex = "3"; // Reset to original z-index
  }

  const penguinEmoji = penguinClone.querySelector(".js-penguin-emoji-clone");

  // Update penguin facing direction based on velocity
  const previousFacingRight = penguinEmoji.classList.contains("face-right");

  if (velocity.x === 0) {
    penguinEmoji.classList.add("face-right");
  } else if (velocity.x > 0.5) {
    penguinEmoji.classList.add("face-right");
  } else if (velocity.x < -0.5) {
    penguinEmoji.classList.remove("face-right");
  }

  // Update favicon if direction changed
  const currentFacingRight = penguinEmoji.classList.contains("face-right");
  if (previousFacingRight !== currentFacingRight) {
    updateFaviconDirection();
  }

  // Check for collisions with enemies
  const penguinCenterX = currentPos.x + PENGUIN_RADIUS;
  const penguinCenterY = currentPos.y + PENGUIN_RADIUS;

  enemies.forEach((enemy) => {
    if (!enemy.isHit) {
      const enemyRect = enemy.element.getBoundingClientRect();
      const enemyCenterX = enemyRect.left + enemyRect.width / 2;
      const enemyCenterY = enemyRect.top + enemyRect.height / 2;

      // Calculate distance between penguin and enemy
      const dx = penguinCenterX - enemyCenterX;
      const dy = penguinCenterY - enemyCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate the effective enemy radius based on its size
      const effectiveEnemyRadius = ENEMY_RADIUS * enemy.size;

      // Check for collision with adjusted radius
      if (distance < PENGUIN_RADIUS + effectiveEnemyRadius) {
        // Calculate current speed
        const currentSpeed = Math.sqrt(
          velocity.x * velocity.x + velocity.y * velocity.y
        );

        // Determine if the penguin is moving fast enough to destroy the enemy
        // Scale the minimum required speed based on the enemy's size
        const requiredSpeed = MIN_EXPLOSION_SPEED * (enemy.size * 0.8);

        if (currentSpeed >= requiredSpeed) {
          // Calculate damage based on penguin speed
          const damage = Math.ceil(currentSpeed / requiredSpeed);
          enemy.hitPoints -= damage;

          // Create small hit effect
          createHitEffect(enemyCenterX, enemyCenterY, damage);

          // If enemy has no more hit points, destroy it
          if (enemy.hitPoints <= 0) {
            // Mark enemy as hit
            enemy.isHit = true;

            // Create explosion effects at the enemy's position
            createExplosionEffect(enemyCenterX, enemyCenterY);

            // reset the sunk flag because the penguin hit the enemy
            // TODO: more robust solution
            penguinSunk = false;

            // Hide the enemy
            enemy.element.style.opacity = "0";

            // Update score
            score += enemy.points;
            document.getElementById("score").textContent = score;
          } else {
            // Enemy is damaged but not destroyed
            // Visual feedback - make the enemy flash red and show damage
            enemy.element.style.filter =
              "sepia(1) saturate(3) hue-rotate(300deg) brightness(0.8)";

            // Show damage percentage as opacity
            const damagePercent = 1 - enemy.hitPoints / enemy.maxHitPoints;
            enemy.element.style.opacity = (1 - damagePercent * 0.5).toString(); // Don't make it too transparent

            // Clear the visual effect after a short delay
            setTimeout(() => {
              enemy.element.style.filter = `sepia(${damagePercent}) saturate(3) hue-rotate(${
                300 * damagePercent
              }deg)`;
            }, 300);
          }
        } else {
          // Not fast enough for explosion - just bounce off
          handleLowVelocityCollision(enemy, dx, dy, distance);
        }

        // Add some bounce effect when hitting an enemy
        const bounceDirection = {
          x: dx / distance,
          y: dy / distance,
        };

        velocity.x += bounceDirection.x * 2;
        velocity.y += bounceDirection.y * 2;
      }
    }
  });

  // Check if penguin has gone off screen
  const penguinOffScreen =
    currentPos.y < -PENGUIN_RADIUS * 4 || // Too far above
    currentPos.y > gameRect.height + PENGUIN_RADIUS * 2 || // Too far below
    currentPos.x < -PENGUIN_RADIUS * 4 || // Too far to the left
    currentPos.x > gameRect.width + PENGUIN_RADIUS * 4; // Too far to the right

  if (penguinOffScreen && !gameEnding) {
    // Penguin has gone off screen, remove the clone
    penguinClone.remove();
    activePenguinClone = null;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    if (debugMode) {
      console.log("Penguin clone removed: Off screen");
    }

    // Reset launch timestamp to allow new launches
    penguinLastLaunchedTimestamp = 0;

    // Make original penguin visible again
    penguin.style.opacity = "1";

    // Call switchToNextPenguin if no switch is in progress
    if (!isPenguinSwitchInProgress) {
      switchToNextPenguin();
    }
    return;
  }

  // Stop animation if penguin is almost stopped
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

  // Only stop the penguin if it has actually stopped on the ground or it has sunk below the surface
  const penguinHasStopped =
    (speed < 0.5 &&
      Math.abs(velocity.y) < 0.5 &&
      currentPos.y + PENGUIN_RADIUS * 2 >= groundY - 1) ||
    // Consider the penguin stopped if it has sunk below the ground and is moving slowly
    (penguinSunk && speed < 2.0 && currentPos.y > groundY + PENGUIN_RADIUS);

  // Check if penguin is moving very slowly but not completely stopped
  const isMovingSlowly = speed < 1.5 && !penguinHasStopped;

  // Check if penguin is barely moving at all (almost static)
  const isAlmostStatic = speed < 0.2;

  // If penguin is almost static and not on the ground, remove it
  if (isAlmostStatic && currentPos.y + PENGUIN_RADIUS * 2 < groundY - 5) {
    penguinClone.remove();
    activePenguinClone = null;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    if (debugMode) {
      console.log("Penguin clone removed: Almost static in mid-air");
    }

    // Reset launch timestamp to allow new launches
    penguinLastLaunchedTimestamp = 0;
    slowMovementTime = 0;

    // Make original penguin visible again
    penguin.style.opacity = "1";

    // Call switchToNextPenguin if no switch is in progress
    if (!isPenguinSwitchInProgress) {
      switchToNextPenguin();
    }
    return;
  }

  if (isMovingSlowly) {
    // Increment the slow movement timer
    slowMovementTime += deltaTime;

    // If penguin has been moving slowly for too long, remove it
    if (slowMovementTime > MAX_SLOW_MOVEMENT_TIME) {
      penguinClone.remove();
      activePenguinClone = null;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      if (debugMode) {
        console.log("Penguin clone removed: Moving slowly for too long");
      }

      // Reset launch timestamp to allow new launches
      penguinLastLaunchedTimestamp = 0;
      slowMovementTime = 0;

      // Make original penguin visible again
      penguin.style.opacity = "1";

      // Call switchToNextPenguin if no switch is in progress
      if (!isPenguinSwitchInProgress) {
        switchToNextPenguin();
      }
      return;
    }
  } else {
    // Reset the slow movement timer if penguin is moving normally
    slowMovementTime = 0;
  }

  const timeSinceLastLaunch = performance.now() - penguinLastLaunchedTimestamp;

  if (timeSinceLastLaunch > RESET_IN_FROM_LAUNCH) {
    // Penguin has been idle for more than 1 second, remove it
    penguinClone.remove();
    activePenguinClone = null;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;

    // Reset launch timestamp to allow new launches
    penguinLastLaunchedTimestamp = 0;

    // Make original penguin visible again
    penguin.style.opacity = "1";

    // Call switchToNextPenguin if no switch is in progress
    if (!isPenguinSwitchInProgress) {
      switchToNextPenguin();
    }
  }

  // Check if the penguin has sunk below the ground
  if (penguinSunk) {
    // Penguin has sunk - fade out without the upward bounce
    penguinClone.style.transition = "opacity 1s";
    penguinClone.style.opacity = "0";

    // Cancel the animation frame
    cancelAnimationFrame(animationFrameId);

    animationFrameId = null;

    // Create some bubbles or particles for sinking effect
    createSinkingEffect(currentPos.x + PENGUIN_RADIUS, currentPos.y);

    // Remove the clone after the animation completes
    setTimeout(() => {
      penguinClone.remove();
      activePenguinClone = null;

      // Reset launch timestamp to allow new launches
      penguinLastLaunchedTimestamp = 0;

      // Make original penguin visible again
      penguin.style.opacity = "1";

      // Call switchToNextPenguin if no switch is in progress
      if (!isPenguinSwitchInProgress) {
        switchToNextPenguin();
      }
    }, 1000);
  } else if (penguinHasStopped) {
    // Penguin has stopped on the ground, add a sinking animation
    penguinClone.style.transition = "transform 1s, opacity 1s";
    penguinClone.style.opacity = "0";
    penguinClone.style.transform = `translate(${currentPos.x}px, ${
      currentPos.y + 30
    }px)`;

    // Cancel the animation frame
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;

    // Remove the clone after the animation completes
    setTimeout(() => {
      penguinClone.remove();
      activePenguinClone = null;

      // Reset launch timestamp to allow new launches
      penguinLastLaunchedTimestamp = 0;

      // Make original penguin visible again
      penguin.style.opacity = "1";

      // Call switchToNextPenguin if no switch is in progress
      if (!isPenguinSwitchInProgress) {
        switchToNextPenguin();
      }
    }, 1000);
  }

  // Continue animation
  animationFrameId = requestAnimationFrame(updatePhysics);
}

// Function to create a sinking effect with bubbles when penguin sinks
function createSinkingEffect(x, y) {
  // Play sinking sound
  playSound("sinking");

  for (let i = 0; i < 5; i++) {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.style.left = `${x + (Math.random() * 20 - 10)}px`;
    bubble.style.top = `${y + Math.random() * 10}px`;
    bubble.style.width = `${Math.random() * 10 + 5}px`;
    bubble.style.height = bubble.style.width;
    bubble.style.opacity = "0.7";
    document.getElementById("game-area").appendChild(bubble);

    // Animate the bubble rising and fading
    setTimeout(() => {
      bubble.style.transition = "top 1s ease-out, opacity 1s ease-out";
      bubble.style.top = `${y - 50 - Math.random() * 20}px`;
      bubble.style.opacity = "0";

      // Remove the bubble after animation
      setTimeout(() => {
        bubble.remove();
      }, 1000);
    }, Math.random() * 500);
  }
}

function switchToNextPenguin() {
  // TODO: this is not working as expected, disable it for now
  return;

  // Set flag to prevent multiple simultaneous calls
  isPenguinSwitchInProgress = true;

  penguinsAvailable--;

  if (penguinsAvailable > 0) {
    // Move the waiting penguin to the slingshot
    waitingPenguin.classList.remove("jumping");

    // Animate the waiting penguin moving to the slingshot
    const slingshotRect = slingshot.getBoundingClientRect();
    const waitingPenguinRect = waitingPenguin.getBoundingClientRect();

    // Get the current penguin emoji from the waiting penguin
    const waitingPenguinDiv = waitingPenguin.querySelector(".js-penguin-emoji");
    const currentPenguinEmoji = waitingPenguinDiv
      ? waitingPenguinDiv.textContent
      : "🐧";

    // Create a clone of the waiting penguin for animation
    const penguinClone = document.createElement("div");
    penguinClone.className = "js-penguin-clone";
    penguinClone.style.position = "absolute";
    penguinClone.style.transform = `translate(${waitingPenguinRect.left}px, ${waitingPenguinRect.top}px)`;
    penguinClone.style.transition = "all 0.5s ease-in-out";
    penguinClone.style.zIndex = "5";
    penguinClone.style.fontSize = "35px";

    // Add the penguin emoji with face-right class
    const penguinDiv = document.createElement("div");
    penguinDiv.style.transform = "scaleX(-1)";
    penguinDiv.style.display = "inline-block";
    penguinDiv.textContent = currentPenguinEmoji;
    penguinClone.appendChild(penguinDiv);

    document.getElementById("game-area").appendChild(penguinClone);

    // Hide the original waiting penguin
    waitingPenguin.style.opacity = "0";

    // Create a new waiting penguin that will jump in from the left
    const newWaitingPenguin = document.createElement("div");
    newWaitingPenguin.className = "js-waiting-penguin-clone";
    newWaitingPenguin.style.position = "absolute";
    newWaitingPenguin.style.fontSize = "35px";
    newWaitingPenguin.style.zIndex = "2";
    // Position it at the same vertical position but off-screen to the left
    newWaitingPenguin.style.position = "absolute";
    newWaitingPenguin.style.left = "calc(18% - 20px)";
    newWaitingPenguin.style.bottom = "20%";
    newWaitingPenguin.style.transform = "translateX(-80px)";
    newWaitingPenguin.style.opacity = "0"; // Start hidden

    // Select a new random emoji for the next waiting penguin
    const randomPenguinType =
      PENGUIN_TYPES[Math.floor(Math.random() * PENGUIN_TYPES.length)];

    // Add the penguin emoji with face-right class
    const newPenguinDiv = document.createElement("div");
    newPenguinDiv.className = "js-penguin-emoji face-right";
    newPenguinDiv.textContent = randomPenguinType.emoji;
    newWaitingPenguin.appendChild(newPenguinDiv);

    document.getElementById("game-area").appendChild(newWaitingPenguin);

    // Animate the clone to the slingshot position - make it jump in an arc
    setTimeout(() => {
      // Add the jumping animation class
      penguinClone.classList.add("penguin-jumping");
      // Use transform to handle the horizontal movement
      penguinClone.style.transition =
        "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      penguinClone.style.transform = `translate(${restPosition.x}px, ${waitingPenguinRect.top}px)`;

      // Play a jump sound
      playSound("stretch");

      // After the jumping animation plays, position at the final location
      setTimeout(() => {
        penguinClone.classList.remove("penguin-jumping");
        penguinClone.style.transition = "transform 0.2s ease-in";
        penguinClone.style.transform = `translate(${restPosition.x}px, ${restPosition.y}px)`;
      }, 450);
    }, 50);

    // Animate the new waiting penguin to the waiting penguin position
    // We delay this animation until the first penguin has started moving toward the slingshot
    setTimeout(() => {
      newWaitingPenguin.style.opacity = "1"; // Make it visible
      newWaitingPenguin.classList.add("jump-in-from-left");
      // Remove the initial transform to allow the animation to work
      newWaitingPenguin.style.transform = "";

      // Play another jump sound with a slight delay
      setTimeout(() => {
        playSound("stretch");
      }, 100);
    }, 300);

    // After animation completes, reset the penguin
    setTimeout(() => {
      // Remove the clone
      penguinClone.remove();

      // Remove the new waiting penguin clone
      newWaitingPenguin.remove();

      // Reset penguin
      resetPenguin();

      // Reset waiting penguin content with the new emoji
      waitingPenguin.style.display = "block";
      waitingPenguin.style.opacity = "1";
      waitingPenguin.classList.add("jumping");

      // Set the waiting penguin content to the new emoji
      const waitingPenguinEmoji =
        waitingPenguin.querySelector(".js-penguin-emoji");
      if (waitingPenguinEmoji) {
        waitingPenguinEmoji.textContent = randomPenguinType.emoji;
      }

      // Reset the penguin switch in progress flag
      isPenguinSwitchInProgress = false;
    }, 650);

    // Select a new random enemy for the next waiting penguin
    const penguinEmoji = penguin.querySelector(".js-penguin-emoji");
    penguinEmoji.textContent = currentPenguinEmoji;
  } else {
    // No more enemies - check if all enemies are hit
    const allEnemiesHit = enemies.every((enemy) => enemy.isHit);
    if (!allEnemiesHit) {
      // Not all enemies hit - game over
      showGameOver("Game Over!");
    }

    // Reset the penguin switch in progress flag even when we're out of penguins
    isPenguinSwitchInProgress = false;
  }
}

function showGameOver(message) {
  // Ensure game is unpaused when showing game over
  gamePaused = false;
  document.getElementById("pause-overlay").style.display = "none";

  // For the last enemy, add a delay before stopping the animation
  if (enemiesInWave === 0 && message === "Game Over!") {
    // Show the game over screen immediately
    displayGameOverScreen(message);

    // But continue the animation for a while to let the enemy fall
    setTimeout(() => {
      // Now cancel the animation frame if it's still running
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      // Clear game animation as well
      if (gameAnimationFrameId) {
        cancelAnimationFrame(gameAnimationFrameId);
        gameAnimationFrameId = null;
      }
      // Reset the gameEnding flag
      gameEnding = false;
    }, 2500);
  } else {
    // No animation continuation for win or other scenarios
    displayGameOverScreen(message);

    // Cancel both animations
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (gameAnimationFrameId) {
      cancelAnimationFrame(gameAnimationFrameId);
      gameAnimationFrameId = null;
    }
  }
}

function displayGameOverScreen(message) {
  // Update the game over overlay
  const gameOverOverlay = document.getElementById("game-over-overlay");
  const gameOverContent = document.getElementById("game-over-content");
  const finalScore = document.getElementById("final-score");
  const finalWave = document.getElementById("final-wave");

  // Set the message and score
  gameOverContent.querySelector("h1").textContent = message;
  finalScore.textContent = score;
  finalWave.textContent = currentWave;

  // Show the overlay with some transparency to see the enemy falling
  if (gameEnding) {
    gameOverOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // More transparent
  } else {
    gameOverOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)"; // Original opacity
  }

  // Show the overlay
  gameOverOverlay.style.display = "flex";

  // Set game over flag
  gameOver = true;
}

function resetPositions() {
  // Recalculate positions for all game elements
  const gameArea = document.getElementById("game-area");
  const gameRect = gameArea.getBoundingClientRect();

  // Reset penguin position
  const slingshotRect = slingshot.getBoundingClientRect();
  restPosition = {
    x: slingshotRect.left + slingshotRect.width / 2 - penguin.offsetWidth / 2,
    y: slingshotRect.top - penguin.offsetHeight + 10,
  };

  // Only update penguin position if it's not launched
  if (!penguinLastLaunchedTimestamp) {
    penguin.style.transform = `translate(${restPosition.x}px, ${restPosition.y}px)`;
    currentPos = { x: restPosition.x, y: restPosition.y };
  }

  // Reposition enemies based on new window size
  const groundHeight = gameRect.height * 0.2;
  const availableHeight = gameRect.height - groundHeight;

  enemies.forEach((enemy, index) => {
    if (!enemy.isHit) {
      // Calculate new positions based on relative positions
      let newX, newY;

      switch (index % 5) {
        case 0:
          newX = gameRect.width * 0.6;
          newY = availableHeight * 0.8;
          break;
        case 1:
          newX = gameRect.width * 0.7;
          newY = availableHeight * 0.7;
          break;
        case 2:
          newX = gameRect.width * 0.8;
          newY = availableHeight * 0.9;
          break;
        case 3:
          newX = gameRect.width * 0.7;
          newY = availableHeight * 0.5;
          break;
        case 4:
          newX = gameRect.width * 0.85;
          newY = availableHeight * 0.6;
          break;
      }

      // Update enemy position
      enemy.element.style.transform = `translate(${newX}px, ${newY}px)`;
      enemy.position = { x: newX, y: newY };
    }
  });
}

function resetPenguin() {
  // Recalculate the slingshot position every time we reset
  // This ensures the penguin is always positioned correctly
  const slingshotRect = slingshot.getBoundingClientRect();
  restPosition = {
    x: slingshotRect.left + slingshotRect.width / 2 - penguin.offsetWidth / 2,
    y: slingshotRect.top - penguin.offsetHeight + 10, // Add a small overlap
  };

  // Reset penguin position to the slingshot
  penguin.style.transform = `translate(${restPosition.x}px, ${restPosition.y}px)`;

  // Make penguin visible again
  penguin.style.opacity = "1";

  // Reset physics variables
  currentPos = { x: restPosition.x, y: restPosition.y };
  velocity = { x: 0, y: 0 };
  penguinLastLaunchedTimestamp = 0;
  slowMovementTime = 0; // Reset slow movement timer

  // Clear any stored drag distance
  lastDragDistance = null;

  const penguinEmoji = penguin.querySelector(".js-penguin-emoji");
  // Make sure penguin is facing right at reset
  penguinEmoji.classList.add("face-right");

  // Add animation to the penguin in the slingshot
  penguin.classList.add("slingshot-penguin-animate");

  // Update favicon to match penguin direction
  updateFaviconDirection();

  // Hide slingshot bands and touch marker
  slingshotBandLeft.style.display = "none";
  slingshotBandRight.style.display = "none";
  touchMarker.style.display = "none";

  // Cancel any ongoing penguin animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Remove any active penguin clone
  const penguinClones = document.querySelectorAll(".js-penguin-clone");
  penguinClones.forEach((penguinClone) => {
    penguinClone.remove();
    penguinCloneCount--;
  });
}

function restartGame() {
  // TODO: fix, now the reset is broken
  window.location.reload();
  return;

  // Hide game over overlay and ensure game is unpaused
  document.getElementById("game-over-overlay").style.display = "none";
  document.getElementById("pause-overlay").style.display = "none";
  gamePaused = false;

  // Cancel any ongoing animations
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }

  // Reset penguin
  resetPenguin();

  // Reset waiting penguin
  waitingPenguin.style.display = "block";
  waitingPenguin.style.opacity = "1";
  waitingPenguin.classList.add("jumping");

  // Make sure the waiting enemy's div has the correct transform
  const waitingPenguinDiv = waitingPenguin.querySelector(".js-penguin-emoji");
  // Select a random water-related enemy
  const randomEnemyType =
    ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];

  if (waitingPenguinDiv) {
    waitingPenguinDiv.style.transform = "scaleX(-1)";
    waitingPenguinDiv.style.display = "inline-block";
    waitingPenguinDiv.textContent = randomEnemyType.emoji;
  } else {
    // If the div doesn't exist for some reason, recreate it
    waitingPenguin.innerHTML = `<div class="js-penguin-emoji face-right">${randomEnemyType.emoji}</div>`;
  }

  applyRandomJumpDelay();

  // Reset level to 1 when restarting the game
  currentLevel = 1;

  // Create new enemies
  createEnemies();

  // Reset score and enemies
  score = 0;
  enemiesInWave = ENEMIES_BASE_COUNT;
  gameOver = false;
  gameEnding = false;
  document.getElementById("score").textContent = score;
}

function toggleDebug() {
  const debugPanel = document.getElementById("debug-panel");
  const debugButton = document.getElementById("debug-toggle");

  debugMode = !debugMode;

  if (debugMode) {
    debugPanel.style.display = "block";
    debugButton.textContent = "Hide Debug";
  } else {
    debugPanel.style.display = "none";
    debugButton.textContent = "Show Debug";
  }
}

function updateDebugInfo() {
  if (debugMode) {
    const debugPanel = document.getElementById("debug-panel");
    const gameRect = document
      .getElementById("game-area")
      .getBoundingClientRect();
    const penguinRect = penguin.getBoundingClientRect();

    const debugInfo = `
              Viewport: ${window.innerWidth}x${window.innerHeight}<br>
              Game Area: ${gameRect.width.toFixed(0)}x${gameRect.height.toFixed(
      0
    )}<br>
              Penguin Pos: (${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(
      1
    )})<br>
              Velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})<br>
              Penguin State: ${
                penguinLastLaunchedTimestamp ? "Launched" : "Ready"
              }<br>
              Enemies Left: ${enemiesInWave}/${enemies.length}<br>
              Current Level: ${currentLevel} (${
      DIFFICULTY_LEVELS[currentDifficulty].name
    })<br>
              Touch Position: (${touchMarker
                .getBoundingClientRect()
                .left.toFixed(0)}, ${touchMarker
      .getBoundingClientRect()
      .top.toFixed(0)})
          `;

    debugPanel.innerHTML = debugInfo;
  }

  requestAnimationFrame(updateDebugInfo);
}

// Function to update touch marker position
function updateTouchMarker(x, y) {
  // Only show touch marker if debug mode is active
  touchMarker.style.display = debugMode ? "block" : "none";
  touchMarker.style.transform = `translate(${x}px, ${y}px)`;
}

// Reusable function to play sound effects
function playSound(soundType) {
  // Skip playing sound if muted
  if (isMuted) return;

  // Randomly select between sound variant 1 or 2
  const soundIndex = Math.random() > 0.5 ? 1 : 2;
  const sound = document.getElementById(`${soundType}-sound-${soundIndex}`);

  if (sound) {
    sound.currentTime = 0;
    sound
      .play()
      .catch((e) => console.log(`Audio play failed for ${soundType}:`, e));
  }
}

// Function to create multiple explosions for a more dramatic effect
function createExplosionEffect(x, y) {
  // Create 3-5 explosions at slightly different positions
  const numExplosions = Math.floor(Math.random() * 3) + 3;

  // Play explosion sound using our reusable function
  playSound("explosion");

  // Add shake effect to game area
  const gameArea = document.getElementById("game-area");
  gameArea.classList.add("shake");

  // Remove shake class after animation completes
  setTimeout(() => {
    gameArea.classList.remove("shake");
  }, 500);

  // Mark explosion as active in favicon
  document.getElementById("favicon").dataset.explosionActive = "true";

  // Update favicon to explosion
  setFavicon("explosion");

  // Reset favicon to penguin after a delay
  setTimeout(() => {
    document.getElementById("favicon").dataset.explosionActive = "false";
    updateFaviconDirection();
  }, 1000);

  for (let i = 0; i < numExplosions; i++) {
    // Random offset from the center - increased for larger targets
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 60;

    // Random size variation - increased for larger targets
    const size = 52.5 + Math.random() * 45;

    // Random delay for each explosion
    const delay = Math.random() * 200;

    // Random rotation
    const rotation = (Math.random() - 0.5) * 40;

    // Create explosion element
    const explosion = document.createElement("div");
    explosion.className = "explosion";
    explosion.textContent = "💥";
    explosion.style.fontSize = `${size}px`;
    explosion.style.transform = `translate(${x + offsetX - size / 2}px, ${
      y + offsetY - size / 2
    }px)`;
    document.getElementById("game-area").appendChild(explosion);

    // Trigger explosion animation with delay
    setTimeout(() => {
      explosion.classList.add("active");
      // Preserve the translation when setting scale and rotation
      explosion.style.transform = `translate(${x + offsetX - size / 2}px, ${
        y + offsetY - size / 2
      }px) scale(2.0) rotate(${rotation}deg)`;
    }, delay);

    // Remove explosion after animation completes
    setTimeout(() => {
      explosion.remove();
    }, delay + 600);
  }
}

// Function to create a hit effect for partial damage
function createHitEffect(x, y, damage) {
  // Create a hit indicator element
  const hitIndicator = document.createElement("div");
  hitIndicator.style.position = "absolute";
  hitIndicator.style.zIndex = "5";
  hitIndicator.style.color = "white";
  hitIndicator.style.fontWeight = "bold";
  hitIndicator.style.fontSize = `${20 + damage * 3}px`;
  hitIndicator.style.textShadow = "0 0 3px red, 0 0 5px firebrick";
  hitIndicator.style.transform = `translate(${x}px, ${y}px)`;
  hitIndicator.style.transition = "all 0.8s ease-out";
  hitIndicator.textContent = damage > 1 ? `${damage}!` : "Hit!";

  document.getElementById("game-area").appendChild(hitIndicator);

  // Animate the hit indicator
  setTimeout(() => {
    hitIndicator.style.transform = `translate(${x}px, ${y - 40}px)`;
    hitIndicator.style.opacity = "0";
  }, 10);

  // Remove the hit indicator after animation
  setTimeout(() => {
    hitIndicator.remove();
  }, 800);

  // Play a hit sound if available
  playSound("hit");
}

// Function to apply a random animation delay to the waiting enemy
function applyRandomJumpDelay() {
  // Apply a random animation delay to make the jumping more natural
  const randomDelay = Math.random() * 1; // Random delay between 0 and 4 seconds
  waitingPenguin.style.animationDelay = `${randomDelay}s`;

  // Also apply a random animation duration for even more variation
  const randomDuration = 3.5 + Math.random(); // Random duration between 3.5 and 4.5 seconds
  waitingPenguin.style.animationDuration = `${randomDuration}s`;
}

// Function to create a trail effect for the falling enemy
function createFallingTrail(x, y) {
  // Only create a trail occasionally
  if (Math.random() > 0.2) return;

  // Create a small particle
  const particle = document.createElement("div");
  particle.style.position = "absolute";
  particle.style.width = "8px";
  particle.style.height = "8px";
  particle.style.borderRadius = "50%";
  particle.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
  particle.style.transform = `translate(${x}px, ${y}px)`;
  particle.style.zIndex = "100";
  particle.style.transition = "all 0.8s ease-out";

  document.getElementById("game-area").appendChild(particle);

  // Animate the particle
  setTimeout(() => {
    particle.style.transform = `translate(${
      x + (Math.random() - 0.5) * 30
    }px, ${y + Math.random() * 50}px)`;
    particle.style.opacity = "0";
  }, 10);

  // Remove the particle after animation
  setTimeout(() => {
    particle.remove();
  }, 800);
}

// Function to handle low velocity collisions with enemies
function handleLowVelocityCollision(enemy, dx, dy, distance) {
  // Calculate bounce direction
  const bounceDirection = {
    x: dx / distance,
    y: dy / distance,
  };

  // Apply a bounce effect proportional to the enemy's size
  // Larger enemies cause stronger bounces
  const bounceForce = 3 * enemy.size;

  // Apply the bounce effect
  velocity.x += bounceDirection.x * bounceForce;
  velocity.y += bounceDirection.y * bounceForce;

  // Make the enemy wobble a bit, with wobble amount proportional to size
  const wobbleAmount = (Math.random() - 0.5) * 20;
  const scaleAmount = 1.1 * enemy.size;
  enemy.element.style.transition = "transform 0.3s ease-in-out";
  enemy.element.style.transform = `rotate(${wobbleAmount}deg) scale(${scaleAmount})`;

  // Reset the penguin's transform after the wobble
  setTimeout(() => {
    enemy.element.style.transform = "rotate(0deg) scale(1)";
  }, 300);
}

function startNextWave() {
  // Increment wave counter
  if (waveInProgress || gameOver) {
    return; // Don't start a new wave if one is already in progress
  }

  // Update wave display
  document.getElementById("wave-number").textContent = currentWave;

  // Calculate number of enemies for this wave
  enemiesInWave = ENEMIES_BASE_COUNT + Math.floor(currentWave / 1.5); // Increase enemies as waves progress

  // Reset penguins available
  penguinsAvailable = enemiesInWave; // Set available penguins to match enemy count

  // Calculate enemy speed for this wave
  enemySpeed = ENEMIES_BASE_SPEED + currentWave * 0.12; // Increase speed as waves progress

  // Set wave in progress flag
  waveInProgress = true;

  // Start spawning enemies
  spawnEnemyWave();

  // Start the game animation loop if it's not already running
  if (!gameAnimationFrameId) {
    gameLastTimestamp = performance.now();
    gameAnimationFrameId = requestAnimationFrame(updateGame);
  }
}

function spawnEnemyWave() {
  // Clear any existing spawn intervals
  if (enemySpawnInterval) {
    clearInterval(enemySpawnInterval);
  }

  // Calculate spawn delay based on wave (faster spawns in later waves)
  const spawnDelay = Math.max(
    ENEMIES_MIN_SPAWN_DELAY,
    ENEMIES_BASE_SPAWN_DELAY - currentWave * 50
  );

  let enemiesSpawned = 0;

  // Set up interval to spawn enemies
  enemySpawnInterval = setInterval(() => {
    if (enemiesSpawned < enemiesInWave && !gameOver) {
      spawnEnemy();
      enemiesSpawned++;
    } else {
      // All enemies spawned or game over
      clearInterval(enemySpawnInterval);
      enemySpawnInterval = null;

      // Check if wave is complete
      checkWaveComplete();
    }
  }, spawnDelay);
}

function spawnEnemy() {
  const gameArea = document.getElementById("game-area");
  const gameRect = gameArea.getBoundingClientRect();
  const seaElement = document.getElementById("sea");
  const seaRect = seaElement.getBoundingClientRect();

  // Create enemy element
  const enemyElement = document.createElement("div");
  enemyElement.className = "enemy";

  // Randomly select an enemy type from the ENEMY_TYPES array
  const enemyTypeIndex = Math.floor(Math.random() * ENEMY_TYPES.length);
  const enemyType = ENEMY_TYPES[enemyTypeIndex];

  // Set the emoji content
  enemyElement.textContent = enemyType.emoji;

  // Apply more dramatic size variation (±50% of the base size)
  const sizeVariation = 0.5 + Math.random() * 1.0; // 0.5 to 1.5
  const finalSize = enemyType.size * sizeVariation;

  // Apply the size to the element
  enemyElement.style.fontSize = `${35 * finalSize}px`;

  // Set initial position - start from right side of screen
  const x = gameRect.width;

  // Calculate the sea's top position and the 100px area above it
  const seaHeight = seaRect.height - 100;
  const seaTop = seaRect.top;
  const spawnAreaTop = Math.max(0, seaTop); // Don't go above the game area
  const spawnAreaHeight = seaHeight + (seaTop - spawnAreaTop);

  // Random y position within sea + 100px above
  const y = spawnAreaTop + Math.random() * spawnAreaHeight;

  enemyElement.style.transform = `translate(${x}px, ${y}px)`;

  // Add to game area
  gameArea.appendChild(enemyElement);

  // Add to enemies array
  enemies.push({
    element: enemyElement,
    position: { x, y },
    speed: enemySpeed * (0.7 + Math.random() * 0.6), // More speed variation (0.7 to 1.3)
    isHit: false,
    type: enemyType.emoji,
    points: enemyType.points,
    size: finalSize, // Store the size for collision detection
    hitPoints: Math.ceil(finalSize * 2), // Larger enemies have more hit points
    maxHitPoints: Math.ceil(finalSize * 2), // Store the max hit points for damage calculation
  });

  // Start animation loop if not already running
  if (!gameAnimationFrameId && !penguinLastLaunchedTimestamp) {
    gameLastTimestamp = performance.now();
    gameAnimationFrameId = requestAnimationFrame(updateGame);
  }
}

function updateGame(timestamp) {
  // Don't update if game is paused
  if (gamePaused) {
    gameAnimationFrameId = requestAnimationFrame(updateGame);
    return;
  }

  // Calculate elapsed time
  const deltaTime = timestamp - gameLastTimestamp;
  gameLastTimestamp = timestamp;

  // Scale time factor to keep physics consistent regardless of frame rate
  const timeScale = deltaTime / 16; // Normalized to 60fps

  // Update enemy positions
  updateEnemies(timeScale);

  // Check for base collisions
  checkBaseCollisions();

  // Continue animation
  gameAnimationFrameId = requestAnimationFrame(updateGame);
}

function updateEnemies(timeScale) {
  const gameRect = document.getElementById("game-area").getBoundingClientRect();
  const baseRect = document.getElementById("base").getBoundingClientRect();

  enemies.forEach((enemy) => {
    if (!enemy.isHit) {
      // Move enemy from right to left
      enemy.position.x -= enemy.speed * timeScale;

      // Update enemy position
      enemy.element.style.transform = `translate(${enemy.position.x}px, ${enemy.position.y}px)`;

      // Check if enemy has reached the base
      if (enemy.position.x <= baseRect.right) {
        // Enemy reached the base - mark as hit and damage base
        enemy.isHit = true;
        enemy.element.style.opacity = "0";

        // Damage the base
        damageBase(BASE_DAMAGE_PER_ENEMY);

        // Create explosion at base edge
        createExplosionEffect(baseRect.right, enemy.position.y);
      }

      // Check if enemy is off screen to the left
      if (enemy.position.x < -50) {
        enemy.isHit = true;
        enemy.element.style.display = "none";
      }
    }
  });

  // Check if wave is complete
  checkWaveComplete();
}

function checkBaseCollisions() {
  // This function is called by updateGame to check if enemies have reached the base
  // The actual collision detection is done in updateEnemies
}

function damageBase(damage) {
  // Reduce base health
  baseHealth = Math.max(0, baseHealth - damage);

  // Update health bar
  const healthBar = document.getElementById("health-bar");
  healthBar.style.width = `${baseHealth}%`;

  // Change color based on health
  if (baseHealth < 25) {
    healthBar.style.backgroundColor = "#FF4500"; // Red
  } else if (baseHealth < 50) {
    healthBar.style.backgroundColor = "#FFA500"; // Orange
  }

  // Add damage animation to base
  const base = document.getElementById("base");
  base.classList.add("base-damage");

  // Remove animation class after it completes
  setTimeout(() => {
    base.classList.remove("base-damage");
  }, 500);

  // Check if base is destroyed
  if (baseHealth <= 0) {
    // Game over - base destroyed
    showGameOver("Base Destroyed!");
  }
}

function checkWaveComplete() {
  // Check if all enemies are hit or off screen
  const allEnemiesProcessed = enemies.every((enemy) => enemy.isHit);

  // If all enemies are processed and no more spawning, wave is complete
  if (allEnemiesProcessed && !enemySpawnInterval && waveInProgress) {
    waveInProgress = false;

    // Start next wave after delay
    setTimeout(() => {
      currentWave++;

      // Update wave display with animation
      const waveContainer = document.getElementById("wave-container");
      document.getElementById("wave-number").textContent = currentWave;
      waveContainer.classList.add("wave-transition");

      // Remove animation class after it completes
      setTimeout(() => {
        waveContainer.classList.remove("wave-transition");
      }, 1000);

      // Start the next wave
      startNextWave();
    }, 3000);
  }
}

function pauseGame() {
  if (gameOver) return; // Don't pause if game is already over

  gamePaused = true;
  document.getElementById("pause-overlay").style.display = "flex";

  // When pausing, we keep the animation loops running but they effectively do nothing
  // This makes it easy to resume without having to manually restart the loops
}

function resumeGame() {
  gamePaused = false;
  document.getElementById("pause-overlay").style.display = "none";

  // Update timestamps to prevent large time jumps when resuming
  if (animationFrameId) {
    penguinLastTimestamp = performance.now();
  }
  if (gameAnimationFrameId) {
    gameLastTimestamp = performance.now();
  }
}

// Toggle mute function for audio
function toggleMute() {
  isMuted = !isMuted;
  const muteButton = document.getElementById("mute-button");

  // Update button icon: 🔇 for muted, 🔊 for unmuted
  muteButton.textContent = isMuted ? "🔇" : "🔊";
}
