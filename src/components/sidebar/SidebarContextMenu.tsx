import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  Trash2,
  Edit2,
  Copy,
  Upload,
  Key,
  MoveRight,
  Play,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { RequestFolder, ApiRequest } from '../../types';
import { exportToPostman } from '../../utils/helpers';
import type { ContextMenuState, SortOption } from './types';

interface SidebarContextMenuProps {
  contextMenu: ContextMenuState;
  closeContextMenu: () => void;
  showMoveToMenu: boolean;
  setShowMoveToMenu: (show: boolean) => void;
  setRunCollectionModal: (modal: { open: boolean; collectionId: string } | null) => void;
  setAuthModal: (modal: { open: boolean; collectionId: string; folderId?: string } | null) => void;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setSortOption: (option: SortOption) => void;
}

function findFolderById(folders: RequestFolder[], folderId: string): RequestFolder | null {
  for (const folder of folders) {
    if (folder.id === folderId) return folder;
    const found = findFolderById(folder.folders, folderId);
    if (found) return found;
  }
  return null;
}

export default function SidebarContextMenu({
  contextMenu,
  closeContextMenu,
  showMoveToMenu,
  setShowMoveToMenu,
  setRunCollectionModal,
  setAuthModal,
  setEditingId,
  setEditingName,
  inputRef,
  setSortOption,
}: SidebarContextMenuProps) {
  const {
    collections,
    addRequest,
    addFolder,
    deleteCollection,
    deleteFolder,
    deleteRequest,
    duplicateRequest,
    moveRequest,
    moveFolder,
    reorderRequests,
    openTab,
    setAllFoldersExpanded,
  } = useAppStore();

  const [pendingDelete, setPendingDelete] = useState<{
    type: 'collection' | 'folder';
    collectionId: string;
    folderId?: string;
    name: string;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const margin = 6;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + w + margin > window.innerWidth)  left = Math.max(margin, left - w);
    if (top  + h + margin > window.innerHeight) top  = Math.max(margin, top  - h);
    setPos({ left, top });
  }, [contextMenu.x, contextMenu.y]);

  const handleExportCollection = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    const postmanJson = exportToPostman(collection);
    const blob = new Blob([postmanJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name.replace(/\s+/g, '_')}.postman_collection.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
      <div
        ref={menuRef}
        className="context-menu fixed z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={pos
          ? { left: pos.left, top: pos.top }
          : { left: contextMenu.x, top: contextMenu.y, visibility: 'hidden' }
        }
      >
        {contextMenu.type === 'collection' && (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setRunCollectionModal({ open: true, collectionId: contextMenu.collectionId });
                closeContextMenu();
              }}
            >
              <Play size={14} /> Run Collection
            </button>
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addRequest(contextMenu.collectionId, null);
                closeContextMenu();
              }}
            >
              <FilePlus size={14} /> Add Request
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addFolder(contextMenu.collectionId, null, 'New Folder');
                closeContextMenu();
              }}
            >
              <FolderPlus size={14} /> Add Folder
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                const collection = collections.find(c => c.id === contextMenu.collectionId);
                if (collection) {
                  setEditingId(collection.id);
                  setEditingName(collection.name);
                  closeContextMenu();
                  setTimeout(() => inputRef.current?.focus(), 0);
                }
              }}
            >
              <Edit2 size={14} /> Rename
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                handleExportCollection(contextMenu.collectionId);
                closeContextMenu();
              }}
            >
              <Upload size={14} /> Export to Postman
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setAuthModal({ open: true, collectionId: contextMenu.collectionId });
                closeContextMenu();
              }}
            >
              <Key size={14} /> Auth Settings
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                openTab({
                  type: 'collection',
                  title: collections.find(c => c.id === contextMenu.collectionId)?.name || 'Collection',
                  collectionId: contextMenu.collectionId,
                });
                closeContextMenu();
              }}
            >
              <Settings size={14} /> Configure
            </button>
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setAllFoldersExpanded(contextMenu.collectionId, true);
                closeContextMenu();
              }}
            >
              <ChevronsUpDown size={14} /> Expand All
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setAllFoldersExpanded(contextMenu.collectionId, false);
                closeContextMenu();
              }}
            >
              <ChevronsDownUp size={14} /> Collapse All
            </button>
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
              onClick={() => {
                const name = collections.find(c => c.id === contextMenu.collectionId)?.name || 'this collection';
                setPendingDelete({ type: 'collection', collectionId: contextMenu.collectionId, name });
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
        {contextMenu.type === 'folder' && (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addRequest(contextMenu.collectionId, contextMenu.folderId!);
                closeContextMenu();
              }}
            >
              <FilePlus size={14} /> Add Request
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addFolder(contextMenu.collectionId, contextMenu.folderId!, 'New Folder');
                closeContextMenu();
              }}
            >
              <FolderPlus size={14} /> Add Subfolder
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                const collection = collections.find(c => c.id === contextMenu.collectionId);
                if (collection) {
                  const folder = findFolderById(collection.folders, contextMenu.folderId!);
                  if (folder) {
                    setEditingId(folder.id);
                    setEditingName(folder.name);
                    closeContextMenu();
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }
                }
              }}
            >
              <Edit2 size={14} /> Rename
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setAuthModal({ open: true, collectionId: contextMenu.collectionId, folderId: contextMenu.folderId });
                closeContextMenu();
              }}
            >
              <Key size={14} /> Auth Settings
            </button>
            {collections.length > 1 && (
              <div className="relative">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 justify-between"
                  onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                >
                  <span className="flex items-center gap-2">
                    <MoveRight size={14} /> Move to
                  </span>
                  <ChevronRight size={14} />
                </button>
                {showMoveToMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                    {collections
                      .filter(c => c.id !== contextMenu.collectionId)
                      .map(targetCollection => (
                        <button
                          key={targetCollection.id}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                          onClick={() => {
                            moveFolder(
                              contextMenu.collectionId,
                              targetCollection.id,
                              contextMenu.folderId!
                            );
                            closeContextMenu();
                          }}
                        >
                          <Folder size={14} className="text-yellow-400" />
                          <span className="truncate">{targetCollection.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
              onClick={() => {
                const collection = collections.find(c => c.id === contextMenu.collectionId);
                const folder = collection ? findFolderById(collection.folders, contextMenu.folderId!) : null;
                const name = folder?.name || 'this folder';
                setPendingDelete({ type: 'folder', collectionId: contextMenu.collectionId, folderId: contextMenu.folderId!, name });
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
        {contextMenu.type === 'request' && (() => {
          const collection = collections.find(c => c.id === contextMenu.collectionId);
          if (!collection) return null;

          const findParent = (
            folders: RequestFolder[],
            folderId: string | undefined
          ): { requests: ApiRequest[] } | null => {
            if (!folderId) return collection;
            for (const folder of folders) {
              if (folder.id === folderId) return folder;
              const found = findParent(folder.folders, folderId);
              if (found) return found;
            }
            return null;
          };

          const parent = findParent(collection.folders, contextMenu.folderId);
          if (!parent) return null;

          const requestIndex = parent.requests.findIndex(r => r.id === contextMenu.requestId);
          if (requestIndex === -1) return null;

          const canMoveUp = requestIndex > 0;
          const canMoveDown = requestIndex < parent.requests.length - 1;

          const moveDestinations: { key: string; label: string; collectionId: string; folderId: string | null; depth: number }[] = [];
          const collectMoveDestFolders = (folders: RequestFolder[], colId: string, depth: number) => {
            for (const folder of folders) {
              if (folder.id !== contextMenu.folderId) {
                moveDestinations.push({ key: `f-${colId}-${folder.id}`, label: folder.name, collectionId: colId, folderId: folder.id, depth });
              }
              collectMoveDestFolders(folder.folders, colId, depth + 1);
            }
          };
          for (const c of collections) {
            const isCurrentRoot = c.id === contextMenu.collectionId && !contextMenu.folderId;
            if (!isCurrentRoot) {
              moveDestinations.push({ key: `c-${c.id}`, label: c.name, collectionId: c.id, folderId: null, depth: 0 });
            }
            collectMoveDestFolders(c.folders, c.id, 1);
          }

          return (
            <>
              {canMoveUp && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                  onClick={() => {
                    setSortOption('created');
                    reorderRequests(contextMenu.collectionId, contextMenu.folderId || null, requestIndex, requestIndex - 1);
                    closeContextMenu();
                  }}
                >
                  <ChevronUp size={14} /> Move Up
                </button>
              )}
              {canMoveDown && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                  onClick={() => {
                    setSortOption('created');
                    reorderRequests(contextMenu.collectionId, contextMenu.folderId || null, requestIndex, requestIndex + 1);
                    closeContextMenu();
                  }}
                >
                  <ChevronDown size={14} /> Move Down
                </button>
              )}
              {(canMoveUp || canMoveDown) && <hr className="my-1 border-fetchy-border" />}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                onClick={() => {
                  duplicateRequest(contextMenu.collectionId, contextMenu.requestId!);
                  closeContextMenu();
                }}
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                onClick={() => {
                  const collection = collections.find(c => c.id === contextMenu.collectionId);
                  if (collection) {
                    const findRequest = (folders: typeof collection.folders, requests: typeof collection.requests): ApiRequest | null => {
                      const request = requests.find(r => r.id === contextMenu.requestId);
                      if (request) return request;
                      for (const folder of folders) {
                        const folderRequest = findRequest(folder.folders, folder.requests);
                        if (folderRequest) return folderRequest;
                      }
                      return null;
                    };

                    const request = findRequest(collection.folders, collection.requests);
                    if (request) {
                      setEditingId(request.id);
                      setEditingName(request.name);
                      closeContextMenu();
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }
                  }
                }}
              >
                <Edit2 size={14} /> Rename
              </button>
              {moveDestinations.length > 0 && (
                <div className="relative">
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 justify-between"
                    onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                  >
                    <span className="flex items-center gap-2">
                      <MoveRight size={14} /> Move to
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  {showMoveToMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[180px] z-50 max-h-64 overflow-y-auto">
                      {moveDestinations.map(dest => (
                        <button
                          key={dest.key}
                          className="w-full py-2 pr-3 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                          style={{ paddingLeft: `${12 + dest.depth * 12}px` }}
                          onClick={() => {
                            moveRequest(
                              contextMenu.collectionId,
                              contextMenu.folderId || null,
                              dest.collectionId,
                              dest.folderId,
                              contextMenu.requestId!
                            );
                            closeContextMenu();
                          }}
                        >
                          <Folder size={14} className="text-yellow-400" />
                          <span className="truncate">{dest.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <hr className="my-1 border-fetchy-border" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
                onClick={() => {
                  deleteRequest(contextMenu.collectionId, contextMenu.requestId!);
                  closeContextMenu();
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          );
        })()}
      </div>

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-base font-semibold text-fetchy-text mb-2">
              Delete {pendingDelete.type === 'collection' ? 'Collection' : 'Folder'}?
            </h3>
            <p className="text-sm text-fetchy-text-muted mb-5">
              Are you sure you want to delete <span className="font-medium text-fetchy-text">"{pendingDelete.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingDelete.type === 'collection') {
                    deleteCollection(pendingDelete.collectionId);
                  } else {
                    deleteFolder(pendingDelete.collectionId, pendingDelete.folderId!);
                  }
                  setPendingDelete(null);
                  closeContextMenu();
                }}
                className="btn bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  , document.body);
}
