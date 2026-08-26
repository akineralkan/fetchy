import { useState, useRef } from 'react';
import * as yaml from 'js-yaml';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, FileCode } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { OpenAPIDocument } from '../../types';
import { importOpenAPISpec } from '../../utils/helpers';
import { DEFAULT_OPENAPI_YAML } from '../openapi/constants';
import ConfirmDialog from '../ConfirmDialog';
import SortableApiDocItem from './SortableApiDocItem';

interface ApiDocsPanelProps {
  /** Pre-filtered/sorted list of API documents (filter state lives in parent) */
  filteredApiDocuments: OpenAPIDocument[];
  /** Called after DnD reorder so parent can reset sort to "created" */
  onResetSort: () => void;
}

export default function ApiDocsPanel({ filteredApiDocuments, onResetSort }: ApiDocsPanelProps) {
  const {
    openApiDocuments,
    addOpenApiDocument,
    updateOpenApiDocument,
    deleteOpenApiDocument,
    reorderOpenApiDocuments,
    openTab,
    tabs,
    updateTab,
  } = useAppStore();

  const { preferences } = usePreferencesStore();
  const confirmBeforeDelete = preferences.confirmBeforeDelete !== false;

  // Editing state (local to this panel)
  const [editingApiSpecId, setEditingApiSpecId] = useState<string | null>(null);
  const [editingApiSpecName, setEditingApiSpecName] = useState('');
  const apiSpecInputRef = useRef<HTMLInputElement>(null);

  // Pending delete confirmation (#103)
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<{ id: string; name: string } | null>(null);

  // DnD state (scoped to api-doc items)
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = event.active.id as string;
    setActiveId(idStr);
    if (idStr.startsWith('api-doc-')) {
      setActiveDragId(idStr.replace('api-doc-', ''));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr.startsWith('api-doc-') && overIdStr.startsWith('api-doc-')) {
      const activeApiDocId = activeIdStr.replace('api-doc-', '');
      const overApiDocId = overIdStr.replace('api-doc-', '');
      const oldIndex = filteredApiDocuments.findIndex(doc => doc.id === activeApiDocId);
      const newIndex = filteredApiDocuments.findIndex(doc => doc.id === overApiDocId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const originalOldIndex = openApiDocuments.findIndex(doc => doc.id === activeApiDocId);
        const originalNewIndex = openApiDocuments.findIndex(doc => doc.id === overApiDocId);
        if (originalOldIndex !== -1 && originalNewIndex !== -1) {
          onResetSort();
          reorderOpenApiDocuments(originalOldIndex, originalNewIndex);
        }
      }
    }
  };

  return (
    <div>
      {/* API Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-fetchy-text-muted">
          {filteredApiDocuments.length} spec{filteredApiDocuments.length !== 1 ? 's' : ''}
          {filteredApiDocuments.length !== openApiDocuments.length && (
            <span className="text-fetchy-text-muted"> ({openApiDocuments.length} total)</span>
          )}
        </span>
        <button
          onClick={() => {
            const doc = addOpenApiDocument('New API Spec', DEFAULT_OPENAPI_YAML, 'yaml');
            openTab({ type: 'openapi', title: doc.name, openApiDocId: doc.id });
          }}
          className="text-xs text-fetchy-accent hover:text-fetchy-accent/80 flex items-center gap-1"
        >
          <Plus size={12} /> New Spec
        </button>
      </div>

      {openApiDocuments.length === 0 ? (
        <div className="text-center py-8 text-fetchy-text-muted">
          <FileCode size={32} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm mb-2">No OpenAPI specs yet</p>
          <p className="text-xs mb-4">Create a new spec to get started</p>
          <button
            onClick={() => {
              const doc = addOpenApiDocument('New API Spec', DEFAULT_OPENAPI_YAML, 'yaml');
              openTab({ type: 'openapi', title: doc.name, openApiDocId: doc.id });
            }}
            className="btn btn-primary text-sm"
          >
            Create OpenAPI Spec
          </button>
        </div>
      ) : filteredApiDocuments.length === 0 ? (
        <div className="text-center py-8 text-fetchy-text-muted">
          <FileCode size={32} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm mb-2">No matching specs found</p>
          <p className="text-xs">Try adjusting your search or filters</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredApiDocuments.map(doc => `api-doc-${doc.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {filteredApiDocuments.map((doc) => (
                <SortableApiDocItem
                  key={doc.id}
                  doc={doc}
                  onClick={() => {
                    if (editingApiSpecId !== doc.id) {
                      openTab({ type: 'openapi', title: doc.name, openApiDocId: doc.id });
                    }
                  }}
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingApiSpecId(doc.id);
                    setEditingApiSpecName(doc.name);
                    setTimeout(() => apiSpecInputRef.current?.focus(), 0);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    if (confirmBeforeDelete) {
                      setPendingDeleteDoc({ id: doc.id, name: doc.name });
                    } else {
                      deleteOpenApiDocument(doc.id);
                    }
                  }}
                  onGenerateCollection={(e) => {
                    e.stopPropagation();
                    if (!doc.content.trim()) {
                      alert('This OpenAPI spec is empty. Add content before generating a collection.');
                      return;
                    }
                    const collection = importOpenAPISpec(doc.content);
                    if (collection) {
                      useAppStore.getState().importCollection(collection);
                      alert(`Collection "${collection.name}" has been created successfully!`);
                    } else {
                      alert('Failed to generate collection. Please check the OpenAPI spec format.');
                    }
                  }}
                  onConvertToYaml={(e) => {
                    e.stopPropagation();
                    if (!doc.content.trim()) {
                      alert('This OpenAPI spec is empty. Add content before converting.');
                      return;
                    }
                    try {
                      const parsed = JSON.parse(doc.content);
                      const yamlContent = yaml.dump(parsed, { indent: 2, lineWidth: -1 });
                      updateOpenApiDocument(doc.id, { content: yamlContent, format: 'yaml' });
                    } catch {
                      alert('Failed to convert to YAML. Please check the JSON format.');
                    }
                  }}
                  onConvertToJson={(e) => {
                    e.stopPropagation();
                    if (!doc.content.trim()) {
                      alert('This OpenAPI spec is empty. Add content before converting.');
                      return;
                    }
                    try {
                      const parsed = yaml.load(doc.content);
                      const jsonContent = JSON.stringify(parsed, null, 2);
                      updateOpenApiDocument(doc.id, { content: jsonContent, format: 'json' });
                    } catch {
                      alert('Failed to convert to JSON. Please check the YAML format.');
                    }
                  }}
                  onExport={(e) => {
                    e.stopPropagation();
                    if (!doc.content.trim()) {
                      alert('This OpenAPI spec is empty. Add content before exporting.');
                      return;
                    }
                    const extension = doc.format === 'yaml' ? 'yaml' : 'json';
                    const blob = new Blob([doc.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${doc.name}.${extension}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  editingId={editingApiSpecId}
                  editingName={editingApiSpecName}
                  setEditingName={setEditingApiSpecName}
                  inputRef={apiSpecInputRef}
                  onEditComplete={() => {
                    if (editingApiSpecName.trim()) {
                      const newName = editingApiSpecName.trim();
                      updateOpenApiDocument(doc.id, { name: newName });
                      tabs.forEach(tab => {
                        if (tab.openApiDocId === doc.id) {
                          updateTab(tab.id, { title: newName });
                        }
                      });
                    }
                    setEditingApiSpecId(null);
                  }}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId && activeDragId && (
              <div className="bg-fetchy-card border border-fetchy-accent rounded px-3 py-2 shadow-lg opacity-90">
                <span className="text-sm text-fetchy-text">
                  {filteredApiDocuments.find(doc => doc.id === activeDragId)?.name || 'Moving spec...'}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
      {pendingDeleteDoc && (
        <ConfirmDialog
          title="Delete API Spec?"
          itemName={pendingDeleteDoc.name}
          onCancel={() => setPendingDeleteDoc(null)}
          onConfirm={() => {
            deleteOpenApiDocument(pendingDeleteDoc.id);
            setPendingDeleteDoc(null);
          }}
        />
      )}
    </div>
  );
}
