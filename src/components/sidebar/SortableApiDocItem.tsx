import { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  GripVertical,
  MoreVertical,
  Trash2,
  Edit2,
  Download,
  FolderPlus,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OpenAPIDocument } from '../../types';

// Sortable API Document Item
export default function SortableApiDocItem({
  doc,
  onClick,
  onEdit,
  onDelete,
  onGenerateCollection,
  onConvertToYaml,
  onConvertToJson,
  onExport,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  doc: OpenAPIDocument;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onGenerateCollection: (e: React.MouseEvent) => void;
  onConvertToYaml: (e: React.MouseEvent) => void;
  onConvertToJson: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `api-doc-${doc.id}`,
    data: { type: 'api-doc', doc }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="tree-item px-2 py-2 cursor-pointer group rounded hover:bg-fetchy-border flex items-center gap-2 relative"
      onClick={onClick}
    >
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-fetchy-border rounded cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} className="text-fetchy-text-muted" />
      </button>
      <FileCode size={14} className="text-fetchy-accent shrink-0" />
      {editingId === doc.id ? (
        <input
          ref={inputRef}
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={onEditComplete}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditComplete();
            else if (e.key === 'Escape') onEditComplete();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm text-fetchy-text bg-fetchy-bg border border-fetchy-accent rounded px-1 py-0.5 outline-none"
          autoFocus
        />
      ) : (
        <span className="text-sm text-fetchy-text truncate flex-1">{doc.name}</span>
      )}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-fetchy-bg text-fetchy-text-muted uppercase">
        {doc.format}
      </span>
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fetchy-border rounded"
          title="More options"
        >
          <MoreVertical size={14} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-fetchy-card border border-fetchy-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
            <button
              onClick={(e) => {
                onGenerateCollection(e);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
            >
              <FolderPlus size={14} />
              Generate Collection
            </button>
            {doc.format === 'json' && (
              <button
                onClick={(e) => {
                  onConvertToYaml(e);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              >
                <FileCode size={14} />
                Convert to YAML
              </button>
            )}
            {doc.format === 'yaml' && (
              <button
                onClick={(e) => {
                  onConvertToJson(e);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              >
                <FileCode size={14} />
                Convert to JSON
              </button>
            )}
            <div className="border-t border-fetchy-border my-1" />
            <button
              onClick={(e) => {
                onExport(e);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={(e) => {
                onEdit(e);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
            >
              <Edit2 size={14} />
              Rename
            </button>
            <button
              onClick={(e) => {
                onDelete(e);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400 hover:text-red-300"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

