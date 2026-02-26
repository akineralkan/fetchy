import { Zap, FolderOpen, FileJson, Terminal } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import Confetti from './Confetti';

type ImportType = 'postman' | 'openapi' | 'curl';

interface WelcomeScreenProps {
  onImport: (type?: ImportType) => void;
}

export default function WelcomeScreen({ onImport }: WelcomeScreenProps) {
  const { addCollection, addRequest, openTab } = useAppStore();

  const handleQuickStart = () => {
    const collection = addCollection('My Collection');
    const request = addRequest(collection.id, null, {
      name: 'My First Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
    });
    openTab({
      type: 'request',
      title: request.name,
      requestId: request.id,
      collectionId: collection.id,
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center bg-fetchy-bg py-8 px-8 relative overflow-hidden">
      <Confetti />
      <div className="text-center max-w-2xl relative z-20 flex flex-col items-center justify-center">
        <div className="inline-block mb-6">
          <img
            src="./logo.jpg"
            alt="Fetchy"
            className="w-28 h-28 mx-auto"
          />
        </div>
        <h1 className="text-3xl font-bold text-fetchy-text mb-2">
          Welcome to Fetchy
        </h1>
        <p className="text-fetchy-accent italic mb-4">Local by design. Reliable by nature.</p>
        <p className="text-fetchy-text-muted mb-8">
          A powerful, offline-capable REST API client for testing and debugging your APIs.
          Import collections from Postman or OpenAPI specs, or start fresh.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={handleQuickStart}
            className="p-6 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <Zap className="w-8 h-8 text-fetchy-accent mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-2">Quick Start</h3>
            <p className="text-sm text-fetchy-text-muted">
              Create a new collection with a sample request
            </p>
          </button>

          <button
            onClick={() => onImport('postman')}
            className="p-6 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <FolderOpen className="w-8 h-8 text-yellow-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-2">Import Postman</h3>
            <p className="text-sm text-fetchy-text-muted">
              Import your existing Postman collections
            </p>
          </button>

          <button
            onClick={() => onImport('openapi')}
            className="p-6 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <FileJson className="w-8 h-8 text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-2">Import OpenAPI</h3>
            <p className="text-sm text-fetchy-text-muted">
              Generate requests from OpenAPI/Swagger specs
            </p>
          </button>

          <button
            onClick={() => onImport('curl')}
            className="p-6 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <Terminal className="w-8 h-8 text-purple-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-2">Import cURL</h3>
            <p className="text-sm text-fetchy-text-muted">
              Convert cURL commands to requests
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

