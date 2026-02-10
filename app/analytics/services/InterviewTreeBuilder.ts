import { Node as ReactFlowNode, Edge } from '@xyflow/react';
import { TreeStructure, TreeNode, TreeAnalysisData, ChatPromptAnswer, isChatPromptAnswer } from '@/lib/types';
import { NodeProcessor } from './NodeProcessor';
import { SpecialEdgeHelper, SpecialEdgeMarking } from './SpecialEdgeHelper';

/**
 * TreeBuilder der die Backend interview_tree Struktur als Input verwendet
 * aber die gleiche Darstellung wie zuvor beibehält
 */
export class InterviewTreeBuilder {
  
  buildTree(cc: any, sc: any, hideAutoNodes: boolean = false): { initNodes: ReactFlowNode[], initEdges: Edge[], specialEdgeMarking: SpecialEdgeMarking } {
    const initNodes: ReactFlowNode[] = [];
    const initEdges: Edge[] = [];
    
    // Sammle die interview_tree Daten vom Backend
    const latestTreeAnalysis = this.collectTreeDataFromBackend(cc, sc);
    
    if (latestTreeAnalysis.length === 0) {
      console.warn('Keine interview_tree Datenstrukturen gefunden');
      // Fallback: Leere Struktur
      return { initNodes, initEdges, specialEdgeMarking: {} };
    }

    // Alle Topic-Bäume in EINEM gemeinsamen, duplikatfreien Graphen verarbeiten
    const createdNodes = new Set<string>();
    const nodeProcessor = new NodeProcessor();
    nodeProcessor.resetCollisionTracking();
    let currentX = 0;
    latestTreeAnalysis.forEach((analysis, idx) => {
      const topicRoot = analysis.treeData.nodes.find(n => n.label === 'TOPIC');
      if (topicRoot) {
        this.processTreeNode(
          initNodes,
          initEdges,
          topicRoot,
          [],
          analysis.chatid,
          analysis.treeData,
          currentX,
          0,
          0,
          nodeProcessor,
          createdNodes,
          hideAutoNodes
        );
        // Abstand für nächsten Topic-Root, aber nur falls dieser noch nicht existiert
        currentX += 800;
      } else {
        console.warn(`Kein TOPIC-Knoten im Backend-Baum gefunden für Chat ${analysis.chatid}`);
      }
    });
    // Mapping NodeId → Label für alle Nodes
    const nodeIdToLabel: Record<string, string> = {};
    initNodes.forEach(n => {
      let label: string = '';
      if (n.data && typeof n.data.header === 'string') {
        label = n.data.header.toUpperCase();
      } else {
        label = n.id.split('_')[0].toUpperCase();
      }
      nodeIdToLabel[n.id] = label;
    });
    const specialEdgeMarking = SpecialEdgeHelper.markSpecialEdges(initEdges, nodeIdToLabel);
    return { initNodes, initEdges, specialEdgeMarking };
  }

  private collectTreeDataFromBackend(cc: any, sc: any): TreeAnalysisData[] {
    const latestTreeAnalysis: TreeAnalysisData[] = [];

    cc.chats.forEach((chatElement: any) => {
      const latest = chatElement.rawMessages.findLast((elem: any) =>
        isChatPromptAnswer(elem)
      ) as ChatPromptAnswer;
      
      if (!latest || !latest.Tree) {
        console.warn(`No tree data found for chat: ${chatElement.chatid}`);
        return;
      }

      const currentStimulus = chatElement.stimulus;
      latestTreeAnalysis.push({
        chatid: chatElement.chatid,
        stimulus: currentStimulus,
        treeData: latest.Tree
      });
    });

    console.log(`Collected ${latestTreeAnalysis.length} tree analyses`);
    return latestTreeAnalysis;
  }


