// Utility for detecting and marking special C→A (Consequence→Attribute) edges
import { Edge } from '@xyflow/react';

export type SpecialEdgeType = 'consequence-to-attribute' | 'attribute-to-attribute';

export interface SpecialEdgeMarking {
  [edgeId: string]: SpecialEdgeType;
}

export class SpecialEdgeHelper {
  /**
   * Checks if an edge goes from Consequence to Attribute (C→A)
   */
  static isConsequenceToAttribute(sourceLabel: string, targetLabel: string): boolean {
    return sourceLabel === 'CONSEQUENCE' && targetLabel === 'ATTRIBUTE';
  }

  /**
   * Checks if an edge goes from Attribute to Attribute (A→A)
   */
  static isAttributeToAttribute(sourceLabel: string, targetLabel: string): boolean {
    return sourceLabel === 'ATTRIBUTE' && targetLabel === 'ATTRIBUTE';
  }

  /**
   * Marks all edges that are C→A or A→A
   */
  static markSpecialEdges(edges: Edge[], nodeIdToLabel: Record<string, string>): SpecialEdgeMarking {
    const marking: SpecialEdgeMarking = {};
    edges.forEach(edge => {
      const sourceLabel = nodeIdToLabel[edge.source]?.toUpperCase();
      const targetLabel = nodeIdToLabel[edge.target]?.toUpperCase();
      if (this.isConsequenceToAttribute(sourceLabel, targetLabel)) {
        marking[edge.id] = 'consequence-to-attribute';
      }
      if (this.isAttributeToAttribute(sourceLabel, targetLabel)) {
        marking[edge.id] = 'attribute-to-attribute';
      }
    });
    return marking;
  }
}