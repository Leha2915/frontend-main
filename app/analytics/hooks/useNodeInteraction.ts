// Typen anpassen
import { useCallback } from 'react';
import type { NodeMouseHandler } from '@xyflow/react';
import { ChatPromptAnswer, isChatPromptAnswer, Message as OrigMessage } from '@/lib/types';

// Message um node_ids erweitern
export interface Message extends OrigMessage {
  node_ids?: number[];
  isSeparator?: boolean;
}

// TreeNode-Objekt anpassen (summary/content2 optional)
interface TreeNode {
  id: number;
  label: string;
  conclusion?: string;
  summary?: string;
  content2?: string;
  content?: string;
  children?: number[];
  parents?: number[];
}

// Hilfsfunktion: Sucht TreeNode im Baum und ergänzt content
function getTreeNodeWithContent(treeNodeId: number, label: string, chats: any[]): TreeNode {
  for (const chat of chats) {
    const latestTreeMessage = chat.rawMessages.findLast((msg: any) =>
      isChatPromptAnswer(msg)
    ) as ChatPromptAnswer;
    if (latestTreeMessage?.Tree) {
      const treeNode = latestTreeMessage.Tree.nodes.find((node: any) =>
        node.id === treeNodeId && node.label === label
      );
      if (treeNode) {
        // Zugriff auf optionale Properties mit type assertion auf any
        const t: any = treeNode;
        return {
          ...treeNode,
          content: t.conclusion || t.summary || t.content2 || t.content || ''
        };
      }
    }
  }
  // Fallback: leeres Objekt mit content
  return { id: treeNodeId, label, content: '' };
}

interface BackendChatMessage {
  role: string;
  content: string;
  chat_index: number;
  message_index: number;
  global_index: number;
  node_ids: number[]; // Neue Struktur: Node-IDs, die zur Message-Zeit aktiv waren
}

