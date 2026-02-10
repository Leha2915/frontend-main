
import React, { useState } from 'react';  
import { Message } from '@/lib/types';

interface InterviewDataModalProps {
  selectedNodeData: {
    nodeInfo: any;
    messages: Message[];      // Trace-basierte Messages
    messageCount: number;     // Echte Message-Anzahl ohne Separatoren
    allMessages: Message[];   // Fallback: Alle Messages
    chatid: string;
    messageSource: 'trace' | 'no-data';
  } | null;
  onClose: () => void;
}

export function InterviewDataModal({ selectedNodeData, onClose }: InterviewDataModalProps) {
  const [viewMode, setViewMode] = useState<'relevant' | 'full'>('relevant');

  if (!selectedNodeData) return null;

  // Sichere Initialisierung für messages und allMessages
  const safeMessages = Array.isArray(selectedNodeData?.messages) ? selectedNodeData.messages : [];
  const safeAllMessages = Array.isArray(selectedNodeData?.allMessages) ? selectedNodeData.allMessages : [];
  const filteredRelevantMessages = safeMessages.filter(message => {
    if (message.isSeparator) return true;
    if (!message.isUserMessage) {
      // Nur System-Fragen, die auch im allMessages-Array vorkommen
      return safeAllMessages.some(m => !m.isUserMessage && m.text === message.text);
    }
    return true;
  });
  const { nodeInfo, messageSource } = selectedNodeData;
  const allMessages = Array.isArray(selectedNodeData?.allMessages) ? selectedNodeData.allMessages : [];

  return (
    <div
      className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 p-4 bg-teal-50 rounded border border-teal-200">
          <br />
          {/* Zeige Stimulus nur, wenn es kein Topic-Knoten ist (Logik direkt vor Nachrichtenanzeige) */}
          {nodeInfo.treeNode?.label === 'TOPIC' ? null : (
            <p><strong>Stimulus:</strong> {nodeInfo.stimulus}</p>
          )}
          <p><strong>Type:</strong> {nodeInfo.treeNode?.label || nodeInfo.type.toUpperCase()}</p>
          <p><strong>Content:</strong> {nodeInfo.treeNode.conclusion}</p>
          <br />
        </div>
        {nodeInfo.treeNode?.label !== 'TOPIC' && (
          <hr className="border-t-2 border-gray-400 my-4" />
        )}
        
        {/* Toggle für Message-Ansicht, aber nicht für Topic-Knoten */}
  {nodeInfo.treeNode?.label !== 'TOPIC' && (
          <div className="mb-4">
            <button
              onClick={() => setViewMode('relevant')}
              className={`mr-2 px-4 py-2 rounded ${
                viewMode === 'relevant' ? 'bg-blue-400 text-white' : 'bg-gray-200'
              }`}
            >
              Relevant Messages ({filteredRelevantMessages.filter(m => m && !m.isSeparator).length})
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-4 py-2 rounded ${
                viewMode === 'full' ? 'bg-blue-400 text-white' : 'bg-gray-200'
              }`}
            >
              Full Chat ({allMessages.length})
            </button>
          </div>
        )}

        {/* Messages Display */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {/* Keine Nachrichtenanzeige und kein Hinweistext nur für Topic-Knoten */}
          {nodeInfo.treeNode?.label === 'TOPIC' ? null : (
            viewMode === 'relevant' ? (
              filteredRelevantMessages.length > 0 ? (
                filteredRelevantMessages.map((message, index) => {
                  if (!message) return null;
                  // Spezielle Behandlung für Trennlinien
                  if (message.isSeparator) {
                    return (
                      <hr 
                        key={message.id || `separator-${index}`} 
                        className="border-t-2 border-gray-300 my-3" 
                      />
                    );
                  }
                  // Nur System-Fragen (AI Interviewer) anzeigen, die auch im allMessages-Array vorkommen
                  if (!message.isUserMessage) {
                    const existsInAll = allMessages.some(m => !m.isUserMessage && m.text === message.text);
                    if (!existsInAll) return null;
                  }
                  return (
                    <div
                      key={message.id || index}
                      className={`p-3 rounded ${
                        message.isUserMessage ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
                      }`}
                    >
                      <div className="text-sm text-gray-600 mb-1">
                        {message.isUserMessage ? 'Participant' : 'AI Interviewer'}
                      </div>
                      <div>{message.text}</div>
                    </div>
                  );
                })
              ) : null
            ) : (
              allMessages.map((message, index) => {
                // Spezielle Behandlung für Trennlinien auch in der Full-Ansicht
                if (message.isSeparator) {
                  return (
                    <hr 
                      key={message.id || `full-separator-${index}`} 
                      className="border-t-2 border-gray-300 my-3" 
                    />
                  );
                }
                return (
                  <div
                    key={message.id || index}
                    className={`p-3 rounded ${
                      message.isUserMessage ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
                    }`}
                  >
                    <div className="text-sm text-gray-600 mb-1">
                      {message.isUserMessage ? 'Participant' : 'AI Interviewer'}
                    </div>
                    <div>{message.text}</div>
                  </div>
                );
              })
            )
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}