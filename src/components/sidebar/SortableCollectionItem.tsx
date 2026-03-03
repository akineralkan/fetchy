import { ChevronDown, ChevronRight, GripVertical, MoreVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Collection } from '../../types';

// Sortable Collection Item
export default function SortableCollectionItem({
  collection,
  children,
  onToggle,
  onDoubleClick,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  collection: Collection;
  children: React.ReactNode;
  onToggle: () => void;
  onDoubleClick?: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `collection-${collection.id}`,
    data: { type: 'collection', collectionId: collection.id, collection }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2 relative">
      <div
        className="tree-item flex items-center gap-2 px-2 py-2 cursor-pointer group rounded"
        onClick={onToggle}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        onContextMenu={onContextMenu}
      >
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-fetchy-border rounded cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} className="text-fetchy-text-muted" />
        </button>
        {collection.expanded ? (
          <ChevronDown size={16} className="text-fetchy-text-muted shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-fetchy-text-muted shrink-0" />
        )}
        {editingId === collection.id ? (
          <input
            ref={inputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditComplete();
              if (e.key === 'Escape') onEditComplete();
            }}
            className="flex-1 bg-transparent border-b border-fetchy-accent text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm font-medium text-fetchy-text truncate flex-1">
            {collection.name}
          </span>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fetchy-border rounded"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>
      {collection.expanded && children}
    </div>
  );
}

