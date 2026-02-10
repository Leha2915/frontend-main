'use client'

import { FC, useState, useCallback } from 'react'
import { TreeStructure } from '@/lib/types'
import {
    ReactFlow,
    Node,
    Edge,
    Controls,
    Background,
    MarkerType,
    useNodesState,
    useEdgesState,
    Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface InterviewTreeProps {
    tree: TreeStructure;
    showControls?: boolean;
    height?: string;
}

const InterviewTree: FC<InterviewTreeProps> = ({
    tree,
    showControls = true,
    height = '500px'
}) => {
    if (!tree || !tree.nodes || tree.nodes.length === 0) {
        return <div>No tree data available</div>;
    }

    // Get node type colors - similar to analytics page styling
    const getNodeStyle = (label: string, isActive: boolean) => {
        const baseStyle = {
            padding: 10,
            borderRadius: 5,
            border: isActive ? '2px solid #ffcc00' : '1px solid #ccc',
        };

        // Assign colors based on node type (similar to analytics)
        switch (label) {
            case 'TOPIC':
                return { ...baseStyle, backgroundColor: '#e3f2fd', borderColor: '#2196f3' };
            case 'STIMULUS':
                return { ...baseStyle, backgroundColor: '#f1f8e9', borderColor: '#8bc34a' };
            case 'IDEA':
                return { ...baseStyle, backgroundColor: '#29590E', color: 'white' };
            case 'ATTRIBUTE':
                return { ...baseStyle, backgroundColor: '#f5f5f5', borderColor: '#9e9e9e' };
            case 'CONSEQUENCE':
                return { ...baseStyle, backgroundColor: '#fff3e0', borderColor: '#ff9800' };
            case 'VALUE':
                return { ...baseStyle, backgroundColor: '#fce4ec', borderColor: '#e91e63' };
            default:
                return { ...baseStyle, backgroundColor: '#f5f5f5' };
        }
    };

    // Define hierarchical layout with proper indentation
    const createHierarchicalLayout = () => {
        const yPositions = {
            'TOPIC': 0,
            'STIMULUS': 150,
            'IDEA': 300,
            'ATTRIBUTE': 450,
            'CONSEQUENCE': 600,
            'VALUE': 750
        };

        // Create a map for easy node lookup
        const nodeMap = new Map();
        tree.nodes.forEach(node => {
            nodeMap.set(node.id, node);
        });

        // Find all root nodes (typically just the TOPIC node)
        const rootNodes = tree.nodes.filter(node =>
            node.parents.length === 0 || node.label === 'TOPIC'
        );

        if (rootNodes.length === 0) return { nodes: [], edges: [] };

        const rfNodes: Node[] = [];
        const rfEdges: Edge[] = [];
        const processedNodes = new Set();

        // Helper function to process a tree branch
        const processNode = (node, xOffset = 0, depth = 0, parentX = 0) => {
            if (processedNodes.has(node.id)) return;
            processedNodes.add(node.id);

            // Get the y-position based on node type
            const y = yPositions[node.label] || 300;

            // Add indentation based on depth, keeping same node types at the same level
            const x = parentX + (depth * 150);

            const isActive = node.id === tree.active_node_id;

            // Add this node to the result
            rfNodes.push({
                id: node.id.toString(),
                type: 'default',
                data: {
                    label: `${node.label}: ${node.conclusion.substring(0, 40)}${node.conclusion.length > 40 ? '...' : ''}`
                },
                position: { x, y },
                style: getNodeStyle(node.label, isActive),
                draggable: true
            });

            // Process children
            let childX = x;
            const childrenByType = {};

            // Group children by their type to maintain proper vertical alignment
            node.children.forEach(childId => {
                const child = nodeMap.get(childId);
                if (!child) return;

                if (!childrenByType[child.label]) {
                    childrenByType[child.label] = [];
                }
                childrenByType[child.label].push(child);
            });

            // Process each child type group
            Object.entries(childrenByType).forEach(([label, children]) => {
                (children as any[]).forEach((child, index) => {
                    // Create edge between this node and child
                    rfEdges.push({
                        id: `edge-${node.id}-${child.id}`,
                        source: node.id.toString(),
                        target: child.id.toString(),
                        markerEnd: {
                            type: MarkerType.ArrowClosed
                        },
                        style: {
                            stroke: '#888',
                            strokeWidth: 1.5
                        }
                    });

                    // Recursively process the child
                    // Horizontal offset increases with each sibling at the same level
                    const siblingOffset = index * 350;
                    processNode(child, siblingOffset, depth + 1, childX + siblingOffset);
                });
            });
        };

        // Start processing from each root node
        rootNodes.forEach((rootNode, index) => {
            const rootX = index * 500;  // Space out multiple root nodes if there are any
            processNode(rootNode, 0, 0, rootX);
        });

        return { nodes: rfNodes, edges: rfEdges };
    };

    // Create initial layout
    const { nodes: initialNodes, edges: initialEdges } = createHierarchicalLayout();

    // Set up state for nodes and edges (enables dragging)
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Reset layout function
    const resetLayout = useCallback(() => {
        const { nodes: resetNodes, edges: resetEdges } = createHierarchicalLayout();
        setNodes(resetNodes);
        setEdges(resetEdges);
    }, [tree, setNodes, setEdges]);

    return (
        <div style={{ width: '100%', height }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={3}
            >
                <Background />
                {showControls && <Controls />}
                <Panel position="top-right">
                    <button
                        onClick={resetLayout}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded shadow"
                    >
                        Reset Layout
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
};

export default InterviewTree;