import { Node as Nodes } from '@xyflow/react';
import { TreeNode, TreeStructure, Edges } from '@/lib/types';

export class NodeProcessor {


  // Tracking für verwendete Positionen - verbesserte Kollisionserkennung
  private usedPositions: Map<string, Set<number>> = new Map(); // y-level -> Set von x-positionen
  
  // Zurücksetzen der Kollisionsdaten für neue Verarbeitung
  public resetCollisionTracking(): void {
    this.usedPositions.clear();
  }
  
  /**
   * Berechnet die Tiefe des tiefsten Elternteils im interview_tree und gibt Tiefe und y-Position zurück.
   * @param nodeId Backend-ID des Knotens
   * @param treeData interview_tree
   * @param ySpacing Abstand pro Ebene
   */
  public getDeepestParentDepthAndY(nodeId: string | number, treeData: TreeStructure, ySpacing: number = 300): { depth: number, y: number } {
    function getDepth(id: string | number): number {
      const node = treeData.nodes.find(n => String(n.id) === String(id));
      if (!node || !node.parents || node.parents.length === 0) return -1;
      return Math.max(...node.parents.map(getDepth)) + 1;
    }
    const depth = getDepth(nodeId);
    return { depth, y: (depth + 1) * ySpacing };
  }

  /**
   * Findet eine verfügbare Position für einen Knoten.
   * Wenn forceRight=true, wird der Knoten rechts neben x positioniert (auf gleicher y-Höhe).
   */
  public findAvailablePosition(x: number, y: number, width: number = 400, forceRight: boolean = false): { x: number, y: number } {
    const yKey = y.toString();
    const minSpacing = 60;
    if (!this.usedPositions.has(yKey)) {
      this.usedPositions.set(yKey, new Set());
      // Erster Knoten auf dieser Zeile: direkt unter dem Elternknoten (x)
      return { x, y };
    }
    const usedXPositions = this.usedPositions.get(yKey)!;
    let availableX = x;
    if (forceRight) {
      // Suche die größte bisher belegte x-Position auf dieser Zeile und setze rechts daneben
      let maxX = Math.max(...Array.from(usedXPositions), x);
      availableX = maxX + minSpacing + width;
      while (this.hasOverlap(availableX, width, usedXPositions)) {
        availableX += minSpacing;
      }
      return { x: availableX, y };
    }
    // Standard: Prüfe, ob direkt unter dem Elternknoten Platz ist
    if (this.hasOverlap(availableX, width, usedXPositions)) {
      // Falls belegt, suche die nächste freie Position rechts daneben
      let maxX = Math.max(...Array.from(usedXPositions));
      availableX = maxX + minSpacing;
      while (this.hasOverlap(availableX, width, usedXPositions)) {
        availableX += minSpacing;
      }
    }
    return { x: availableX, y };
  }
  
  public markPositionAsUsed(x: number, y: number, width: number): void {
    const yKey = y.toString();
    
    if (!this.usedPositions.has(yKey)) {
      this.usedPositions.set(yKey, new Set());
    }
    
    const usedXPositions = this.usedPositions.get(yKey)!;
    
    // Markiere diese Position als verwendet mit Puffer
    for (let i = x - 10; i < x + width + 10; i += 10) {
      usedXPositions.add(i);
    }
  }
  
  private hasOverlap(x: number, width: number, usedXPositions: Set<number>): boolean {
    for (let i = x; i < x + width; i += 10) {
      if (usedXPositions.has(i)) {
        return true;
      }
    }
    return false;
  }

