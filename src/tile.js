"use strict";

const Item = require("./item");
const ItemStack = require("./item-stack");
const Thing = require("./thing");
const Condition = require("./condition");
const { TilePacket, ItemRemovePacket, ItemAddPacket } = requireModule("protocol");

const { OTBBitFlag, TileFlag } = require("./bitflag");
const PathfinderNode = requireModule("pathfinder-node");

const Tile = function(id, position) {

  /*
   * Class Tile
   * Container for a world tile
   *
   * API:
   *
   * @Tile.broadcast - broadcasts a packet to all spectators of the tile
   * @Tile.addThing(thing, index) - Adds the thing to a tile at the specified index
   * @Tile.addTopThing(thing) - Adds the thing to the top of the tile
   * @Tile.deleteThing(thing) - removes a thing from the tile by its reference
   * @Tile.removeIndex(index, count) - removes a number of items from the tile from an index
   *
   */

  // Tiles also inherit from thing
  Thing.call(this, id);

  // Reference the position
  this.position = position;

}

Tile.prototype = Object.create(Thing.prototype);
Tile.prototype.constructor = Tile;

Tile.prototype.getFriction = function() {

  /*
   * Function Tile.getFriction
   * Returns the ground friction of the tile
   */

  return this.getAttribute("friction");

}

Tile.prototype.broadcastNeighbours = function(packet) {

  /*
   * Function Tile.broadcastNeighbours
   * Broadcasts a message to the tile neighbours for e.g., whispering
   */

  this.neighbours.forEach(tile => tile.writePlayers(packet));

}

Tile.prototype.distanceManhattan = function(other) {

  /*
   * Function Tile.distanceManhattan
   * Returns the Manhattan distance between two tiles
   */

  return this.getPosition().manhattanDistance(other.getPosition());

}

Tile.prototype.writePlayers = function(packet) {

  /*
   * Function Tile.writePlayers
   * Writes a packet to all players on the tile
   */

  this.players.forEach(player => player.write(packet));

}

Tile.prototype.isHouseTile = function() {

  return this.hasOwnProperty("house");

}

Tile.prototype.addCreature = function(creature) {

  /*
   * Function Tile.addCreature
   * Adds the reference of a creature to the tile
   */

  creature.position = this.position;

  // Write tile condition
  if(creature.isPlayer()) {

    if(this.isProtectionZone()) {

      // Drop the combat lock
      if(creature.isInCombat()) {
        creature.combatLock.unlock();
      }

      if(creature.actionHandler.targetHandler.hasTarget()) {
        creature.actionHandler.targetHandler.setTarget(null)
      }

    }

  }

  if(!this.hasOwnProperty("creatures")) {
    this.creatures = new Set();
  }

  this.creatures.add(creature);

}

Tile.prototype.eliminateItem = function(thing) {

  /*
   * Function Tile.eliminateItem
   * Eliminates an item from the gameworld
   */

  // Poof!
  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.POFF);

  // The item is being deleted from the game world (also called for stackables but has no effect)
  thing.cleanup();

}

Tile.prototype.addThing = function(thing, index) {

  /*
   * Function Tile.addThing
   * Public function to add an item to the tile at a particular index. Normally players can only add things to the top of a tile.
   * Decaying items however, may need to be inserted with the appropriate index
   */

  if(!this.hasOwnProperty("itemStack")) {
    this.itemStack = new ItemStack();
  }

  // Guard
  if(!this.itemStack.isValidIndex(index)) {
    return;
  }

  // Guard
  if(this.isFull()) {
    return this.eliminateItem(thing)
  }

  // Do not allow items to be added on expertise doors
  if(this.itemStack.hasMagicDoor()) {
    return;
  }

  // Attach listeners to close magic doors on tile exit
  if(thing.isMagicDoor() && thing.isOpened()) {
    this.once("exit", thing.close.bind(thing));
  }

  // Set the parent of the thing
  thing.setParent(this);

  // Get a reference to the previous top item
  let currentThing = this.peekIndex(index);

  // Whether we need to check for stacking
  if(currentThing !== null && thing.isStackable() && currentThing.id === thing.id && currentThing.count < Item.prototype.MAXIMUM_STACK_COUNT) {
    return this.__addStackable(index, currentThing, thing);
  }

  if(!this.hasOwnProperty("itemStack")) {
    this.itemStack = new ItemStack();
  }

  // If specified at the top of the stack
  this.itemStack.addThing(index, thing);

  // Broadcast
  this.broadcast(new ItemAddPacket(this.position, thing, index));

}

