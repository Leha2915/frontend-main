import { useCallback, useState } from 'react';
import type {Edge, NodeMouseHandler} from '@xyflow/react';

export function usePathHighlighting(
  edges: Edge[],
  setNodes: Function,
  setEdges: Function
) {
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());

  const findPathNodes = useCallback((nodeId: string, allEdges: Edge[]): Set<string> => {
    const pathNodes = new Set<string>();
    const visited = new Set<string>();

    const findAncestors = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      pathNodes.add(currentNodeId);

      const incomingEdges = allEdges.filter(edge => edge.target === currentNodeId);
      incomingEdges.forEach(edge => {
        findAncestors(edge.source);
      });
    };

    const findDescendants = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      pathNodes.add(currentNodeId);

      const outgoingEdges = allEdges.filter(edge => edge.source === currentNodeId);
      outgoingEdges.forEach(edge => {
        findDescendants(edge.target);
      });
    };

    visited.clear();
    findAncestors(nodeId);
    visited.clear();
    findDescendants(nodeId);

    return pathNodes;
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    const pathNodes = findPathNodes(node.id, edges);
    setHighlightedPath(pathNodes);
    
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          className: pathNodes.has(n.id) 
            ? n.data.className
            : `${n.data.className} opacity-30 grayscale`
        }
      }))
    );

    setEdges(currentEdges =>
      currentEdges.map(edge => {
        const isHighlighted = pathNodes.has(edge.source) && pathNodes.has(edge.target);
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: isHighlighted ? '#059669' : '#d1d5db',
            strokeWidth: isHighlighted ? 3 : 1,
            opacity: isHighlighted ? 1 : 0.3
          }
        };
      })
    );
  }, [edges, setNodes, setEdges, findPathNodes]);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHighlightedPath(new Set());
    
    setNodes(currentNodes => 
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          className: n.data.className.replace(' opacity-30 grayscale', '')
        }
      }))
    );

    setEdges(currentEdges =>
      currentEdges.map(edge => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: '#b1b5bd',
          strokeWidth: 1,
          opacity: 1
        }
      }))
    );
  }, [setNodes, setEdges]);

  return { onNodeMouseEnter, onNodeMouseLeave };
}