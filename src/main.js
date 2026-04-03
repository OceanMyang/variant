import Phaser from "phaser";
import { SpinePlugin } from "@esotericsoftware/spine-phaser-v4";
import { Hero } from "./hero";
import {
  VIEW_W,
  VIEW_H,
  WORLD_H,
  WALL_W,
  CHUNK_H,
  CHUNKS_AHEAD,
  CHUNKS_BEHIND,
  ROCK_LENGTH,
  ROCK_THICKNESS,
  ROCK_GAP,
  CAT_WALL,
  CAT_RAGDOLL,
  CAT_FLOOR,
  MOVE_FORCE,
  P_KATANA,
  P_GEYSER,
  P_CHICKEN,
  P_DRESS,
  P_SKATEBOARD,
  SKATE_ARROW_SPEED,
  SKATE_SPAWN_INTERVAL,
  SKATE_HIT_WINDOW_PX,
  ITEM_THRESHOLD,
} from "./global";

class FallScene extends Phaser.Scene {
  constructor() {
    super({ key: "FallScene" });
    this.hero = null;
    this.survivedTime = 0;
    this.isGameOver = false;
    this.generatedChunks = new Map();
    this.lastChunkIndex = -1;
    this.waterZones = [];
    this.rainZones = [];
    this.skateArrows = []; // { side, y, textObj }
    this.skateSpawnTimer = 0;
    this.skateSpawnRate = 1;
    this.skateReceptorY = 0;
    this.skateVisual = null;
  }

  preload() {
    this.load.spineJson("man", "/spine/man/skeleton.json");
    this.load.spineAtlas("manAtlas", "/spine/man/skeleton.atlas", true);
    this.load.image("chicken", "/spine/man/skeleton_12.png");
    this.load.image("katana", "/spine/man/skeleton_14.png");
    this.load.spritesheet("geyser", "/spine/man/skeleton_9.png", {
      frameWidth: 149,
      frameHeight: 351,
    });
    this.load.image("raindrop", "/spine/man/skeleton_4.png");
    this.load.image("dress", "/spine/man/skeleton_6.png");
    this.load.image("skateboard", "/spine/man/skeleton_2.png");
  }

