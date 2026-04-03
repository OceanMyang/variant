// global.js
export const VIEW_W = 720;
export const VIEW_H = 1280;
export const WORLD_H = 20000;
export const WALL_W = 40;

export const CHUNK_H = VIEW_H;
export const CHUNKS_AHEAD = 2;
export const CHUNKS_BEHIND = 2;

export const ROCK_LENGTH = 120;
export const ROCK_THICKNESS = 18;
export const ROCK_GAP = 250;

export const CAT_WALL = 0x0001;
export const CAT_ROCK = 0x0002;
export const CAT_FLOOR = 0x0004;
export const CAT_RAGDOLL = 0x0008;
export const CAT_HAND = 0x0010;

export const MOVE_FORCE = 0.005;

export const ITEM_THRESHOLD = 100;

export const P_KATANA = 0.0;
export const P_CHICKEN = 0.5;
export const P_GEYSER = 0.0;
export const P_DRESS = 0.0;
export const P_SKATEBOARD = 0.3;

// FNF-style arrow rhythm constants
export const SKATE_ARROW_SPEED = 300; // px/s falling speed (constant, no acceleration)
export const SKATE_SPAWN_INTERVAL = 1.2; // seconds between arrow spawns
export const SKATE_HIT_WINDOW_PX = 50; // px tolerance at receptor
