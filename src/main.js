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
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.isGameOver) return;
      if (this.matter.world.enabled) {
        this.matter.world.pause();
      } else {
        this.matter.world.resume();
      }
    });

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

    // Dark edge line for depth
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
    while (y < chunkBottom - 50 && y < WORLD_H - 100) {
      const fromLeft = Math.random() > 0.5;
      const angleDeg = Phaser.Math.Between(10, 35); // shallower, more natural
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const startX = fromLeft ? WALL_W : VIEW_W - WALL_W;
      const dx = (fromLeft ? 1 : -1) * Math.cos(angleRad) * ROCK_LENGTH;
      const dy = Math.sin(angleRad) * ROCK_LENGTH;
      const cx = startX + dx / 2;
      const cy = y + dy / 2;
      const rotation = fromLeft ? angleRad : Math.PI - angleRad;

      const spikeW = Phaser.Math.Between(30, 200);
      const spikeH = Phaser.Math.Between(120, 500);
      const tipOffset = Phaser.Math.Between(spikeH * 0.2, spikeH * 0.8); // tip is offset, not centered

      const rootX = fromLeft ? 0 : VIEW_W;
      const dir = fromLeft ? 1 : -1;

      // Absolute world coords of the 3 vertices
      const p0 = { x: rootX, y: y }; // top on wall
      const p1 = { x: rootX + dir * spikeW, y: y + tipOffset }; // tip (inward, offset)
      const p2 = { x: rootX, y: y + spikeH }; // bottom on wall

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

      // Centroid of triangle for body position
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
    if (!this.matter.world.enabled) return;

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
