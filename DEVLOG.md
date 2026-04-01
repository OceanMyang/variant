# Dev Log

Idea: a hilarious physics game. You're playing a man falling down the cliff. The goal here is to stay in the air as long as possible.
There are pickup items along the way.

## 0.1.0 Demo Scene
Played all spine animations by modifying HelloScene

# 0.0.1 Animation-Based Fall Scene
Features
- Spine character falls and accelerates.
- There are limits on both side. Now they are just flat walls.
- A timer counts the timespan of the falling process
- When it hits the ground, gameover and show score.
- Falling animation: FallPose
- Hit ground animation: DramaticCollapse

Problem:
Animation feels too rigid.

# 0.0.2 Rocks on cliffs 
- Add rocks on the walls of both side. I want them to be like natural cliffs.
- When spine character hits the rocks, it loses some speed and plays HardHit animation to show impact.

Problem:
HardHit animation is too dumb and rigid. The whole animation system is floaty.
To achieve a more hilarious and realistic effect, I need ragdoll physics.

# 0.0.3 Ragdoll physics
- 
