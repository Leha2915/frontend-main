'use client';
import React, { useContext, useState, useCallback } from 'react';
import {
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ChatsContext } from '@/context/chats';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Info } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Spinner from '@/components/ui/Spinner';
import { SettingsContext } from '@/context/settings';
import { ProgressContext } from '@/context/progress';
import { Message } from '@/lib/types';
import ListerNode from '@/components/ListerNode';
import DashedArrowEdge from './components/DashedArrowEdge';

import { usePathHighlighting } from './hooks/usePathHighlighting';
import { useNodeInteraction } from './hooks/useNodeInteraction';
import { InterviewTreeBuilder } from './services/InterviewTreeBuilder';
import { SpecialEdgeHelper, SpecialEdgeMarking } from './services/SpecialEdgeHelper';
import { InterviewDataModal } from './components/InterviewDataModal';

import { useJWTAuth } from '@/context/jwtAuth'
import { useEffect } from 'react'

export default function Analytics() {
  const cc = useContext(ChatsContext);
  const sc = useContext(SettingsContext);
  const pc = useContext(ProgressContext);

  const { isGuest, isLoggedIn, enterAsGuest } = useJWTAuth()
  
  // State für alle Chat-Messages aus dem Backend
  const [allChatMessages, setAllChatMessages] = useState<{
    role: string;
    content: string;
    chat_index: number;
    message_index: number;
    global_index: number;
    node_ids: number[];
  }[]>([]);
  const [loading, setLoading] = useState(true);

  // Lade alle Chat-Messages beim Start
  useEffect(() => {
    const loadAllChatMessages = async () => {
      const project_slug = localStorage.getItem("project") ?? "";
      const storedId = localStorage.getItem(`interview_session_${project_slug}`);
      if (!storedId) {
        setLoading(false);
        return;
      }
      try {
        const payload = { 
          session_id: storedId, 
          projectSlug: project_slug 
        };
        const response = await fetch('/api/analytics/chat-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          setAllChatMessages(data.messages);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[Analytics] API Error:', errorData.error);
        }
      } catch (error) {
        console.error('[Analytics] Network Error:', error);
      }
      setLoading(false);
    };
    loadAllChatMessages();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      let project_slug = localStorage.getItem("project") ?? "";
      const storedId = localStorage.getItem(`interview_session_${project_slug}`);
      if (!storedId) return;
      if (!isGuest) {
          enterAsGuest(project_slug)
          window.location.href = "/pause"
      }
    }
  }, [isGuest]);

  // State für Modal mit Interviewdaten
  const [selectedNodeData, setSelectedNodeData] = useState<{
    nodeInfo: any;
    messages: Message[];
    messageCount: number;
    allMessages: Message[];
    chatid: string;
    messageSource: "trace" | "no-data";
  } | null>(null);

  // State für AUTO-Knoten Filter Toggle
  const [hideAutoNodes, setHideAutoNodes] = useState(false);

  if (!pc.submittedRanking) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <p>
          Please submit your stimuli ranking first. After that, you will be able
          to see the analytics.
        </p>
      </div>
    );
  }

  // Funktion zum Erstellen des Baums mit AUTO-Knoten Filter
  const createTree = useCallback(() => {
    const treeBuilder = new InterviewTreeBuilder();
    return treeBuilder.buildTree(cc, sc, hideAutoNodes);
  }, [cc, sc, hideAutoNodes]);

  // Tree erstellen - wird bei hideAutoNodes Änderung neu erstellt
  const { initNodes, initEdges, specialEdgeMarking } = createTree();
  const nodeTypes = { listerNode: ListerNode };
  const edgeTypes = { dashed: DashedArrowEdge };

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  // Spezialverbindung: C→A (Consequence → Attribute) und backwards-relation als gestrichelte Kante
  const dashedEdgeIds = new Set();
  const dashedEdges = initEdges
    .filter(edge => {
      const sourceNode = initNodes.find(n => n.id === edge.source);
      const targetNode = initNodes.find(n => n.id === edge.target);
      // C→A oder backwards-relation (z.B. edge.id.startsWith('dashed_backwards_'))
      const isCA = typeof sourceNode?.data?.header === 'string' && typeof targetNode?.data?.header === 'string' &&
        (sourceNode.data.header as string).toUpperCase() === 'CONSEQUENCE' && (targetNode.data.header as string).toUpperCase() === 'ATTRIBUTE';
      const isBackwards = edge.type === 'dashed' || edge.id.startsWith('dashed_backwards_');
      if (isCA || isBackwards) {
        dashedEdgeIds.add(edge.id);
        return true;
      }
      return false;
    })
    .map(edge => ({
      ...edge,
      type: 'dashed',
    }));

  // Entferne alle gestrichelten Kanten aus den normalen Kanten
  const filteredEdges = initEdges.filter(edge => !dashedEdgeIds.has(edge.id));

  // Kombiniere normale und Spezialkanten
  const styledEdges = [...filteredEdges, ...dashedEdges];
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges);

  // Baum komplett neu erstellen wenn Toggle sich ändert
  useEffect(() => {
    const { initNodes: newNodes, initEdges: newEdges } = createTree();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [hideAutoNodes, createTree, setNodes, setEdges]);

  // Custom Hooks
  const { onNodeMouseEnter, onNodeMouseLeave } = usePathHighlighting(
    edges, setNodes, setEdges
  );
  
  const { onNodeClick } = useNodeInteraction(cc, setSelectedNodeData, allChatMessages);
  
  
  // Ladeindikator
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner />
          <span className="text-gray-500 text-sm">Loading analytics…</span>
        </div>
      </div>
    );
  }

  // Leerer Zustand für den Graphen
  if (!nodes || nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-gray-400 text-2xl">No data available for analytics</span>
        </div>
      </div>
    );
  }



  return (
    <div className="w-full h-full relative">
      {/* Info button with tooltip for analytics help */}
      <div className="absolute top-4 left-4 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300 p-2"
              aria-label="Show analytics help"
            >
              <Info className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="max-w-xs text-sm">
            <strong>Analytics Overview:</strong> This page visualizes the structure of your interview as a graph. Each node represents a concept or answer, and the connections show their relationships. You can click on nodes to see more details. Use the filter button in the top right to show or hide automatically generated product attributes, consequences, and values.
          </TooltipContent>
        </Tooltip>
      </div>
      {/* Toggle für AUTO-Knoten Filter - jetzt als dezenter Button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-gray-500 border border-gray-200 opacity-70 hover:opacity-100 px-2 py-1"
          onClick={() => setHideAutoNodes((v) => !v)}
          aria-pressed={hideAutoNodes}
        >
          {hideAutoNodes ? (
            <Eye className="w-4 h-4 mr-1" />
          ) : (
            <EyeOff className="w-4 h-4 mr-1" />
          )}
          {hideAutoNodes ? 'Show' : 'Hide'} automatically generated product attributes, consequences and values
        </Button>
      </div>
      {/* Legend for connection types */}
      <div className="absolute right-4 bottom-4 bg-white/90 border border-gray-300 rounded p-3 text-xs text-gray-800 z-50 shadow min-w-[260px] flex flex-col gap-2">
      <div className="font-bold mb-1">Legend: Connection Types</div>
        <div className="flex items-center gap-2">
          <svg width="36" height="10"><line x1="2" y1="5" x2="34" y2="5" stroke="#b1b5bd" strokeWidth="2" markerEnd="url(#arrow)" /></svg>
            <span>Standard connection</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="36" height="10">
            <defs>
              <marker id="arrowGray" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,4 L0,8 Z" fill="#888" />
              </marker>
            </defs>
            <line x1="2" y1="5" x2="34" y2="5" stroke="#888" strokeWidth="2" strokeDasharray="6,4" markerEnd="url(#arrowGray)" />
          </svg>
            <span>Special connection (in case new ACV-chain has been created) </span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.2}
        maxZoom={3}
      >
        <Controls />
      </ReactFlow>

      <InterviewDataModal 
        selectedNodeData={selectedNodeData}
        onClose={() => setSelectedNodeData(null)}
      />
  
    </div>
  );
}