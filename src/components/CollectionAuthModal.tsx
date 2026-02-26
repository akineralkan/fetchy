import { useState, useEffect } from 'react';
import { X, Link } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { RequestAuth, RequestFolder } from '../types';
import VariableInput from './VariableInput';

interface CollectionAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  folderId?: string;
}

export default function CollectionAuthModal({
  isOpen,
  onClose,
  collectionId,
  folderId,
}: CollectionAuthModalProps) {
  const { collections, updateCollection, updateFolder } = useAppStore();
  const [auth, setAuth] = useState<RequestAuth>({ type: 'none' });

  const collection = collections.find(c => c.id === collectionId);

  // Find folder recursively
  const findFolder = (folders: RequestFolder[], id: string): RequestFolder | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolder(folder.folders, id);
      if (found) return found;
    }
    return null;
  };

  const folder = folderId && collection ? findFolder(collection.folders, folderId) : null;
  const target = folder || collection;
  const targetName = folder ? folder.name : collection?.name || 'Collection';

  useEffect(() => {
    if (target?.auth) {
      setAuth(target.auth);
    } else {
      setAuth({ type: 'none' });
    }
  }, [target]);

  if (!isOpen || !collection) return null;

  const handleSave = () => {
    if (folderId) {
      updateFolder(collectionId, folderId, { auth });
    } else {
      updateCollection(collectionId, { auth });
    }
    onClose();
  };

  const authTypes = [
    { value: 'inherit', label: 'Inherit' },
    { value: 'none', label: 'No Auth' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'api-key', label: 'API Key' },
  ];

  // Only show inherit option for folders (collections can't inherit)
  const availableAuthTypes = folderId
    ? authTypes
    : authTypes.filter(t => t.value !== 'inherit');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-fetchy-border">
          <div>
            <h2 className="text-lg font-semibold">Authorization Settings</h2>
            <p className="text-sm text-fetchy-text-muted mt-0.5">
              Configure auth for <span className="text-fetchy-accent">{targetName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-fetchy-border rounded">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <label className="block text-sm text-fetchy-text-muted mb-2">Authorization Type</label>
            <div className="flex flex-wrap gap-2">
              {availableAuthTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setAuth({ ...auth, type: type.value as any })}
                  className={`px-3 py-1.5 text-sm rounded ${
                    auth.type === type.value
                      ? 'bg-fetchy-accent text-white'
                      : 'bg-fetchy-border text-fetchy-text-muted hover:text-fetchy-text'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-fetchy-bg rounded-lg p-4 border border-fetchy-border">
            {auth.type === 'inherit' && (
              <div className="flex items-center gap-2 text-fetchy-text-muted">
                <Link size={16} className="text-fetchy-accent" />
                <span className="text-sm">Auth will be inherited from parent collection</span>
              </div>
            )}

            {auth.type === 'none' && (
              <p className="text-fetchy-text-muted text-sm text-center">
                No authentication required. Child requests can override this.
              </p>
            )}

            {auth.type === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-fetchy-text-muted mb-1">Username</label>
                  <VariableInput
                    value={auth.basic?.username || ''}
                    onChange={(value) => setAuth({
                      ...auth,
                      basic: { username: value, password: auth.basic?.password || '' }
                    })}
                    className="w-full"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-fetchy-text-muted mb-1">Password</label>
                  <VariableInput
                    value={auth.basic?.password || ''}
                    onChange={(value) => setAuth({
                      ...auth,
                      basic: { username: auth.basic?.username || '', password: value }
                    })}
                    className="w-full"
                    placeholder="Enter password"
                  />
                </div>
              </div>
            )}

            {auth.type === 'bearer' && (
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Token</label>
                <VariableInput
                  value={auth.bearer?.token || ''}
                  onChange={(value) => setAuth({ ...auth, bearer: { token: value } })}
                  className="w-full"
                  placeholder="Enter bearer token"
                />
              </div>
            )}

            {auth.type === 'api-key' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-fetchy-text-muted mb-1">Key</label>
                  <VariableInput
                    value={auth.apiKey?.key || ''}
                    onChange={(value) => setAuth({
                      ...auth,
                      apiKey: {
                        key: value,
                        value: auth.apiKey?.value || '',
                        addTo: auth.apiKey?.addTo || 'header'
                      }
                    })}
                    className="w-full"
                    placeholder="e.g., X-API-Key"
                  />
                </div>
                <div>
                  <label className="block text-sm text-fetchy-text-muted mb-1">Value</label>
                  <VariableInput
                    value={auth.apiKey?.value || ''}
                    onChange={(value) => setAuth({
                      ...auth,
                      apiKey: {
                        key: auth.apiKey?.key || '',
                        value: value,
                        addTo: auth.apiKey?.addTo || 'header'
                      }
                    })}
                    className="w-full"
                    placeholder="Enter API key value"
                  />
                </div>
                <div>
                  <label className="block text-sm text-fetchy-text-muted mb-1">Add to</label>
                  <select
                    value={auth.apiKey?.addTo || 'header'}
                    onChange={(e) => setAuth({
                      ...auth,
                      apiKey: {
                        key: auth.apiKey?.key || '',
                        value: auth.apiKey?.value || '',
                        addTo: e.target.value as 'header' | 'query'
                      }
                    })}
                    className="w-full"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Params</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-fetchy-text-muted mt-4">
            Requests in this {folderId ? 'folder' : 'collection'} can inherit this auth by selecting "Inherit" in their Auth settings.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-fetchy-border">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

