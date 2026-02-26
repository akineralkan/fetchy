import { useRef, useEffect } from 'react';
import { GripVertical, MoreVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ApiRequest } from '../../types';
import { getMethodBgColor } from '../../utils/helpers';

// Sortable Request Item
export default function SortableRequestItem({
  request,
  collectionId,
  folderId,
  depth,
  onClick,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
  isActive,
  isHighlighted,
}: {
  request: ApiRequest;
  collectionId: string;
  folderId?: string;
  depth: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
  isActive?: boolean;
  isHighlighted?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `request-${request.id}`,
    data: { type: 'request', collectionId, folderId, request }
  });

  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isHighlighted]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className={`tree-item flex items-center gap-2 px-2 py-1.5 cursor-pointer group rounded ${isActive && isHighlighted ? 'bg-fetchy-accent/15 ring-2 ring-yellow-500/70' : isActive ? 'bg-fetchy-accent/15 ring-1 ring-fetchy-accent/40' : isHighlighted ? 'bg-yellow-500/10 ring-1 ring-yellow-500/50' : ''}`}
      onClick={onClick}
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
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(request.method)}`}>
        {request.method}
      </span>
      {editingId === request.id ? (
        <input
          ref={inputRef}
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onEditComplete}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditComplete();
            if (e.key === 'Escape') onEditComplete();
          }}
          className="flex-1 px-2 py-1 text-sm bg-fetchy-bg border border-fetchy-accent rounded outline-none"
        />
      ) : (
        <span className="text-sm text-fetchy-text truncate flex-1">{request.name}</span>
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
  );
}

