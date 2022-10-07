import OmeggaPlugin, { OL, PS, PC, Vector, Brick, WriteSaveObject } from 'omegga';

type Config = { foo: string };
type Storage = { bar: string };

const heldPiece = new Map<string, Brick>();
const heldPieceWSO = new Map<string, WriteSaveObject>();
const heldPiecePos = new Map<string, [number,number,number]>();

export default class Plugin implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    // Write your plugin!
    this.omegga.on('interact', async ({ player, position, brick_name, message }) => {
      const block = await getDoorBrickFromInteract(position);
      
      if(heldPiece.has(player.name)){
        let bricky = heldPiece.get(player.name);
        if(block.brick.size[1]>0 && bricky.size[1]>0){
          const doorData = heldPieceWSO.get(player.name)
        // get door data from the brick position
              await Omegga.loadSaveData(doorData, { quiet: true,
                offX: (block.brick.position[0]-bricky.position[0]),
                offY: (block.brick.position[1]-bricky.position[1]),
                offZ: (block.brick.position[2]-bricky.position[2]+((block.brick.size[2])+bricky.size[2]))});
              heldPiece.delete(player.name)
              heldPiecePos.delete(player.name)
              heldPieceWSO.delete(player.name)
      }else{
        this.omegga.whisper(this.omegga.getPlayer(player.controller), "You cannot place your block on this block.");
      }

      }else{
        if(block.brick.size[1]>0){
          if(block.brick.material_index!=3){
            this.omegga.whisper(this.omegga.getPlayer(player.controller), "You cannot pick up this block. (Material must be Plastic)");
          }else{
          const doorData = (await Omegga.getSaveData({center: position,extent: block.brick.size})) as WriteSaveObject;
           heldPiece.set(player.name,block.brick);
           heldPieceWSO.set(player.name,doorData);
           heldPiecePos.set(player.name,block.brick.position);
           this.clearBricks(position,block.brick.size,block.ownerId);
          }
        }else{
        this.omegga.whisper(this.omegga.getPlayer(player.controller), "You cannot pick up this kind of block.");
        }
      }

  });

    return { registeredCommands: ['test'] };
  }

  async stop() {
    // Anything that needs to be cleaned up...
  }

  async clearBricks(center: Vector, extent: Vector, ownerId: String){
    // clear the old door bricks
    Omegga.writeln(
      `Bricks.ClearRegion ${center.join(' ')} ${extent.join(' ')} ${ownerId}`
    );
  }
}

/** lookup a brick by position and filter fn
 * @param unique when enabled, require this door to be unique
 */
 export async function getDoorBrickQuery(
  region: { center: Vector; extent: Vector },
  query: (brick: Brick) => boolean,
  unique?: boolean
): Promise<{ brick: Brick; ownerId: string }> {
  // get the save data around the clicked brick
  const saveData = await Omegga.getSaveData(region);

  // no bricks detected
  if (!saveData || saveData.bricks.length === 0) return null;

  // ensure the brick version has components
  if (saveData.version !== 10) return null;

  // find brick based on query
  const index = saveData.bricks.findIndex(query);
  const brick = index > -1 ? saveData.bricks[index] : null;

  // prevent multiple bricks in the same position from being clicked
  if (
    unique &&
    index > -1 &&
    saveData.bricks.some((b, i) => query(b) && i !== index)
  )
    return null;

  if (!brick) return null;

  return { brick, ownerId: saveData.brick_owners[brick.owner_index - 1].id };
}


/** get a brick's data from interact metadata (for relative positioning) */
export async function getDoorBrickFromInteract(
  position: Vector,
): Promise<{ brick: Brick; ownerId: string }> {
  // find the brick that has a matching position to this one
  return getDoorBrickQuery(
    {
      center: position as Vector,
      extent: [3000, 3000, 3000] as Vector,
    },
    b => b.position.every((p, i) => position[i] === p),
    true
  );
}