import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Package, 
  Settings, 
  Download, 
  Search, 
  FileCode, 
  Blocks as BlocksIcon, 
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
  X,
  FastForward,
  Eye,
  Code,
  Wand2,
  Plus
} from 'lucide-react';
import { ModelViewer } from './components/ModelViewer';
import { motion, AnimatePresence } from 'motion/react';
import { createManifest, downloadMcAddon, generateUUID } from './lib/mc-utils';
import { GoogleGenAI, type Part } from "@google/genai";
import { saveToDB, getFromDB } from './lib/idb';
import { BEDROCK_EXAMPLES } from './constants/ExampleLibrary';

// Polyfill process for browser
if (typeof window !== 'undefined' && !window.process) {
  (window as any).process = { env: {} };
}

// Initialization
const getGeminiKey = () => {
  try {const key = process.env.GEMINI_API_KEY || "";
    console.log("Gemini key loaded:", key ? "YES ✓" : "MISSING ✗");
    return key;
  } catch (e) {
    return "";
  }
};

const aiKey = getGeminiKey();
const ai = aiKey ? new GoogleGenAI({ apiKey: aiKey }) : null;
// Single reusable AI call — replaces all getGenerativeModel usage
const askAI = async (prompt: string): Promise<string> => {
  if (!ai) return "AI not available — check your GEMINI_API_KEY in .env";
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    return result.text ?? "";
  } catch (e: any) {
    return `AI Error: ${e?.message || String(e)}`;
  }
};

type Step = 'setup' | 'fetch' | 'port' | 'creative' | 'export';
type Tool = 'geometry' | 'states' | 'scripts' | 'entities';

