---
name: Tank Game Architecture
description: Understanding the architecture, map format, and socket events of the Tank Attack game
---

# Tank Game Architecture

This document describes the structure of the Tank Attack web application.

## Directory Structure
- `/server/index.js` - Express server and socket event listeners.
- `/server/game.js` - Authoritative Game class containing collision and bullet logic.
- `/server/database.js` - SQLite functions for user auth.
- `/public/app.js` - Frontend UI routing and API calls.
- `/public/game.js` - Frontend Canvas renderer.

## Map Format
Maps are stored in `/server/maps/default.json`. The structure must follow this format:
```json
{
  "width": 800,
  "height": 600,
  "obstacles": [
    { "x": 100, "y": 100, "w": 50, "h": 200 }
  ]
}
```

## Socket Events
- **Client to Server**:
  - `createGame(username)`: Initializes a new lobby.
  - `joinGame({gameId, username})`: Connects to an existing lobby.
  - `input(data)`: Sends player inputs (up, down, left, right, fire, targetAngle) to the server at 60Hz.

- **Server to Client**:
  - `gameJoined({gameId, map})`: Sent when a player successfully joins.
  - `playerJoined()`: Sent when the second player joins, starting the battle.
  - `gameState(state)`: Broadcasts position and status of all players and bullets at 60Hz. State contains: `players`, `bullets`, `map`, `active`.

## Bullet Limit
A player can only have a maximum of 2 bullets alive on screen at once. `player.bulletCount` tracks this. Bullets have a lifespan of 60 frames and are destroyed upon collision with walls or tanks.