Tile.prototype.addTopThing = function(thing) {

  /*
   * Function Tile.addTopThing
   * Pushes a particular thing to the top of the item stack
   */

  return this.addThing(thing, ItemStack.prototype.TOP_INDEX);

}

Tile.prototype.hasElevation = function() {

  /*
   * Function Tile.hasElevation
   * Returns true if the tile has sufficient elevation to bring the player to another level
   */

  return this.hasItems() && this.itemStack.hasElevation();

}

Tile.prototype.hasDestination = function() {

  /*
   * Function Tile.hasDestination
   * Returns the teleporter (if any) from a tile
   */

  // Could be a teleporter or floor change (stair?)
  if(this.__getFloorChange() !== null) {
    return true;
  }

  if(!this.hasItems()) {
    return false;
  }

  return this.itemStack.getTeleporterDestination() !== null;

}

Tile.prototype.replace = function(id) {

  /*
   * Function Tile.replace
   * Implements the replace function for a tile: slightly different than for other things
   */

  // Simply update the identifier of the tile
  this.id = id;

  // If the new identifier is said to be decaying (e.g., pickholes)
  if(this.isDecaying()) {
    this.scheduleDecay();
  }

  this.broadcast(new TilePacket(this.position, id));

}

Tile.prototype.getItems = function() {

  /*
   * Function Tile.getItems
   * Returns a reference to the items that are placed on the tile
   */

  if(!this.hasItems()) {
    return new Array();
  }

  return this.itemStack.__items;

}

Tile.prototype.getScore = function() {
  
  /*
   * Function Tile.getScore
   * Returns the A* cost of walking on a tile
   */

  // Currently implemented as a constant
  return this.pathfinderNode.getScore();
  
}

Tile.prototype.getWeight = function(current) {

  /*
   * Function Tile.getCost
   * Returns the A* cost of walking on a tile
   */

  // Moving diagonally is not preferred
  if(this.getPosition().isDiagonal(current.getPosition())) {
    return 3 * this.getFriction();
  }

  // Currently implemented as a constant
  return this.getFriction(); 

}

Tile.prototype.getNumberCharacters = function() {

  /*
   * Function Tile.getNumberCharacters
   * Returns the total number of characters on a tile
   */

  if(!this.hasOwnProperty("creatures")) {
    return 0;
  }

  return this.creatures.size;

}

Tile.prototype.__getFloorChange = function() {

  /*
   * Function Tile.__getFloorChange
   * Returns where the floor has a change event or null
   */

  // Tiles with null identifier do not have a floor change
  if(this.id === 0) {
    return null;
  }

  // Check the tile itself
  let floorChange = this.getAttribute("floorchange");

  // A floorchange is configured on the tile itself
  if(floorChange !== null) {
    return floorChange;
  }

  if(!this.hasItems()) {
    return null;
  }

  // Check the item stack for stairs perhaps?
  return this.itemStack.getFloorChange();

}

Tile.prototype.enablePathfinding = function(target) {

  /*
   * Function Tile.prototype.enablePathfinding
   * Clears A* pathfinding parameters and resets it
   */

  this.pathfinderNode = new PathfinderNode();

}

Tile.prototype.disablePathfinding = function() {

  /*
   * Function Tile.prototype.disablePathfinding
   * Clears A* pathfinding parameters and resets it
   */

  delete this.pathfinderNode;

}

