import { Physics } from "@esotericsoftware/spine-phaser-v4";
import Phaser from "phaser";
import { CAT_FLOOR, CAT_RAGDOLL, CAT_ROCK, CAT_WALL } from "./global";

const S = 0.28;

export class Hero {
  /** @param {Phaser.Scene} scene */
  constructor(scene, x, y) {
    this.scene = scene;
    this.torsoBody = null;
    this.spine = null;
    this.allBodies = [];

    this._createSpine(x, y);
    this._createBody(x + 20, y);
    this.setup();
  }

  get x() {
    return this.torsoBody?.position.x ?? 0;
  }
  get y() {
    return this.torsoBody?.position.y ?? 0;
  }

  ownsLabel(label) {
    return this.allBodies.some((b) => b.label === label);
  }

  pushLeft(force) {
    if (this.torsoBody) this.torsoBody.force.x -= force;
  }
  pushRight(force) {
    if (this.torsoBody) this.torsoBody.force.x += force;
  }

  setup() {
    this.isEating = false;
    for (const ik of this.spine.skeleton.ikConstraints) {
      ik.mix = 0;
    }
  }

  startEating() {
    if (this.isEating) return;
    this.isEating = true;

    const M = Phaser.Physics.Matter.Matter;

    // Freeze all bodies so gravity doesn't pull the character down
    for (const body of this.allBodies) {
      M.Body.setStatic(body, true);
    }

    // Reset bones to neutral before animation takes over
    this.spine.skeleton.setToSetupPose();

    // Put the chicken leg into the food slot
    const skeleton = this.spine.skeleton;
    const slot = skeleton.findSlot("foodSlot");
    const attachment = skeleton.getAttachmentByName("foodSlot", "skin/food/chicken leg");
    if (slot && attachment) slot.setAttachment(attachment);

    // Play Eat animation once, then return to ragdoll (no crossfade from ragdoll state)
    const entry = this.spine.animationState.setAnimation(0, "Eat", false);
    entry.mixDuration = 0;
    const listener = {
      complete: (e) => {
        if (e === entry) {
          this.spine.animationState.removeListener(listener);
          this.stopEating();
        }
      },
    };
    this.spine.animationState.addListener(listener);
  }

  stopEating() {
    this.isEating = false;

    const M = Phaser.Physics.Matter.Matter;

    // Unfreeze — ragdoll resumes
    for (const body of this.allBodies) {
      M.Body.setStatic(body, false);
    }

    // Reset all IK constraints — the Eat animation keyframes them, leaving mix > 0
    for (const ik of this.spine.skeleton.ikConstraints) {
      ik.mix = 0;
    }

    // Clear the food slot
    const slot = this.spine.skeleton.findSlot("foodSlot");
    if (slot) slot.setAttachment(null);

    // Clear animation so ragdoll bone overrides take full control
    this.spine.animationState.setEmptyAnimation(0, 0);
  }

  update() {
    if (!this.spine?.skeleton) return;

    // Hips body is the root of the spine
    this.spine.x = this.hips.position.x;
    this.spine.y = this.hips.position.y + 150;

    // While eating, SpineGameObject's preUpdate handles the animation — skip bone overrides
    if (this.isEating) return;

    // Drive torsoBone rotation from body angle
    const torso = this.spine.skeleton.findBone("torsoBone");
    torso.rotation = -Phaser.Math.RadToDeg(this.torsoBody.angle) + 90;

    const rightLeg = this.spine.skeleton.findBone("RightHipBone");
    rightLeg.rotation = -Phaser.Math.RadToDeg(
      this.rightLeg.angle - this.torsoBody.angle,
    );

    const rightFibula = this.spine.skeleton.findBone("RightFibula");
    rightFibula.rotation = -Phaser.Math.RadToDeg(
      Math.max(0, this.rightFibula.angle - this.rightLeg.angle),
    );

    const rightFeetBone = this.spine.skeleton.findBone("rightFeetBone");
    rightFeetBone.rotation = -Phaser.Math.RadToDeg(this.rightLeg.angle) + 90;

    // Left leg
    const leftLeg = this.spine.skeleton.findBone("leftHipBone");
    leftLeg.rotation = -Phaser.Math.RadToDeg(
      this.leftLeg.angle - this.torsoBody.angle,
    );

    const leftFibula = this.spine.skeleton.findBone("leftFibula");
    leftFibula.rotation = -Phaser.Math.RadToDeg(
      Math.max(0, this.leftFibula.angle - this.leftLeg.angle),
    );

    const leftFeetBone = this.spine.skeleton.findBone("leftFeetBone");
    leftFeetBone.rotation = -Phaser.Math.RadToDeg(this.leftLeg.angle) + 90;

    // Right arm
    const rightHandUp = this.spine.skeleton.findBone("rightHandUp");
    rightHandUp.rotation = -Phaser.Math.RadToDeg(
      this.rightUpperArm.angle - this.torsoBody.angle,
    );

    // Left arm
    const leftHandUp = this.spine.skeleton.findBone("leftHandUp"); // FIX: was "rightHandUp"
    leftHandUp.rotation = -Phaser.Math.RadToDeg(
      this.leftUpperArm.angle - this.torsoBody.angle,
    );
    this.spine.skeleton.updateWorldTransform(Physics.none);
  }

