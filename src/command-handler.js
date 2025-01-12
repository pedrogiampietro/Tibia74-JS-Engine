"use strict";

const Position = requireModule("position");
const { ServerMessagePacket } = requireModule("protocol");

const CommandHandler = function() {

}

CommandHandler.prototype.WAYPOINTS = new Object({
  "rookgaard": new Position(32097, 32219, 8),
  "thais": new Position(32369, 32241, 8),
  "carlin": new Position(32360, 31782, 8),
  "ab'dendriel": new Position(32732, 31634, 8),
  "venore": new Position(32957, 32076, 8),
  "poh": new Position(32816, 32260, 10),
  "gm-island": new Position(32316, 31942, 8),
  "senja": new Position(32125, 31667, 8),
  "dracona": new Position(32804, 31586, 15),
  "orc-fortress": new Position(32882, 31772, 9),
  "edron": new Position(33217, 31814, 7),
  "kazordoon": new Position(32649, 31925, 4),
  "ankrahmun": new Position(33194, 32853, 7),
  "darama": new Position(33213, 32454, 14),
  "cormaya": new Position(33301, 31968, 8),
  "fibula": new Position(32174, 32437, 8),
  "white-flower": new Position(32346, 32362, 9),
  "femur-hills": new Position(32536, 31837, 11),
  "ghost-ship": new Position(33321, 32181, 8),
  "mintwallin": new Position(32456, 32100, 0),
  "cyclopolis": new Position(33251, 31695, 8),
  "annihilator": new Position(33221, 31671, 2)
});

CommandHandler.prototype.handleCommandWaypoint = function(player, waypoint) {

  /*
   * CommandHandler.handleCommandWaypoint
   * Executes the waypoint command
   */

  if(!this.WAYPOINTS.hasOwnProperty(waypoint)) {
    return player.sendCancelMessage("This waypoint does not exist.");
  }

  return gameServer.world.creatureHandler.teleportCreature(player, this.WAYPOINTS[waypoint]);

}

CommandHandler.prototype.handle = function(player, message) {

  //if(player.getProperty(CONST.PROPERTIES.ROLE) !== CONST.ROLES.ADMIN) {
  //  return;
  //}

  message = message.split(" ");

  if(message[0] === "/property") {
    return player.setProperty(Number(message[1]), Number(message[2]));
  }

  if(message[0] === "/waypoint") {
    return this.handleCommandWaypoint(player, message[1]);
  }

  if(message[0] === "/teleport") {
    return gameServer.world.creatureHandler.teleportCreature(player, new Position(Number(message[1]), Number(message[2]), Number(message[3])));
  }

  if(message[0] === "/broadcast") {
    return gameServer.world.broadcastPacket(new ServerMessagePacket(message[1]));
  }

  if(message[0] === "/spawn") {
    let id = Number(message[1]);
    return gameServer.world.creatureHandler.spawnCreature(id, player.getPosition());
  }

  if(message[0] === "/path") {
    let a = player.getPosition();
    let b = a.add(new Position(Number(message[1]), Number(message[2]), 0));
    let p = gameServer.world.findPath(player, a, b, 1);
    p.forEach(function(tile) {
      gameServer.world.sendMagicEffect(tile.getPosition(), CONST.EFFECT.MAGIC.TELEPORT);
    });
  }

}

module.exports = CommandHandler;
