import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

export const generateUUID = () => uuidv4();

export interface Manifest {
  format_version: number;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: [number, number, number];
    min_engine_version: [number, number, number];
  };
  modules: {
    type: string;
    uuid: string;
    version: [number, number, number];
  }[];
  dependencies?: {
    uuid: string;
    version: [number, number, number];
  }[];
}

export const createManifest = (name: string, description: string, type: 'resources' | 'data', dependencyUuid?: string): Manifest => {
  return {
    format_version: 2,
    header: {
      name: `${name} ${type === 'resources' ? 'RP' : 'BP'}`,
      description,
      uuid: generateUUID(),
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0]
    },
    modules: [
      {
        type: type,
        uuid: generateUUID(),
        version: [1, 0, 0]
      }
    ],
    ...(dependencyUuid ? {
      dependencies: [
        {
          uuid: dependencyUuid,
          version: [1, 0, 0]
        }
      ]
    } : {})
  };
};

export const createBlocksJson = (namespace: string, blocks: string[]) => {
  const blocksObj: Record<string, any> = {};
  blocks.forEach(block => {
    blocksObj[`${namespace}:${block}`] = {
      textures: block,
      sound: "stone"
    };
  });
  return JSON.stringify(blocksObj, null, 2);
};

export const createBasicScript = (blockId: string, namespace: string) => {
  return `world.beforeEvents.itemUseOn.subscribe((event) => {
  const { block, source } = event;
  if (block.typeId === "${blockId}") {
    const currentState = block.permutation.getState("${namespace}:open_state");
    block.setPermutation(block.permutation.withState("${namespace}:open_state", !currentState));
    system.run(() => {
      world.playSound("random.chestopen", block.location);
    });
  }
});`;
};

export const downloadMcAddon = async (projectName: string, rpFiles: Record<string, string | Blob>, bpFiles: Record<string, string | Blob>) => {
  const zip = new JSZip();
  
  // Resource Pack
  const rpFolder = zip.folder(`${projectName}_RP`);
  if (rpFolder) {
    for (const [path, content] of Object.entries(rpFiles)) {
      if (content === undefined || content === null) continue; // Skip corrupt entries
      rpFolder.file(path, content);
    }
  }

  // Behavior Pack
  const bpFolder = zip.folder(`${projectName}_BP`);
  if (bpFolder) {
    for (const [path, content] of Object.entries(bpFiles)) {
      if (content === undefined || content === null) continue; // Skip corrupt entries
      bpFolder.file(path, content);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.mcaddon`;
  a.click();
  URL.revokeObjectURL(url);
};