  _createSpine(x, y) {
    this.spine = this.scene.add.spine(x, y, "man", "manAtlas");
    this.spine.setScale(S);
    this.spine.setDepth(10);
    this.spine.animationState.data.defaultMix = 0.15;
  }

  _angle(angle) {
    return Phaser.Math.Angle.Normalize(angle);
  }

  _createBody(x, y) {
    const M = Phaser.Physics.Matter.Matter;

    const filter = {
      category: CAT_RAGDOLL,
      mask: CAT_WALL | CAT_RAGDOLL | CAT_ROCK | CAT_FLOOR,
    };

    const handFilter = {
      category: CAT_RAGDOLL,
      mask: CAT_WALL | CAT_ROCK,
    };

    const hips = M.Bodies.rectangle(x, y, 40, 20, {
      label: "hips",
      frictionAir: 0,
      collisionFilter: 0,
    });

    const head = M.Bodies.rectangle(x, y - 100, 40, 40, {
      label: "head",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const torso = M.Bodies.rectangle(x, y - 60, 40, 80, {
      label: "torso",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const rightLeg = M.Bodies.rectangle(x - 10, y, 20, 60, {
      label: "rightLeg",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const leftLeg = M.Bodies.rectangle(x + 10, y, 20, 60, {
      label: "leftLeg",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const rightFibula = M.Bodies.rectangle(x - 10, y + 60, 20, 70, {
      label: "rightFibula",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const leftFibula = M.Bodies.rectangle(x + 10, y + 60, 20, 70, {
      label: "leftFibula",
      frictionAir: 0,
      collisionFilter: filter,
    });

    const rightFoot = M.Bodies.rectangle(x - 10, y + 80, 20, 10, {
      label: "rightFoot",
      collisionFilter: 0,
    });

    const leftFoot = M.Bodies.rectangle(x + 10, y + 80, 20, 10, {
      label: "leftFoot",
      collisionFilter: 0,
    });

    const rightUpperArm = M.Bodies.rectangle(x - 20, y - 80, 10, 120, {
      label: "rightUpperArm",
      collisionFilter: handFilter,
    });

    const leftUpperArm = M.Bodies.rectangle(x + 20, y - 80, 10, 120, {
      label: "leftUpperArm",
      collisionFilter: handFilter,
    });

    this.scene.matter.world.add(hips);
    this.scene.matter.world.add(head);
    this.scene.matter.world.add(torso);
    this.scene.matter.world.add(rightLeg);
    this.scene.matter.world.add(rightFibula);
    this.scene.matter.world.add(rightFoot);
    this.scene.matter.world.add(leftLeg);
    this.scene.matter.world.add(leftFibula);
    this.scene.matter.world.add(leftFoot);
    this.scene.matter.world.add(rightUpperArm);
    this.scene.matter.world.add(leftUpperArm);

    this.scene.matter.add.constraint(hips, torso, 0, 1, {
      pointA: { x: 0, y: -20 },
      pointB: { x: 0, y: 40 },
      damping: 1,
    });

    this.scene.matter.add.constraint(head, torso, 0, 1, {
      pointA: { x: 0, y: 20 },
      pointB: { x: 0, y: -40 },
      damping: 1,
    });

    this.scene.matter.add.constraint(hips, rightLeg, 0, 1, {
      pointA: { x: -10, y: 0 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(hips, leftLeg, 0, 1, {
      pointA: { x: 10, y: 0 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(rightLeg, rightFibula, 10, 0.1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(leftLeg, leftFibula, 10, 0.1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 30 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(rightFibula, rightFoot, 0, 1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 5 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(leftFibula, leftFoot, 0, 1, {
      pointA: { x: 0, y: -30 },
      pointB: { x: 0, y: 5 },
      damping: 0.1,
    });

    // Right arm: attach to top of torso
    this.scene.matter.add.constraint(torso, rightUpperArm, 0, 1, {
      pointA: { x: -20, y: -20 },
      pointB: { x: 0, y: 60 },
      damping: 0.1,
    });

    // Left arm: attach to top of torso
    this.scene.matter.add.constraint(torso, leftUpperArm, 0, 1, {
      pointA: { x: 20, y: -20 },
      pointB: { x: 0, y: 60 },
      damping: 0.1,
    });

    this.torsoBody = torso;
    this.hips = hips;
    this.rightLeg = rightLeg;
    this.rightFibula = rightFibula;
    this.leftLeg = leftLeg;
    this.leftFibula = leftFibula;
    this.rightUpperArm = rightUpperArm;
    this.leftUpperArm = leftUpperArm;
    this.allBodies = [
      hips,
      head,
      torso,
      rightLeg,
      rightFibula,
      rightFoot,
      leftLeg,
      leftFibula,
      leftFoot,
      rightUpperArm,
      leftUpperArm,
    ];
  }
}
