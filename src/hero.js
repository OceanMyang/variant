import { Physics } from "@esotericsoftware/spine-phaser-v4";
import Phaser from "phaser";

const CAT_WALL = 0x0001;
const CAT_RAGDOLL = 0x0002;
const CAT_ROCK = 0x0004;
const CAT_FLOOR = 0x0008;
const S = 0.28;

export class Hero {
  /** @param {Phaser.Scene} scene */
  constructor(scene, x, y) {
    this.scene = scene;
    this.torsoBody = null;
    this.spine = null;

    this._createSpine(x, y);
    this._createBody(x + 20, y);
  }

  get x() {
    return this.torsoBody?.position.x ?? 0;
  }
  get y() {
    return this.torsoBody?.position.y ?? 0;
  }

  ownsLabel(label) {
    return label === "torso";
  }

  pushLeft(force) {
    if (this.torsoBody) this.torsoBody.force.x -= force;
  }
  pushRight(force) {
    if (this.torsoBody) this.torsoBody.force.x += force;
  }

  update() {
    if (!this.spine?.skeleton) return;

    // Hips body is the root of the spine
    this.spine.x = this.hipsBody.position.x;
    this.spine.y = this.hipsBody.position.y + 150;

    // Drive torsoBone rotation from body angle
    const torso = this.spine.skeleton.findBone("torsoBone");
    if (torso) {
      torso.rotation = -Phaser.Math.RadToDeg(this.torsoBody.angle) + 90;
    }

    this.spine.skeleton.updateWorldTransform(Physics.update);
  }

  _createSpine(x, y) {
    this.spine = this.scene.add.spine(x, y, "man", "manAtlas");
    this.spine.setScale(S);
    this.spine.setDepth(10);
    this.spine.animationState.data.defaultMix = 0.15;
  }

  _createBody(x, y) {
    const M = Phaser.Physics.Matter.Matter;

    const filter = {
      category: CAT_RAGDOLL,
      mask: CAT_WALL | CAT_ROCK | CAT_FLOOR,
    };

    const hips = M.Bodies.rectangle(x, y, 40, 10, {
      label: "hips",
    });

    const torso = M.Bodies.rectangle(x, y - 60, 40, 100, {
      label: "torso",
      collisionFilter: filter,
    });

    this.scene.matter.world.add(hips);
    this.scene.matter.world.add(torso);

    this.scene.matter.add.constraint(hips, torso, 0, 1, {
      pointA: { x: 0, y: -20 },
      pointB: { x: 0, y: 40 },
      damping: 0.1,
    });

    this.hipsBody = hips;
    this.torsoBody = torso;
  }
}
