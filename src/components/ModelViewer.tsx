import React, { useEffect, useRef, useState, useMemo } from 'react';
import { RotateCw, Maximize2, MousePointer2, Move, ZoomIn, ZoomOut, Camera, Plus, Undo2, Redo2, Copy, Trash2, Database } from 'lucide-react';

interface Cube {
  origin: [number, number, number];
  size: [number, number, number];
  uv?: [number, number];
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
}

interface Bone {
  name: string;
  cubes?: Cube[];
  pivot?: [number, number, number];
}

interface ModelViewerProps {
  json: string;
  textureBlob?: Blob;
  onUpdate?: (newJson: string) => void;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ json, textureBlob, onUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: -25, y: 45 });
  const [zoom, setZoom] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [textureImage, setTextureImage] = useState<HTMLImageElement | null>(null);
  
  // Selection State
  const [selectedBoneIdx, setSelectedBoneIdx] = useState<number | null>(null);
  const [selectedCubeIdx, setSelectedCubeIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  
  // Transformation Presets
  const [customPresets, setCustomPresets] = useState<{name: string, size: [number, number, number], origin: [number, number, number]}[]>(() => {
  try {
    const saved = localStorage.getItem('mp_model_presets');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
});

  const PRESET_DEFAULTS = [
    { name: 'Full Cube', size: [16, 16, 16], origin: [-8, 0, -8] },
    { name: 'Slab', size: [16, 8, 16], origin: [-8, 0, -8] },
    { name: 'Pillar', size: [8, 16, 8], origin: [-4, 0, -4] },
    { name: 'Half Cube', size: [8, 16, 16], origin: [-4, 0, -8] },
    { name: 'Wall', size: [16, 16, 4], origin: [-8, 0, -2] },
  ];

  const applyPreset = (preset: { size: number[], origin: number[] }) => {
    updateGeometry({
      size: preset.size,
      origin: preset.origin
    });
  };

  const saveCurrentAsPreset = () => {
    if (selectedBoneIdx === null || selectedCubeIdx === null || !modelData[selectedBoneIdx]) return;
    const cube = modelData[selectedBoneIdx].cubes[selectedCubeIdx];
    const name = prompt("Name your preset:", "New Preset");
    if (name) {
      const newPresets = [...customPresets, { name, size: cube.size as [number, number, number], origin: cube.origin as [number, number, number] }];
      setCustomPresets(newPresets);
      localStorage.setItem('mp_model_presets', JSON.stringify(newPresets));
    }
  };

  useEffect(() => {
    if (!textureBlob) {
      setTextureImage(null);
      return;
    }
    const url = URL.createObjectURL(textureBlob);
    const img = new Image();
    img.src = url;
    img.onload = () => setTextureImage(img);
    return () => URL.revokeObjectURL(url);
  }, [textureBlob]);

  const rawData = useMemo(() => {
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }, [json]);

  const modelData = useMemo(() => {
    if (!rawData) return [];
    try {
      const geo = rawData["minecraft:geometry"]?.[0] || rawData["geometry"]?.[0] || rawData;
      const bonesData = geo.bones || geo.geometry?.bones || rawData.bones || [];
      const texWidth = geo.description?.texture_width || 64;
      const texHeight = geo.description?.texture_height || 64;
      
      return bonesData.map((b: any, bIdx: number) => ({
        name: b.name || 'unknown',
        index: bIdx,
        cubes: (b.cubes || []).map((c: any, cIdx: number) => ({
          origin: c.origin || [0,0,0],
          size: c.size || [1,1,1],
          uv: c.uv,
          rotation: c.rotation,
          pivot: c.pivot,
          color: getBoneColor(b.name),
          boneIdx: bIdx,
          cubeIdx: cIdx
        })),
        texWidth,
        texHeight
      }));
    } catch (e) {
      return [];
    }
  }, [rawData]);

  // History for Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    if (json && history.length === 0) {
      setHistory([json]);
      setHistoryIdx(0);
    }
  }, [json]);

  const pushHistory = (newJson: string) => {
    const nextHistory = history.slice(0, historyIdx + 1);
    nextHistory.push(newJson);
    if (nextHistory.length > 50) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryIdx(nextHistory.length - 1);
    onUpdate?.(newJson);
  };

  const undo = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      onUpdate?.(prev);
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      onUpdate?.(next);
    }
  };

  const duplicateCube = () => {
    if (selectedBoneIdx === null || selectedCubeIdx === null || !rawData) return;
    const newData = JSON.parse(JSON.stringify(rawData));
    const geo = newData["minecraft:geometry"]?.[0] || newData["geometry"]?.[0] || newData;
    const bones = geo.bones || geo.geometry?.bones || newData.bones || [];
    
    if (bones[selectedBoneIdx]?.cubes?.[selectedCubeIdx]) {
      const original = bones[selectedBoneIdx].cubes[selectedCubeIdx];
      const copy = { ...original, origin: [original.origin[0] + 1, original.origin[1], original.origin[2]] };
      bones[selectedBoneIdx].cubes.splice(selectedCubeIdx + 1, 0, copy);
      pushHistory(JSON.stringify(newData, null, 2));
      setSelectedCubeIdx(selectedCubeIdx + 1);
    }
  };

  const deleteCube = () => {
    if (selectedBoneIdx === null || selectedCubeIdx === null || !rawData) return;
    const newData = JSON.parse(JSON.stringify(rawData));
    const geo = newData["minecraft:geometry"]?.[0] || newData["geometry"]?.[0] || newData;
    const bones = geo.bones || geo.geometry?.bones || newData.bones || [];
    
    if (bones[selectedBoneIdx]?.cubes?.[selectedCubeIdx]) {
      bones[selectedBoneIdx].cubes.splice(selectedCubeIdx, 1);
      pushHistory(JSON.stringify(newData, null, 2));
      setSelectedCubeIdx(null);
    }
  };

  const updateGeometry = (updates: any) => {
    if (!rawData || !onUpdate) return;
    const newData = JSON.parse(JSON.stringify(rawData));
    const geo = newData["minecraft:geometry"]?.[0] || newData["geometry"]?.[0] || newData;
    const bones = geo.bones || geo.geometry?.bones || newData.bones || [];
    
    if (selectedBoneIdx !== null && bones[selectedBoneIdx]) {
      if (selectedCubeIdx !== null && bones[selectedBoneIdx].cubes?.[selectedCubeIdx]) {
        bones[selectedBoneIdx].cubes[selectedCubeIdx] = {
          ...bones[selectedBoneIdx].cubes[selectedCubeIdx],
          ...updates
        };
      } else {
        bones[selectedBoneIdx] = { ...bones[selectedBoneIdx], ...updates };
      }
    }
    pushHistory(JSON.stringify(newData, null, 2));
  };

  function getBoneColor(name: string) {
    const n = (name || "").toLowerCase();
    if (n.includes('wood') || n.includes('log')) return '#8B4513';
    if (n.includes('leaf') || n.includes('green')) return '#2D5A27';
    if (n.includes('glass') || n.includes('window')) return '#A5F3FC';
    if (n.includes('metal') || n.includes('iron')) return '#94A3B8';
    if (n.includes('stone') || n.includes('brick')) return '#64748B';
    if (n.includes('water')) return '#3B82F6';
    if (n.includes('cloth') || n.includes('fabric')) return '#EC4899';
    const colors = ['#4ADE80', '#FB923C', '#6366F1', '#F43F5E', '#8B5CF6', '#FACC15'];
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  const lastPolygons = useRef<any[]>([]);
  const drawRef = useRef<() => void>(() => {});

  const project = (x: number, y: number, z: number, localRotation?: [number, number, number], pivot?: [number, number, number]) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, z: 0 };
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let px = x, py = y, pz = z;

    // Apply local rotation relative to pivot
    if (localRotation && pivot) {
      const [rx, ry, rz] = localRotation.map(a => (a * Math.PI) / 180);
      const [pxo, pyo, pzo] = pivot;
      px -= pxo; py -= pyo; pz -= pzo;
      
      const x1 = px;
      const y1 = py * Math.cos(rx) - pz * Math.sin(rx);
      const z1 = py * Math.sin(rx) + pz * Math.cos(rx);
      
      const x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry);
      const y2 = y1;
      const z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);

      const x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
      const y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);
      const z3 = z2;

      px = x3 + pxo; py = y3 + pyo; pz = z3 + pzo;
    }

    const radX = (rotation.x * Math.PI) / 180;
    const radY = (rotation.y * Math.PI) / 180;
    const ryX = px * Math.cos(radY) - pz * Math.sin(radY);
    const ryZ = px * Math.sin(radY) + pz * Math.cos(radY);
    const rxY = py * Math.cos(radX) - ryZ * Math.sin(radX);
    const rxZ = py * Math.sin(radX) + ryZ * Math.cos(radX);
    const scale = zoom * 15;
    return { x: centerX + ryX * scale, y: centerY - rxY * scale, z: rxZ };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    // Draw Ground Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const p1 = project(i * 16, 0, -64);
      const p2 = project(i * 16, 0, 64);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const p3 = project(-64, 0, i * 16);
      const p4 = project(64, 0, i * 16);
      ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
    }

    const polygons: any[] = [];
    modelData.forEach(bone => {
      bone.cubes?.forEach(cube => {
        const [ox, oy, oz] = cube.origin;
        const [sw, sh, sd] = cube.size;
        const uv = cube.uv;
        const cubeRot = cube.rotation;
        const cubePivot = cube.pivot || [ox + sw/2, oy + sh/2, oz + sd/2];
        const vertices = [
          [ox, oy, oz], [ox + sw, oy, oz], [ox + sw, oy + sh, oz], [ox, oy + sh, oz],
          [ox, oy, oz + sd], [ox + sw, oy, oz + sd], [ox + sw, oy + sh, oz + sd], [ox, oy + sh, oz + sd]
        ].map(v => project(v[0], v[1], v[2], cubeRot, cubePivot));

        const faces = [
          { indices: [0, 1, 2, 3], normal: [0, 0, -1], color: cube.color, shade: 0.8, uvOffset: [sd*2 + sw, sd] },
          { indices: [4, 5, 6, 7], normal: [0, 0, 1], color: cube.color, shade: 1.0, uvOffset: [sd, sd] },
          { indices: [0, 4, 7, 3], normal: [-1, 0, 0], color: cube.color, shade: 0.7, uvOffset: [0, sd] },
          { indices: [1, 5, 6, 2], normal: [1, 0, 0], color: cube.color, shade: 0.9, uvOffset: [sd + sw, sd] },
          { indices: [3, 2, 6, 7], normal: [0, 1, 0], color: cube.color, shade: 1.2, uvOffset: [sd, 0] },
          { indices: [0, 1, 5, 4], normal: [0, -1, 0], color: cube.color, shade: 0.5, uvOffset: [sd + sw, 0] },
        ];

        faces.forEach(face => {
          const avgZ = face.indices.reduce((sum, idx) => sum + vertices[idx].z, 0) / 4;
          const isSelected = selectedBoneIdx === bone.index && selectedCubeIdx === cube.cubeIdx;
          polygons.push({
            points: face.indices.map(idx => ({ x: vertices[idx].x, y: vertices[idx].y })),
            z: avgZ,
            color: isSelected ? '#3B82F6' : face.color,
            shade: isSelected ? 1.0 : face.shade,
            uv: uv,
            uvOffset: face.uvOffset,
            size: cube.size,
            normal: face.normal,
            isSelected,
            boneIdx: bone.index,
            cubeIdx: cube.cubeIdx
          });
        });
      });
    });

    polygons.sort((a, b) => b.z - a.z);
    lastPolygons.current = polygons;
    
    polygons.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      p.points.forEach((pt: any) => ctx.lineTo(pt.x, pt.y));
      ctx.closePath();
      
      ctx.fillStyle = shadeColor(p.color, p.shade);
      ctx.fill();

      if (textureImage && p.uv) {
        ctx.save(); ctx.clip();
        ctx.globalAlpha = p.isSelected ? 0.3 : 1.0;
        const [u, v] = p.uv;
        const [txo, tyo] = p.uvOffset;
        const minX = Math.min(...p.points.map((pt:any)=>pt.x));
        const minY = Math.min(...p.points.map((pt:any)=>pt.y));
        const fWidth = Math.max(...p.points.map((pt:any)=>pt.x)) - minX;
        const fHeight = Math.max(...p.points.map((pt:any)=>pt.y)) - minY;
        ctx.drawImage(textureImage, (u + txo) % textureImage.width, (v + tyo) % textureImage.height, 16, 16, 
          minX, minY, fWidth, fHeight
        );
        ctx.restore();
      }
      ctx.strokeStyle = p.isSelected ? '#3B82F6' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = p.isSelected ? 2 : 1;
      ctx.stroke();
    });
  };

  function shadeColor(color: string, percent: number) {
    const f = parseInt(color.slice(1), 16);
    const t = percent < 1 ? 0 : 255;
    const p = percent < 1 ? 1 - percent : percent - 1;
    const R = f >> 16;
    const G = (f >> 8) & 0x00FF;
    const B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
  }

  drawRef.current = draw;

  // Redraw hook
  useEffect(() => {
    draw();
  }, [modelData, rotation, zoom, textureImage, selectedBoneIdx, selectedCubeIdx]);

  // Resize hook
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        drawRef.current();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = [...lastPolygons.current].reverse().find(p => {
        let isInside = false;
        for (let i = 0, j = p.points.length - 1; i < p.points.length; j = i++) {
          const xi = p.points[i].x, yi = p.points[i].y;
          const xj = p.points[j].x, yj = p.points[j].y;
          if (((yi > mouseY) !== (yj > mouseY)) && (mouseX < (xj - xi) * (mouseY - yi) / (yj - yi) + xi)) isInside = !isInside;
        }
        return isInside;
      });

      if (hit) {
        setSelectedBoneIdx(hit.boneIdx);
        setSelectedCubeIdx(hit.cubeIdx);
      } else {
        // Clear selection if clicking empty space
        setSelectedBoneIdx(null);
        setSelectedCubeIdx(null);
      }
    }
    
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotation(prev => ({
      x: prev.x + dy * 0.5,
      y: prev.y + dx * 0.5
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="w-full h-full flex bg-[#1e1e2e] relative rounded-3xl overflow-hidden border-2 border-slate-700/50 group">
      {/* Sidebar Editor */}
      <div className="w-72 border-r border-white/5 bg-slate-900/50 flex flex-col z-10 backdrop-blur-md">
        <div className="p-4 border-b border-white/5 flex gap-2">
          <button 
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'view' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Outliner
          </button>
          <button 
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'edit' ? 'bg-vibrant-orange text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Properties
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {activeTab === 'view' ? (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={undo} 
                  disabled={historyIdx <= 0}
                  className="flex-1 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4 mx-auto" />
                </button>
                <button 
                  onClick={redo} 
                  disabled={historyIdx >= history.length - 1}
                  className="flex-1 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4 mx-auto" />
                </button>
              </div>

              {modelData.map((bone, bIdx) => (
                <div key={bIdx} className="space-y-1">
                  <div className="flex items-center justify-between group-hover:pr-2 transition-all">
                    <button 
                      onClick={() => { setSelectedBoneIdx(bIdx); setSelectedCubeIdx(null); }}
                      className={`flex-1 text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${selectedBoneIdx === bIdx && selectedCubeIdx === null ? 'bg-white/10 text-white' : 'text-slate-400 font-medium hover:bg-white/5'}`}
                    >
                      <Move className="w-3 h-3 min-w-[12px]" />
                      <span className="text-[10px] truncate">{bone.name}</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newCube = { origin: [0,0,0], size: [1,1,1], uv: [0,0] };
                        const newData = JSON.parse(json);
                        const geo = newData["minecraft:geometry"]?.[0] || newData["geometry"]?.[0] || newData;
                        const bones = geo.bones || geo.geometry?.bones || newData.bones || [];
                        if (bones[bIdx]) {
                           if (!bones[bIdx].cubes) bones[bIdx].cubes = [];
                           bones[bIdx].cubes.push(newCube);
                           pushHistory(JSON.stringify(newData, null, 2));
                        }
                      }}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-500 hover:text-vibrant-green transition-all rounded-lg"
                      title="Add Cube"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="pl-6 space-y-1">
                    {bone.cubes?.map((cube, cIdx) => (
                      <button 
                        key={cIdx} 
                        onClick={() => { setSelectedBoneIdx(bIdx); setSelectedCubeIdx(cIdx); }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${selectedBoneIdx === bIdx && selectedCubeIdx === cIdx ? 'bg-vibrant-green/20 text-vibrant-green' : 'text-slate-500 text-[9px] hover:text-slate-300'}`}
                      >
                        <MousePointer2 className="w-2.5 h-2.5" />
                        Cube {cIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {selectedBoneIdx !== null ? (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black text-vibrant-orange uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-3 h-3" />
                        {selectedCubeIdx !== null ? `Cube ${selectedCubeIdx + 1}` : `Bone: ${modelData[selectedBoneIdx].name}`}
                      </h4>
                      {selectedCubeIdx !== null && (
                        <div className="flex gap-1">
                          <button onClick={duplicateCube} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 transition-all border border-white/5" title="Duplicate">
                            <Copy className="w-3 h-3" />
                          </button>
                          <button onClick={deleteCube} className="p-1.5 bg-vibrant-orange/10 hover:bg-vibrant-orange/20 rounded-lg text-vibrant-orange transition-all border border-vibrant-orange/10" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {selectedCubeIdx !== null ? (
                      <div className="space-y-4">
                        <PropertyRow 
                          label="Origin" 
                          values={modelData[selectedBoneIdx].cubes[selectedCubeIdx].origin} 
                          onChange={(v) => updateGeometry({ origin: v })} 
                        />
                        <PropertyRow 
                          label="Size" 
                          values={modelData[selectedBoneIdx].cubes[selectedCubeIdx].size} 
                          onChange={(v) => updateGeometry({ size: v })} 
                        />
                        <PropertyRow 
                          label="Rotation" 
                          values={modelData[selectedBoneIdx].cubes[selectedCubeIdx].rotation || [0,0,0]} 
                          onChange={(v) => updateGeometry({ rotation: v })} 
                        />
                        <PropertyRow 
                          label="Pivot" 
                          values={modelData[selectedBoneIdx].cubes[selectedCubeIdx].pivot || [0,0,0]} 
                          onChange={(v) => updateGeometry({ pivot: v })} 
                        />
                        <PropertyRow 
                          label="UV" 
                          values={modelData[selectedBoneIdx].cubes[selectedCubeIdx].uv || [0,0]} 
                          onChange={(v) => updateGeometry({ uv: v })} 
                          cols={2}
                        />

                        {/* Transformation Presets */}
                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transformation Presets</h5>
                            <button 
                              onClick={saveCurrentAsPreset}
                              className="text-[8px] font-black text-vibrant-green uppercase tracking-widest hover:underline"
                            >
                              + SAVE CUSTOM
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {PRESET_DEFAULTS.map((p, i) => (
                              <button 
                                key={i}
                                onClick={() => applyPreset(p)}
                                className="px-2 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] text-white/70 font-bold border border-white/5 transition-all text-left truncate"
                              >
                                {p.name}
                              </button>
                            ))}
                            {customPresets.map((p, i) => (
                              <button 
                                key={`custom-${i}`}
                                onClick={() => applyPreset(p)}
                                className="px-2 py-2 bg-vibrant-orange/10 hover:bg-vibrant-orange/20 rounded-lg text-[9px] text-vibrant-orange font-bold border border-vibrant-orange/20 transition-all text-left truncate flex justify-between group"
                              >
                                <span>{p.name}</span>
                                <Trash2 
                                  className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 hover:text-white" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = customPresets.filter((_, idx) => idx !== i);
                                    setCustomPresets(next);
                                    localStorage.setItem('mp_model_presets', JSON.stringify(next));
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] text-slate-400 font-medium italic">
                        Select a cube within this bone to edit its geometry values directly.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <MousePointer2 className="w-10 h-10 text-white/10 mx-auto mb-4" />
                  <p className="text-[10px] text-slate-500 font-bold">Select an element to edit</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div 
          ref={containerRef}
          className="flex-1 cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => setZoom(prev => Math.min(Math.max(0.5, prev - e.deltaY * 0.001), 5))}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
          
          {/* View Overlays */}
          <div className="absolute top-6 left-6 flex flex-col gap-1">
            <span className="text-[10px] font-black text-vibrant-orange uppercase tracking-widest bg-vibrant-orange/10 px-3 py-1 rounded-full border border-vibrant-orange/20">Modern 3D Studio</span>
            <span className="text-[8px] font-mono text-white/30 px-3">Bones: {modelData.length} | Zoom: {zoom.toFixed(1)}x</span>
          </div>

          <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <button 
              onClick={() => { setRotation({ x: -25, y: 45 }); setZoom(1.5); }}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all shadow-lg"
              title="Reset Camera"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoom(prev => Math.min(prev + 0.5, 10))}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all shadow-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.1))}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all shadow-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PropertyRow = ({ label, values, onChange, cols = 3 }: { label: string, values: number[], onChange: (v: number[]) => void, cols?: number }) => (
  <div className="space-y-2">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <div className={`grid ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="text-[8px] text-white/40 font-mono text-center uppercase">
            {cols === 2 ? (i === 0 ? 'U' : 'V') : (i === 0 ? 'X' : i === 1 ? 'Y' : 'Z')}
          </span>
          <input 
            type="number"
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = parseFloat(e.target.value) || 0;
              onChange(next);
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2 text-[10px] text-white font-mono outline-none focus:border-vibrant-orange transition-all"
          />
        </div>
      ))}
    </div>
  </div>
);
