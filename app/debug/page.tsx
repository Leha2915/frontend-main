'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [backendSchema, setBackendSchema] = useState<any>(null);
  const [testResponse, setTestResponse] = useState<any>(null);
  
  useEffect(() => {
    // Cookies beim Laden lesen
    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
      const [name, value] = cookie.split('=');
      return { ...acc, [name]: value };
    }, {} as Record<string, string>);
    
    setSessionId(cookies['interview_session_id'] || 'Keine Session-ID gefunden');
  }, []);

  const testPayload = async () => {
    try {
      const payload = {
        template_name: 'queue_laddering',
        template_vars: { topic: 'Test Topic', stimulus: 'Test Stimulus' },
        messages: [{ role: 'user', content: 'Test message' }],
        model: 'qwen3-32b',
        projectSlug: '3dc7fe9e',
        session_id: sessionId
      };
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      
      const data = await res.json();
      setTestResponse(data);
    } catch (err) {
      setTestResponse({ error: err.message });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Debug-Seite</h1>
      
      <div className="mb-4 p-3 border rounded">
        <h2 className="text-xl">Session-Status</h2>
        <p>Aktuelle Session-ID: <code>{sessionId}</code></p>
        <div className="flex gap-2 mt-2">
          <button 
            onClick={() => {
              const newId = `test-${Date.now()}`;
              document.cookie = `interview_session_id=${newId}; path=/`;
              setSessionId(newId);
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Test-Cookie setzen
          </button>
          <button 
            onClick={() => {
              document.cookie = "interview_session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              setSessionId('Keine Session-ID');
            }}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Cookie löschen
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <button 
          onClick={testPayload}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          API-Anfrage testen
        </button>
      </div>
      
      {testResponse && (
        <div className="p-3 border rounded bg-gray-50">
          <h2 className="text-xl mb-2">API-Antwort:</h2>
          <pre className="whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(testResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}