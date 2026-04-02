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
} from "./global";

class FallScene extends Phaser.Scene {
  constructor() {
    super({ key: "FallScene" });
    this.hero = null;
    this.survivalTime = 0;
    this.isGameOver = false;
    this.generatedChunks = new Map();
    this.lastChunkIndex = -1;
  }

  preload() {
    this.load.spineJson("man", "/spine/man/skeleton.json");
    this.load.spineAtlas("manAtlas", "/spine/man/skeleton.atlas", true);
  }

  create() {
    // --- Walls (visual) ---
    this.add.rectangle(WALL_W / 2, WORLD_H / 2, WALL_W, WORLD_H, 0x444466);
    this.add.rectangle(
      VIEW_W - WALL_W / 2,
      WORLD_H / 2,
      WALL_W,
      WORLD_H,
      0x444466,
    );

    // --- Walls (physics) ---
    const wallFilter = { category: CAT_WALL, mask: CAT_RAGDOLL };
    this.matter.add.rectangle(WALL_W / 2, WORLD_H / 2, WALL_W, WORLD_H, {
      isStatic: true,
      label: "wall",
      collisionFilter: wallFilter,
    });
    this.matter.add.rectangle(
      VIEW_W - WALL_W / 2,
      WORLD_H / 2,
      WALL_W,
      WORLD_H,
      { isStatic: true, label: "wall", collisionFilter: wallFilter },
    );

    // --- Floor ---
    this.add.rectangle(VIEW_W / 2, WORLD_H - 5, VIEW_W, 10, 0x888888);
    this.matter.add.rectangle(VIEW_W / 2, WORLD_H - 5, VIEW_W, 10, {
      isStatic: true,
      label: "floor",
      collisionFilter: { category: CAT_FLOOR, mask: CAT_RAGDOLL },
    });

    // --- Hero ---
    this.hero = new Hero(this, VIEW_W / 2, 200);

    // --- Collision: floor = game over ---
    this.matter.world.on("collisionstart", (event) => {
      if (this.isGameOver) return;
      for (const pair of event.pairs) {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;
        if (
          (a === "floor" && this.hero.ownsLabel(b)) ||
          (b === "floor" && this.hero.ownsLabel(a))
        ) {
          this.endGame();
          break;
        }
      }
    });

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, VIEW_W, WORLD_H);

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys();

    // --- UI ---
    this.timerText = this.add
      .text(VIEW_W / 2, 20, "0.00s", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50);

    this.gameOverText = this.add
      .text(VIEW_W / 2, VIEW_H / 2, "", {
        fontSize: "48px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.updateChunks();
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
    while (y < chunkBottom - 50 && y < WORLD_H - 100) {
      const fromLeft = Math.random() > 0.5;
      const angleDeg = Phaser.Math.Between(20, 50);
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const startX = fromLeft ? WALL_W : VIEW_W - WALL_W;
      const dx = (fromLeft ? 1 : -1) * Math.cos(angleRad) * ROCK_LENGTH;
      const dy = Math.sin(angleRad) * ROCK_LENGTH;
      const cx = startX + dx / 2;
      const cy = y + dy / 2;
      const rotation = fromLeft ? angleRad : Math.PI - angleRad;

      const visual = this.add.rectangle(
        cx,
        cy,
        ROCK_LENGTH,
        ROCK_THICKNESS,
        0x777799,
      );
      visual.setRotation(rotation);

      const rockBody = this.matter.add.rectangle(
        cx,
        cy,
        ROCK_LENGTH,
        ROCK_THICKNESS,
        {
          isStatic: true,
          label: "rock",
          angle: rotation,
          collisionFilter: { category: CAT_WALL, mask: CAT_RAGDOLL },
        },
      );

      objects.push({ visual, rockBody });
      y += Phaser.Math.Between(ROCK_GAP, ROCK_GAP * 2);
    }

    this.generatedChunks.set(chunkIndex, objects);
  }

  destroyChunk(chunkIndex) {
    const objects = this.generatedChunks.get(chunkIndex);
    if (!objects) return;
    objects.forEach(({ visual, rockBody }) => {
      visual.destroy();
      this.matter.world.remove(rockBody);
    });
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

    this.survivalTime += deltaMs / 1000;
    this.timerText.setText(this.survivalTime.toFixed(2) + "s");

    if (this.cursors.left.isDown) this.hero.pushLeft(MOVE_FORCE);
    else if (this.cursors.right.isDown) this.hero.pushRight(MOVE_FORCE);

    this.hero.update();

    this.cameras.main.scrollY = this.hero.y - VIEW_H * 0.4;

    this.updateChunks();
  }

  // ==================== GAME OVER ====================

  endGame() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.gameOverText.setText(
      "GAME OVER\n" + this.survivalTime.toFixed(2) + "s",
    );
    this.gameOverText.setVisible(true);
  }
}

const config = {
  type: Phaser.WEBGL,
  parent: "app",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: "#2d2d44",
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