Tile.prototype.setZoneFlags = function(flags) {

  /*
   * Function Tile.setZoneFlags
   * Sets the configured flags
   */

  // Create
  this.tilezoneFlags = new TileFlag(flags); 

}

Tile.prototype.isNoLogoutZone = function() {

  /*
   * Function Tile.isNoLogoutZone
   * Returns true when the tile is a no logout zone
   */

  return this.hasOwnProperty("tilezoneFlags") && this.tilezoneFlags.get(TileFlag.prototype.flags.TILESTATE_NOLOGOUT);

}

Tile.prototype.isProtectionZone = function() {

  /*
   * Function Tile.isProtectionZone
   * Returns true when the tile is a protection zone and cannot be entered by monsters
   */

  return this.hasOwnProperty("tilezoneFlags") && this.tilezoneFlags.get(TileFlag.prototype.flags.TILESTATE_PROTECTIONZONE);

}

Tile.prototype.isBlockSolid = function() {

  /*
   * Function Tile.isBlockSolid
   * Returns true if the tile blocks solids
   */

  // Id of zero means nothing is there
  if(this.id === 0) {
    return true;
  }

  // Otherwise check the block solid flag
  return this.hasFlag(OTBBitFlag.prototype.flags.FLAG_BLOCK_SOLID);

}

Tile.prototype.isOccupiedAny = function() {

  if(this.isOccupied()) {
    return true;
  }

  if(this.isOccupiedCharacters()) {
    return true;
  }

  return false;

}

Tile.prototype.isOccupied = function() {

  /*
   * Function Tile.isOccupied
   * Returns true if the tile is somehow occupied
   */

  // The tile is a block solid (e.g., lava)
  if(this.isBlockSolid()) {
    return true;
  }

  // The tile items contain a block solid (e.g., a wall)
  if(this.hasItems() && this.itemStack.isBlockSolid()) {
    return true;
  }

  return false;

}

Tile.prototype.hasItems = function() {

  return this.hasOwnProperty("itemStack");

}


Tile.prototype.isOccupiedCharacters = function() {

  /*
   * Function Tile.isOccupiedCharacters
   * Returns true if the tile is occupied by any item (e.g., prevents closing a door)
   */

  if(!this.hasOwnProperty("creatures")) {
    return false;
  }

  return this.creatures.size > 0;

}

Tile.prototype.deleteIndex = function(index) {

  let thing = this.peekIndex(index);

  if(thing === null) {
    return null;
  }

  this.__deleteThing(thing, index);
  thing.cleanup();

}

Tile.prototype.deleteThing = function(thing) {

  /*
   * Function Tile._removeItemReference
   * Removes an item on the tile by reference
   */

  if(!this.hasItems()) {
    return;
  }

  // Get the index of the item to be removed
  let index = this.itemStack.__items.indexOf(thing);

  // The requested item does not exist in the container
  if(index === -1) {
    return -1;
  }

  this.__deleteThing(thing, index);

  return index;

}

Tile.prototype.removeIndex = function(index, amount) {

  /*
   * Function Tile.removeIndex
   * Removes an item from the tile at a particular index
   */

  // Take a peek at the item at the index
  let thing = this.peekIndex(index);

  if(thing === null) {
    return null;
  }

  // The thing is not stackable: remove the currently peeked at thing but return a reference to the item
  if(!thing.isStackable()) {
    this.__deleteThing(thing, index);
    return thing;
  }

  return this.__deleteThingStackableItem(index, thing, amount);

}

Tile.prototype.isTrashholder = function() {

  /*
   * Function Tile.isTrashholder
   * Returns true if the tile is a trashholder
   */

  // Definitely not a trashholder
  if(this.id === 0) {
    return false;
  }

  // Check the tile prototype like lava?
  if(this.getPrototype().isTrashholder()) {
    return true;
  }
 
  // Item prototypes like a dustbin?
  return this.hasItems() && this.itemStack.isTrashholder();

}

