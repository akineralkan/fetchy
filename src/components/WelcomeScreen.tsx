import { Zap, Terminal, FolderOpen, Globe } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import Confetti from './Confetti';

interface WelcomeScreenProps {
  onImportRequest: () => void;
  onImportCollection: () => void;
  onImportEnvironment: () => void;
}

export default function WelcomeScreen({ onImportRequest, onImportCollection, onImportEnvironment }: WelcomeScreenProps) {
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
    <div className="h-full flex flex-col items-center justify-start bg-fetchy-bg pt-6 px-6 relative overflow-hidden">
      <Confetti />
      <div className="text-center max-w-2xl relative z-20 flex flex-col items-center w-full">
        <div className="inline-block mb-3">
          <img
            src="./logo.jpg"
            alt="Fetchy"
            className="w-20 h-20 mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold text-fetchy-text mb-1">
          Welcome to Kechy
        </h1>
        <p className="text-fetchy-accent italic mb-2 text-sm">Local by design. Reliable by nature.</p>
        <p className="text-fetchy-text-muted mb-5 text-sm">
          A powerful, offline-capable REST API client for testing and debugging your APIs.
          Import collections from Postman or OpenAPI specs, or start fresh.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
          <button
            onClick={handleQuickStart}
            className="p-4 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <Zap className="w-6 h-6 text-fetchy-accent mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-1 text-sm">Quick Start</h3>
            <p className="text-xs text-fetchy-text-muted">
              Create a new collection with a sample request
            </p>
          </button>

          <button
            onClick={onImportRequest}
            className="p-4 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <Terminal className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-1 text-sm">Import Request</h3>
            <p className="text-xs text-fetchy-text-muted">
              Import a request from a cURL command
            </p>
          </button>

          <button
            onClick={onImportCollection}
            className="p-4 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <FolderOpen className="w-6 h-6 text-yellow-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-1 text-sm">Import Collection</h3>
            <p className="text-xs text-fetchy-text-muted">
              Import from Postman, Hoppscotch, Bruno, or OpenAPI
            </p>
          </button>

          <button
            onClick={onImportEnvironment}
            className="p-4 bg-fetchy-card border border-fetchy-border rounded-lg hover:border-fetchy-accent transition-colors group"
          >
            <Globe className="w-6 h-6 text-green-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-fetchy-text mb-1 text-sm">Import Environment</h3>
            <p className="text-xs text-fetchy-text-muted">
              Import environments from Postman, Hoppscotch, or Bruno
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

