export interface ExampleAsset {
  name: string;
  category: 'geometry' | 'states' | 'entities' | 'scripts';
  content: string;
}

export const BEDROCK_EXAMPLES: ExampleAsset[] = [
  {
    name: 'Standard Chair',
    category: 'geometry',
    content: `{
  "format_version": "1.12.0",
  "minecraft:geometry": [
    {
      "description": {
        "identifier": "geometry.chair",
        "texture_width": 64,
        "texture_height": 64,
        "visible_bounds_width": 2,
        "visible_bounds_height": 2,
        "visible_bounds_offset": [0, 1, 0]
      },
      "bones": [
        {
          "name": "body",
          "pivot": [0, 0, 0],
          "cubes": [
            { "origin": [-6, 0, -6], "size": [12, 2, 12], "uv": [0, 0] },
            { "origin": [-5, 0, -5], "size": [2, 8, 2], "uv": [0, 0] },
            { "origin": [3, 0, -5], "size": [2, 8, 2], "uv": [0, 0] },
            { "origin": [-5, 0, 3], "size": [2, 8, 2], "uv": [0, 0] },
            { "origin": [3, 0, 3], "size": [2, 8, 2], "uv": [0, 0] },
            { "origin": [-6, 10, 4], "size": [12, 12, 2], "uv": [0, 0] }
          ]
        }
      ]
    }
  ]
}`
  },
  {
    name: 'Toggle Switch',
    category: 'states',
    content: `{
  "format_version": "1.21.30",
  "minecraft:block_state": {
    "description": {
      "identifier": "mod:switch"
    },
    "states": {
      "mod:active": [ false, true ]
    }
  }
}`
  },
  {
    name: 'Custom NPC',
    category: 'entities',
    content: `{
  "format_version": "1.12.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "mod:npc",
      "materials": { "default": "entity_alphatest" },
      "textures": { "default": "textures/entity/npc" },
      "geometry": { "default": "geometry.humanoid" },
      "render_controllers": [ "controller.render.default" ]
    }
  }
}`
  },
  {
    name: 'Basic Interaction',
    category: 'scripts',
    content: `import { world, system } from "@minecraft/server";

world.beforeEvents.itemUseOn.subscribe((ev) => {
  const { source, block } = ev;
  if (block.typeId.includes("furniture")) {
    source.sendMessage("Interacted with " + block.typeId);
  }
});`
  },
  {
    name: 'Table Geometry',
    category: 'geometry',
    content: `{
  "format_version": "1.12.0",
  "minecraft:geometry": [
    {
      "description": {
        "identifier": "geometry.table",
        "texture_width": 64,
        "texture_height": 64
      },
      "bones": [
        {
          "name": "root",
          "pivot": [0, 0, 0],
          "cubes": [
            { "origin": [-8, 14, -8], "size": [16, 2, 16], "uv": [0, 0] },
            { "origin": [-7, 0, -7], "size": [2, 14, 2], "uv": [0, 20] },
            { "origin": [5, 0, -7], "size": [2, 14, 2], "uv": [0, 20] },
            { "origin": [-7, 0, 5], "size": [2, 14, 2], "uv": [0, 20] },
            { "origin": [5, 0, 5], "size": [2, 14, 2], "uv": [0, 20] }
          ]
        }
      ]
    }
  ]
}`
  },
  {
    name: 'Crate States',
    category: 'states',
    content: `{
  "format_version": "1.21.30",
  "minecraft:block_state": {
    "description": { "identifier": "mod:crate" },
    "states": {
      "mod:content_type": [ "empty", "apples", "wheat", "iron" ]
    }
  }
}`
  }
];