Tile.prototype.getTopItem = function() {

  /*
   * Function Tile.getTopItem
   * Returns at the top item of the stack
   */

  if(!this.hasItems()) {
    return null;
  }

  return this.itemStack.getTopItem();

}

Tile.prototype.peekIndex = function(index) {

  /*
   * Function Tile.peekIndex
   * Peeks at the item at the specified index
   */

  if(!this.hasItems()) {
    return null;
  }

  return this.itemStack.peekIndex(index);

}

Tile.prototype.isFull = function() {

  /*
   * Function Tile.isFull
   * Returns true if the stack is full and does not accept any more items
   */

  if(!this.hasItems()) {
    return false;
  }

  return this.itemStack.isFull();

}

Tile.prototype.getMaximumAddCount = function(player, item, index) {

  /*
   * Function Tile.getMaximumAddCount
   * Returns true if you can add an item to a tile
   */

  if(!this.hasItems()) {
    return Item.prototype.MAXIMUM_STACK_COUNT;
  }

  // Must be a valid index requested
  if(!this.itemStack.isValidIndex(index)) {
    return 0;
  }

  if(this.isHouseTile() && !player.ownsHouseTile(this)) {
    return 0;
  }

  // Thrashholders always accept items but remove them
  if(this.isTrashholder()) {
    return Item.prototype.MAXIMUM_STACK_COUNT;
  }

  // The tile is full and no longer accepts items
  if(this.isFull()) {
    return 0;
  }

  if(this.itemStack.hasMagicDoor()) {
    return 0;
  }

  // Take a look at the item at the particular slot
  let thing = this.peekIndex(index);

  // If the slot is empty we can add the maximum stack count
  if(thing === null) {
    return Item.prototype.MAXIMUM_STACK_COUNT;
  }

  // Not empty but the identifiers match and the item is stackable
  if(thing.id === item.id && thing.isStackable()) {

    // If the tile is full only allow up to the maximum
    if(this.isFull()) {
      return Item.prototype.MAXIMUM_STACK_COUNT - thing.count;
    }

  }

  // Everything is available
  return Item.prototype.MAXIMUM_STACK_COUNT;

}

Tile.prototype.getChunk = function() {

  /*
   * Function Tile.getChunk
   * Returns the chunk that a tile is located in
   */

  return gameServer.world.getChunkFromWorldPosition(this.position);

}

Tile.prototype.broadcast = function(packet) {

  /*
   * Function Tile.broadcast
   * Broadcasts a message to the parent chunk
   */

  return this.getChunk().broadcast(packet);

}

Tile.prototype.removeCreature = function(creature) {

  /*
   * Function Tile.removeCreature
   * Removes the reference of a creature from the tile
   */

  this.creatures.delete(creature);

  if(this.creatures.size === 0) {
    delete this.creatures;
  }

}

Tile.prototype.getCreature = function() {

  /*
   * Function Tile.getCreature
   * Returns a single creature from the tile with given priorities
   */

  if(!this.hasOwnProperty("creatures")) {
    return null;
  }

  return this.creatures.values().next().value;

}

Tile.prototype.getDestination = function() {
    
  /*
   * Function Tile.getDestination
   * Handles a floor change event by stepping on a floor change tile
   */
  
  let destination = null;

  // Perhaps a teleporter?
  if(this.hasItems()) {
    destination = this.itemStack.getTeleporterDestination();
  }
      
  // Destination was found through teleporter
  if(destination !== null) {
    return destination;
  } 

  // A floor change on the item
  let change = this.__getFloorChange();

  // Teleport to the appropriate tile
  switch(change) {
    case "north": return this.position.north().up();
    case "west": return this.position.west().up();
    case "east": return this.position.east().up();
    case "south": return this.position.south().up();
    case "down": return this.__getInverseFloorChange();
  }

  return null;

}

