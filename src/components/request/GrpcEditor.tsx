import { useState, useCallback } from 'react';
import { FolderOpen, RefreshCw, Plus, Trash2, Play, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { GrpcRequestData, GrpcServiceInfo, GrpcMetadataEntry } from '../../types';

interface GrpcEditorProps {
  grpc: GrpcRequestData;
  onChange: (updates: Partial<GrpcRequestData>) => void;
  isLoading: boolean;
  onInvoke: () => void;
  onCancel: () => void;
}

type GrpcTab = 'config' | 'payload' | 'metadata';

export default function GrpcEditor({
  grpc,
  onChange,
  isLoading,
  onInvoke,
  onCancel,
}: GrpcEditorProps) {
  const [activeTab, setActiveTab] = useState<GrpcTab>('config');
  const [loadedServices, setLoadedServices] = useState<GrpcServiceInfo[]>([]);
  const [isLoadingProto, setIsLoadingProto] = useState(false);
  const [protoError, setProtoError] = useState<string | null>(null);

  const handlePickProto = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.openFile({
      filters: [{ name: 'Protocol Buffer', extensions: ['proto'] }],
    });
    if (!result) return;
    const filePath = result.filePath;
    onChange({ protoFilePath: filePath, serviceName: '', methodName: '' });
    setLoadedServices([]);
    setProtoError(null);
    // Auto-load the proto
    await loadProto(filePath);
  }, [onChange]);

  const loadProto = useCallback(async (filePath: string) => {
    const api = (window as any).electronAPI;
    if (!api?.grpc) {
      setProtoError('gRPC API not available');
      return;
    }
    setIsLoadingProto(true);
    setProtoError(null);
    try {
      const result = await api.grpc.loadProto(filePath);
      if (result.success && result.services) {
        setLoadedServices(result.services);
        // Auto-select first service/method if only one option
        if (result.services.length === 1) {
          const svc = result.services[0];
          const updates: Partial<GrpcRequestData> = { serviceName: svc.name };
          if (svc.methods.length === 1) {
            updates.methodName = svc.methods[0].name;
          }
          onChange(updates);
        }
      } else {
        setProtoError(result.error || 'Failed to load proto file');
      }
    } catch (err: any) {
      setProtoError(err?.message || 'Failed to load proto file');
    } finally {
      setIsLoadingProto(false);
    }
  }, [onChange]);

  const handleReloadProto = useCallback(async () => {
    if (!grpc.protoFilePath) return;
    await loadProto(grpc.protoFilePath);
  }, [grpc.protoFilePath, loadProto]);

  const handleServiceChange = (serviceName: string) => {
    onChange({ serviceName, methodName: '' });
  };

  const handleMethodChange = (methodName: string) => {
    onChange({ methodName });
  };

  const selectedService = loadedServices.find(s => s.name === grpc.serviceName);
  const selectedMethod = selectedService?.methods.find(m => m.name === grpc.methodName);

  // ─── Metadata helpers ─────────────────────────────────────────────────────

  const addMetadata = () => {
    const newEntry: GrpcMetadataEntry = { id: uuidv4(), key: '', value: '', enabled: true };
    onChange({ metadata: [...(grpc.metadata || []), newEntry] });
  };

  const updateMetadata = (id: string, updates: Partial<GrpcMetadataEntry>) => {
    onChange({
      metadata: (grpc.metadata || []).map(e => e.id === id ? { ...e, ...updates } : e),
    });
  };

  const removeMetadata = (id: string) => {
    onChange({ metadata: (grpc.metadata || []).filter(e => e.id !== id) });
  };

  // ─── Rendering ────────────────────────────────────────────────────────────

  const renderConfig = () => (
    <div className="flex flex-col gap-4 p-4 overflow-auto h-full">
      {/* Proto File */}
      <div>
        <label className="block text-xs font-medium text-fetchy-text-muted mb-1 uppercase tracking-wide">
          Proto File
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={grpc.protoFilePath || ''}
            readOnly
            placeholder="Pick a .proto file..."
            className="flex-1 text-sm bg-fetchy-input border border-fetchy-border rounded px-3 py-1.5 text-fetchy-text placeholder:text-fetchy-text-muted cursor-default"
          />
          <button
            onClick={handlePickProto}
            disabled={isLoadingProto}
            className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
            title="Browse for .proto file"
          >
            <FolderOpen size={14} /> Browse
          </button>
          {grpc.protoFilePath && (
            <button
              onClick={handleReloadProto}
              disabled={isLoadingProto}
              className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
              title="Reload proto"
            >
              <RefreshCw size={14} className={isLoadingProto ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
        {protoError && (
          <p className="mt-1 text-xs text-red-400">{protoError}</p>
        )}
        {isLoadingProto && (
          <p className="mt-1 text-xs text-fetchy-text-muted">Loading proto…</p>
        )}
      </div>

      {/* Service */}
      <div>
        <label className="block text-xs font-medium text-fetchy-text-muted mb-1 uppercase tracking-wide">
          Service
        </label>
        <select
          value={grpc.serviceName || ''}
          onChange={(e) => handleServiceChange(e.target.value)}
          disabled={loadedServices.length === 0}
          className="w-full text-sm"
        >
          <option value="">
            {loadedServices.length === 0 ? 'Load a .proto file first' : 'Select a service'}
          </option>
          {loadedServices.map(svc => (
            <option key={svc.name} value={svc.name}>{svc.name}</option>
          ))}
        </select>
      </div>

      {/* Method */}
      <div>
        <label className="block text-xs font-medium text-fetchy-text-muted mb-1 uppercase tracking-wide">
          Method
        </label>
        <select
          value={grpc.methodName || ''}
          onChange={(e) => handleMethodChange(e.target.value)}
          disabled={!selectedService}
          className="w-full text-sm"
        >
          <option value="">
            {!selectedService ? 'Select a service first' : 'Select a method'}
          </option>
          {(selectedService?.methods || []).map(m => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.requestStream || m.responseStream
                ? ` (${m.requestStream && m.responseStream
                  ? 'bidirectional stream'
                  : m.requestStream
                    ? 'client stream'
                    : 'server stream'})`
                : ''}
            </option>
          ))}
        </select>
        {selectedMethod && (selectedMethod.requestStream || selectedMethod.responseStream) && (
          <p className="mt-1 text-xs text-fetchy-accent">
            Streaming RPC — responses will be collected and returned as a JSON array.
          </p>
        )}
      </div>

      {/* TLS Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-fetchy-text">
          <input
            type="checkbox"
            checked={grpc.useTls === true}
            onChange={(e) => onChange({ useTls: e.target.checked })}
            className="w-4 h-4 accent-fetchy-accent"
          />
          Use TLS
        </label>
        <span className="text-xs text-fetchy-text-muted">
          Enable for secure gRPC (grpcs://). Disable for plaintext (grpc://).
        </span>
      </div>
    </div>
  );

  const renderPayload = () => (
    <div className="flex flex-col h-full p-4 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fetchy-text-muted uppercase tracking-wide">
          Request Payload (JSON)
        </span>
      </div>
      <textarea
        value={grpc.payload || ''}
        onChange={(e) => onChange({ payload: e.target.value })}
        placeholder={'{\n  "key": "value"\n}'}
        spellCheck={false}
        className="flex-1 w-full bg-fetchy-input border border-fetchy-border rounded p-3 text-sm font-mono text-fetchy-text resize-none focus:outline-none focus:ring-1 focus:ring-fetchy-accent"
      />
    </div>
  );

  const renderMetadata = () => {
    const entries = grpc.metadata || [];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-end gap-2 p-2 border-b border-fetchy-border shrink-0">
          <button
            onClick={addMetadata}
            className="flex items-center gap-1 px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border rounded"
          >
            <Plus size={12} /> Add Metadata
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full kv-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '40%' }} />
              <col />
              <col style={{ width: '32px' }} />
            </colgroup>
            <thead className="sticky top-0 bg-fetchy-bg">
              <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                <th className="w-8 p-2" />
                <th className="p-2">Key</th>
                <th className="p-2">Value</th>
                <th className="w-8 p-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-fetchy-border/50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={(e) => updateMetadata(entry.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-fetchy-accent"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      value={entry.key}
                      onChange={(e) => updateMetadata(entry.id, { key: e.target.value })}
                      placeholder="Key"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      value={entry.value}
                      onChange={(e) => updateMetadata(entry.id, { value: e.target.value })}
                      placeholder="Value"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeMetadata(entry.id)}
                      className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="px-4 py-3 text-xs text-fetchy-text-muted">
              No metadata entries. Click "Add Metadata" to add gRPC headers.
            </p>
          )}
        </div>
      </div>
    );
  };

  const TABS: Array<{ id: GrpcTab; label: string }> = [
    { id: 'config', label: 'Config' },
    { id: 'payload', label: 'Payload' },
    { id: 'metadata', label: `Metadata${(grpc.metadata || []).filter(e => e.enabled && e.key).length > 0 ? ` (${(grpc.metadata || []).filter(e => e.enabled && e.key).length})` : ''}` },
  ];

  const canInvoke = Boolean(grpc.serverAddress && grpc.protoFilePath && grpc.serviceName && grpc.methodName);

  return (
    <div className="h-full flex flex-col bg-fetchy-bg">
      {/* Tab bar + Invoke button */}
      <div className="flex items-center border-b border-fetchy-border shrink-0">
        <div className="flex flex-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-fetchy-accent text-fetchy-accent bg-fetchy-accent/25'
                  : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Invoke / Cancel button */}
        {isLoading ? (
          <button
            onClick={onCancel}
            className="mx-3 btn flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-3"
          >
            <XCircle size={14} /> Cancel
          </button>
        ) : (
          <button
            onClick={onInvoke}
            disabled={!canInvoke}
            className="mx-3 btn btn-primary flex items-center gap-2 text-sm py-1.5 px-3 disabled:opacity-50"
            title={!canInvoke ? 'Fill in server address, proto file, service, and method first' : 'Invoke gRPC call'}
          >
            <Play size={14} /> Invoke
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'config' && renderConfig()}
        {activeTab === 'payload' && renderPayload()}
        {activeTab === 'metadata' && renderMetadata()}
      </div>
    </div>
  );
}