  // Rekursive Verarbeitung beliebiger Knoten
  private processTreeNode(
    initNodes: ReactFlowNode[],
    initEdges: Edge[],
    node: TreeNode,
    parentNodeIds: string[],
    chatid: string,
    treeData: TreeStructure,
    startX: number,
    y_base: number,
    level: number,
    nodeProcessor: NodeProcessor,
    createdNodes: Set<string>,
    hideAutoNodes: boolean = false
  ) {
    // Prüfe ob dieser Knoten AUTO-generiert ist
    const isAutoNode = node.conclusion && (
      node.conclusion.includes('AUTO: Automatisch generiertes Produktattribut') 
      || node.conclusion.includes('AUTO: Automatisch generierte Konsequenz')
      || node.conclusion.includes('AUTO: Automatisch generierter Wert')
      || node.conclusion.includes('AUTO: Automatisch generierte Idee')
      || node.conclusion.includes('AUTO')
    );

    // Wenn es ein AUTO-Knoten ist und diese ausgeblendet werden sollen,
    // überspringe diesen Knoten UND alle seine Kinder komplett
    if (isAutoNode && hideAutoNodes) {
      // AUTO-Knoten werden komplett übersprungen, auch nicht ins Set aufgenommen
      return;
    }

    // Einheitliche Verarbeitung aller Knotentypen
    const nodeId = `${node.label.toLowerCase()}_${node.id}`;
    // y-Position direkt anhand interview_tree-Tiefe bestimmen
    const ySpacing = 300;
    const { y: yPos, depth } = nodeProcessor.getDeepestParentDepthAndY(node.id, treeData, ySpacing);
    // x-Position wie bisher bestimmen (Kollisionslogik)
    let availablePos;
    if (node.label === 'IDEA') {
      // Finde die tatsächliche Position des STIMULUS-Parents
      let parentX = startX;
      if (parentNodeIds.length > 0) {
        const parentNode = initNodes.find(n => parentNodeIds.includes(n.id));
        if (parentNode) {
          parentX = parentNode.position.x;
        }
      }
      availablePos = { x: parentX, y: yPos };
    } else if (node.label === 'ATTRIBUTE') {
      // Spezialpositionierung für Attribute mit Attribut- oder Consequence-Eltern
      let parentNode = null;
      let parentType = null;
      if (Array.isArray(node.parents)) {
        for (const parentId of node.parents) {
          const parent = treeData.nodes.find(n => n.id === parentId);
          if (parent && (parent.label === 'CONSEQUENCE' || parent.label === 'ATTRIBUTE')) {
            parentNode = initNodes.find(n => n.id === `${parent.label.toLowerCase()}_${parent.id}`);
            parentType = parent.label;
            if (parentNode) break;
          }
        }
      }
      if (parentNode) {
        const baseX = parentNode.position.x + 400 + 60;
        availablePos = nodeProcessor.findAvailablePosition(baseX, yPos, 400, false);
      } else {
        availablePos = nodeProcessor.findAvailablePosition(startX, yPos, 400);
      }
    } else {
      availablePos = nodeProcessor.findAvailablePosition(startX, yPos, 400);
    }
    
    if (!createdNodes.has(nodeId)) {
      // Nur hinzufügen, wenn es kein AUTO-Knoten ist oder hideAutoNodes nicht aktiv ist
      if (!(isAutoNode && hideAutoNodes)) {
        let header = node.label.charAt(0).toUpperCase() + node.label.slice(1).toLowerCase();
        let className = 'max-w-[400px] border';
        if (node.label === 'TOPIC') {
          header = 'Topic';
          className = 'max-w-[500px] bg-blue-50 border-2 border-blue-200';
        } else if (node.label === 'STIMULUS') {
          header = 'Stimulus';
          className = 'max-w-[400px] bg-green-50 border-2 border-green-200';
        } else if (node.label === 'Irrelevant Answer' || node.label === 'IRRELEVANT_ANSWER') {
          header = 'Irrelevant Answer';
          className += ' bg-gray-200 border-gray-400 text-gray-500';
        } else if (node.label === 'ATTRIBUTE') {
          header = 'Attribute';
          className += ' bg-green-100 border-green-300 border-2';
        } else if (node.label === 'CONSEQUENCE') {
          header = 'Consequence';
          className += ' bg-yellow-100 border-yellow-300 border-2';
        } else if (node.label === 'VALUE') {
          header = 'Value';
          className += ' bg-purple-100 border-purple-300 border-2';
        } else if (node.label === 'IDEA') {
          header = 'Idea';
          className = 'max-w-[500px] bg-blue-100 border-blue-300 border-2';
        }
        initNodes.push({
          id: nodeId,
          type: 'listerNode',
          data: {
            header,
            listElements: [node.conclusion || `Unnamed ${header}`],
            className,
            parents: node.parents || [],
          },
          position: availablePos,
        });
        nodeProcessor.markPositionAsUsed(availablePos.x, availablePos.y, 400);
        createdNodes.add(nodeId);
      }
    }
    // Kanten zu ALLEN Parents (immer gleich, egal welcher Typ)
    parentNodeIds.forEach(parentId => {
      // Spezialkanten für C→A und A→A
      const parentNodeObj = initNodes.find(n => n.id === parentId);
  const isConsequenceToAttribute = typeof parentNodeObj?.data?.header === 'string' && (parentNodeObj.data.header as string).toUpperCase() === 'CONSEQUENCE' && node.label === 'ATTRIBUTE';
  const isAttributeToAttribute = typeof parentNodeObj?.data?.header === 'string' && (parentNodeObj.data.header as string).toUpperCase() === 'ATTRIBUTE' && node.label === 'ATTRIBUTE';
      const edgeId = (isConsequenceToAttribute || isAttributeToAttribute)
        ? `dashed_${parentId}_${nodeId}`
        : `edge_${parentId}_${nodeId}`;
      if (!initEdges.find(edge => edge.id === edgeId)) {
        initEdges.push({
          id: edgeId,
          source: parentId,
          target: nodeId,
          ...(isConsequenceToAttribute || isAttributeToAttribute ? { type: 'dashed' } : {}),
        });
      }
    });
    // Rekursiv alle Kinder verarbeiten (egal welcher Typ)
    if (Array.isArray(node.children)) {
      node.children.forEach((childId: number | string) => {
        const childNode = treeData.nodes.find(n => n.id === childId);
        if (childNode) {
          // Alle Parents des Childs (kann mehrere haben)
          const childParentNodeIds = (childNode.parents || []).map(pid => {
            const parentNode = treeData.nodes.find(n => n.id === pid);
            return parentNode ? `${parentNode.label.toLowerCase()}_${parentNode.id}` : null;
          }).filter(Boolean) as string[];
          this.processTreeNode(
            initNodes,
            initEdges,
            childNode,
            childParentNodeIds,
            chatid,
            treeData,
            availablePos.x, // Verwende die tatsächliche Position des Parent-Knotens
            y_base,
            level + 1,
            nodeProcessor,
            createdNodes,
            hideAutoNodes
          );
        }
      });
    }
  }

  /**
   * Fügt eine gestrichelte Edge für backwards_relation hinzu
   */
  private addDashedBackwardsEdge(initEdges: Edge[], fromNode: TreeNode, toNode: TreeNode) {
    const edgeId = `dashed_backwards_${fromNode.id}_${toNode.id}`;
    if (!initEdges.find(edge => edge.id === edgeId)) {
      initEdges.push({
        id: edgeId,
        source: `${fromNode.label.toLowerCase()}_${fromNode.id}`,
        target: `${toNode.label.toLowerCase()}_${toNode.id}`,
        type: 'dashed', // Custom-Type für gestrichelte Linie
      });
    }
  }

}

