import { ChevronDown, ChevronRight, Folder, GripVertical, MoreVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RequestFolder } from '../../types';

// Sortable Folder Item
export default function SortableFolderItem({
  folder,
  collectionId,
  depth,
  children,
  onToggle,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  folder: RequestFolder;
  collectionId: string;
  depth: number;
  children: React.ReactNode;
  onToggle: () => void;
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
    isOver,
  } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', collectionId, folder }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`tree-item flex items-center gap-2 px-2 py-1.5 cursor-pointer group rounded ${isOver ? 'bg-fetchy-accent/20' : ''}`}
        onClick={onToggle}
        onContextMenu={onContextMenu}
      >
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-fetchy-border rounded cursor-grab active:cursor-grabbing"
          style={{ marginLeft: `${(depth - 1) * 16}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} className="text-fetchy-text-muted" />
        </button>
        {folder.expanded ? (
          <ChevronDown size={14} className="text-fetchy-text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-fetchy-text-muted shrink-0" />
        )}
        <Folder size={14} className="text-yellow-400 shrink-0" />
        {editingId === folder.id ? (
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
          <span className="text-sm text-fetchy-text truncate flex-1">{folder.name}</span>
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
      {folder.expanded && children}
    </div>
  );
}