  processIdeaChain(
    initNodes: Nodes[], 
    initEdges: Edges[], 
    ideaNode: TreeNode, 
    parentId: string, 
    chatid: string, 
    treeData: TreeStructure,
    startX: number,
    positions: any,
    createdNodes: Set<string>
  ): { finalX: number } {
    let currentX = startX;
    const ideaNodeId = `idea_${chatid}_${ideaNode.id}`;

    // Irrelevant Answer Knoten (Backend liefert oft 'Irrelevant Answer' als Label)
    const isIrrelevant = ideaNode.label === 'Irrelevant Answer';
    if (isIrrelevant) {
      if (!createdNodes.has(ideaNodeId)) {
        const availablePos = this.findAvailablePosition(currentX, positions.y_idea, 400);
        initNodes.push({
          id: ideaNodeId,
          type: 'listerNode',
          data: {
            header: 'Irrelevant Answer',
            listElements: [ideaNode.conclusion || 'Irrelevant'],
            className: 'max-w-[400px] bg-gray-200 border border-gray-400 text-gray-500',
          },
          position: availablePos,
        });
        this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
        createdNodes.add(ideaNodeId);
        currentX = availablePos.x;
      }
      // Alle Parents verbinden
      ideaNode.parents.forEach(parent => {
        const edgeId = `edge_${parent}_${ideaNodeId}`;
        if (!initEdges.find(edge => edge.id === edgeId)) {
          initEdges.push({
            id: edgeId,
            source: `idea_${chatid}_${parent}`,
            target: ideaNodeId,
          });
        }
      });
      return { finalX: currentX };
    }

    // IDEA-Knoten wie bisher
    if (!createdNodes.has(ideaNodeId)) {
      const availablePos = this.findAvailablePosition(currentX, positions.y_idea, 500);
      initNodes.push({
        id: ideaNodeId,
        type: 'listerNode',
        data: {
          header: 'Idea',
          listElements: [ideaNode.conclusion || 'Unnamed Idea'],
          className: 'max-w-[500px] bg-blue-100 border-2 border-blue-300',
        },
        position: availablePos,
      });
      this.markPositionAsUsed(availablePos.x, availablePos.y, 500);
      createdNodes.add(ideaNodeId);
      currentX = availablePos.x;
    }
    // Alle Parents verbinden (auch für normale Knoten)
    ideaNode.parents.forEach(parent => {
      const edgeId = `edge_${parent}_${ideaNodeId}`;
      if (!initEdges.find(edge => edge.id === edgeId)) {
        initEdges.push({
          id: edgeId,
          source: `idea_${chatid}_${parent}`,
          target: ideaNodeId,
        });
      }
    });

    const attributeNodes = treeData.nodes.filter(node => 
      node.label === 'ATTRIBUTE' && node.parents.includes(ideaNode.id)
    );

    let maxAttributeX = currentX;

    attributeNodes.forEach((attrNode, index) => {
      const { finalX } = this.processAttributeChain(
        initNodes,
        initEdges,
        attrNode,
        ideaNodeId,
        chatid,
        treeData,
        currentX,
        positions,
        createdNodes
      );
      maxAttributeX = Math.max(maxAttributeX, finalX);
    });

    return { finalX: maxAttributeX };
  }

  processAttributeChain(
    initNodes: Nodes[],
    initEdges: Edges[],
    attrNode: TreeNode,
    parentId: string,
    chatid: string,
    treeData: TreeStructure,
    startX: number,
    positions: any,
    createdNodes: Set<string>
  ): { finalX: number } {
    const attrNodeId = `attr_${chatid}_${attrNode.id}`;
    // Irrelevant Answer als Attribute
    if (attrNode.label === 'IRRELEVANT_ANSWER') {
      if (!createdNodes.has(attrNodeId)) {
        const availablePos = this.findAvailablePosition(startX, positions.y_attributes, 400);
        initNodes.push({
          id: attrNodeId,
          type: 'listerNode',
          data: {
            header: 'Irrelevant Answer',
            listElements: [attrNode.conclusion || 'Irrelevant'],
            className: 'max-w-[400px] bg-gray-200 border border-gray-400 text-gray-500',
          },
          position: availablePos,
        });
        this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
        createdNodes.add(attrNodeId);
        startX = availablePos.x;
      }
      // Alle Parents verbinden
      attrNode.parents.forEach(parent => {
        const edgeId = `edge_${parent}_${attrNodeId}`;
        if (!initEdges.find(edge => edge.id === edgeId)) {
          initEdges.push({
            id: edgeId,
            source: `idea_${chatid}_${parent}`,
            target: attrNodeId,
          });
        }
      });
      return { finalX: startX };
    }
    // Normale Attribute
    if (!createdNodes.has(attrNodeId)) {
      const availablePos = this.findAvailablePosition(startX, positions.y_attributes, 400);
      initNodes.push({
        id: attrNodeId,
        type: 'listerNode',
        data: {
          header: 'Attribute',
          listElements: [attrNode.conclusion || 'Unnamed Attribute'],
          className: 'max-w-[400px] bg-green-100 border-2 border-green-300',
        },
        position: availablePos,
      });
      this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
      createdNodes.add(attrNodeId);
      startX = availablePos.x;
    }
    // Alle Parents verbinden
    attrNode.parents.forEach(parent => {
      const edgeId = `edge_${parent}_${attrNodeId}`;
      if (!initEdges.find(edge => edge.id === edgeId)) {
        initEdges.push({
          id: edgeId,
          source: `idea_${chatid}_${parent}`,
          target: attrNodeId,
        });
      }
    });

    // Process CONSEQUENCE children
    const consequenceNodes = treeData.nodes.filter(node => 
      node.label === 'CONSEQUENCE' && node.parents.includes(attrNode.id)
    );

    let maxConsequenceX = startX;

    if (consequenceNodes.length > 0) {
      consequenceNodes.forEach((consNode, index) => {
        const { finalX } = this.processConsequenceChain(
          initNodes,
          initEdges,
          consNode,
          attrNodeId,
          chatid,
          treeData,
          startX,
          positions,
          createdNodes
        );
        maxConsequenceX = Math.max(maxConsequenceX, finalX);
      });
    } else {
      // Direct values if no consequences
      const valueNodes = treeData.nodes.filter(node => 
        node.label === 'VALUE' && node.parents.includes(attrNode.id)
      );
      valueNodes.forEach((valNode, valIndex) => {
        const valNodeId = `val_${chatid}_${valNode.id}`;
        if (!createdNodes.has(valNodeId)) {
          const availablePos = this.findAvailablePosition(
            startX,
            positions.y_values, 
            400
          );
          initNodes.push({
            id: valNodeId,
            type: 'listerNode',
            data: {
              header: 'Value',
              listElements: [valNode.conclusion || 'Unnamed Value'],
              className: 'max-w-[400px] bg-purple-100 border-2 border-purple-300',
            },
            position: availablePos,
          });
          this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
          createdNodes.add(valNodeId);
        }
        // Alle Parents verbinden
        valNode.parents.forEach(parent => {
          const edgeId = `edge_${parent}_${valNodeId}`;
          if (!initEdges.find(edge => edge.id === edgeId)) {
            initEdges.push({
              id: edgeId,
              source: `attr_${chatid}_${parent}`,
              target: valNodeId,
            });
          }
        });
        maxConsequenceX = Math.max(maxConsequenceX, startX + 400);
      });
    }
    return { finalX: maxConsequenceX };
  }