  create() {
    // --- Cliff walls (visual) ---
    this._drawCliffWall("left");
    this._drawCliffWall("right");

    // --- Walls (physics) ---
    const wallFilter = { category: CAT_WALL, mask: CAT_RAGDOLL };
    this.matter.add.rectangle(0, WORLD_H / 2, WALL_W, WORLD_H, {
      isStatic: true,
      label: "wall",
      collisionFilter: wallFilter,
    });
    this.matter.add.rectangle(VIEW_W, WORLD_H / 2, WALL_W, WORLD_H, {
      isStatic: true,
      label: "wall",
      collisionFilter: wallFilter,
    });

    // --- Floor ---
    this.add.rectangle(VIEW_W / 2, WORLD_H - 5, VIEW_W, 10, 0x555577);
    this.matter.add.rectangle(VIEW_W / 2, WORLD_H - 5, VIEW_W, 10, {
      isStatic: true,
      label: "floor",
      collisionFilter: { category: CAT_FLOOR, mask: CAT_RAGDOLL },
    });

    // --- Hero ---
    this.hero = new Hero(this, VIEW_W / 2, 200);

    // --- Collision events ---
    this.matter.world.on("collisionstart", (event) => {
      if (this.isGameOver) return;
      if (this.hero?.isWearingDress) return;
      if (this.hero?.isSkateboarding) return;
      if (this.isEating) return;
      if (this.isGrabbing) return;
      for (const pair of event.pairs) {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;

        // Floor = game over
        if (
          (a === "floor" && this.hero.ownsLabel(b)) ||
          (b === "floor" && this.hero.ownsLabel(a))
        ) {
          this.endGame(a === "head" || b === "head");
          break;
        }

        // Chicken = eat animation
        if (
          (a === "chicken" && this.hero.ownsLabel(b)) ||
          (b === "chicken" && this.hero.ownsLabel(a))
        ) {
          const chickenBody = a === "chicken" ? pair.bodyA : pair.bodyB;
          this._collectChicken(chickenBody);
          break;
        }

        // Katana = grab
        if (
          (a === "katana" && this.hero.ownsLabel(b)) ||
          (b === "katana" && this.hero.ownsLabel(a))
        ) {
          const katanaBody = a === "katana" ? pair.bodyA : pair.bodyB;
          this._collectKatana(katanaBody);
          break;
        }

        // Dress = wear
        if (
          !this.hero.isWearingDress &&
          ((a === "dress" && this.hero.ownsLabel(b)) ||
            (b === "dress" && this.hero.ownsLabel(a)))
        ) {
          const dressBody = a === "dress" ? pair.bodyA : pair.bodyB;
          this._collectDress(dressBody);
          break;
        }

        // Skateboard = rhythm mini-game
        if (
          !this.hero.isSkateboarding &&
          ((a === "skateboard" && this.hero.ownsLabel(b)) ||
            (b === "skateboard" && this.hero.ownsLabel(a)))
        ) {
          const skateBody = a === "skateboard" ? pair.bodyA : pair.bodyB;
          this._collectSkateboard(skateBody);
          break;
        }
      }
    });

    this.matter.world.on("collisionactive", (event) => {
      if (this.isGameOver || this.hero.isGrabbing || this.hero.isEating) return;
      const M = Phaser.Physics.Matter.Matter;
      for (const pair of event.pairs) {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;
        if (
          (a === "geyser" && this.hero.ownsLabel(b)) ||
          (b === "geyser" && this.hero.ownsLabel(a))
        ) {
          const waterBody = a === "geyser" ? pair.bodyA : pair.bodyB;
          if (waterBody.geyserSide === "left") {
            M.Body.setVelocity(this.hero.torsoBody, {
              x: 5,
              y: this.hero.torsoBody.velocity.y / 2,
            });
          } else if (waterBody.geyserSide === "right") {
            M.Body.setVelocity(this.hero.torsoBody, {
              x: -5,
              y: this.hero.torsoBody.velocity.y / 2,
            });
          }
        }
      }
    });

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, VIEW_W, WORLD_H);

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.isGameOver) return;
      if (this.hero?.isGrabbing) {
        this.hero.onSpacePressed();
        return;
      }
      if (this.matter.world.enabled) {
        this.matter.world.pause();
        this.time.paused = true;
        this.tweens.pauseAll();
        if (this.hero?.spine) this.hero.spine.animationState.timeScale = 0;
        this.pauseText.setVisible(true);
      } else {
        this.matter.world.resume();
        this.time.paused = false;
        this.tweens.resumeAll();
        if (this.hero?.spine) this.hero.spine.animationState.timeScale = 1;
        this.pauseText.setVisible(false);
      }
    });

    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.hero?.isSkateboarding) this._onSkateKey("left");
    });
    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.hero?.isSkateboarding) this._onSkateKey("right");
    });

    // --- UI ---
    this.timerText = this.add
      .text(VIEW_W / 2, 20, "", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50);

    this.gameOverText = this.add
      .text(VIEW_W / 2, VIEW_H / 2 - 40, "", {
        fontSize: "48px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.gameOverSubText = this.add
      .text(VIEW_W / 2, VIEW_H / 2 + 40, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.pauseText = this.add
      .text(VIEW_W / 2, VIEW_H / 2, "PAUSED", {
        fontSize: "48px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Circular stamina bar shown while grabbing katana
    this.staminaGraphics = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    this.staminaLabel = this.add
      .text(0, 0, "SPACE", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(61)
      .setVisible(false);

    // FNF-style arrow rhythm UI for skateboard
    const receptorStyle = {
      fontSize: "52px",
      color: "#223355",
      stroke: "#000000",
      strokeThickness: 3,
      fontFamily: "system-ui, sans-serif",
    };
    this.skateLeftReceptor = this.add
      .text(0, 0, "←", receptorStyle)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(62)
      .setVisible(false);
    this.skateRightReceptor = this.add
      .text(0, 0, "→", receptorStyle)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(62)
      .setVisible(false);

    this.skateRoundText = this.add
      .text(0, 0, "", {
        fontSize: "18px",
        color: "#ffdd44",
        fontFamily: "system-ui, sans-serif",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(61)
      .setVisible(false);

    this.updateChunks();
  }

  // ==================== CLIFF WALLS ====================

  _drawCliffWall(side) {
    const g = this.add.graphics();
    g.setDepth(5);
    g.fillStyle(0x333355, 1);

    const stepH = 30;
    const steps = Math.ceil(WORLD_H / stepH) + 1;
    const maxJag = 18;
    const minJag = 4;

    const points = [];
    for (let i = 0; i <= steps; i++) {
      const y = i * stepH;
      const jag = Phaser.Math.Between(minJag, maxJag);
      const x = side === "left" ? jag : VIEW_W - jag;
      points.push({ x, y });
    }

    g.beginPath();
    if (side === "left") {
      g.moveTo(0, 0);
      for (const p of points) g.lineTo(p.x, p.y);
      g.lineTo(0, WORLD_H);
    } else {
      g.moveTo(VIEW_W, 0);
      for (const p of points) g.lineTo(p.x, p.y);
      g.lineTo(VIEW_W, WORLD_H);
    }
    g.closePath();
    g.fillPath();

    g.lineStyle(2, 0x222244, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();
  }

  // ==================== CHUNKS ====================

  generateChunk(chunkIndex) {
    if (this.generatedChunks.has(chunkIndex)) return;
    const objects = [];
    const chunkTop = chunkIndex * CHUNK_H;
    const chunkBottom = chunkTop + CHUNK_H;

    if (chunkIndex <= 0 || chunkTop >= WORLD_H - 50) {
      this.generatedChunks.set(chunkIndex, objects);
      return;
    }

    let y = chunkTop + Phaser.Math.Between(50, ROCK_GAP);
    while (y < chunkBottom - 50 && y < WORLD_H - ITEM_THRESHOLD) {
      const fromLeft = Math.random() > 0.5;
      const angleDeg = Phaser.Math.Between(10, 35);
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const startX = fromLeft ? WALL_W : VIEW_W - WALL_W;
      const dx = (fromLeft ? 1 : -1) * Math.cos(angleRad) * ROCK_LENGTH;
      const dy = Math.sin(angleRad) * ROCK_LENGTH;
      const cx = startX + dx / 2;
      const cy = y + dy / 2;
      const rotation = fromLeft ? angleRad : Math.PI - angleRad;

      const spikeW = Phaser.Math.Between(30, 200);
      const spikeH = Phaser.Math.Between(120, 500);
      const tipOffset = Phaser.Math.Between(spikeH * 0.2, spikeH * 0.8);

      const rootX = fromLeft ? 0 : VIEW_W;
      const dir = fromLeft ? 1 : -1;

      const p0 = { x: rootX, y: y };
      const p1 = { x: rootX + dir * spikeW, y: y + tipOffset };
      const p2 = { x: rootX, y: y + spikeH };

      const visual = this.add.graphics();
      visual.setDepth(5);
      visual.fillStyle(0x333355, 1);
      visual.lineStyle(2, 0x555588, 1);
      visual.beginPath();
      visual.moveTo(p0.x, p0.y);
      visual.lineTo(p1.x, p1.y);
      visual.lineTo(p2.x, p2.y);
      visual.closePath();
      visual.fillPath();
      visual.strokePath();

      const tcx = (p0.x + p1.x + p2.x) / 3;
      const tcy = (p0.y + p1.y + p2.y) / 3;

      const rockBody = this.matter.add.fromVertices(tcx, tcy, [p0, p1, p2], {
        isStatic: true,
        label: "rock",
        collisionFilter: { category: CAT_WALL, mask: CAT_RAGDOLL },
      });

      objects.push({ visual, rockBody });
      y += spikeH + Phaser.Math.Between(ROCK_GAP, ROCK_GAP * 2);
    }

    if (Math.random() < P_KATANA) {
      const side = Math.random() < 0.5 ? "left" : "right";
      let ky;
      let attempts = 0;
      do {
        ky = chunkTop + Phaser.Math.Between(200, CHUNK_H - 200);
        attempts++;
      } while (
        attempts < 10 &&
        objects.some(
          (o) =>
            o.rockBody &&
            ky >= o.rockBody.bounds.min.y - 60 &&
            ky <= o.rockBody.bounds.max.y + 60,
        )
      );

      if (ky < WORLD_H - 100) {
        // Anchor image center closer to the handle so blade is mostly inside wall
        const kx = side === "left" ? WALL_W + 20 : VIEW_W - WALL_W - 20;

        // Blade faces wall, handle sticks into playfield
        // Image: handle on left, tip on right at native resolution
        // Left wall  → flip so tip points left (into wall), handle points right
        // Right wall → no flip, tip points right (into wall), handle points left
        const scale = 0.18;
        const angleDeg = side === "left" ? -15 : 15;
        const kVisual = this.add
          .image(kx, ky, "katana")
          .setScale(scale)
          .setAngle(angleDeg)
          .setFlipX(side === "left")
          .setDepth(8);

        const M = Phaser.Physics.Matter.Matter;
        const katanaBody = M.Bodies.rectangle(kx, ky, 180, 20, {
          isStatic: true,
          isSensor: true,
          label: "katana",
          angle: Phaser.Math.DegToRad(angleDeg),
        });
        this.matter.world.add(katanaBody);

        objects.push({ visual: kVisual, katanaBody });
      } // end ky < WORLD_H - 100
    }

    if (Math.random() < P_GEYSER && chunkTop < WORLD_H - 200) {
      const side = Math.random() < 0.5 ? "left" : "right";
      let wy,
        wyAttempts = 0;
      do {
        wy = chunkTop + Phaser.Math.Between(200, CHUNK_H - 200);
        wyAttempts++;
      } while (
        wyAttempts < 10 &&
        objects.some(
          (o) =>
            o.rockBody &&
            wy >= o.rockBody.bounds.min.y - 80 &&
            wy <= o.rockBody.bounds.max.y + 80,
        )
      );
      if (wy < WORLD_H - 100) {
        const burstLen = 160;
        const burstH = 70;
        const startX = side === "left" ? WALL_W : VIEW_W - WALL_W - burstLen;
        const cx = startX + burstLen / 2;

        // After rotating ±90°, the frame's height becomes the visual width on screen.
        // Position center so the source edge sits exactly at the wall.
        const GEYSER_SCALE = 0.9;
        const GEYSER_WIDTH = 120;
        const geyserAngle = side === "left" ? -90 : 90;
        const geyserCX =
          side === "left"
            ? WALL_W + GEYSER_WIDTH * GEYSER_SCALE
            : VIEW_W - WALL_W - GEYSER_WIDTH * GEYSER_SCALE;
        const waterG = this.add
          .sprite(geyserCX, wy, "geyser", 0)
          .setDepth(7)
          .setScale(GEYSER_SCALE)
          .setAngle(geyserAngle - 7);

        let animFrame = 0;
        const waterTimer = this.time.addEvent({
          delay: 150,
          callback: () => {
            animFrame = (animFrame + 1) % 4;
            waterG.setFrame(animFrame);
          },
          loop: true,
        });

        // Raindrop spawner — skeleton_4.png sprites that tween downward and self-destroy
        const rainStartY = wy + burstH / 2;
        const spawnRaindrop = () => {
          if (!waterG.active) return;
          const rd = this.add
            .image(
              cx + Phaser.Math.Between(-burstLen * 1.2, burstLen * 1.2),
              rainStartY,
              "raindrop",
            )
            .setScale(0.15)
            .setDepth(6);
          this.tweens.add({
            targets: rd,
            y: rainStartY + Phaser.Math.Between(400, 700),
            alpha: 0,
            duration: Phaser.Math.Between(1200, 2200),
            ease: "Linear",
            onComplete: () => rd.destroy(),
          });
        };
        const rainTimer = this.time.addEvent({
          delay: 100,
          callback: spawnRaindrop,
          loop: true,
        });

        // Physics sensor collider
        const M = Phaser.Physics.Matter.Matter;
        const geyserBody = M.Bodies.rectangle(geyserCX, wy, 280, 120, {
          isStatic: true,
          isSensor: true,
          label: "geyser",
          collisionFilter: { category: CAT_WALL, mask: CAT_RAGDOLL },
        });
        geyserBody.geyserSide = side;
        this.matter.world.add(geyserBody);

        // Zone bounds for per-frame force checks (no physics body needed)
        const waterZoneData = {
          minX: startX,
          maxX: startX + burstLen,
          minY: wy - burstH / 2,
          maxY: wy + burstH / 2,
          side,
        };
        const rainZoneData = {
          minX: startX - 20,
          maxX: startX + burstLen + 20,
          minY: wy + burstH / 2,
          maxY: wy + burstH / 2 + 500,
        };
        this.waterZones.push(waterZoneData);
        this.rainZones.push(rainZoneData);

        objects.push({
          visual: waterG,
          waterTimer,
          rainTimer,
          geyserBody,
          waterZoneData,
          rainZoneData,
        });
      } // end wy < WORLD_H - 100
    }

    if (Math.random() < P_CHICKEN) {
      const cx = Phaser.Math.Between(WALL_W + 60, VIEW_W - WALL_W - 60);
      const cy = chunkTop + Phaser.Math.Between(200, CHUNK_H - 200);
      if (cy < WORLD_H - 100) {
        const visual = this.add
          .image(cx, cy, "chicken")
          .setScale(0.2)
          .setDepth(8);

        const M = Phaser.Physics.Matter.Matter;
        const chickenBody = M.Bodies.circle(cx, cy, 40, {
          isStatic: true,
          isSensor: true,
          label: "chicken",
        });
        this.matter.world.add(chickenBody);

        objects.push({ visual, chickenBody });
      } // end cy < WORLD_H - 100
    }

    // Dress item
    if (Math.random() < P_DRESS) {
      const cx = Phaser.Math.Between(WALL_W + 60, VIEW_W - WALL_W - 60);
      const cy = chunkTop + Phaser.Math.Between(200, CHUNK_H - 200);
      if (cy < WORLD_H - 100) {
        const visual = this.add
          .image(cx, cy, "dress")
          .setScale(0.12)
          .setDepth(8);

        const M = Phaser.Physics.Matter.Matter;
        const dressBody = M.Bodies.circle(cx, cy, 40, {
          isStatic: true,
          isSensor: true,
          label: "dress",
        });
        this.matter.world.add(dressBody);

        objects.push({ visual, dressBody });
      } // end cy < WORLD_H - 100
    }

    // Skateboard item
    if (Math.random() < P_SKATEBOARD) {
      const cx = Phaser.Math.Between(WALL_W + 80, VIEW_W - WALL_W - 80);
      const cy = chunkTop + Phaser.Math.Between(200, CHUNK_H - 200);
      if (cy < WORLD_H - 100) {
        const g = this.add
          .image(cx, cy, "skateboard")
          .setScale(0.18)
          .setDepth(8);

        const M = Phaser.Physics.Matter.Matter;
        const skateBody = M.Bodies.rectangle(cx, cy, 190, 55, {
          isStatic: true,
          isSensor: true,
          label: "skateboard",
        });
        this.matter.world.add(skateBody);
        objects.push({ visual: g, skateBody });
      }
    }

    this.generatedChunks.set(chunkIndex, objects);
  }

  destroyChunk(chunkIndex) {
    const objects = this.generatedChunks.get(chunkIndex);
    if (!objects) return;
    objects.forEach(
      ({ visual, rockBody, chickenBody, katanaBody, dressBody, skateBody }) => {
        visual.destroy();
        if (rockBody) this.matter.world.remove(rockBody);
        if (chickenBody) this.matter.world.remove(chickenBody);
        if (katanaBody) this.matter.world.remove(katanaBody);
        if (dressBody) this.matter.world.remove(dressBody);
        if (skateBody) this.matter.world.remove(skateBody);
      },
    );
    this.generatedChunks.delete(chunkIndex);
  }

  updateChunks() {
    const currentChunk = Math.floor(this.hero.y / CHUNK_H);
    if (currentChunk === this.lastChunkIndex) return;
    this.lastChunkIndex = currentChunk;

    for (
      let i = currentChunk - CHUNKS_BEHIND;
      i <= currentChunk + CHUNKS_AHEAD;
      i++
    ) {
      this.generateChunk(i);
    }
    for (const [index] of this.generatedChunks) {
      if (index < currentChunk - CHUNKS_BEHIND) this.destroyChunk(index);
    }
  }

  // ==================== UPDATE ====================

  update(_, deltaMs) {
    if (this.isGameOver) return;
    if (!this.matter.world.enabled) return;

    this.survivedTime += deltaMs / 1000;
    this.timerText.setText(`You survived ${this.survivedTime.toFixed(2)}s.\n`);

    if (this.cursors.left.isDown) this.hero.pushLeft(MOVE_FORCE);
    else if (this.cursors.right.isDown) this.hero.pushRight(MOVE_FORCE);

    this.hero.update();
    this.hero.updateGrabbing(deltaMs);
    this._updateStaminaUI();
    this._updateSkateUI(deltaMs);

    this.cameras.main.scrollY = this.hero.y - VIEW_H * 0.4;

    this.updateChunks();
  }

  // ==================== STAMINA UI ====================

  _updateStaminaUI() {
    const grabbing = this.hero.isGrabbing;
    this.staminaGraphics.setVisible(grabbing);
    this.staminaLabel.setVisible(grabbing);
    if (!grabbing) return;

    // Position above the hero in screen space
    const sx = this.hero.x - this.cameras.main.scrollX;
    const sy = this.hero.y - this.cameras.main.scrollY - 220;
    const R = 38;

    this.staminaLabel.setPosition(sx, sy);

    const g = this.staminaGraphics;
    g.clear();

    // Dark background circle
    g.fillStyle(0x000000, 0.55);
    g.fillCircle(sx, sy, R);

    // Background ring
    g.lineStyle(7, 0x444444, 1);
    g.strokeCircle(sx, sy, R);

    // Stamina arc — clockwise from top
    const stamina = this.hero.stamina;
    const color =
      stamina > 0.5 ? 0x44dd88 : stamina > 0.25 ? 0xffaa00 : 0xff3333;
    g.lineStyle(7, color, 1);
    g.beginPath();
    g.arc(
      sx,
      sy,
      R,
      -Math.PI / 2, // start: top
      -Math.PI / 2 + stamina * Math.PI * 2, // end: clockwise
      false,
    );
    g.strokePath();
  }

  // ==================== KATANA ====================

  _collectKatana(katanaBody) {
    // Remove collider but keep visual — hero teleports to it
    this.matter.world.remove(katanaBody);
    const { x, y } = katanaBody.position;
    const side = x < VIEW_W / 2 ? "left" : "right";
    this.hero.startGrabbing(x, y, side);
  }

  // ==================== CHICKEN ====================

  _collectChicken(chickenBody) {
    this.matter.world.remove(chickenBody);
    for (const [, objects] of this.generatedChunks) {
      const idx = objects.findIndex((o) => o.chickenBody === chickenBody);
      if (idx !== -1) {
        objects[idx].visual.destroy();
        objects.splice(idx, 1);
        break;
      }
    }
    this.hero.startEating();
  }

  _collectDress(dressBody) {
    this.matter.world.remove(dressBody);
    for (const [, objects] of this.generatedChunks) {
      const idx = objects.findIndex((o) => o.dressBody === dressBody);
      if (idx !== -1) {
        objects[idx].visual.destroy();
        objects.splice(idx, 1);
        break;
      }
    }
    this.hero.startDress();
  }

  // ==================== SKATEBOARD ====================

  _collectSkateboard(skateBody) {
    this.matter.world.remove(skateBody);
    for (const [, objects] of this.generatedChunks) {
      const idx = objects.findIndex((o) => o.skateBody === skateBody);
      if (idx !== -1) {
        this.skateVisual = objects[idx].visual;
        objects.splice(idx, 1);
        break;
      }
    }
    // Destroy any leftover arrow text objects
    for (const a of this.skateArrows) a.textObj.destroy();
    this.skateArrows = [];
    this.skateSpawnTimer = 0; // spawn first arrow immediately
    this.skateSpawnRate = 1;
    this.hero.startSkateboarding();
  }

  _onSkateKey(side) {
    const idx = this.skateArrows.findIndex(
      (a) =>
        a.side === side &&
        Math.abs(a.y - this.skateReceptorY) <= SKATE_HIT_WINDOW_PX,
    );
    if (idx !== -1) {
      this.skateSpawnRate += 0.1;
      this.skateArrows[idx].textObj.destroy();
      this.skateArrows.splice(idx, 1);
      this.hero.nextSkateRound();
      this.hero.setSide(side);
    } else {
      // Highlight the closest arrow as the mistake
      const closest = this.skateArrows.reduce(
        (best, a) =>
          !best ||
          Math.abs(a.y - this.skateReceptorY) <
            Math.abs(best.y - this.skateReceptorY)
            ? a
            : best,
        null,
      );
      this._skateFail(closest);
    }
  }

  _skateFail(missedArrow = null) {
    this.hero.stopSkateboarding();
    this.skateLeftReceptor.setVisible(false);
    this.skateRightReceptor.setVisible(false);
    this.skateRoundText.setVisible(false);
    if (this.skateVisual) {
      this.skateVisual.destroy();
      this.skateVisual = null;
    }

    // Destroy all arrows except the offending one
    for (const a of this.skateArrows) {
      if (a !== missedArrow) a.textObj.destroy();
    }
    this.skateArrows = [];

    // Red fade-out on the missed/wrong arrow
    if (missedArrow) {
      missedArrow.textObj.setColor("#ff2222");
      this.tweens.add({
        targets: missedArrow.textObj,
        alpha: 0,
        y: missedArrow.textObj.y + 35,
        duration: 500,
        ease: "Power2",
        onComplete: () => missedArrow.textObj.destroy(),
      });
    }
  }

  _updateSkateUI(deltaMs) {
    if (!this.hero?.isSkateboarding) {
      this.skateLeftReceptor.setVisible(false);
      this.skateRightReceptor.setVisible(false);
      this.skateRoundText.setVisible(false);
      if (this.skateVisual) {
        this.skateVisual.destroy();
        this.skateVisual = null;
      }
      return;
    }

    const dt = deltaMs / 1000;

    // Positions relative to skateboard in screen space
    const hsx = this.skateVisual.x - this.cameras.main.scrollX;
    const hsy = this.skateVisual.y - this.cameras.main.scrollY;
    const ry = hsy - 350; // receptor sits above the skateboard
    const lx = hsx - 30;
    const rx = hsx + 30;
    const spawnY = ry - 420; // arrows travel 420px to reach receptor
    this.skateReceptorY = ry;

    // Spawn a new arrow
    this.skateSpawnTimer -= this.skateSpawnRate * dt;
    if (this.skateSpawnTimer <= 0) {
      const side = Math.random() < 0.5 ? "left" : "right";
      const textObj = this.add
        .text(side === "left" ? lx : rx, spawnY, side === "left" ? "←" : "→", {
          fontSize: "52px",
          color: side === "left" ? "#ff4466" : "#44aaff",
          stroke: "#000000",
          strokeThickness: 3,
          fontFamily: "system-ui, sans-serif",
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(62);
      this.skateArrows.push({ side, y: spawnY, textObj });
      this.skateSpawnTimer = SKATE_SPAWN_INTERVAL;
    }

    // Move arrows, update positions and colours
    for (const arrow of this.skateArrows) {
      arrow.y += SKATE_ARROW_SPEED * dt;
      const ax = arrow.side === "left" ? lx : rx;
      arrow.textObj.setPosition(ax, arrow.y);
      const inWindow = Math.abs(arrow.y - ry) <= SKATE_HIT_WINDOW_PX;
      arrow.textObj.setColor(
        inWindow ? "#ffffff" : arrow.side === "left" ? "#ff4466" : "#44aaff",
      );
    }

    // Miss — arrow passed the receptor without a hit
    const missedArrow = this.skateArrows.find(
      (a) => a.y > ry + SKATE_HIT_WINDOW_PX,
    );
    if (missedArrow) {
      this._skateFail(missedArrow);
      return;
    }

    // Keep skateboard sprite under hero feet
    if (this.skateVisual) {
      this.skateVisual.setPosition(this.hero.spine.x, this.hero.spine.y);
    }

    // Receptors
    this.skateLeftReceptor.setPosition(lx, ry).setVisible(true);
    this.skateRightReceptor.setPosition(rx, ry).setVisible(true);

    this.skateRoundText.setVisible(false);
  }

  // ==================== GAME OVER ====================

  endGame(headHit = false) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    if (headHit) {
      this.gameOverText.setText("Oops. You hit your head.\n" + `Score: 0.\n`);
    } else {
      const v = this.hero.torsoBody.velocity.y;
      const score =
        (Math.floor(this.survivedTime * 100) * 10) / Math.max(v, 10);
      this.gameOverText.setText("GAME OVER\n" + `Score: ${score.toFixed(0)}\n`);
      this.gameOverSubText.setText(
        `You hit the ground at ${v.toFixed(2)}m/s.\n` +
          "Stay longer next time!",
      );
    }
    this.gameOverText.setVisible(true);
    this.gameOverSubText.setVisible(true);
  }
}

const config = {
  type: Phaser.WEBGL,
  parent: "app",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: "#1a1a2e",
  scene: [FallScene],
  plugins: {
    scene: [{ key: "SpinePlugin", plugin: SpinePlugin, mapping: "spine" }],
  },
  physics: {
    default: "matter",
    matter: {
      gravity: { y: 1 },
      debug: true,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