export default function App() {
  const [activeStep, setActiveStep] = useState<Step>(() => {
    try {
      return (localStorage.getItem('mp_step') as Step) || 'setup';
    } catch (e) {
      return 'setup';
    }
  });
  const [activeTool, setActiveTool] = useState<Tool>('geometry');
  const [projectName, setProjectName] = useState(() => {
    try {
      return localStorage.getItem('mp_name') || 'Cluttered Port';
    } catch (e) {
      return 'Cluttered Port';
    }
  });
  const [projectDesc, setProjectDesc] = useState(() => {
    try {
      return localStorage.getItem('mp_desc') || 'A port of the Cluttered mod for Bedrock Edition.';
    } catch (e) {
      return 'A port of the Cluttered mod for Bedrock Edition.';
    }
  });
  const [namespace, setNamespace] = useState(() => {
    try {
      return localStorage.getItem('mp_namespace') || 'cluttered';
    } catch (e) {
      return 'cluttered';
    }
  });
  const [githubUrl, setGithubUrl] = useState(() => {
    try {
      return localStorage.getItem('mp_url') || 'https://github.com/YellowChuJelly/Cluttered';
    } catch (e) {
      return 'https://github.com/YellowChuJelly/Cluttered';
    }
  });
  const [scrapedFiles, setScrapedFiles] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mp_scraped') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Project Files State
  const [rpFiles, setRpFiles] = useState<Record<string, string | Blob>>({});
  const [bpFiles, setBpFiles] = useState<Record<string, string | Blob>>({});
  
  // AI Forge Content
  const [ideas, setIdeas] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mp_ideas') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [isForging, setIsForging] = useState(false);
  const [forgeGuide, setForgeGuide] = useState('');
  const [selectedIdeaIndices, setSelectedIdeaIndices] = useState<Set<number>>(new Set());
  const [dbLoaded, setDbLoaded] = useState(false);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('mp_step', activeStep);
    localStorage.setItem('mp_name', projectName);
    localStorage.setItem('mp_desc', projectDesc);
    localStorage.setItem('mp_namespace', namespace);
    localStorage.setItem('mp_url', githubUrl);
    localStorage.setItem('mp_scraped', JSON.stringify(scrapedFiles));
    localStorage.setItem('mp_ideas', JSON.stringify(ideas));
    
    // Save files to IndexedDB instead of localStorage
    if (dbLoaded) {
      saveToDB('mp_rp_files', rpFiles);
      saveToDB('mp_bp_files', bpFiles);
    }
  }, [activeStep, projectName, projectDesc, namespace, githubUrl, scrapedFiles, ideas, rpFiles, bpFiles, dbLoaded]);

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedRp = await getFromDB('mp_rp_files');
        const savedBp = await getFromDB('mp_bp_files');
        if (savedRp) setRpFiles(savedRp);
        if (savedBp) setBpFiles(savedBp);
      } catch (e) {
        console.error("Failed to load IndexedDB state:", e);
      } finally {
        setDbLoaded(true);
      }
    };
    loadState();
  }, []);

  // Auto-save edited file
  useEffect(() => {
    if (!selectedFile || !selectedFile.name) return;
    const timeout = setTimeout(() => {
      // Check RP then BP
      const rpPath = Object.keys(rpFiles).find(p => p.endsWith(selectedFile.name));
      const bpPath = Object.keys(bpFiles).find(p => p.endsWith(selectedFile.name));

      if (rpPath) {
        if (rpFiles[rpPath] === selectedFile.content) return;
        setRpFiles(prev => ({ ...prev, [rpPath]: selectedFile.content }));
      } else if (bpPath) {
        if (bpFiles[bpPath] === selectedFile.content) return;
        setBpFiles(prev => ({ ...prev, [bpPath]: selectedFile.content }));
      } else {
        // Default to RP models if new
        setRpFiles(prev => ({ ...prev, [`models/blocks/${selectedFile.name}`]: selectedFile.content }));
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [selectedFile?.content]);

  // Tool Selection Side Effect
  useEffect(() => {
    if (!selectedFile) return;
    const path = Object.keys(rpFiles).find(k => k.endsWith(selectedFile.name)) || 
                 Object.keys(bpFiles).find(k => k.endsWith(selectedFile.name));
    
    if (!path) return;
    
    const isValid = (
      (activeTool === 'geometry' && path.startsWith('models/')) ||
      (activeTool === 'states' && path.startsWith('block_states/')) ||
      (activeTool === 'entities' && (path.startsWith('entity/') || path.startsWith('entities/'))) ||
      (activeTool === 'scripts' && (path.startsWith('scripts/') || path.startsWith('functions/')))
    );

    if (!isValid) setSelectedFile(null);
  }, [activeTool]);

  const handleFetchGithub = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setSetupLoading(true);
    setError(null);
    setFetchProgress({ current: 0, total: 0, message: "Initializing asset scan..." });
    
    let allFiles: any[] = [];
    let allTextures: any[] = [];
    let newRpFiles: Record<string, Blob> = {};
    let repoFiles: any[] = [];

    try {
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/);
      if (!match) throw new Error('Invalid GitHub URL');
      const [_, user, repo, deepPath] = match;

      setFetchProgress(p => ({ ...p!, message: "Fetching repository branch metadata..." }));
      const repoRes = await fetch(`https://api.github.com/repos/${user}/${repo}`, { signal: controller.signal });
      if (!repoRes.ok) throw new Error(`GitHub API Error: ${repoRes.statusText}`);
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || 'main';

      setFetchProgress(p => ({ ...p!, message: "Scanning entire repository structure..." }));
      const treeRes = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees/${defaultBranch}?recursive=1`, { signal: controller.signal });
      if (!treeRes.ok) throw new Error("Failed to scan repository structure recursively.");
      const treeData = await treeRes.json();
      
      repoFiles = treeData.tree || [];
      const searchRoot = deepPath ? deepPath : '';
      
      repoFiles.forEach((f: any) => {
        if (f.type !== 'blob' || !f.path.startsWith(searchRoot)) return;
        const name = f.path.split('/').pop();
        const download_url = `https://raw.githubusercontent.com/${user}/${repo}/${defaultBranch}/${f.path}`;
        
        if (f.path.endsWith('.json')) {
          if (f.path.includes('/models/') || f.path.includes('/geometry/')) {
            allFiles.push({ ...f, name, download_url, category: 'geometry' });
          } else if (f.path.includes('/blockstates/') || f.path.includes('/block_states/')) {
            allFiles.push({ ...f, name, download_url, category: 'states' });
          } else if (f.path.includes('/entities/') || f.path.includes('/entity/')) {
            allFiles.push({ ...f, name, download_url, category: 'entities' });
          }
        } else if (f.path.endsWith('.png') && f.path.includes('/textures/')) {
          allTextures.push({ ...f, name, download_url });
        } else if ((f.path.endsWith('.js') || f.path.endsWith('.ts')) && (f.path.includes('/scripts/') || f.path.includes('/functions/'))) {
          allFiles.push({ ...f, name, download_url, category: 'scripts' });
        }
      });

      const totalAssets = allTextures.length + allFiles.length;
      if (totalAssets === 0) {
        setFetchProgress(p => ({ ...p!, message: "No textures or models found, finishing..." }));
      } else {
        setFetchProgress(p => ({ ...p!, message: `Found ${totalAssets} assets. Preparing download...` }));
      }

      // Helper to fetch with timeout and retry
      const fetchWithRetry = async (url: string, retries = 3, timeout = 12000): Promise<Response> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          const timeoutControl = new AbortController();
          const id = setTimeout(() => timeoutControl.abort(), timeout);
          try {
            const res = await fetch(url, { signal: timeoutControl.signal });
            clearTimeout(id);
            if (res.ok) return res;
          } catch (e) {
            clearTimeout(id);
            if (attempt === retries - 1) throw e;
          }
          await new Promise(r => setTimeout(r, 600)); // Even faster backoff
        }
        throw new Error(`Failed to fetch ${url}`);
      };

      const CONCURRENCY = 40;
      const startTime = Date.now();
      let completedCount = 0;
      const totalToDownload = allTextures.length;
      
      // Use index-based pool for maximum speed (sliding window)
      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, totalToDownload) }, async () => {
        while (nextIndex < totalToDownload && !controller.signal.aborted) {
          const currentIndex = nextIndex++;
          const tex = allTextures[currentIndex];
          
          try {
            const texRes = await fetchWithRetry(tex.download_url);
            const blob = await texRes.blob();
            newRpFiles[`textures/blocks/${tex.name}`] = blob;
          } catch (e) {
            console.warn(`Failed to download ${tex.name}:`, e);
          } finally {
            completedCount++;
            
            // Throttle UI updates to roughly every 5 items or if it's the last one
            if (completedCount % 5 === 0 || completedCount === totalToDownload) {
              const elapsed = Date.now() - startTime;
              const rate = completedCount > 0 ? elapsed / completedCount : 0;
              const remaining = totalToDownload - completedCount;
              const secondsLeft = Math.round((rate * remaining) / 1000);
              
              setFetchProgress({
                current: completedCount,
                total: totalToDownload,
                message: `Downloading assets: ${completedCount}/${totalToDownload} (${secondsLeft}s left)`
              });
            }
          }
        }
      });

      await Promise.all(workers);

    } catch (err: any) {

      if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setRpFiles(prev => {
          const next = { ...prev, ...newRpFiles };
          // Localize scripts and states into RP memory for workspace editing
          repoFiles.forEach((f: any) => {
            const fileMeta = allFiles.find(af => af.sha === f.sha);
            if (fileMeta && fileMeta.category && fileMeta.category !== 'geometry') {
              // We'll lazy load content later or fetch now if small. For now we just mark placeholders.
              // Logic improved: We should fetch ALL JSON/Scripts during setup to make tools useful.
            }
          });
          return next;
        });
        const uniqueData = Array.from(new Map(allFiles.filter(f => f.category === 'geometry').map((item: any) => [item.sha, item])).values());
        setScrapedFiles(uniqueData);
      
      setSetupLoading(false);
      setFetchProgress(null);
      setAbortController(null);
      
      if (uniqueData.length > 0) {
        setActiveStep('fetch');
      } else if (!error) {
        setError("No models found. Check namespace or repo structure.");
      }
    }
  };

  const handleStopFetch = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleForgeIdeas = async (append = false) => {
    setIsForging(true);
    setError(null);
    try {
      if (!ai) {
        setError("AI initialization failed. Check your API key.");
        return;
      }
      
      const prompt = `Based on the theme of "${projectName}" (${projectDesc}) and the namespace "${namespace}", suggest exactly 5 unique furniture or decoration additions for a Minecraft Bedrock Add-on. 
      ${forgeGuide ? `User Guidance/Focus: "${forgeGuide}"` : ''}
      
      For each item, provide:
      1. A unique name (no colons).
      2. An array of 3 Bedrock block states (e.g. "open", "closed", "locked").
      3. A brief description of behavior.
      4. A valid Bedrock Geometry JSON string (format_version 1.12.0). 
         REQUIREMENTS:
         - Identifiers: "geometry.[name]"
         - Bones: Primary bone named "body" or "root". 
         - Pivot: [0,0,0]
         - Use size & origin (Java range -8 to 8 maps to Bedrock).
         - UV: [u, v] coordinates for a 16x16 or 32x32 texture sheet.
         - Material Instances: Use "material_instance": "main" for cubes.
      5. Behavior Script: A COMPLETE, valid Minecraft Bedrock script using @minecraft/server API v1.9.0. Rules:
         - Do NOT include import statements (they will be added separately by the app).
         - Use world.afterEvents, world.beforeEvents, system.run.
         - For interactive blocks: subscribe to world.beforeEvents.itemUseOn, check block.typeId === '${namespace}:[name_sanitized]', toggle block state using setPermutation.
         - Return only the function body code, no imports, no exports.
      
      Return ONLY a raw JSON array:
      [ { "name": "string", "states": [string], "description": "string", "geometry": "JSON_STRING", "script": "STRING" }, ... ]`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      const text = result.text ?? "";
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error("AI response did not contain a valid JSON array.");
      
      const newIdeas = JSON.parse(text.substring(start, end + 1));
      if (append) {
        setIdeas([...ideas, ...newIdeas]);
      } else {
        setIdeas(newIdeas);
        setSelectedIdeaIndices(new Set());
      }
    } catch (err: any) {
      console.error(err);
      setError("AI Forge encountered an error: " + err.message);
    } finally {
      setIsForging(false);
    }
  };

  const handleEditIdea = async (index: number) => {
    const editPrompt = prompt("How should AI refine this idea? (e.g. 'make it medieval', 'add a color state')");
    if (!editPrompt) return;

    setIsForging(true);
    try {
      if (!ai) {
        setError("AI initialization failed. Check your API key.");
        return;
      }
      const idea = ideas[index];
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:  prompt as any,
      });
      const text = result.text ?? "";

      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const updatedIdea = JSON.parse(text.substring(start, end + 1));
      
      const updatedIdeas = [...ideas];
      updatedIdeas[index] = updatedIdea;
      setIdeas(updatedIdeas);
    } catch (err) {
      console.error(err);
      alert("Failed to edit idea.");
    } finally {
      setIsForging(false);
    }
  };

  const toggleIdeaSelection = (idx: number) => {
    const newSelection = new Set(selectedIdeaIndices);
    if (newSelection.has(idx)) newSelection.delete(idx);
    else newSelection.add(idx);
    setSelectedIdeaIndices(newSelection);
  };


  const [selectedAssetShas, setSelectedAssetShas] = useState<Set<string>>(new Set<string>());
  const [conversionProgress, setConversionProgress] = useState<{ current: number; total: number } | null>(null);

  const toggleAssetSelection = (sha: string) => {
    const newSelection = new Set(selectedAssetShas);
    if (newSelection.has(sha)) newSelection.delete(sha);
    else newSelection.add(sha);
    setSelectedAssetShas(newSelection);
  };

  const selectAllAssets = () => {
    setSelectedAssetShas(new Set<string>(scrapedFiles.map(f => f.sha)));
  };

  const deselectAllAssets = () => {
    setSelectedAssetShas(new Set<string>());
  };

  const handleDeleteFile = (path: string) => {
    if (!confirm(`Delete ${path}? This cannot be undone.`)) return;
    setRpFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setBpFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (selectedFile?.name === path.split('/').pop()) {
      setSelectedFile(null);
    }
  };

  const handleBatchPort = async (shasToProcess: Set<string>) => {
    if (shasToProcess.size === 0) return;
    setIsLoading(true);
    const filesToPort = scrapedFiles.filter(f => shasToProcess.has(f.sha));
    setConversionProgress({ current: 0, total: filesToPort.length });
    
    const newRpFiles = { ...rpFiles };
    const newBpFiles = { ...bpFiles };
    
    try {
      for (let i = 0; i < filesToPort.length; i++) {
        const file = filesToPort[i];
        setConversionProgress({ current: i + 1, total: filesToPort.length });
        
        try {
          const response = await fetch(file.download_url);
          const javaJson = await response.text();
          const baseName = file.name.replace('.json', '');
          const sanitized = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          
          if (!ai) return;
          const text = await askAI(`Convert this Minecraft Java block model to Bedrock Edition format.
              
              1. Geometry: format_version 1.12.0, identifier "geometry.${sanitized}".
              2. Block State: standard 1.21.30 format for "${namespace}:${sanitized}".
              3. Client Entity (Optional): if applicable.
              4. Behavior Script: A COMPLETE, valid Minecraft Bedrock script using @minecraft/server API v1.9.0. Rules:
              - Do NOT include import statements (they will be added separately)
              - Use only: world.afterEvents, world.beforeEvents, system.run
              - For interactive blocks: subscribe to world.beforeEvents.itemUseOn, check block.typeId === '${namespace}:${sanitized}', then toggle a block state using block.setPermutation(block.permutation.withState('${namespace}:open_state', !block.permutation.getState('${namespace}:open_state')))
              - Do NOT use deprecated APIs like runCommand on block
              - Return only the function body code, no imports, no exports
              
              Java Model:
              ${javaJson}`);
          
          const aiRes = text;
          const raw = aiRes.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(raw);
          
          newRpFiles[`models/blocks/${sanitized}.json`] = parsed.geometry || "";
          newRpFiles[`block_states/${sanitized}.json`] = parsed.block_state || JSON.stringify({
            format_version: "1.21.30",
            "minecraft:block_state": {
              description: { identifier: `${namespace}:${sanitized}` },
              states: {}
            }
          }, null, 2);

          newRpFiles[`entity/${sanitized}.json`] = parsed.client_entity || JSON.stringify({
            format_version: "1.10.0",
            "minecraft:client_entity": {
              description: {
                identifier: `${namespace}:${sanitized}`,
                materials: { default: "entity_alphatest" },
                textures: { default: `textures/entity/${sanitized}` },
                geometry: { default: `geometry.${sanitized}` },
                render_controllers: ["controller.render.default"],
                spawn_egg: { base_color: "#4ADE80", overlay_color: "#ffffff" }
              }
            }
          }, null, 2);

          newBpFiles[`scripts/${sanitized}.js`] = parsed.script || 
`// Auto-generated behavior for ${sanitized}
world.beforeEvents.itemUseOn.subscribe((event) => {
  const { block } = event;
  if (block.typeId === "${namespace}:${sanitized}") {
    console.log("${sanitized} was used!");
  }
});`;
        } catch (fileErr) {
          console.error(`Failed to port ${file.name}:`, fileErr);
        }
        
        await new Promise(r => setTimeout(r, 100));
      }
      
      setRpFiles(newRpFiles);
      setBpFiles(newBpFiles);
      
      if (filesToPort.length > 0) {
        const lastFile = filesToPort[filesToPort.length - 1];
        const sanitized = lastFile.name.replace('.json', '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        setSelectedFile({ 
          name: `${sanitized}.json`, 
          content: newRpFiles[`models/blocks/${sanitized}.json`] as string 
        });
      }
    } catch (err: any) {
      setError("Batch Conversion failed: " + err.message);
    } finally {
      setIsLoading(false);
      setConversionProgress(null);
    }
  };

  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'blockbench'>('editor');

  const handleAiChat = async () => {
    if (!aiQuery.trim() || !selectedFile) return;
    setIsAiLoading(true);
    setAiExplain(null);
    try {
      if (!ai) {
        setAiResponse("AI not configured.");
        return;
      }
      const text = await askAI(`You are an expert Minecraft Bedrock Add-on Developer. 
            The current file being edited is "${selectedFile.name}" (${activeTool}).
            Current Content:
            ${selectedFile.content}
            
            User Request: "${aiQuery}"
            
            If the user asks to modify the code, return ONLY the updated code block wrapped in triple backticks. If they ask a question, provide a concise explanation.`);
      if (text.includes('```')) {
        const newCode = text.split('```')[1].replace(/^[a-z]+\n/, '').trim();
        setSelectedFile({ ...selectedFile, content: newCode });
        setAiResponse("I've updated the code based on your request! Check the workspace.");
      } else {
        setAiResponse(text);
      }
    } catch (err: any) {
      setAiResponse("Error: " + err.message);
    } finally {
      setIsAiLoading(false);
      setAiQuery('');
    }
  };

  const handleExplainCode = async () => {
    if (!selectedFile) return;
    setIsAiLoading(true);
    try {
      if (!ai) return;
      const text = await askAI(`Explain what this Minecraft Bedrock ${activeTool} code does in plain, helpful language for a modder. Use bullet points for features like rotation, interaction, or states.\n\nCode:\n${selectedFile.content}`);
      setAiExplain(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConvertModel = async (file: any) => {
    setIsLoading(true);
    try {
      const filename = `${file.name.replace('.json', '')}.json`;
      const response = await fetch(file.download_url);
      const javaJson = await response.text();
      
      const baseName = filename.replace('.json', '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      if (!ai) return;
      const text = await askAI(`Convert this Minecraft Java block model to Bedrock Edition format.
          1. Geometry: format_version 1.12.0, identifier "geometry.${filename.replace('.json', '')}".
          2. Block State: standard 1.21.30 format for "${namespace}:${filename.replace('.json', '')}".
          3. Behavior Script: A COMPLETE, valid Minecraft Bedrock script using @minecraft/server API v1.9.0. Rules:
             - Do NOT include import statements (they will be added separately)
             - Use world.afterEvents, world.beforeEvents, system.run
             - For interactive blocks: subscribe to world.beforeEvents.itemUseOn, check block.typeId === '${namespace}:${baseName}', then toggle a block state using block.setPermutation(block.permutation.withState('${namespace}:open_state', !block.permutation.getState('${namespace}:open_state')))
             - Return only the function body code, no imports, no exports
          4. Client Entity (Optional): standard 1.10.0 format.
          Return a JSON object: { "geometry": "STRING", "block_state": "STRING", "script": "STRING", "client_entity": "STRING" }
          Java Model: ${javaJson}`);
      
      const aiRes = text;
      const raw = aiRes.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      const bedrockGeo = parsed.geometry || "";
      
      const texturePath = Object.keys(rpFiles).find(k => 
        k.startsWith('textures/blocks/') && 
        (k.toLowerCase().includes(`/${baseName}.png`) || k.toLowerCase().includes(baseName.toLowerCase()))
      );
      const textureBlob = texturePath ? rpFiles[texturePath] as Blob : undefined;

      setRpFiles(prev => ({ 
        ...prev, 
        [`models/blocks/${baseName}.json`]: bedrockGeo,
        [`block_states/${baseName}.json`]: parsed.block_state || JSON.stringify({
          format_version: "1.21.30",
          "minecraft:block_state": {
            description: { identifier: `${namespace}:${baseName}` },
            states: {}
          }
        }, null, 2),
        [`entity/${baseName}.json`]: parsed.client_entity || JSON.stringify({
          format_version: "1.10.0",
          "minecraft:client_entity": {
            description: {
              identifier: `${namespace}:${baseName}`,
              materials: { default: "entity_alphatest" },
              textures: { default: `textures/entity/${baseName}` },
              geometry: { default: `geometry.${baseName}` },
              render_controllers: ["controller.render.default"],
              spawn_egg: { base_color: "#4ADE80", overlay_color: "#ffffff" }
            }
          }
        }, null, 2)
      }));
      setBpFiles(prev => ({ 
        ...prev, 
        [`scripts/${baseName}.js`]: parsed.script || 
`// Auto-generated behavior for ${baseName}
world.beforeEvents.itemUseOn.subscribe((event) => {
  const { block } = event;
  if (block.typeId === "${namespace}:${baseName}") {
    console.log("${baseName} was used!");
  }
});`
      }));
      setSelectedFile({ name: `${baseName}.json`, content: bedrockGeo, textureBlob });
    } catch (err: any) {
      setError("AI Conversion failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
    const sanitizedNamespace = namespace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const projectNameClean = projectName.replace(/\s+/g, '_').toLowerCase();

    const bpUuid = generateUUID();
    const rpUuid = generateUUID();
    
    const bpManifest = {
      format_version: 2,
      header: {
        name: `${projectName} BP`,
        description: projectDesc,
        uuid: bpUuid,
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0]
      },
      modules: [
        { type: "data", uuid: generateUUID(), version: [1, 0, 0] },
        { type: "script", language: "javascript", uuid: generateUUID(), version: [1, 0, 0], entry: "scripts/main.js" }
      ],
      dependencies: [
        { uuid: rpUuid, version: [1, 0, 0] },
        { module_name: "@minecraft/server", version: "1.9.0" }
      ]
    };

    const rpManifest = {
      format_version: 2,
      header: {
        name: `${projectName} RP`,
        description: projectDesc,
        uuid: rpUuid,
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0]
      },
      modules: [{ type: "resources", uuid: generateUUID(), version: [1, 0, 0] }]
    };

    const bpScripts = Object.keys(bpFiles).filter(p => p.startsWith('scripts/') && p !== 'scripts/main.js');
    const scriptBodies = bpScripts.map(p => {
      const content = bpFiles[p] as string;
      // Strip any import statements from individual scripts — we'll add one shared import at top
      return (content || '').replace(/^import\s+.*from\s+['"][^'"]+['"];?\s*/gm, '').trim();
    }).filter(Boolean);

    const mainScriptContent = [
      `import { world, system } from "@minecraft/server";`,
      ``,
      `// ${projectName} — Combined Addon Script`,
      `console.log("${projectName} Addon Loaded!");`,
      ``,
      ...scriptBodies
    ].join('\n');

    const bp: Record<string, string | Blob> = { 
      ...bpFiles, 
      'manifest.json': JSON.stringify(bpManifest, null, 2),
      'scripts/main.js': mainScriptContent
    };
    const rp: Record<string, string | Blob> = { 
      ...rpFiles, 
      'manifest.json': JSON.stringify(rpManifest, null, 2) 
    };

    const langLines: string[] = [`pack.name=${projectName}`, `pack.description=${projectDesc}`];
    const terrainTexture: any = { resource_pack_name: projectName, texture_name: "atlas.terrain", texture_data: {} };
    const itemTexture: any = { resource_pack_name: projectName, texture_name: "atlas.items", texture_data: {} };
    
    // Icon generation
    if (!rp['pack_icon.png']) {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('M', 32, 32);
        const iconBlob = await new Promise<Blob | null>(res => canvas.toBlob(res));
        if (iconBlob) rp['pack_icon.png'] = iconBlob;
      }
    }

    // Process each ported geometry
    const geometryPaths = Object.keys(rpFiles).filter(p => p.startsWith('models/blocks/') && typeof rpFiles[p] === 'string');
    
    for (const path of geometryPaths) {
      const fullFileName = path.split('/').pop()?.replace('.json', '') || 'item';
      const shortName = fullFileName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const identifier = `${sanitizedNamespace}:${shortName}`;
      
      const textureFile = Object.keys(rpFiles).find(k => 
        k.startsWith('textures/blocks/') && 
        (k.toLowerCase().includes(`/${shortName}.png`) || k.toLowerCase().includes(`/${fullFileName}.png`))
      );
      
      // Strip .png for texture aliases
      const textureAlias = shortName;
      const texturePath = textureFile ? textureFile.replace('.png', '') : `textures/blocks/${shortName}`;

      const readableName = shortName
        .split(/[_-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
      
      // Fallback texture generation (Awaitable)
      if (!textureFile) {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#4ADE80';
          ctx.fillRect(0, 0, 16, 16);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.strokeRect(2, 2, 12, 12);
          const fallbackBlob = await new Promise<Blob | null>(res => canvas.toBlob(res));
          if (fallbackBlob) rp[`${texturePath}.png`] = fallbackBlob;
        }
      }

      langLines.push(`tile.${identifier}.name=${readableName}`);
      langLines.push(`item.${identifier}.name=${readableName}`);

      const materialInstances: Record<string, any> = {
        "*": {
          "texture": textureAlias,
          "render_method": "alpha_test"
        }
      };

      try {
        const geoContent = rpFiles[path] as string;
        const geoData = JSON.parse(geoContent);
        const geo = (geoData["minecraft:geometry"] || geoData["geometry"] || [])[0] || geoData;
        const bones = geo.bones || [];
        
        bones.forEach((b: any) => {
          (b.cubes || []).forEach((c: any) => {
            if (c.material_instance && c.material_instance !== "*") {
              materialInstances[c.material_instance] = {
                "texture": textureAlias,
                "render_method": "alpha_test"
              };
              const subTex = Object.keys(rpFiles).find(k => 
                k.startsWith('textures/blocks/') && k.toLowerCase().includes(`/${c.material_instance.toLowerCase()}.png`)
              );
              if (subTex) {
                materialInstances[c.material_instance].texture = subTex.replace('.png', '').replace('textures/blocks/', '');
              }
            }
          });
        });
      } catch (e) { console.warn("Failed to scan for material instances", e); }
      
      // 1.21.30 Block + Directional Placement via Cardinal Direction State
      const bpBlock = {
        format_version: "1.21.30",
        "minecraft:block": {
          description: {
            identifier: identifier,
            menu_category: {
              category: "construction"
            },
            traits: {
              "minecraft:placement_direction": {
                "enabled_states": ["minecraft:cardinal_direction"],
                "y_rotation_offset": 180
              }
            }
          },
          components: {
            "minecraft:display_name": `tile.${identifier}.name`,
            "minecraft:geometry": {
              "identifier": `geometry.${shortName}`,
              "bone_visibility": {}
            },
            "minecraft:material_instances": materialInstances,
            "minecraft:destructible_by_mining": { "seconds_to_destroy": 1.0 },
            "minecraft:selection_box": { "origin": [-8, 0, -8], "size": [16, 16, 16] },
            "minecraft:collision_box": { "origin": [-8, 0, -8], "size": [16, 16, 16] }
          },
          permutations: [
            { "condition": "query.block_state('minecraft:cardinal_direction') == 'north'", "components": { "minecraft:transformation": { "rotation": [0, 0, 0] } } },
            { "condition": "query.block_state('minecraft:cardinal_direction') == 'west'", "components": { "minecraft:transformation": { "rotation": [0, 90, 0] } } },
            { "condition": "query.block_state('minecraft:cardinal_direction') == 'south'", "components": { "minecraft:transformation": { "rotation": [0, 180, 0] } } },
            { "condition": "query.block_state('minecraft:cardinal_direction') == 'east'", "components": { "minecraft:transformation": { "rotation": [0, -90, 0] } } }
          ]
        }
      };
      
      const bpItem = {
        format_version: "1.21.30",
        "minecraft:item": {
          description: {
            identifier: identifier,
            menu_category: { category: "items" }
          },
          components: {
            "minecraft:display_name": { "value": `tile.${identifier}.name` },
            "minecraft:icon": { "texture": textureAlias },
            "minecraft:block_placer": { "block": identifier },
            "minecraft:max_stack_size": { "value": 64 }
          }
        }
      };
      
      bp[`blocks/${shortName}.json`] = JSON.stringify(bpBlock, null, 2);
      bp[`items/${shortName}.json`] = JSON.stringify(bpItem, null, 2);
      
      terrainTexture.texture_data[textureAlias] = { textures: texturePath };
      itemTexture.texture_data[textureAlias] = { textures: texturePath };
    }

    rp['textures/item_texture.json'] = JSON.stringify(itemTexture, null, 2);
    rp['textures/terrain_texture.json'] = JSON.stringify(terrainTexture, null, 2);
    rp['texts/en_US.lang'] = langLines.join('\n');
    
    await downloadMcAddon(projectNameClean, rp, bp);
    } catch (exportErr: any) {
      console.error("Export failed:", exportErr);
      alert(`Export failed: ${exportErr.message}\n\nCheck the browser console (F12) for details.`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-vibrant-beige text-slate-800 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b-2 border-vibrant-border sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-vibrant-green rounded-xl flex items-center justify-center shadow-sm">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-vibrant-brown">ModPorter <span className="text-vibrant-green font-bold">Studio</span></h1>
        </div>
        
        <nav className="ml-auto hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
          <TabButton active={activeStep === 'setup'} onClick={() => setActiveStep('setup')} icon={<Settings className="w-4 h-4" />} label="1. Setup" />
          <TabButton active={activeStep === 'fetch'} onClick={() => setActiveStep('fetch')} icon={<Github className="w-4 h-4" />} label="2. Assets" />
          <TabButton active={activeStep === 'creative'} onClick={() => setActiveStep('creative')} icon={<Sparkles className="w-4 h-4" />} label="3. Creative Forge" />
          <TabButton active={activeStep === 'port'} onClick={() => setActiveStep('port')} icon={<Database className="w-4 h-4" />} label="4. Port Studio" />
          <TabButton active={activeStep === 'export'} onClick={() => setActiveStep('export')} icon={<Download className="w-4 h-4" />} label="5. Export" />
        </nav>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 bg-[#F1F3F4] px-4 py-2 rounded-full border border-slate-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">iPad Engine Ready</span>
          </div>
          <button 
            onClick={handleExport}
            className="vibrant-button-primary bg-vibrant-orange border-vibrant-orange-dark uppercase text-sm"
          >
            EXPORT .MCADDON
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Pipeline Steps */}
        <aside className="w-72 bg-white border-r-2 border-vibrant-border p-6 flex flex-col gap-4 overflow-y-auto">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Translation Pipeline</h2>
          
          <PipelineStep 
            active={activeStep === 'setup'} 
            completed={activeStep !== 'setup'} 
            number="1" 
            title="Setup Project" 
            desc="Configure names & source" 
          />
          <PipelineStep 
            active={activeStep === 'fetch'} 
            completed={activeStep === 'port' || activeStep === 'export'} 
            number="2" 
            title="Fetch Assets" 
            desc={`${scrapedFiles.length} models localized`} 
          />
          <PipelineStep 
            active={activeStep === 'creative'} 
            completed={activeStep === 'port' || activeStep === 'export'} 
            number="3" 
            title="Creative Forge" 
            desc={`${ideas.length} ideas generated`} 
          />
          <PipelineStep 
            active={activeStep === 'port'} 
            completed={activeStep === 'export'} 
            number="4" 
            title="Bedrock Porting" 
            desc="LLM-assisted conversion" 
          />
          <PipelineStep 
            active={activeStep === 'export'} 
            completed={false} 
            number="5" 
            title="Export Packs" 
            desc="Generate .mcaddon file" 
          />

          <div className="mt-auto p-4 bg-slate-100 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">Target Project</p>
            <p className="text-sm font-black text-slate-700 truncate">{projectName}</p>
            <p className="text-[10px] text-vibrant-green font-bold mt-1 uppercase">Ready for Deployment</p>
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="flex-1 bg-vibrant-viewport p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeStep === 'setup' && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="vibrant-card p-8">
                    <h2 className="text-xl font-black mb-6 text-vibrant-brown">Project Configuration</h2>
                    <div className="space-y-4">
                      <Input label="Project Name" value={projectName} onChange={setProjectName} />
                      <Input label="Namespace" value={namespace} onChange={setNamespace} />
                      <Input 
                        label="GitHub Repository URL" 
                        value={githubUrl} 
                        onChange={setGithubUrl} 
                        placeholder="https://github.com/user/repo" 
                      />
                      <div className="flex gap-4 mt-4">
                        <button 
                          onClick={handleFetchGithub}
                          disabled={setupLoading}
                          className={`vibrant-button-secondary flex-1 py-4 flex items-center justify-center gap-3 transition-all ${
                            setupLoading ? 'opacity-70 bg-slate-400' : ''
                          }`}
                        >
                          {setupLoading ? (
                            <>
                              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                              ANALYZING MOD REPO...
                            </>
                          ) : (
                            <>
                              <Github className="w-5 h-5" />
                              FETCH MOD ASSETS
                            </>
                          )}
                        </button>

                        {setupLoading && (
                          <button 
                            onClick={handleStopFetch}
                            className="bg-vibrant-orange hover:bg-vibrant-orange-dark text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-vibrant-orange/30 transition-all flex items-center gap-2"
                          >
                            <FastForward className="w-4 h-4" />
                            Use Current
                          </button>
                        )}
                        
                        {!setupLoading && Object.keys(rpFiles).length > 0 && (
                          <button 
                            onClick={() => {
                              if(confirm("Clear all project data? This cannot be undone.")) {
                                localStorage.clear();
                                setRpFiles({});
                                setBpFiles({});
                                setScrapedFiles([]);
                                setIdeas([]);
                                setActiveStep('setup');
                                window.location.reload();
                              }
                            }}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-4 rounded-2xl transition-all flex items-center gap-2"
                            title="Clear All Data"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {Object.keys(rpFiles).length > 0 && !setupLoading && (
                        <div className="p-4 bg-vibrant-green/10 border border-vibrant-green/20 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Database className="w-4 h-4 text-vibrant-green" />
                            <span className="text-[10px] font-black text-vibrant-green uppercase tracking-widest">
                               Session Restored: {Object.keys(rpFiles).length} Assets Cached
                            </span>
                          </div>
                          <button 
                            onClick={() => setActiveStep('port')}
                            className="text-[9px] font-black text-vibrant-green hover:underline uppercase"
                          >
                            Jump to Porting →
                          </button>
                        </div>
                      )}
                      
                      {fetchProgress && (
                        <div className="mt-4 p-4 bg-slate-900 rounded-2xl border-2 border-slate-800 shadow-xl overflow-hidden relative">
                           <div className="flex justify-between items-center mb-2">
                             <div className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-vibrant-green rounded-full animate-pulse" />
                               {fetchProgress.message}
                             </div>
                             {fetchProgress.total > 0 && (
                               <span className="text-[10px] font-mono text-slate-400">
                                 {fetchProgress.current}/{fetchProgress.total}
                               </span>
                             )}
                           </div>
                           {fetchProgress.total > 0 && (
                             <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
                                 className="h-full bg-vibrant-green"
                               />
                             </div>
                           )}
                           <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-vibrant-green/5 to-transparent pointer-events-none" />
                        </div>
                      )}
                      {error && (
                        <div className="p-4 bg-vibrant-orange-light border-2 border-vibrant-orange text-vibrant-orange-dark rounded-2xl text-sm font-bold flex gap-3">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          {error}
                        </div>
                      )}
                    </div>
                  </section>
                  
                  <div className="space-y-6">
                    <div className="vibrant-card p-8 bg-vibrant-green-light border-vibrant-green/30">
                      <h3 className="font-black text-vibrant-green-dark uppercase tracking-widest text-sm mb-4">iPad Porting Guide</h3>
                      <ul className="space-y-4">
                        <li className="flex gap-4">
                          <div className="w-6 h-6 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                          <p className="text-sm text-vibrant-green-dark/80 font-medium">Link your favorite open-source Java mod from GitHub.</p>
                        </li>
                        <li className="flex gap-4">
                          <div className="w-6 h-6 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
                          <p className="text-sm text-vibrant-green-dark/80 font-medium">Convert complex Java models to lightweight Bedrock shapes.</p>
                        </li>
                        <li className="flex gap-4">
                          <div className="w-6 h-6 rounded-full bg-vibrant-green text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
                          <p className="text-sm text-vibrant-green-dark/80 font-medium">Download the .mcaddon and open it directly in Minecraft iOS.</p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeStep === 'fetch' && (
              <motion.div 
                key="fetch"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-vibrant-brown">Extracted Java Assets</h2>
                    <p className="text-slate-500">Select models to batch-port to Bedrock</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex bg-white rounded-full border-2 border-vibrant-border p-1">
                      <button onClick={selectAllAssets} className="px-3 py-1 text-[10px] font-black hover:bg-slate-50 rounded-full transition-colors">ALL</button>
                      <button onClick={deselectAllAssets} className="px-3 py-1 text-[10px] font-black hover:bg-slate-50 rounded-full transition-colors">NONE</button>
                    </div>

                    <button 
                      onClick={() => handleBatchPort(selectedAssetShas)}
                      disabled={isLoading || selectedAssetShas.size === 0}
                      className="vibrant-button-secondary py-2 text-xs flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3" />
                      PORT SELECTED ({selectedAssetShas.size})
                    </button>

                    <button 
                      onClick={() => {
                        const allShas = new Set<string>(scrapedFiles.map(f => f.sha));
                        handleBatchPort(allShas);
                      }}
                      disabled={isLoading || scrapedFiles.length === 0}
                      className="px-4 py-2 bg-vibrant-brown text-white rounded-full font-bold text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                    >
                      PORT ALL ({scrapedFiles.length})
                    </button>

                    <button 
                      onClick={() => {
                        setSelectedFile({ name: 'custom_furniture.json', content: '{}' });
                        setActiveStep('port');
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-800"
                    >
                      + Manual
                    </button>
                  </div>
                </div>

                {conversionProgress && (
                  <div className="vibrant-card p-6 border-b-8 border-vibrant-orange animate-pulse">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-black text-vibrant-orange-dark uppercase tracking-widest">Converting Models via AI...</span>
                       <span className="font-mono text-xs">{conversionProgress.current} / {conversionProgress.total}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                       <div 
                        className="h-full bg-vibrant-orange transition-all duration-300"
                        style={{ width: `${(conversionProgress.current / conversionProgress.total) * 100}%` }}
                       />
                    </div>
                    {scrapedFiles.length > 0 && !conversionProgress && (
                      <div className="mt-4 flex justify-end">
                        <button 
                          onClick={() => setActiveStep('creative')}
                          className="bg-vibrant-green text-white px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-vibrant-green/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                        >
                          Continue to Creative Forge
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {scrapedFiles && scrapedFiles.length > 0 ? scrapedFiles.map((file, idx) => (
                    <div 
                      key={`${file?.sha || idx}-${idx}`} 
                      className={`vibrant-card p-4 flex items-center gap-4 cursor-pointer group transition-all hover:scale-105 ${
                        selectedAssetShas.has(file?.sha) ? 'border-vibrant-green bg-vibrant-green-light' : 'hover:border-vibrant-green'
                      }`}
                      onClick={() => file?.sha && toggleAssetSelection(file.sha)}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shrink-0 ${
                        selectedAssetShas.has(file?.sha) ? 'bg-white border-vibrant-green' : 'bg-slate-50 border-vibrant-border'
                      }`}>
                         {selectedAssetShas.has(file?.sha) 
                          ? <CheckCircle2 className="w-6 h-6 text-vibrant-green" />
                          : <FileCode className="w-6 h-6 text-slate-400 group-hover:text-vibrant-green transition-colors" />
                         }
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-bold truncate text-slate-700">{file?.name || 'Unknown Item'}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Math.round((file?.size || 0) / 1024)} KB • JSON</div>
                      </div>
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (file) handleConvertModel(file);
                         }}
                         className="p-1 rounded-full hover:bg-vibrant-green/10 text-slate-300 hover:text-vibrant-green transition-colors"
                         title="Port Single"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center text-slate-400 font-bold italic">
                      No assets found. Try adjusting the path or repo URL.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeStep === 'creative' && (
              <motion.div 
                key="creative"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 pb-20"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[40px] border-2 border-vibrant-border shadow-md">
                  <div className="flex-1 space-y-4">
                    <h2 className="text-3xl font-black text-vibrant-brown">Creative Forge</h2>
                    <p className="text-slate-500 font-medium">Guide the AI to generate new furniture additions for your mod.</p>
                    
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Sparkles className="w-5 h-5 text-vibrant-orange group-focus-within:animate-ping" />
                      </div>
                      <input 
                        type="text"
                        value={forgeGuide}
                        onChange={(e) => setForgeGuide(e.target.value)}
                        placeholder="e.g. 'Add more gothic elements' or 'Suggest bedroom sets'..."
                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-200 rounded-3xl outline-none focus:border-vibrant-green focus:bg-white transition-all font-bold text-slate-700 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleForgeIdeas(false)}
                      disabled={isForging}
                      className="vibrant-button-secondary bg-slate-900 text-white px-8 py-4 h-full flex items-center gap-2"
                    >
                      {isForging ? "FORGING..." : "FORGE FRESH"}
                    </button>
                    <button 
                      onClick={() => handleForgeIdeas(true)}
                      disabled={isForging || ideas.length === 0}
                      className="vibrant-button-secondary bg-vibrant-orange text-white px-8 py-4 h-full flex items-center gap-2"
                    >
                      ADD MORE
                    </button>
                  </div>
                </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ideas.map((idea, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => toggleIdeaSelection(idx)}
                          className={`vibrant-card p-6 border-b-8 transition-all relative cursor-pointer group ${
                            selectedIdeaIndices.has(idx) 
                              ? 'border-vibrant-green bg-vibrant-green-light ring-4 ring-vibrant-green/20' 
                              : 'border-slate-200 hover:border-vibrant-orange'
                          }`}
                        >
                          <div 
                            className={`absolute top-4 right-4 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedIdeaIndices.has(idx) 
                                ? 'bg-vibrant-green border-vibrant-green text-white shadow-lg' 
                                : 'bg-white border-slate-200 text-slate-200 group-hover:border-vibrant-green group-hover:text-vibrant-green'
                            }`}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </div>

                      <div className="mb-4">
                        <h3 className="font-black text-xl text-vibrant-brown leading-tight pr-10">{idea?.name || "New Asset"}</h3>
                      </div>
                      
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed line-clamp-3">{idea?.description || "Description pending AI forge..."}</p>
                      
                      <div className="space-y-3 mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended States</p>
                        <div className="flex flex-wrap gap-2">
                           {Array.isArray(idea?.states) && idea.states.map((s: string) => (
                             <span key={s} className="px-2 py-1 bg-white/50 rounded text-[9px] font-mono text-slate-500 border border-slate-200">{s}</span>
                           ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black hover:bg-slate-50 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditIdea(idx);
                          }}
                        >
                          <Settings className="w-3 h-3" />
                          Fine-Tune
                        </button>
                        <button 
                          className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${
                            selectedIdeaIndices.has(idx) 
                              ? 'bg-vibrant-green text-white shadow-md' 
                              : 'bg-slate-900 text-white hover:bg-vibrant-orange'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const sanitizedName = idea?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'forge_item';
                            const geometryId = `geometry.${sanitizedName}`;
                            const content = idea.geometry || `{
  "format_version": "1.12.0",
  "minecraft:geometry": [
    {
      "description": {
        "identifier": "${geometryId}",
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
            {
              "origin": [-8, 0, -8],
              "size": [16, 16, 16],
              "uv": [0, 0]
            }
          ]
        }
      ]
    }
  ]
}`;
                            
                            const blockState = `{
  "format_version": "1.21.30",
  "minecraft:block_state": {
    "description": { "identifier": "${namespace}:${sanitizedName}" },
    "states": {}
  }
}`;

                            const script = `// Behavior for ${idea?.name}\nconsole.log("Loaded behavior for ${sanitizedName}");`;

                            // Add to pack memory
                            setRpFiles(prev => ({ 
                              ...prev, 
                              [`models/blocks/${sanitizedName}.json`]: content,
                              [`block_states/${sanitizedName}.json`]: blockState
                            }));
                            setBpFiles(prev => ({
                              ...prev,
                              [`scripts/${sanitizedName}.js`]: script
                            }));

                            setSelectedFile({ name: `${sanitizedName}.json`, content });
                            setActiveStep('port');
                            setActiveTool('geometry');
                          }}
                        >
                          <Wand2 className="w-4 h-4" />
                          Forge Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {ideas.length > 0 && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl px-10 py-6 rounded-full border-2 border-vibrant-border shadow-2xl flex items-center gap-10 z-[100]"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Selection State</span>
                      <span className="text-sm font-black text-vibrant-brown">Selected {selectedIdeaIndices.size} New Blocks</span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        // Commit selected ideas to the workspace
                        const newRpFiles = { ...rpFiles };
                        const newBpFiles = { ...bpFiles };
                        let firstFile: any = null;

                        Array.from(selectedIdeaIndices).forEach(idx => {
                          const idea = ideas[idx];
                          const sanitizedName = idea?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') || `forge_item_${idx}`;
                          const geometryId = `geometry.${sanitizedName}`;
                          const content = idea.geometry || `{
  "format_version": "1.12.0",
  "minecraft:geometry": [
    {
      "description": {
        "identifier": "${geometryId}",
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
            {
              "origin": [-8, 0, -8],
              "size": [16, 16, 16],
              "uv": [0, 0]
            }
          ]
        }
      ]
    }
  ]
}`;
                          const rpPath = `models/blocks/${sanitizedName}.json`;
                          const statePath = `block_states/${sanitizedName}.json`;
                          newRpFiles[rpPath] = content;
                          newRpFiles[statePath] = `{
  "format_version": "1.21.30",
  "minecraft:block_state": {
    "description": { "identifier": "${namespace}:${sanitizedName}" },
    "states": {}
  }
}`;
                          newBpFiles[`scripts/${sanitizedName}.js`] = idea.script || `// Behavior for ${idea?.name}`;

                          if (!firstFile) firstFile = { name: `${sanitizedName}.json`, content };
                        });

                        setRpFiles(newRpFiles);
                        setBpFiles(newBpFiles);
                        if (firstFile) setSelectedFile(firstFile);
                        setActiveStep('port');
                        setActiveTool('geometry');
                      }}
                      className="bg-vibrant-green text-white px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-vibrant-green/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                      PROCEED TO PORTING
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    <button 
                      onClick={handleExport}
                      className="bg-slate-900 text-white px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center gap-3"
                    >
                      QUICK EXPORT
                      <Download className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}

                {ideas.length === 0 && !isForging && (
                  <div className="text-center py-32 bg-slate-50 rounded-[60px] border-4 border-dashed border-slate-200">
                    <Sparkles className="w-24 h-24 mx-auto mb-6 text-slate-200 animate-pulse" />
                    <h3 className="text-2xl font-black text-slate-400">The Forge is Cold</h3>
                    <p className="text-slate-400 font-bold max-w-sm mx-auto mt-2 italic">Add a prompt above to generate your first batch of ideas</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeStep === 'port' && (
              <motion.div 
                key="port"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-12 gap-8 h-[calc(100vh-160px)] min-h-[600px]"
              >
                <div className="col-span-3 flex flex-col gap-6">
                  <div className="vibrant-card flex-1 flex flex-col p-6 shadow-xl border-b-8 border-vibrant-brown">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-vibrant-brown">
                      <Layers className="w-5 h-5 text-vibrant-green" />
                      Studio Lib
                    </h3>
                    
                    <div className="flex flex-col gap-1 mb-6 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <ToolButton active={activeTool === 'geometry'} onClick={() => setActiveTool('geometry')} label="Geometry" />
                      <ToolButton active={activeTool === 'states'} onClick={() => setActiveTool('states')} label="Block States" />
                      <ToolButton active={activeTool === 'entities'} onClick={() => setActiveTool('entities')} label="Spawnable" />
                      <ToolButton active={activeTool === 'scripts'} onClick={() => setActiveTool('scripts')} label="Behaviors" />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 border-t border-slate-100 pt-4">
                      {(() => {
                        const allProjectPaths = [
                          ...Object.keys(rpFiles).map(p => ({ path: p, pack: 'rp' })),
                          ...Object.keys(bpFiles).map(p => ({ path: p, pack: 'bp' }))
                        ];

                        const projectFiles = allProjectPaths
                          .filter(p => {
                            const content = p.pack === 'rp' ? rpFiles[p.path] : bpFiles[p.path];
                            return typeof content === 'string' && (content as string).length > 0;
                          })
                          .filter(p => {
                            const path = p.path;
                            if (activeTool === 'geometry') return path.startsWith('models/');
                            if (activeTool === 'states') return path.startsWith('block_states/');
                            if (activeTool === 'entities') return path.startsWith('entity/') || path.startsWith('entities/');
                            if (activeTool === 'scripts') return path.startsWith('scripts/') || path.startsWith('functions/');
                            return false;
                          });

                        const examples = BEDROCK_EXAMPLES.filter(e => e.category === activeTool);

                        if (projectFiles.length === 0 && examples.length === 0) {
                          return <div className="text-[10px] text-slate-400 italic text-center py-10">No items found in this category.</div>;
                        }

                        return (
                          <>
                            {projectFiles.map((fileObj) => {
                              const path = fileObj.path;
                              const content = fileObj.pack === 'rp' ? rpFiles[path] : bpFiles[path];
                              const name = path.split('/').pop() || path;
                              const baseName = name.replace('.json', '');
                              const texturePath = Object.keys(rpFiles).find(k => 
                                k.startsWith('textures/blocks/') && 
                                (k.toLowerCase().includes(`/${baseName}.png`) || k.toLowerCase().includes(baseName.toLowerCase()))
                              );
                              const textureBlob = texturePath ? rpFiles[texturePath] as Blob : undefined;

                              return (
                                <div key={path} className="group relative">
                                  <button 
                                    onClick={() => setSelectedFile({ name, content: content as string, textureBlob })}
                                    className={`w-full text-left p-3 rounded-2xl transition-all text-xs font-bold border-2 flex items-center gap-3 ${
                                      selectedFile?.name === name 
                                      ? 'bg-vibrant-green-light border-vibrant-green text-vibrant-green-dark' 
                                      : 'hover:bg-slate-50 border-transparent text-slate-600'
                                    }`}
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                      {textureBlob ? (
                                        <img src={URL.createObjectURL(textureBlob)} className="w-full h-full object-contain pixelated" alt="" />
                                      ) : <Database className="w-4 h-4 text-slate-300" />}
                                    </div>
                                    <span className="truncate pr-8">{name}</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(path); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-vibrant-orange/10 text-vibrant-orange transition-all rounded-lg"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                            
                            {examples.length > 0 && (
                              <div className="pt-4 pb-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Example Library</p>
                                {examples.map((ex, idx) => (
                                  <button 
                                    key={`ex-${idx}`}
                                    onClick={() => setSelectedFile({ name: `${ex.name.toLowerCase().replace(/\s/g, '_')}.json`, content: ex.content })}
                                    className="w-full text-left p-3 rounded-2xl transition-all text-[10px] font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-3 mb-1 opacity-70 hover:opacity-100"
                                  >
                                    <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center shrink-0">
                                      <Search className="w-3 h-3 text-slate-400" />
                                    </div>
                                    <span className="truncate">Example: {ex.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="vibrant-card p-6 bg-slate-900 border-b-8 border-vibrant-orange text-white">
                    <h4 className="flex items-center gap-2 text-vibrant-orange font-black text-xs mb-4 uppercase tracking-widest">
                       <Sparkles className="w-4 h-4" />
                       Code Co-pilot
                    </h4>
                    
                    <div className="bg-white/10 p-4 rounded-2xl text-[11px] font-medium leading-relaxed mb-4 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                       {isAiLoading ? "AI is processing your request..." : aiResponse || "Ask me to 'Add rotation' or 'Explain this code'."}
                    </div>

                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
                        placeholder="Type instruction..." 
                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-4 py-3 text-xs outline-none focus:border-vibrant-green transition-all" 
                      />
                      <button 
                        onClick={handleAiChat}
                        disabled={isAiLoading || !selectedFile}
                        className="w-full bg-vibrant-orange text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        RUN AI REFINEMENT
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-span-9 flex flex-col gap-6">
                   <div className="vibrant-card editor-surface flex-1 flex flex-col border-t-8 border-vibrant-orange relative group shadow-2xl">
                      <div className="absolute top-6 right-8 flex gap-2 z-10">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
                      </div>

                      <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                         <div className="flex items-center gap-3">
                           <div className="p-2 bg-vibrant-orange/10 rounded-lg">
                             <Database className="w-4 h-4 text-vibrant-orange" />
                           </div>
                           <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Workspace</span>
                             <span className="text-xs font-mono text-slate-900 font-black truncate max-w-[120px]">{selectedFile?.name || 'idle_mod_studio.json'}</span>
                           </div>
                         </div>

                         <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                           <button 
                             onClick={() => setViewMode('editor')}
                             className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'editor' ? 'bg-white shadow-sm text-vibrant-orange' : 'text-slate-400'}`}
                           >
                             <Code className="w-3 h-3" />
                             Editor
                           </button>
                           <button 
                             onClick={() => setViewMode('preview')}
                             className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'preview' ? 'bg-white shadow-sm text-vibrant-green' : 'text-slate-400'}`}
                           >
                             <Eye className="w-3 h-3" />
                             3D View
                           </button>
                           <button 
                             onClick={() => setViewMode('blockbench')}
                             className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'blockbench' ? 'bg-white shadow-sm text-[#3e90ff]' : 'text-slate-400'}`}
                           >
                             <Layers className="w-3 h-3" />
                             Blockbench
                           </button>
                         </div>

                         {/* JSON Status Badge */}
                         {selectedFile && (
                           <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-2 ${
                             (() => {
                               try { JSON.parse(selectedFile.content); return true; } catch(e) { return false; }
                             })() ? 'bg-vibrant-green-light border-vibrant-green/20 text-vibrant-green-dark' : 'bg-vibrant-orange-light border-vibrant-orange/20 text-vibrant-orange-dark'
                           }`}>
                             {(() => {
                               try { JSON.parse(selectedFile.content); return '✓ Valid JSON'; } catch(e) { return '✗ JSON Error'; }
                             })()}
                           </div>
                         )}

                         <div className="flex flex-wrap gap-2 w-full md:w-auto">
                           <button 
                            onClick={handleExplainCode}
                            disabled={isAiLoading || !selectedFile}
                            className="flex-1 md:flex-none text-[10px] font-black text-vibrant-brown hover:bg-slate-200 px-4 py-2 bg-slate-100 rounded-full border border-slate-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                           >
                              <Search className="w-3 h-3" />
                              <span className="hidden sm:inline">Explain</span> Code
                           </button>
                           <button 
                            className="flex-1 md:flex-none bg-vibrant-green text-white px-6 md:px-8 py-2 rounded-full text-xs font-black shadow-lg hover:scale-105 transition-transform uppercase border-b-4 border-vibrant-green-dark flex items-center justify-center gap-2"
                            onClick={() => {
                              if (selectedFile) {
                                setRpFiles(prev => ({ ...prev, [`models/blocks/${selectedFile.name}`]: selectedFile.content }));
                                alert("WORKSPACE SAVED: Files updated in local pack!");
                              }
                            }}
                           >
                              <Settings className="w-3 h-3" />
                              SAVE
                           </button>
                           <button 
                            className="flex-1 md:flex-none bg-slate-900 text-white px-6 md:px-8 py-2 rounded-full text-xs font-black shadow-lg hover:scale-105 transition-transform uppercase flex items-center justify-center gap-2 border-b-4 border-slate-700 whitespace-nowrap"
                            onClick={() => setActiveStep('export')}
                           >
                              EXPORT
                              <ChevronRight className="w-4 h-4" />
                           </button>
                         </div>
                      </div>
                      
                      <div className="flex-1 relative overflow-hidden bg-slate-50">
                        {viewMode === 'editor' ? (
                          <textarea 
                             key={`${activeStep}-${activeTool}-${selectedFile?.name}`}
                             value={(() => {
                               if (!selectedFile) return '';
                               const baseName = selectedFile.name.replace('.json', '');
                               const path = {
                                 geometry: `models/blocks/${baseName}.json`,
                                 states: `block_states/${baseName}.json`,
                                 entities: `entity/${baseName}.json`,
                                 scripts: `scripts/${baseName}.js`
                               }[activeTool as 'geometry' | 'states' | 'entities' | 'scripts'];

                               return (path.startsWith('scripts/') ? bpFiles[path] : rpFiles[path]) || `// No ${activeTool} found for ${baseName}. Click 'SAVE' to initialize if needed or 'RUN AI REFINEMENT'.`;
                             })() as string}
                             onChange={(e) => {
                               if (!selectedFile) return;
                               const baseName = selectedFile.name.replace('.json', '');
                               const newVal = e.target.value;
                               const path = {
                                 geometry: `models/blocks/${baseName}.json`,
                                 states: `block_states/${baseName}.json`,
                                 entities: `entity/${baseName}.json`,
                                 scripts: `scripts/${baseName}.js`
                               }[activeTool as 'geometry' | 'states' | 'entities' | 'scripts'];

                               if (path.startsWith('scripts/')) {
                                 setBpFiles(prev => ({ ...prev, [path]: newVal }));
                               } else {
                                 setRpFiles(prev => ({ ...prev, [path]: newVal }));
                               }
                             }}
                             className="absolute inset-0 w-full h-full p-10 font-mono text-sm resize-none outline-none text-slate-800 leading-relaxed custom-scrollbar selection:bg-vibrant-orange/30 bg-transparent"
                             spellCheck={false}
                             placeholder="Select a file or 'FORGE' a new one to begin editing code..."
                          />
                        ) : viewMode === 'preview' ? (
                          <div className="absolute inset-0">
                             <ModelViewer 
                               json={selectedFile?.content || ''} 
                               textureBlob={selectedFile?.textureBlob} 
                               onUpdate={(newJson) => setSelectedFile((prev: any)=> prev? { ...prev, content: newJson } : null)}
                             />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-12 text-center text-white">
                             <img src="https://www.blockbench.net/logo_fluffy.png" className="w-24 h-24 mb-6" alt="Blockbench" />
                             <h3 className="text-2xl font-black mb-4">Blockbench 3D Editor</h3>
                             <p className="text-slate-400 max-w-md mb-8 text-sm font-medium">
                               To edit your model in professional 3D, download the Bedrock JSON below and upload it to Blockbench Web.
                             </p>
                             
                             <div className="flex gap-4">
                               <button 
                                 onClick={() => {
                                   if (!selectedFile) return;
                                   const blob = new Blob([selectedFile.content], { type: 'application/json' });
                                   const url = URL.createObjectURL(blob);
                                   const a = document.createElement('a');
                                   a.href = url;
                                   a.download = selectedFile.name;
                                   a.click();
                                 }}
                                 className="vibrant-button-primary bg-[#3e90ff] border-[#3e90ff] shadow-lg shadow-[#3e90ff]/20 px-8 flex items-center gap-2"
                               >
                                 <Download className="w-4 h-4" />
                                 DOWNLOAD FOR BLOCKBENCH
                               </button>
                               <a 
                                 href="https://web.blockbench.net/" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="vibrant-button-secondary bg-white text-slate-900 border-white px-8 flex items-center gap-2"
                               >
                                 LAUNCH BLOCKBENCH WEB
                                 <ChevronRight className="w-4 h-4" />
                               </a>
                             </div>
                             
                             <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/10 max-w-lg text-left">
                               <h4 className="text-[10px] font-black uppercase text-vibrant-orange mb-3 tracking-widest">How to use Blockbench:</h4>
                               <ul className="space-y-2 text-[11px] text-slate-300 font-medium">
                                 <li className="flex gap-2">
                                   <div className="w-4 h-4 rounded-full bg-vibrant-orange/20 text-vibrant-orange flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">1</div>
                                   Download the JSON model file from ModPorter.
                                 </li>
                                 <li className="flex gap-2">
                                   <div className="w-4 h-4 rounded-full bg-vibrant-orange/20 text-vibrant-orange flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">2</div>
                                   Open web.blockbench.net and select "File {'>'} Open Model".
                                 </li>
                                 <li className="flex gap-2">
                                   <div className="w-4 h-4 rounded-full bg-vibrant-orange/20 text-vibrant-orange flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">3</div>
                                   After editing, export back to "Bedrock Geometry" and paste the code back here.
                                 </li>
                               </ul>
                             </div>
                          </div>
                        )}
                        
                        {aiExplain && (
                          <div className="absolute inset-x-0 bottom-0 bg-vibrant-green text-white p-6 max-h-[40%] overflow-y-auto z-20 shadow-2xl animate-bounce-in border-t-4 border-white/20">
                             <div className="flex justify-between items-center mb-4">
                               <h5 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                 <Sparkles className="w-4 h-4" />
                                 AI Code Breakdown
                               </h5>
                               <button onClick={() => setAiExplain(null)} className="p-1 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
                             </div>
                             <div className="text-xs font-medium leading-relaxed max-w-none">
                                {aiExplain}
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 border-t border-slate-100 p-6">
                         <div className="flex items-center justify-between mb-4">
                           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                             In-Game Content Manifest (iPad Optimized)
                           </h4>
                           <button 
                             onClick={handleExport}
                             className="bg-vibrant-orange hover:bg-vibrant-orange-dark text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 shadow-lg shadow-vibrant-orange/20"
                           >
                             <Download className="w-3 h-3" />
                             Final Export
                           </button>
                         </div>
                         <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                           {Object.keys(rpFiles).filter(p => p.startsWith('models/blocks/') && typeof rpFiles[p] === 'string' && (rpFiles[p] as string).length > 20).map((path, idx) => {
                             const fileName = path.split('/').pop()?.replace('.json', '') || 'item';
                             const name = fileName.replace(/^(item_|block_)/, '');
                             return (
                               <div key={idx} className="aspect-square bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                                  <div className="flex-1 flex items-center justify-center w-full">
                                    <div className="w-8 h-8 bg-vibrant-orange/10 rounded-md flex items-center justify-center">
                                      <BlocksIcon className="w-4 h-4 text-vibrant-orange" />
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-900/10 py-1 px-2 text-center">
                                     <div className="text-[7px] font-black text-slate-600 truncate">{name}</div>
                                  </div>
                                  
                                  {/* Mobile-friendly overlay on tap/hover */}
                                  <div className="absolute inset-0 bg-slate-900/90 text-[7px] text-white p-2 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal text-center font-mono">
                                     <span className="text-vibrant-orange font-bold mb-1 truncate w-full">{name}</span>
                                     <span className="opacity-50 break-all">{namespace}:{name}</span>
                                  </div>
                               </div>
                             );
                           })}
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeStep === 'export' && (
               <motion.div 
               key="export"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex items-center justify-center min-h-[500px]"
             >
                <div className="vibrant-card max-w-xl w-full p-12 text-center space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-vibrant-green via-vibrant-orange to-vibrant-green" />
                  <div className="w-24 h-24 bg-vibrant-green-light rounded-3xl flex items-center justify-center mx-auto shadow-inner border-2 border-vibrant-green/20">
                    <CheckCircle2 className="w-12 h-12 text-vibrant-green" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-vibrant-brown">Add-on Export Ready</h2>
                    <p className="text-slate-500 mt-2 font-medium">All components have been successfully cross-compiled.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <StatusCard label="Resource Pack" status="Generated" />
                    <StatusCard label="Behavior Pack" status="Linked" />
                    <StatusCard label="UUID Harmony" status="Verified" />
                    <StatusCard label="Compatibility" status="iPadOS OK" />
                  </div>

                  {/* iOS Install Guide */}
                  <div className="p-8 bg-vibrant-green-light rounded-[40px] border-2 border-vibrant-green/30 text-left">
                     <h3 className="text-vibrant-green-dark font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        iOS Installation Guide
                     </h3>
                     <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                          <p className="text-xs text-vibrant-green-dark font-medium leading-relaxed">Download and open the **Files app** on your iPad. Locate the downloaded **.mcaddon** file.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                          <p className="text-xs text-vibrant-green-dark font-medium leading-relaxed">Tap and hold the file, select **Share**, then choose **Minecraft** from the list of apps.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                          <p className="text-xs text-vibrant-green-dark font-medium leading-relaxed">In Minecraft, go to **Settings {'>'} Global Resources** to activate the Resource Pack.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-5 h-5 rounded-full bg-vibrant-green text-white flex items-center justify-center text-[10px] font-black shrink-0">4</div>
                          <p className="text-xs text-vibrant-green-dark font-medium leading-relaxed">When creating or editing a world, ensure **Behavior Packs** and **Experiments** (Beta APIs) are enabled.</p>
                        </div>
                     </div>
                  </div>

                  <div className="bg-slate-900 rounded-[32px] p-6 border-b-8 border-slate-700">
                    <h3 className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-left flex items-center gap-2">
                       <Package className="w-4 h-4 text-vibrant-orange" />
                       Inventory Preview
                    </h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                       {Object.keys(rpFiles).filter(p => p.startsWith('models/blocks/') && typeof rpFiles[p] === 'string' && (rpFiles[p] as string).length > 20).map((path, idx) => {
                         const fullFileName = path.split('/').pop()?.replace('.json', '') || 'item';
                         const name = fullFileName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                         
                         const textureFile = Object.keys(rpFiles).find(k => 
                           k.startsWith('textures/blocks/') && 
                           (k.toLowerCase().includes(`/${name}.png`) || k.toLowerCase().includes(`/${fullFileName}.png`))
                         );
                         const textureBlob = textureFile ? rpFiles[textureFile] as Blob : undefined;
                         const readableName = name.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                         return (
                           <div key={idx} className="bg-white/5 rounded-2xl border border-white/10 p-3 flex flex-col items-center gap-2 group transition-all hover:bg-white/10 relative">
                              <div className="w-full aspect-square bg-slate-800 rounded-xl flex items-center justify-center border border-white/20 shadow-lg relative overflow-hidden group">
                                {textureBlob ? (
                                  <img 
                                    src={URL.createObjectURL(textureBlob)} 
                                    className="w-full h-full object-contain pixelated" 
                                    alt={name}
                                  />
                                ) : (
                                  <BlocksIcon className="w-6 h-6 text-vibrant-orange opacity-40" />
                                )}
                                <div className="absolute top-1 right-1 px-1 bg-vibrant-green rounded text-[6px] text-white font-black tracking-widest backdrop-blur">NEW</div>
                                
                                {/* Full details on hover */}
                                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-3 opacity-0 group-hover:opacity-100 transition-opacity text-center">
                                  <span className="text-[10px] text-white font-black mb-1 leading-tight">{readableName}</span>
                                  <span className="text-[7px] text-vibrant-orange font-mono opacity-80 break-all">{namespace}:{name}</span>
                                </div>
                              </div>
                              <div className="w-full text-center">
                                 <div className="text-[9px] text-white/60 font-black truncate leading-tight group-hover:text-white">{readableName}</div>
                              </div>
                           </div>
                         );
                       })}
                      {Array.from({ length: Math.max(0, 12 - Object.keys(rpFiles).filter(p => p.startsWith('models/blocks/')).length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square bg-white/5 rounded-xl border border-white/5 flex items-center justify-center opacity-10">
                           <div className="w-6 h-6 border-2 border-dashed border-white/20 rounded-lg" />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-6 text-center italic flex items-center justify-center gap-2">
                      <Search className="w-3 h-3" />
                      Search for these names in your Minecraft creative inventory
                    </p>
                  </div>

                  <button 
                    onClick={handleExport}
                    className="vibrant-button-primary w-full py-6 text-xl"
                  >
                    DOWNLOAD .MCADDON
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <Sparkles className="w-3 h-3" />
                    Built with Gemini Pro Engine
                    <Sparkles className="w-3 h-3" />
                  </div>
                </div>
             </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer / Status Bar */}
      <footer className="h-10 border-t-2 border-vibrant-border bg-white px-8 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> Translation Server Active</span>
          <span>Version 2.4.0-Stable</span>
        </div>
        <div>
          Advanced Modding for Bedrock Edition
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`vibrant-tab ${active ? 'vibrant-tab-active' : 'vibrant-tab-inactive'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`text-left px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        active 
          ? 'bg-vibrant-brown text-white shadow-inner' 
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function PipelineStep({ active, completed, number, title, desc }: { active: boolean, completed: boolean, number: string, title: string, desc: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${
      active 
        ? 'bg-vibrant-orange-light border-vibrant-orange shadow-md scale-[1.02]' 
        : completed 
          ? 'bg-vibrant-green-light border-vibrant-green' 
          : 'bg-white border-slate-100 opacity-60'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
        active 
          ? 'bg-vibrant-orange text-white' 
          : completed 
            ? 'bg-vibrant-green text-white' 
            : 'bg-slate-200 text-slate-400'
      }`}>
        {completed ? '✓' : number}
      </div>
      <div>
        <p className={`text-sm font-black ${
          active 
            ? 'text-vibrant-orange-dark' 
            : completed 
              ? 'text-vibrant-green-dark' 
              : 'text-slate-600'
        }`}>{title}</p>
        <p className={`text-[10px] font-bold ${
          active 
            ? 'text-vibrant-orange' 
            : completed 
              ? 'text-vibrant-green' 
              : 'text-slate-400'
        }`}>{desc}</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "" }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-vibrant-green focus:bg-white outline-none transition-all"
      />
    </div>
  );
}

function StatusCard({ label, status }: { label: string, status: string }) {
  return (
    <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-left">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</p>
      <p className="text-sm font-black text-vibrant-green">{status}</p>
    </div>
  );
}
