# Dev Log

- In this game, you are a ragdoll falling down the cliff. Your only enemy is gravity. Collect items on the way to survive longer.
- The biggest technical challenge is to rig the Spine character into a ragdoll. I need to use Matter.js for ragdoll physics, but it's incompatible with Spine. So, I manually rigged the relative positions between Spine bones with Matter colliders and synced them in update().
- I want the ragdoll to keep moving when game is over (now everything just freezes). I want to show impact with the given boost effect animation. It'd also be funny to see the ragdoll rolling on the ground.
