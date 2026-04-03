import { Physics } from "@esotericsoftware/spine-phaser-v4";
import Phaser from "phaser";
import { CAT_FLOOR, CAT_RAGDOLL, CAT_ROCK, CAT_WALL } from "./global";

// Used for Spine to dance on the skateboard
const DANCE_ANIMS = [
  "Dance",
  "Dance2",
  "DanceEmote",
  "DanceWithMic",
  "Headbang",
  "HipTwist",
  "IndianClassicalDance",
  "IndianClassicalDance2",
  "JazzHands",
  "Moonwalk",
  "PunjabiDance",
  "PunjabiDance2",
  "PunjabiDanceNew",
  "PunjabiDanceNew2",
  "RRRDance",
  "RRRDance1",
  "RRRDance2",
  "RRRDance3",
  "TikTokDance",
  "TikTokDance2",
  "TikTokDance3",
  "TikTokDance4",
  "TikTokDance5",
  "Thumka",
  "Thumka2",
  "Twerk",
  "VickyKaushalDance",
  "VickyKaushalDance2",
];

// Scale of Spine character
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

  // Check if the collision involves a ragdoll collider
  ownsLabel(label) {
    return this.allBodies.some((b) => b.label === label);
  }

  pushLeft(force) {
    if (this.torsoBody) this.torsoBody.force.x -= force;
  }
  pushRight(force) {
    if (this.torsoBody) this.torsoBody.force.x += force;
  }

  // Flip Spine character horizontally
  setSide(side) {
    this.spine.skeleton.scaleX =
      side === "left"
        ? -Math.abs(this.spine.skeleton.scaleX)
        : Math.abs(this.spine.skeleton.scaleX);
  }

  setup() {
    this.isEating = false;
    this.isGrabbingKatana = false;
    this.isWearingDress = false;
    this.isSkateboarding = false;
    this.dressVisual = null;
    this.dressTween = null;
    this.stamina = 1; // 0–1
    this.grabTimer = 0;
    this.skateRound = 0;
    // remove ikconstraints for ragdoll physics
    for (const ik of this.spine.skeleton.ikConstraints) {
      ik.mix = 0;
    }
  }

  startDress() {
    if (this.isWearingDress) return;
    this.isWearingDress = true;

    // Increase air friction on all bodies — slows terminal velocity like a parachute
    for (const body of this.allBodies) {
      body.frictionAir = 0.05;
    }

    // Play FallPose animation — ragdoll bone driving stops in update()
    this.spine.skeleton.setToSetupPose();
    const entry = this.spine.animationState.setAnimation(0, "FallPose", true);
    entry.mixDuration = 0;

    this.dressVisual = this.scene.add
      .image(0, 0, "dress")
      .setDepth(50)
      .setScale(0.18, 0.1);

    // Remove the dress after 3s
    this.dressTween = this.scene.time.delayedCall(3000, () => this.stopDress());
  }

  stopDress() {
    this.isWearingDress = false;

    // Restore original frictionAir
    for (const body of this.allBodies) {
      body.frictionAir = 0;
    }

    // Clear animation — ragdoll bone driving resumes
    for (const ik of this.spine.skeleton.ikConstraints) ik.mix = 0;
    this.spine.animationState.setEmptyAnimation(0, 0);

    if (this.dressTween) {
      this.dressTween.remove();
      this.dressTween = null;
    }
    if (this.dressVisual) {
      this.dressVisual.destroy();
      this.dressVisual = null;
    }
  }

  startGrabbingKatana(targetX, targetY, side = "right") {
    if (this.isGrabbingKatana || this.isEating) return;
    this.isGrabbingKatana = true;
    this.stamina = 1;
    this.grabTimer = 0;
    this.grabSide = side;

    // Flip skeleton for left wall
    this.setSide(side);

    // Store grab position — spine will render here while grabbing
    this.grabX = targetX;
    this.grabY = targetY;

    const M = Phaser.Physics.Matter.Matter;
    for (const body of this.allBodies) {
      M.Body.setStatic(body, true);
    }

    this.spine.skeleton.setToSetupPose();

    // Play FacepalmDouble at 25%. This is a grabbing pose.
    const anim = this.spine.skeleton.data.findAnimation("FacepalmDouble");
    const entry = this.spine.animationState.setAnimation(
      0,
      "FacepalmDouble",
      false,
    );
    entry.mixDuration = 0;
    this.spine.animationState.update(anim.duration * 0.25);
    this.spine.animationState.apply(this.spine.skeleton);
    this.spine.skeleton.updateWorldTransform(Physics.update);
    this.spine.animationState.clearTrack(0);
  }

  // During grabbing katana
  // Each space press restores stamina by a flat 5%
  onSpacePressed() {
    if (!this.isGrabbingKatana) return;
    this.stamina = Math.min(1, this.stamina + 0.05);
  }

  updateGrabbingKatana(deltaMs) {
    if (!this.isGrabbingKatana) return;

    const dt = deltaMs / 1000;
    // Stamina drain accelerates the longer the player holds — starts gentle, gets punishing
    const DRAIN_RATE = 0.15 + this.grabTimer * 0.1;

    this.stamina -= DRAIN_RATE * dt;
    this.grabTimer += dt;

    if (this.stamina <= 0) {
      this.stamina = 0;
      this.stopGrabbingKatana();
    }
  }

  stopGrabbingKatana() {
    this.isGrabbingKatana = false;

    // Reset skeleton flip
    this.spine.skeleton.scaleX = Math.abs(this.spine.skeleton.scaleX);

    const M = Phaser.Physics.Matter.Matter;
    for (const body of this.allBodies) {
      M.Body.setStatic(body, false);
    }

    for (const ik of this.spine.skeleton.ikConstraints) {
      ik.mix = 0;
    }

    this.spine.animationState.setEmptyAnimation(0, 0);
  }

  startSkateboarding() {
    if (
      this.isSkateboarding ||
      this.isEating ||
      this.isGrabbingKatana ||
      this.isWearingDress
    )
      return;
    this.isSkateboarding = true;
    this.skateRound = 0;

    const M = Phaser.Physics.Matter.Matter;
    for (const body of this.allBodies) {
      M.Body.setStatic(body, true);
    }

    this.spine.skeleton.setToSetupPose();
    const anim = DANCE_ANIMS[Math.floor(Math.random() * DANCE_ANIMS.length)];
    const entry = this.spine.animationState.setAnimation(0, anim, true);
    entry.mixDuration = 0;
  }

  stopSkateboarding() {
    this.isSkateboarding = false;

    const M = Phaser.Physics.Matter.Matter;
    for (const body of this.allBodies) {
      M.Body.setStatic(body, false);
    }

    this.spine.skeleton.scaleX = Math.abs(this.spine.skeleton.scaleX);

    for (const ik of this.spine.skeleton.ikConstraints) ik.mix = 0;
    this.spine.animationState.setEmptyAnimation(0, 0);
  }

  // Called on a successful arrow hit
  nextSkateRound() {
    this.skateRound++;

    // Pick a new random dance for variety
    const anim = DANCE_ANIMS[Math.floor(Math.random() * DANCE_ANIMS.length)];
    const entry = this.spine.animationState.setAnimation(0, anim, true);
    entry.mixDuration = 0;
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
    const attachment = skeleton.getAttachmentByName(
      "foodSlot",
      "skin/food/chicken leg",
    );
    if (slot && attachment) slot.setAttachment(attachment);

    // Play Eat animation once, then return to ragdoll (no crossfade from ragdoll state)
    const entry = this.spine.animationState.setAnimation(0, "Eat", false);
    entry.mixDuration = 0;
    entry.timeScale = 2;
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
    const emptyEntry = this.spine.animationState.setEmptyAnimation(0, 0);
    emptyEntry.timeScale = 1;
  }

  update() {
    if (!this.spine?.skeleton) return;

    // While grabbing, pin spine to the katana position instead of hips
    if (this.isGrabbingKatana) {
      const xOffset = this.grabSide === "left" ? 80 : -80;
      this.spine.x = this.grabX + xOffset;
      this.spine.y = this.grabY + 300;
      return;
    }

    // Move Spine character to Ragdoll position
    this.spine.x = this.hips.position.x;
    this.spine.y = this.hips.position.y + 150;

    // Keep dress visual attached to Spine character waist
    if (this.dressVisual) {
      const bone = this.spine.skeleton.findBone("torsoBone");
      this.dressVisual.x = this.spine.x + bone.worldX * this.spine.scaleX + 5;
      this.dressVisual.y =
        this.spine.y + bone.worldY * Math.abs(this.spine.scaleY);
    }

    // While eating, wearing dress, or skateboarding — animation drives bones
    if (this.isEating || this.isWearingDress || this.isSkateboarding) return;

    // Sync Spine bone rotations with Ragdoll limbs (mostly sync rotations)
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

    const rightHandUp = this.spine.skeleton.findBone("rightHandUp");
    rightHandUp.rotation = -Phaser.Math.RadToDeg(
      this.rightUpperArm.angle - this.torsoBody.angle,
    );

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

  // create ragdoll counterpart for Spine character with Matter.js
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

    const head = M.Bodies.rectangle(x, y - 100, 30, 30, {
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
    this.scene.matter.world.add(leftLeg);
    this.scene.matter.world.add(leftFibula);
    this.scene.matter.world.add(rightUpperArm);
    this.scene.matter.world.add(leftUpperArm);

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
      leftLeg,
      leftFibula,
      rightUpperArm,
      leftUpperArm,
    ];

    this.scene.matter.add.constraint(hips, torso, 0, 1, {
      pointA: { x: 0, y: -20 },
      pointB: { x: 0, y: 40 },
      damping: 1,
    });

    this.scene.matter.add.constraint(head, torso, 0, 1, {
      pointA: { x: 0, y: 15 },
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

    this.scene.matter.add.constraint(torso, rightUpperArm, 0, 1, {
      pointA: { x: -20, y: -20 },
      pointB: { x: 0, y: 60 },
      damping: 0.1,
    });

    this.scene.matter.add.constraint(torso, leftUpperArm, 0, 1, {
      pointA: { x: 20, y: -20 },
      pointB: { x: 0, y: 60 },
      damping: 0.1,
    });
  }
}
