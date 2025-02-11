"use strict";

const Position = requireModule("position");
const { ServerMessagePacket } = requireModule("protocol");

const CommandHandler = function () {};

CommandHandler.prototype.WAYPOINTS = new Object({
  rookgaard: new Position(32097, 32219, 8),
  thais: new Position(32369, 32241, 8),
  carlin: new Position(32360, 31782, 8),
  "ab'dendriel": new Position(32732, 31634, 8),
  venore: new Position(32957, 32076, 8),
  poh: new Position(32816, 32260, 10),
  "gm-island": new Position(32316, 31942, 8),
  senja: new Position(32125, 31667, 8),
  dracona: new Position(32804, 31586, 15),
  "orc-fortress": new Position(32882, 31772, 9),
  edron: new Position(33217, 31814, 7),
  kazordoon: new Position(32649, 31925, 4),
  ankrahmun: new Position(33194, 32853, 7),
  darama: new Position(33213, 32454, 14),
  cormaya: new Position(33301, 31968, 8),
  fibula: new Position(32174, 32437, 8),
  "white-flower": new Position(32346, 32362, 9),
  "femur-hills": new Position(32536, 31837, 11),
  "ghost-ship": new Position(33321, 32181, 8),
  mintwallin: new Position(32456, 32100, 0),
  cyclopolis: new Position(33251, 31695, 8),
  annihilator: new Position(33221, 31671, 2),
});

CommandHandler.prototype.handleCommandWaypoint = function (player, waypoint) {
  /*
   * CommandHandler.handleCommandWaypoint
   * Executes the waypoint command
   */

  if (!this.WAYPOINTS.hasOwnProperty(waypoint)) {
    return player.sendCancelMessage("This waypoint does not exist.");
  }

  return gameServer.world.creatureHandler.teleportCreature(
    player,
    this.WAYPOINTS[waypoint]
  );
};

CommandHandler.prototype.handleCommandAddSkill = function (
  player,
  skill,
  amount
) {
  if (skill === "level") {
    try {
      const skills = player.skills;
      if (!skills) {
        console.error("[AddSkill] Could not find skills object");
        return gameServer.world.broadcastPacket(
          new ServerMessagePacket("Could not access player skills")
        );
      }

      // Obter exp atual do objeto skills
      const currentLevel = skills[7] || 1;
      const currentExp = skills[6] || 0;
      const targetLevel = currentLevel + Number(amount);

      console.log("[AddSkill] Current Level:", currentLevel);
      console.log("[AddSkill] Current Exp:", currentExp);
      console.log("[AddSkill] Target Level:", targetLevel);

      // Calcular exp necessária
      const Skill = requireModule("skill");
      const skillInstance = new Skill();
      const targetExp = skillInstance.getExperience(targetLevel);
      const currentLevelExp = skillInstance.getExperience(currentLevel);
      const expRequired = targetExp - currentLevelExp;

      console.log("[AddSkill] Required Exp:", expRequired);

      // Atualizar exp no objeto skills
      skills[6] = currentExp + expRequired;

      // Recalcular atributos baseados no novo level
      const newHealth = 150 + (targetLevel - 1) * 5; // 5 HP por level
      const newMana = 35 + (targetLevel - 1) * 5; // 5 MP por level
      const newCap = 400 + (targetLevel - 1) * 10; // 10 CAP por level

      // Atualizar o player em tempo real
      player.setProperty(CONST.PROPERTIES.HEALTH, newHealth);
      player.setProperty(CONST.PROPERTIES.MAX_HEALTH, newHealth);
      player.setProperty(CONST.PROPERTIES.MANA, newMana);
      player.setProperty(CONST.PROPERTIES.MAX_MANA, newMana);
      player.setProperty(CONST.PROPERTIES.CAPACITY, newCap);

      // Notificar o cliente sobre as mudanças
      gameServer.world.broadcastPacket(
        new ServerMessagePacket(
          `Added ${expRequired} experience points (${amount} levels). New level: ${targetLevel}`
        )
      );

      // O servidor deve ter um mecanismo próprio para persistir os dados
      // quando o player deslogar ou em intervalos regulares

      return true;
    } catch (error) {
      console.error("[AddSkill] Error:", error);
      return gameServer.world.broadcastPacket(
        new ServerMessagePacket("An error occurred while adding experience.")
      );
    }
  }

  console.log("[AddSkill] Invalid skill type:", skill);
  return gameServer.world.broadcastPacket(
    new ServerMessagePacket("Invalid skill type. Available: level")
  );
};

CommandHandler.prototype.handle = function (player, message) {
  //if(player.getProperty(CONST.PROPERTIES.ROLE) !== CONST.ROLES.ADMIN) {
  //  return;
  //}

  message = message.split(" ");

  if (message[0] === "/property") {
    return player.setProperty(Number(message[1]), Number(message[2]));
  }

  if (message[0] === "/waypoint") {
    return this.handleCommandWaypoint(player, message[1]);
  }

  if (message[0] === "/teleport") {
    return gameServer.world.creatureHandler.teleportCreature(
      player,
      new Position(Number(message[1]), Number(message[2]), Number(message[3]))
    );
  }

  if (message[0] === "/broadcast") {
    return gameServer.world.broadcastPacket(
      new ServerMessagePacket(message[1])
    );
  }

  if (message[0] === "/spawn") {
    let id = Number(message[1]);
    return gameServer.world.creatureHandler.spawnCreature(
      id,
      player.getPosition()
    );
  }

  if (message[0] === "/path") {
    let a = player.getPosition();
    let b = a.add(new Position(Number(message[1]), Number(message[2]), 0));
    let p = gameServer.world.findPath(player, a, b, 1);
    p.forEach(function (tile) {
      gameServer.world.sendMagicEffect(
        tile.getPosition(),
        CONST.EFFECT.MAGIC.TELEPORT
      );
    });
  }

  if (message[0] === "/addskill") {
    return this.handleCommandAddSkill(player, message[1], message[2]);
  }
};

module.exports = CommandHandler;