export function useNodeInteraction(
  cc: any, 
  setSelectedNodeData: Function, 
  backendChatMessages: BackendChatMessage[] = []
) {
  
  const findRelevantMessagesFromBackend = useCallback((treeNode: any): Message[] => {
    const relevantMessages: Message[] = [];
    const targetNodeId = treeNode.id;
    
    // Sammle alle relevanten Message-Paare (System-Frage + User-Antwort)
    const messageGroups: Array<{systemMsg?: any, userMsg: any}> = [];
    
    backendChatMessages.forEach((msg, index) => {
      if (msg.node_ids && msg.node_ids.includes(targetNodeId)) {
        if (msg.role === 'user') {
          if (index > 0) {
            const previousMsg = backendChatMessages[index - 1];
            if (previousMsg && previousMsg.role === 'system') {
              messageGroups.push({
                systemMsg: previousMsg,
                userMsg: msg
              });
            } else {
              // User-Message ohne vorherige System-Message
              messageGroups.push({ userMsg: msg });
            }
          } else {
            // Erste User-Message im Verlauf (index 0)
            messageGroups.push({ userMsg: msg });
          }
        }
        // System-Messages mit targetNodeId werden ignoriert (gehören zur nächsten Interaktion)
      }
    });
    
    // Konvertiere Message-Groups zu Display-Messages
    messageGroups.forEach((group, groupIndex) => {
      // System-Nachricht hinzufügen (falls vorhanden)
      if (group.systemMsg) {
        relevantMessages.push({
          id: `backend_system_${group.systemMsg.global_index}`,
          text: group.systemMsg.content,
          isUserMessage: false,
          node_ids: group.systemMsg.node_ids || []
        });
      }
      // User/System-Nachricht hinzufügen (inkl. node_ids)
      relevantMessages.push({
        id: `backend_direct_${group.userMsg.global_index}`,
        text: group.userMsg.content,
        isUserMessage: group.userMsg.role === 'user',
        node_ids: group.userMsg.node_ids || []
      });
      
      // Trennlinie zwischen Gruppen hinzufügen (außer nach der letzten Gruppe)
      if (groupIndex < messageGroups.length - 1) {
        relevantMessages.push({
          id: `separator_${group.userMsg.global_index}`,
          text: '',
          isUserMessage: false,
          isSeparator: true
        });
      }
    });
    
    return relevantMessages;
  }, [backendChatMessages]);

  const findAllMessagesFromBackend = useCallback((chatId: string): Message[] => {
    // Konvertiere chatId zu chat_index (Frontend Chat "1" = Backend Index 0, etc.)
    const chatIndex = parseInt(chatId) - 1;
    
    // Filtere Backend-Messages für den entsprechenden Chat
    const chatMessages = backendChatMessages.filter(msg => 
      msg.chat_index === chatIndex
    );
    
    const allMessages: Message[] = [];
    
    // Konvertiere alle Backend-Messages zu Display-Messages (chronologisch)
    chatMessages.forEach((msg, index) => {
      // System-Messages und User-Messages separat hinzufügen
      allMessages.push({
        id: `backend_full_${msg.global_index}`,
        text: msg.content,
        isUserMessage: msg.role === 'user',
        node_ids: msg.node_ids || []
      });
    });
    
    return allMessages;
  }, [backendChatMessages]);

  // Findet alle nötigen Infos und Nachrichten für einen Knoten nur über Backend-Daten
  const findNodeInterviewData = useCallback((nodeId: string) => {
    const match = nodeId.match(/^([a-zA-Z_]+)_(\d+)$/);
    if (!match) return null;
    const label = match[1].toUpperCase();
    const treeNodeId = parseInt(match[2]);
    if (isNaN(treeNodeId)) return null;

    // Prüfe, ob der Knoten ein AUTO-Knoten ist (content oder conclusion beginnt mit 'AUTO:')
    let foundTreeNodeForContent = getTreeNodeWithContent(treeNodeId, label, cc.chats);
    let isAuto = false;
    if (foundTreeNodeForContent) {
      const autoText = (foundTreeNodeForContent.conclusion || foundTreeNodeForContent.content || '').trim().toUpperCase();
      isAuto = autoText.startsWith('AUTO:');
    }

    // msgWithNode wird für weitere Logik benötigt
    let msgWithNode = backendChatMessages.find(msg => msg.node_ids && msg.node_ids.includes(treeNodeId));

    // Hilfsmethode: Finde StimulusIndex eines Elternteils
    function findParentStimulus(treeNodeId: number, label: string): number | string {
      // Suche TreeNode-Objekt für diesen Knoten
      let treeNodeObj: any = null;
      for (const chat of cc.chats) {
        const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
        if (latestTreeMessage?.Tree) {
          const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === treeNodeId && n.label === label);
          if (found) {
            treeNodeObj = found;
            break;
          }
        }
      }
      if (!treeNodeObj || !Array.isArray(treeNodeObj.parents) || treeNodeObj.parents.length === 0) return '';
      for (const parentId of treeNodeObj.parents) {
        // Finde Parent-Objekt im Tree
        let parentTreeNode: any = null;
        let parentLabel = '';
        for (const chat of cc.chats) {
          const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
          if (latestTreeMessage?.Tree) {
            const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === parentId);
            if (found) {
              parentTreeNode = found;
              parentLabel = found.label;
              break;
            }
          }
        }
        if (!parentTreeNode) continue;
        // Finde Stimulus für Parent
        let parentMsgWithNode = backendChatMessages.find(msg => msg.node_ids && msg.node_ids.includes(parentId));
        if (parentMsgWithNode && typeof parentMsgWithNode.chat_index === 'number') {
          return parentMsgWithNode.chat_index + 1;
        } else {
          // Rekursiv weiter in die Elternknoten
          const recursive = findParentStimulus(parentId, parentLabel);
          if (recursive !== '') return recursive;
        }
      }
      return '';
    }

    let stimulusIndex: number | string;
    if (isAuto) {
      stimulusIndex = findParentStimulus(treeNodeId, label);
    } else if (msgWithNode && typeof msgWithNode.chat_index === 'number') {
      stimulusIndex = msgWithNode.chat_index + 1;
    } else {
      stimulusIndex = treeNodeId;
    }


    // Hilfsfunktion: Suche rekursiv das erste Kind mit relevanter Nachricht
    function findFirstChildWithMessage(treeNode: any): {msg: BackendChatMessage|null, childTreeNode: any|null} {
      if (!treeNode || !Array.isArray(treeNode.children) || treeNode.children.length === 0) return {msg: null, childTreeNode: null};
      for (const childId of treeNode.children) {
        // Finde Child-Objekt im Tree
        let childTreeNode = null;
        for (const chat of cc.chats) {
          const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
          if (latestTreeMessage?.Tree) {
            const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === childId);
            if (found) {
              childTreeNode = found;
              break;
            }
          }
        }
        if (!childTreeNode) continue;
        const msg = backendChatMessages.find(msg => msg.node_ids && msg.node_ids.includes(childTreeNode.id));
        if (msg) return {msg, childTreeNode};
        // Rekursiv weiter in die Kindknoten
        const result = findFirstChildWithMessage(childTreeNode);
        if (result.msg) return result;
      }
      return {msg: null, childTreeNode: null};
    }

    // Hilfsfunktion: Suche rekursiv den ersten Parent mit relevanter Nachricht
    function findFirstParentWithMessage(treeNode: any): {msg: BackendChatMessage|null, parentTreeNode: any|null} {
      if (!treeNode || !Array.isArray(treeNode.parents) || treeNode.parents.length === 0) return {msg: null, parentTreeNode: null};
      for (const parentId of treeNode.parents) {
        // Finde Parent-Objekt im Tree
        let parentTreeNode = null;
        for (const chat of cc.chats) {
          const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
          if (latestTreeMessage?.Tree) {
            const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === parentId);
            if (found) {
              parentTreeNode = found;
              break;
            }
          }
        }
        if (!parentTreeNode) continue;
        const msg = backendChatMessages.find(msg => msg.node_ids && msg.node_ids.includes(parentTreeNode.id));
        if (msg) return {msg, parentTreeNode};
        // Rekursiv weiter in die Elternknoten
        const result = findFirstParentWithMessage(parentTreeNode);
        if (result.msg) return result;
      }
      return {msg: null, parentTreeNode: null};
    }

  let foundTreeNode = getTreeNodeWithContent(treeNodeId, label, cc.chats);
  let relevantMessages = msgWithNode ? findRelevantMessagesFromBackend(foundTreeNode) : [];
  let messageSource = relevantMessages.length > 0 ? 'trace' : 'no-data';
  let actualMessageCount = relevantMessages.filter(msg => !msg.isSeparator).length;
  let allBackendMessages = msgWithNode ? findAllMessagesFromBackend((msgWithNode.chat_index + 1).toString()) : [];
  let usedChatId = msgWithNode ? (msgWithNode.chat_index + 1).toString() : '';

    // Falls keine relevante Nachricht, suche rekursiv im ersten Kind, falls das fehlschlägt, in den Eltern (nur für allMessages)
    if (!msgWithNode || relevantMessages.length === 0) {
      // Finde TreeNode-Objekt für diesen Knoten
      let treeNodeObj = null;
      for (const chat of cc.chats) {
        const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
        if (latestTreeMessage?.Tree) {
          const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === treeNodeId && n.label === label);
          if (found) {
            treeNodeObj = found;
            break;
          }
        }
      }
      let foundMsg = null;
      if (treeNodeObj) {
        const {msg: childMsg, childTreeNode} = findFirstChildWithMessage(treeNodeObj);
        if (childMsg && childTreeNode) {
          allBackendMessages = findAllMessagesFromBackend((childMsg.chat_index + 1).toString());
          usedChatId = (childMsg.chat_index + 1).toString();
          foundMsg = true;
        }
        // Falls kein Kind gefunden, suche Eltern
        if (!foundMsg) {
          const {msg: parentMsg, parentTreeNode} = findFirstParentWithMessage(treeNodeObj);
          if (parentMsg && parentTreeNode) {
            allBackendMessages = findAllMessagesFromBackend((parentMsg.chat_index + 1).toString());
            usedChatId = (parentMsg.chat_index + 1).toString();
          }
        }
      }
    }

    return {
      nodeInfo: {
        id: nodeId,
        type: label,
        treeNode: foundTreeNode,
        stimulus: stimulusIndex,
        hasTraceData: relevantMessages.length > 0,
        // Füge alle TreeNodes für das Modal hinzu (aus dem letzten TreeMessage)
        treeNodes: (() => {
          for (const chat of cc.chats) {
            const latestTreeMessage = chat.rawMessages.findLast((msg: any) => isChatPromptAnswer(msg)) as any;
            if (latestTreeMessage?.Tree && Array.isArray(latestTreeMessage.Tree.nodes)) {
              const found = latestTreeMessage.Tree.nodes.find((n: any) => n.id === treeNodeId && n.label === label);
              if (found) return latestTreeMessage.Tree.nodes;
            }
          }
          return [];
        })()
      },
      messages: relevantMessages,
      messageCount: actualMessageCount,
      allMessages: allBackendMessages,
      chatid: usedChatId,
      messageSource: messageSource as "trace" | "no-data"
    };
  }, [backendChatMessages, findRelevantMessagesFromBackend, findAllMessagesFromBackend]);

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Überspringe Topic
    if (node.id === 'Topic') {
      return;
    }
    const nodeData = findNodeInterviewData(node.id);
    if (nodeData) {
      setSelectedNodeData(nodeData);
    }
  }, [findNodeInterviewData, setSelectedNodeData]);

  return { onNodeClick };
}