Tile.prototype.__getInverseFloorChange = function() {

  /*
   * Function Tile.__getInverseFloorChange
   * When a tile is specified to move you down, let us see downstairs in what direction we need to move
   */

  // Get the tile below the current floor change
  let tile = gameServer.world.getTileFromWorldPosition(this.position.down());

  // There is no available tile
  if(tile === null) {
    return null;
  }
  
  // Map to the appropriate (reserved) direction
  switch(tile.__getFloorChange()) {
    case "north": return tile.position.south();
    case "west": return tile.position.east();
    case "east":return tile.position.west();
    case "south": return tile.position.north();
    default: return tile.position;
  }   
    
}

Tile.prototype.scheduleDecay = function() {

  /*
   * Function Tile.scheduleDecay
   * Schedules a decay event for the tile
   */

  // Get the decaying properties
  let properties = this.__getDecayProperties();

  // Schedule the event
  return process.gameServer.world.eventQueue.addEvent(this.replace.bind(this, properties.decayTo), properties.duration);

}


Tile.prototype.__deleteThingStackableItem = function(index, currentItem, count) {

  /*
   * Function Tile.__deleteThingStackableItem
   * Removes an item by an identifier and ammount
   */

  // More requested than available in the item
  if(count > currentItem.count) {
    return null;
  }

  // Exactly equal: still remove the item completely
  if(count === currentItem.count) {
    this.__deleteThing(currentItem, index);
    return currentItem;
  }

  // We have to split the existing stack into two smaller stacks
  return this.__handleSplitStack(index, currentItem, count);

}

Tile.prototype.__handleSplitStack = function(index, currentItem, count) {

  /*
   * Function Tile.__handleSplitStack
   * Handles splitting of an existing stack 
   */

  // We have to update the count with the difference by subtracting the removed number of items
  this.__replaceFungibleItem(index, currentItem, currentItem.count - count);

  // Create the new smaller stack
  return currentItem.createFungibleThing(count);

}

Tile.prototype.__addStackable = function(index, currentItem, thing) {

  /*
   * Function Tile.__addStackable
   * Adds a stackable item to another stackable item of the same type
   */

  // Calculate how much the new item overflows the other item
  let overflow = (currentItem.count + thing.count) - Item.prototype.MAXIMUM_STACK_COUNT;

  // Overflow? We have to split the stack into a bigger and smaller pile
  if(overflow > 0) {
    this.__splitStack(index, currentItem, overflow);
  } else {
    this.__replaceFungibleItem(index, currentItem, currentItem.count + thing.count);
  }

}

Tile.prototype.__splitStack = function(index, currentItem, overflow) {

  /*
   * Function Tile.__splitStack
   * Adds a stackable item to another stackable item of the same type
   */

  // There is an overflow: current item is capped at the maximum stack size. Create a small stack on top
  this.__replaceFungibleItem(index, currentItem, Item.prototype.MAXIMUM_STACK_COUNT);

  this.addTopThing(currentItem.createFungibleThing(overflow));

}

Tile.prototype.__replaceFungibleItem = function(index, thing, count) {

  /*
   * Function Tile.__replaceFungibleItem
   * Stackable items are fungible: meaning they can deleted and replaced by new items
   */

  // Remove the item and create a new one of the right size
  this.__deleteThing(thing, index);

  // Add to top
  this.addTopThing(thing.createFungibleThing(count));

}

Tile.prototype.isBlockProjectile = function() {

  return this.hasOwnProperty("itemStack") && this.itemStack.isBlockProjectile();

}

Tile.prototype.__deleteThing = function(thing, index) {

  /*
   * Function Tile.__deleteThing
   * Removes an item from the tile
   */

  if(!this.hasItems()) {
    return;
  }

  // Top index
  this.itemStack.deleteThing(index);

  this.broadcast(new ItemRemovePacket(this.position, index, thing.getCount()));

}

module.exports = Tile;
