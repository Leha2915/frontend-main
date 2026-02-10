import React from 'react';
import { EdgeProps } from '@xyflow/react';

export default function DashedArrowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const nodeWidth = 200; // Node-Breite ggf. anpassen
  const nodeHeight = 60; // Node-Höhe ggf. anpassen

  // untereMitte des Quellknotens 
  const startX = sourceX;
  const startY = sourceY;
  // linke obere Ecke des Zielknotens 
  const endX = targetX - nodeWidth / 2;
  const endY = targetY + nodeHeight / 2;

  const edgePath = `M${startX},${startY} L${endX},${endY}`;

  return (
    <g>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="#888"
        strokeWidth={3}
        strokeDasharray="6,4"
        markerEnd="url(#dashed-arrowhead)"
      />
      <defs>
        <marker
          id="dashed-arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L10,3.5 L0,7 Z" fill="#888" />
        </marker>
      </defs>
    </g>
  );
}