  processConsequenceChain(
    initNodes: Nodes[],
    initEdges: Edges[],
    consNode: TreeNode,
    parentId: string,
    chatid: string,
    treeData: TreeStructure,
    startX: number,
    positions: any,
    createdNodes: Set<string>
  ): { finalX: number } {
    const consNodeId = `cons_${chatid}_${consNode.id}`;
    // Irrelevant Answer als Consequence
    if (consNode.label === 'IRRELEVANT_ANSWER') {
      if (!createdNodes.has(consNodeId)) {
        const availablePos = this.findAvailablePosition(startX, positions.y_consequences, 400);
        initNodes.push({
          id: consNodeId,
          type: 'listerNode',
          data: {
            header: 'Irrelevant Answer',
            listElements: [consNode.conclusion || 'Irrelevant'],
            className: 'max-w-[400px] bg-gray-200 border border-gray-400 text-gray-500',
          },
          position: availablePos,
        });
        this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
        createdNodes.add(consNodeId);
        startX = availablePos.x;
      }
      consNode.parents.forEach(parent => {
        const edgeId = `edge_${parent}_${consNodeId}`;
        if (!initEdges.find(edge => edge.id === edgeId)) {
          initEdges.push({
            id: edgeId,
            source: `attr_${chatid}_${parent}`,
            target: consNodeId,
          });
        }
      });
      return { finalX: startX };
    }
    // Normale Consequence
    if (!createdNodes.has(consNodeId)) {
      const availablePos = this.findAvailablePosition(startX, positions.y_consequences, 400);
      initNodes.push({
        id: consNodeId,
        type: 'listerNode',
        data: {
          header: 'Consequence',
          listElements: [consNode.conclusion || 'Unnamed Consequence'],
          className: 'max-w-[400px] bg-yellow-100 border-2 border-yellow-300',
        },
        position: availablePos,
      });
      this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
      createdNodes.add(consNodeId);
      startX = availablePos.x;
    }
    consNode.parents.forEach(parent => {
      const edgeId = `edge_${parent}_${consNodeId}`;
      if (!initEdges.find(edge => edge.id === edgeId)) {
        initEdges.push({
          id: edgeId,
          source: `attr_${chatid}_${parent}`,
          target: consNodeId,
        });
      }
    });
    // Process VALUE children
    const valueNodes = treeData.nodes.filter(node => 
      node.label === 'VALUE' && node.parents.includes(consNode.id)
    );
    let maxValueX = startX;
    valueNodes.forEach((valNode, valIndex) => {
      const valNodeId = `val_${chatid}_${valNode.id}`;
      if (!createdNodes.has(valNodeId)) {
        const availablePos = this.findAvailablePosition(
          startX,
          positions.y_values, 
          400
        );
        initNodes.push({
          id: valNodeId,
          type: 'listerNode',
          data: {
            header: 'Value',
            listElements: [valNode.conclusion || 'Unnamed Value'],
            className: 'max-w-[400px] bg-purple-100 border-2 border-purple-300',
          },
          position: availablePos,
        });
        this.markPositionAsUsed(availablePos.x, availablePos.y, 400);
        createdNodes.add(valNodeId);
      }
      // Alle Parents verbinden
      valNode.parents.forEach(parent => {
        const edgeId = `edge_${parent}_${valNodeId}`;
        if (!initEdges.find(edge => edge.id === edgeId)) {
          initEdges.push({
            id: edgeId,
            source: `cons_${chatid}_${parent}`,
            target: valNodeId,
          });
        }
      });
      maxValueX = Math.max(maxValueX, startX + 400);
    });
    return { finalX: maxValueX };
  }
}