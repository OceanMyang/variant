import Phaser from "phaser";
import { SpinePlugin } from "@esotericsoftware/spine-phaser-v4";

/** Portrait 9:16 — same aspect as Variant games (e.g. 720×1280). */
const VIEW_W = 720;
const VIEW_H = 1280;

/** Total fall distance — character starts near top, floor at bottom. */
const WORLD_H = 20000;

/** Wall thickness on each side. */
const WALL_W = 40;

/** Playable area between walls. */
const PLAY_W = VIEW_W - WALL_W * 2;

class FallScene extends Phaser.Scene {
  constructor() {
    super({ key: "FallScene" });
    this.hero = null;
    this.proxy = null;
    this.survivalTime = 0;
    this.isGameOver = false;
  }

  preload() {
    this.load.spineJson("man", "/spine/man/skeleton.json");
    this.load.spineAtlas("manAtlas", "/spine/man/skeleton.atlas", true);
  }

  create() {
    // --- Physics world bounds (keeps proxy inside the shaft) ---
    this.physics.world.setBounds(WALL_W, 0, PLAY_W, WORLD_H);

    // --- Visual walls ---
    this.add.rectangle(WALL_W / 2, WORLD_H / 2, WALL_W, WORLD_H, 0x444466);
    this.add.rectangle(
      VIEW_W - WALL_W / 2,
      WORLD_H / 2,
      WALL_W,
      WORLD_H,
      0x444466,
    );

    // --- Floor ---
    this.floor = this.add.rectangle(
      VIEW_W / 2,
      WORLD_H - 5,
      VIEW_W,
      10,
      0x888888,
    );
    this.physics.add.existing(this.floor, true); // static body

    // --- Proxy (invisible physics body) ---
    this.proxy = this.add.rectangle(VIEW_W / 2, 200, 40, 80, 0xff0000, 0);
    this.physics.add.existing(this.proxy);
    this.proxy.body.setGravityY(300);
    this.proxy.body.setMaxVelocityY(600);
    this.proxy.body.setDragX(200);
    this.proxy.body.setCollideWorldBounds(true);

    // Floor collision → game over
    this.physics.add.collider(this.proxy, this.floor, () => this.endGame());

    // --- Spine character ---
    this.hero = this.add.spine(VIEW_W / 2, 200, "man", "manAtlas");
    this.hero.setDepth(10);
    this.hero.setScale(0.28);
    this.hero.animationState.data.defaultMix = 0.15;
    this.hero.animationState.setAnimation(0, "FallPose", true);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, VIEW_W, WORLD_H);

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys();

    // --- UI (fixed to camera) ---
    this.timerText = this.add
      .text(VIEW_W / 2, 20, "0.00s", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.gameOverText = this.add
      .text(VIEW_W / 2, VIEW_H / 2, "", {
        fontSize: "48px",
        color: "#ff4444",
        fontFamily: "system-ui, sans-serif",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  update(_, deltaMs) {
    if (this.isGameOver) return;

    const dt = deltaMs / 1000;
    this.survivalTime += dt;
    this.timerText.setText(this.survivalTime.toFixed(2) + "s");

    // --- Input ---
    if (this.cursors.left.isDown) {
      this.proxy.body.setVelocityX(-250);
      this.hero.skeleton.scaleX = -Math.abs(this.hero.skeleton.scaleX);
    } else if (this.cursors.right.isDown) {
      this.proxy.body.setVelocityX(250);
      this.hero.skeleton.scaleX = Math.abs(this.hero.skeleton.scaleX);
    }

    // --- Sync Spine to proxy ---
    this.hero.x = this.proxy.x;
    this.hero.y = this.proxy.y;

    // --- Camera follows proxy manually ---
    this.cameras.main.scrollY = this.proxy.y - VIEW_H * 0.4;
  }

  endGame() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.proxy.body.setVelocity(0, 0);
    this.proxy.body.setGravityY(0);

    this.hero.animationState.setAnimation(0, "DramaticCollapse", false);

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
    default: "arcade",
    arcade: {
      gravity: { y: 0 }, // gravity set per-body, not globally
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
