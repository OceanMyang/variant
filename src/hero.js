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
    this.setup();
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

  setup() {
    for (const ik of this.spine.skeleton.ikConstraints) {
      ik.mix = 0;
    }
  }

  update() {
    if (!this.spine?.skeleton) return;

    // Hips body is the root of the spine
    this.spine.x = this.hipsBody.position.x;
    this.spine.y = this.hipsBody.position.y + 150;

    // Drive torsoBone rotation from body angle
    const torso = this.spine.skeleton.findBone("torsoBone");
    torso.rotation = -Phaser.Math.RadToDeg(this.torsoBody.angle) + 90;

    const rightLeg = this.spine.skeleton.findBone("RightHipBone");
    rightLeg.rotation = -Phaser.Math.RadToDeg(
      this.rightLeg.angle - this.torsoBody.angle,
    );

    const rightFibula = this.spine.skeleton.findBone("RightFibula");
    console.log(this.rightFibula.angle - this.rightLeg.angle);
    rightFibula.rotation = -Phaser.Math.RadToDeg(
      Math.max(0, this.rightFibula.angle - this.rightLeg.angle),
    );

    const rightFeetBone = this.spine.skeleton.findBone("rightFeetBone");
    rightFeetBone.rotation = -Phaser.Math.RadToDeg(this.rightFibula.angle) + 90;

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
      mask: CAT_WALL | CAT_RAGDOLL | CAT_ROCK | CAT_FLOOR,
    };

    const hips = M.Bodies.rectangle(x, y, 40, 20, {
      label: "hips",
      collisionFilter: 0,
    });

    const torso = M.Bodies.rectangle(x, y - 60, 40, 100, {
      label: "torso",
      collisionFilter: filter,
    });

    const rightLeg = M.Bodies.rectangle(x, y, 20, 70, {
      label: "rightFibula",
      collisionFilter: filter,
    });

    const rightFibula = M.Bodies.rectangle(x, y, 20, 70, {
      label: "rightLeg",
      collisionFilter: filter,
    });

    const rightFoot = M.Bodies.rectangle(x, y, 20, 10, {
      label: "rightFoot",
      collisionFilter: 0,
    });

    this.scene.matter.world.add(hips);
    this.scene.matter.world.add(torso);
    this.scene.matter.world.add(rightLeg);
    this.scene.matter.world.add(rightFibula);
    this.scene.matter.world.add(rightFoot);

    this.scene.matter.add.constraint(hips, torso, 0, 1, {
      pointA: { x: 0, y: -20 },
      pointB: { x: 0, y: 40 },
      damping: 1,
    });

    this.scene.matter.add.constraint(hips, rightLeg, 0, 1, {
      pointA: { x: -10, y: 0 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(rightLeg, rightFibula, 10, 0.1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(rightFibula, rightFoot, 0, 1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 5 },
      damping: 0.1,
    });

    this.hipsBody = hips;
    this.torsoBody = torso;
    this.rightLeg = rightLeg;
    this.rightFibula = rightFibula;
  }
}
