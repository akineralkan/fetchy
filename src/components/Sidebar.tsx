import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  FolderPlus,
  FilePlus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  Trash2,
  Edit2,
  Copy,
  Plus,
  Clock,
  Download,
  Upload,
  Key,
  Filter,
  ArrowUpDown,
  X,
  MoveRight,
  FileCode,
  Play,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Collection, RequestFolder, ApiRequest, RequestHistoryItem } from '../types';
import { getMethodBgColor, exportToPostman, importOpenAPISpec } from '../utils/helpers';
import { DEFAULT_OPENAPI_YAML } from './openapi/constants';
import CollectionAuthModal from './CollectionAuthModal';
import RunCollectionModal from './RunCollectionModal';
import Tooltip from './Tooltip';
import SortableApiDocItem from './sidebar/SortableApiDocItem';
import SortableCollectionItem from './sidebar/SortableCollectionItem';
import SortableRequestItem from './sidebar/SortableRequestItem';
import SortableFolderItem from './sidebar/SortableFolderItem';
import type { SortOption, FilterMethod, DragItem } from './sidebar/types';

interface SidebarProps {
  onImport: () => void;
  onHistoryItemClick?: (item: RequestHistoryItem) => void;
}


export default function Sidebar({ onImport, onHistoryItemClick }: SidebarProps) {
  const {
    collections,
    addCollection,
    updateCollection,
    deleteCollection,
    toggleCollectionExpanded,
    addFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded,
    addRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
    openTab,
    updateTab,
    tabs,
    activeTabId,
    history,
    clearHistory,
    reorderCollections,
    reorderRequests,
    reorderFolders,
    moveRequest,
    moveFolder,
    openApiDocuments,
    addOpenApiDocument,
    updateOpenApiDocument,
    deleteOpenApiDocument,
    reorderOpenApiDocuments,
  } = useAppStore();

  // Determine which request is currently active based on the open tab
  const activeStoreTab = tabs.find(t => t.id === activeTabId);
  const activeRequestId = activeStoreTab?.requestId ?? null;

  const [activeTab, setActiveTab] = useState<'collections' | 'history' | 'api'>('collections');
  const [isFocused, setIsFocused] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; collectionId: string; folderId?: string } | null>(null);
  const [runCollectionModal, setRunCollectionModal] = useState<{ open: boolean; collectionId: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'collection' | 'folder' | 'request';
    collectionId: string;
    folderId?: string;
    requestId?: string;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingApiSpecId, setEditingApiSpecId] = useState<string | null>(null);
  const [editingApiSpecName, setEditingApiSpecName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const apiSpecInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation state for search results
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);

  // Filter and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // API Spec filter and sort states
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiSortOption, setApiSortOption] = useState<'name-asc' | 'name-desc' | 'format' | 'created'>('created');
  const [showApiFilterMenu, setShowApiFilterMenu] = useState(false);
  const [apiFilterFormat, setApiFilterFormat] = useState<'all' | 'yaml' | 'json'>('all');

  // Move to submenu state
  const [showMoveToMenu, setShowMoveToMenu] = useState(false);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track sidebar focus — show accent border only when sidebar is interacted with
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (sidebarRef.current && sidebarRef.current.contains(e.target as Node)) {
        setIsFocused(true);
      } else {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Refs for keydown handler to avoid dependency ordering issues
  const flatVisibleRequestsRef = useRef<{ requestId: string; collectionId: string; folderId?: string; request: ApiRequest }[]>([]);
  const highlightedRequestIdRef = useRef<string | null>(null);
  const handleRequestClickRef = useRef<(collectionId: string, request: ApiRequest, folderId?: string) => void>(() => {});

  // Keep refs in sync
  useEffect(() => {
    highlightedRequestIdRef.current = highlightedRequestId;
  }, [highlightedRequestId]);

  // Auto-focus collection search when typing while collections tab is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only for collections tab
      if (activeTab !== 'collections') return;
      // Only when sidebar is focused
      if (!isFocused) return;
      // Don't intercept if already typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Handle Up/Down navigation even outside search input
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Skip if in a non-search input (e.g. renaming)
        if (isInInput && target !== searchInputRef.current) return;
        e.preventDefault();
        const flat = flatVisibleRequestsRef.current;
        if (flat.length === 0) return;

        const currentHighlight = highlightedRequestIdRef.current;
        const currentIndex = currentHighlight
          ? flat.findIndex(r => r.requestId === currentHighlight)
          : -1;

        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < flat.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : flat.length - 1;
        }

        setHighlightedRequestId(flat[nextIndex].requestId);
        return;
      }

      // Handle Enter to open highlighted request
      if (e.key === 'Enter' && highlightedRequestIdRef.current) {
        // Allow Enter from search input or from sidebar (not other inputs)
        if (isInInput && target !== searchInputRef.current) return;
        e.preventDefault();
        const flat = flatVisibleRequestsRef.current;
        const item = flat.find(r => r.requestId === highlightedRequestIdRef.current);
        if (item) {
          handleRequestClickRef.current(item.collectionId, item.request, item.folderId);
          setHighlightedRequestId(null);
        }
        return;
      }

      // Handle Escape to clear highlight
      if (e.key === 'Escape') {
        if (highlightedRequestIdRef.current) {
          setHighlightedRequestId(null);
        }
        if (target === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      // Auto-type into search box for printable chars
      if (isInInput) return;
      // Don't intercept modifier combos (Ctrl+C, etc.) except Shift for uppercase
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only printable characters (single char keys)
      if (e.key.length !== 1) return;
      // Don't intercept if no collections exist (search bar not shown)
      if (collections.length === 0) return;

      e.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        setSearchQuery(prev => prev + e.key);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isFocused, collections.length]);

  // Filter and sort collections/requests
  const filterRequests = useCallback((requests: ApiRequest[]): ApiRequest[] => {
    let filtered = requests;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r => r.name.toLowerCase().includes(query) || r.url.toLowerCase().includes(query)
      );
    }

    // Filter by method
    if (filterMethod !== 'all') {
      filtered = filtered.filter(r => r.method === filterMethod);
    }

    // Sort
    switch (sortOption) {
      case 'name-asc':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'method':
        filtered = [...filtered].sort((a, b) => a.method.localeCompare(b.method));
        break;
      // 'created' keeps original order
    }

    return filtered;
  }, [searchQuery, filterMethod, sortOption]);

  const hasMatchingRequests = useCallback((folder: RequestFolder): boolean => {
    if (filterRequests(folder.requests).length > 0) return true;
    return folder.folders.some(f => hasMatchingRequests(f));
  }, [filterRequests]);

  const filterFolders = useCallback((folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      requests: filterRequests(folder.requests),
      folders: filterFolders(folder.folders),
    })).filter(folder => {
      // Keep folder if it has matching requests or subfolders with matching requests
      if (folder.requests.length > 0) return true;
      if (folder.folders.some(f => hasMatchingRequests(f))) return true;
      if (!searchQuery && filterMethod === 'all') return true;
      return false;
    });
  }, [filterRequests, hasMatchingRequests, searchQuery, filterMethod]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery && filterMethod === 'all' && sortOption === 'created') {
      return collections;
    }

    return collections.map(collection => ({
      ...collection,
      requests: filterRequests(collection.requests),
      folders: filterFolders(collection.folders),
    })).filter(collection => {
      // Keep collection if it has matching requests or folders
      if (collection.requests.length > 0) return true;
      if (collection.folders.some(f => hasMatchingRequests(f))) return true;
      if (!searchQuery && filterMethod === 'all') return true;
      // Also include if collection name matches search
      if (searchQuery && collection.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return false;
    });
  }, [collections, searchQuery, filterMethod, sortOption, filterRequests, filterFolders, hasMatchingRequests]);

  // Filter and sort API documents
  const filteredApiDocuments = useMemo(() => {
    let filtered = [...openApiDocuments];

    // Filter by search query
    if (apiSearchQuery) {
      const query = apiSearchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query)
      );
    }

    // Filter by format
    if (apiFilterFormat !== 'all') {
      filtered = filtered.filter(doc => doc.format === apiFilterFormat);
    }

    // Sort
    switch (apiSortOption) {
      case 'name-asc':
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'format':
        filtered = filtered.sort((a, b) => a.format.localeCompare(b.format));
        break;
      // 'created' keeps original order
    }

    return filtered;
  }, [openApiDocuments, apiSearchQuery, apiFilterFormat, apiSortOption]);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'collection' | 'folder' | 'request',
    collectionId: string,
    folderId?: string,
    requestId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, collectionId, folderId, requestId });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setShowMoveToMenu(false);
  };

  const handleAddCollection = () => {
    const collection = addCollection('New Collection');
    setEditingId(collection.id);
    setEditingName(collection.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRequestClick = (collectionId: string, request: ApiRequest, folderId?: string) => {
    openTab({
      type: 'request',
      title: request.name,
      requestId: request.id,
      collectionId,
      folderId,
    });
  };
  handleRequestClickRef.current = handleRequestClick;

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Parse drag data from ID
    const idStr = active.id as string;
    if (idStr.startsWith('collection-')) {
      const collectionId = idStr.replace('collection-', '');
      const index = collections.findIndex(c => c.id === collectionId);
      setActiveDragData({ type: 'collection', id: collectionId, collectionId, index });
    } else if (idStr.startsWith('api-doc-')) {
      const apiDocId = idStr.replace('api-doc-', '');
      const index = filteredApiDocuments.findIndex(doc => doc.id === apiDocId);
      setActiveDragData({ type: 'api-doc', id: apiDocId, collectionId: '', index });
    } else if (idStr.startsWith('request-')) {
      const data = active.data.current;
      if (data) {
        setActiveDragData({
          type: 'request',
          id: data.request.id,
          collectionId: data.collectionId,
          folderId: data.folderId,
          index: 0,
        });
      }
    } else if (idStr.startsWith('folder-')) {
      const data = active.data.current;
      if (data) {
        setActiveDragData({
          type: 'folder',
          id: data.folder.id,
          collectionId: data.collectionId,
          index: 0,
        });
      }
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle API document reordering
    if (activeIdStr.startsWith('api-doc-') && overIdStr.startsWith('api-doc-')) {
      const activeApiDocId = activeIdStr.replace('api-doc-', '');
      const overApiDocId = overIdStr.replace('api-doc-', '');
      const oldIndex = filteredApiDocuments.findIndex(doc => doc.id === activeApiDocId);
      const newIndex = filteredApiDocuments.findIndex(doc => doc.id === overApiDocId);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Map back to original indices in the complete list
        const originalOldIndex = openApiDocuments.findIndex(doc => doc.id === activeApiDocId);
        const originalNewIndex = openApiDocuments.findIndex(doc => doc.id === overApiDocId);
        if (originalOldIndex !== -1 && originalNewIndex !== -1) {
          setApiSortOption('created'); // Reset sort to manual order
          reorderOpenApiDocuments(originalOldIndex, originalNewIndex);
        }
      }
      return;
    }

    // Handle collection reordering
    if (activeIdStr.startsWith('collection-') && overIdStr.startsWith('collection-')) {
      const activeCollectionId = activeIdStr.replace('collection-', '');
      const overCollectionId = overIdStr.replace('collection-', '');
      const oldIndex = collections.findIndex(c => c.id === activeCollectionId);
      const newIndex = collections.findIndex(c => c.id === overCollectionId);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderCollections(oldIndex, newIndex);
      }
      return;
    }

    // Handle folder reordering within same collection or moving between collections
    if (activeIdStr.startsWith('folder-')) {
      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData && overData) {
        if (activeData.collectionId === overData.collectionId) {
          // Same collection - reorder folders
          const collection = collections.find(c => c.id === activeData.collectionId);
          if (collection) {
            const oldIndex = collection.folders.findIndex(f => f.id === activeData.folder.id);
            const newIndex = collection.folders.findIndex(f => f.id === overData.folder.id);
            if (oldIndex !== -1 && newIndex !== -1) {
              reorderFolders(activeData.collectionId, null, oldIndex, newIndex);
            }
          }
        } else {
          // Different collection - move folder
          const targetCollection = collections.find(c => c.id === overData.collectionId);
          if (targetCollection) {
            const newIndex = overData.folder
              ? targetCollection.folders.findIndex(f => f.id === overData.folder.id)
              : targetCollection.folders.length;
            moveFolder(
              activeData.collectionId,
              overData.collectionId,
              activeData.folder.id,
              newIndex !== -1 ? newIndex : undefined
            );
          }
        }
      } else if (activeData && overIdStr.startsWith('collection-')) {
        // Dropping folder onto a collection
        const targetCollectionId = overIdStr.replace('collection-', '');
        if (activeData.collectionId !== targetCollectionId) {
          moveFolder(
            activeData.collectionId,
            targetCollectionId,
            activeData.folder.id
          );
        }
      }
      return;
    }

    // Handle request reordering within same container or moving between containers
    if (activeIdStr.startsWith('request-')) {
      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData && overData) {
        const sourceCollectionId = activeData.collectionId;
        const sourceFolderId = activeData.folderId;
        const targetCollectionId = overData.collectionId;
        const targetFolderId = overData.folderId;
        const requestId = activeData.request.id;

        // Same container - reorder
        if (sourceCollectionId === targetCollectionId && sourceFolderId === targetFolderId) {
          const collection = collections.find(c => c.id === sourceCollectionId);
          if (collection) {
            const requests = sourceFolderId
              ? findFolderById(collection.folders, sourceFolderId)?.requests
              : collection.requests;
            if (requests) {
              const oldIndex = requests.findIndex(r => r.id === requestId);
              const overRequest = overData.request || overData.folder;
              const newIndex = overData.request
                ? requests.findIndex(r => r.id === overRequest.id)
                : requests.length;
              if (oldIndex !== -1 && newIndex !== -1) {
                setSortOption('created');
                reorderRequests(sourceCollectionId, sourceFolderId || null, oldIndex, newIndex);
              }
            }
          }
        } else {
          // Different container - move
          moveRequest(
            sourceCollectionId,
            sourceFolderId || null,
            targetCollectionId,
            targetFolderId || null,
            requestId
          );
        }
      } else if (activeData && overIdStr.startsWith('folder-')) {
        // Dropping request onto a folder
        const overFolderData = over.data.current;
        if (overFolderData) {
          moveRequest(
            activeData.collectionId,
            activeData.folderId || null,
            overFolderData.collectionId,
            overFolderData.folder.id,
            activeData.request.id
          );
        }
      } else if (activeData && overIdStr.startsWith('collection-')) {
        // Dropping request onto a collection (root level)
        const targetCollectionId = overIdStr.replace('collection-', '');
        moveRequest(
          activeData.collectionId,
          activeData.folderId || null,
          targetCollectionId,
          null,
          activeData.request.id
        );
      }
    }
  };

  // Helper to find folder by ID
  const findFolderById = (folders: RequestFolder[], folderId: string): RequestFolder | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder;
      const found = findFolderById(folder.folders, folderId);
      if (found) return found;
    }
    return null;
  };

  const formatHistoryTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatResponseSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  const expandAllFolders = (folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      expanded: true,
      folders: expandAllFolders(folder.folders),
    }));
  };

  const collapseAllFolders = (folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      expanded: false,
      folders: collapseAllFolders(folder.folders),
    }));
  };

  const handleExpandAll = () => {
    collections.forEach(collection => {
      updateCollection(collection.id, {
        expanded: true,
        folders: expandAllFolders(collection.folders),
      });
    });
  };

  const handleCollapseAll = () => {
    collections.forEach(collection => {
      updateCollection(collection.id, {
        expanded: false,
        folders: collapseAllFolders(collection.folders),
      });
    });
  };

  const renderFolder = (collectionId: string, folder: RequestFolder, depth: number) => {
    const folderRequests = folder.requests;
    const folderFolders = folder.folders;
    const requestIds = folderRequests.map(r => `request-${r.id}`);
    const folderIds = folderFolders.map(f => `folder-${f.id}`);

    return (
      <SortableFolderItem
        key={folder.id}
        folder={folder}
        collectionId={collectionId}
        depth={depth}
        onToggle={() => toggleFolderExpanded(collectionId, folder.id)}
        onContextMenu={(e) => handleContextMenu(e, 'folder', collectionId, folder.id)}
        editingId={editingId}
        editingName={editingName}
        setEditingName={setEditingName}
        inputRef={inputRef}
        onEditComplete={() => {
          updateFolder(collectionId, folder.id, { name: editingName });
          setEditingId(null);
        }}
      >
        <div className="ml-2">
          <SortableContext items={[...folderIds, ...requestIds]} strategy={verticalListSortingStrategy}>
            {folderFolders.map((f) => renderFolder(collectionId, f, depth + 1))}
            {folderRequests.map((request) => (
              <SortableRequestItem
                key={request.id}
                request={request}
                collectionId={collectionId}
                folderId={folder.id}
                depth={depth + 1}
                isActive={activeRequestId === request.id}
                isHighlighted={highlightedRequestId === request.id}
                onClick={() => handleRequestClick(collectionId, request, folder.id)}
                onContextMenu={(e) => handleContextMenu(e, 'request', collectionId, folder.id, request.id)}
                editingId={editingId}
                editingName={editingName}
                setEditingName={setEditingName}
                inputRef={inputRef}
                onEditComplete={() => {
                  updateRequest(collectionId, request.id, { name: editingName });
                  setEditingId(null);
                }}
              />
            ))}
          </SortableContext>
        </div>
      </SortableFolderItem>
    );
  };

  const renderCollection = (collection: Collection) => {
    const collectionRequests = collection.requests;
    const collectionFolders = collection.folders;
    const requestIds = collectionRequests.map(r => `request-${r.id}`);
    const folderIds = collectionFolders.map(f => `folder-${f.id}`);

    return (
      <SortableCollectionItem
        key={collection.id}
        collection={collection}
        onToggle={() => toggleCollectionExpanded(collection.id)}
        onContextMenu={(e) => handleContextMenu(e, 'collection', collection.id)}
        editingId={editingId}
        editingName={editingName}
        setEditingName={setEditingName}
        inputRef={inputRef}
        onEditComplete={() => {
          useAppStore.getState().updateCollection(collection.id, { name: editingName });
          setEditingId(null);
        }}
      >
        <div className="ml-2">
          <SortableContext items={[...folderIds, ...requestIds]} strategy={verticalListSortingStrategy}>
            {collectionFolders.map((folder) => renderFolder(collection.id, folder, 1))}
            {collectionRequests.map((request) => (
              <SortableRequestItem
                key={request.id}
                request={request}
                collectionId={collection.id}
                depth={1}
                isActive={activeRequestId === request.id}
                isHighlighted={highlightedRequestId === request.id}
                onClick={() => handleRequestClick(collection.id, request)}
                onContextMenu={(e) => handleContextMenu(e, 'request', collection.id, undefined, request.id)}
                editingId={editingId}
                editingName={editingName}
                setEditingName={setEditingName}
                inputRef={inputRef}
                onEditComplete={() => {
                  updateRequest(collection.id, request.id, { name: editingName });
                  setEditingId(null);
                }}
              />
            ))}
          </SortableContext>
          {collectionFolders.length === 0 && collectionRequests.length === 0 && (
            <button
              className="w-full mt-1 mb-1 px-3 py-2 text-xs text-fetchy-text-muted hover:text-fetchy-accent hover:bg-fetchy-accent/10 border border-dashed border-fetchy-border hover:border-fetchy-accent/50 rounded flex items-center justify-center gap-1.5 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                addRequest(collection.id, null);
              }}
            >
              <FilePlus size={13} />
              New Request
            </button>
          )}
        </div>
      </SortableCollectionItem>
    );
  };

  const renderHistoryItem = (item: RequestHistoryItem) => (
    <div
      key={item.id}
      className="tree-item px-2 py-2 cursor-pointer group rounded hover:bg-fetchy-border mb-1 border border-transparent hover:border-fetchy-border"
      title={`${item.request.method} ${item.request.url}\nClick to load this request and response`}
      onClick={() => onHistoryItemClick?.(item)}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(item.request.method)}`}>
          {item.request.method}
        </span>
        <span className="text-sm text-fetchy-text truncate flex-1">{item.request.name || item.request.url}</span>
        <span className="text-xs text-fetchy-text-muted whitespace-nowrap">
          {formatHistoryTime(item.timestamp)}
        </span>
      </div>
      <div className="text-xs text-fetchy-text-muted truncate mt-1 ml-7">
        {item.request.url}
      </div>
      {item.response && (
        <div className="flex items-center gap-3 mt-1 ml-7 text-xs">
          <span className={`font-medium ${item.response.status >= 200 && item.response.status < 300 ? 'text-green-400' : item.response.status >= 400 ? 'text-red-400' : 'text-yellow-400'}`}>
            {item.response.status} {item.response.statusText}
          </span>
          <span className="text-fetchy-text-muted">{item.response.time}ms</span>
          <span className="text-fetchy-text-muted">{formatResponseSize(item.response.size)}</span>
        </div>
      )}
    </div>
  );

  // Build flat list of visible requests for keyboard navigation
  const flatVisibleRequests = useMemo(() => {
    const result: { requestId: string; collectionId: string; folderId?: string; request: ApiRequest }[] = [];
    const traverseFolder = (collectionId: string, folder: RequestFolder) => {
      if (!folder.expanded) return;
      for (const f of folder.folders) {
        traverseFolder(collectionId, f);
      }
      for (const r of folder.requests) {
        result.push({ requestId: r.id, collectionId, folderId: folder.id, request: r });
      }
    };
    for (const collection of filteredCollections) {
      if (!collection.expanded) continue;
      for (const folder of collection.folders) {
        traverseFolder(collection.id, folder);
      }
      for (const r of collection.requests) {
        result.push({ requestId: r.id, collectionId: collection.id, request: r });
      }
    }
    return result;
  }, [filteredCollections]);

  // Keep refs in sync with latest values
  useEffect(() => {
    flatVisibleRequestsRef.current = flatVisibleRequests;
  }, [flatVisibleRequests]);

  // Reset highlight when search query changes
  useEffect(() => {
    setHighlightedRequestId(null);
  }, [searchQuery]);

  const collectionIds = filteredCollections.map(c => `collection-${c.id}`);

  const hasActiveFilters = searchQuery || filterMethod !== 'all' || sortOption !== 'created';

  return (
    <div ref={sidebarRef} className="h-full bg-fetchy-sidebar flex flex-col border-r border-fetchy-border">
      {/* Header */}
      <div className="p-3 border-b border-fetchy-border">
        <div className="bg-fetchy-card border border-fetchy-border rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('api')}
            className={`${
              activeTab === 'api' ? 'flex-1' : ''
            } px-3 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'api'
                ? 'bg-fetchy-accent text-white shadow-sm'
                : 'text-fetchy-text-muted hover:bg-fetchy-border hover:text-fetchy-text'
            }`}
          >
            <FileCode size={14} />
            {activeTab === 'api' && 'API'}
          </button>
          <button
            onClick={() => {
              setActiveTab('collections');
              // Auto-highlight the active request or fallback to first visible
              if (activeRequestId) {
                setHighlightedRequestId(activeRequestId);
              }
            }}
            className={`${
              activeTab === 'collections' ? 'flex-1' : ''
            } px-3 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'collections'
                ? 'bg-fetchy-accent text-white shadow-sm'
                : 'text-fetchy-text-muted hover:bg-fetchy-border hover:text-fetchy-text'
            }`}
          >
            <Folder size={14} />
            {activeTab === 'collections' && 'Collections'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${
              activeTab === 'history' ? 'flex-1' : ''
            } px-3 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-fetchy-accent text-white shadow-sm'
                : 'text-fetchy-text-muted hover:bg-fetchy-border hover:text-fetchy-text'
            }`}
          >
            <Clock size={14} />
            {activeTab === 'history' && 'History'}
          </button>
        </div>
      </div>

      {/* Filter/Search Bar - Only for collections and API tabs */}
      {(activeTab === 'collections' && collections.length > 0) || (activeTab === 'api' && openApiDocuments.length > 0) ? (
        <div className={`p-2 border-b border-fetchy-border transition-colors duration-150 ${isFocused ? 'sidebar-focused' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={activeTab === 'collections' ? searchInputRef : undefined}
                type="text"
                placeholder={activeTab === 'collections' ? "Search requests..." : "Search API specs..."}
                value={activeTab === 'collections' ? searchQuery : apiSearchQuery}
                onChange={(e) => {
                  if (activeTab === 'collections') {
                    setSearchQuery(e.target.value);
                  } else {
                    setApiSearchQuery(e.target.value);
                  }
                }}
                className="w-full pl-3 pr-7 py-1.5 text-sm bg-fetchy-bg border border-fetchy-border rounded focus:outline-none focus:border-fetchy-accent"
              />
              {((activeTab === 'collections' && searchQuery) || (activeTab === 'api' && apiSearchQuery)) && (
                <button
                  onClick={() => {
                    if (activeTab === 'collections') {
                      setSearchQuery('');
                    } else {
                      setApiSearchQuery('');
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fetchy-text-muted hover:text-fetchy-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {activeTab === 'collections' && (
              <>
                <Tooltip content="Expand All">
                  <button
                    onClick={handleExpandAll}
                    className="p-1.5 rounded border border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border"
                  >
                    <ChevronDown size={14} />
                  </button>
                </Tooltip>
                <Tooltip content="Collapse All">
                  <button
                    onClick={handleCollapseAll}
                    className="p-1.5 rounded border border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border"
                  >
                    <ChevronUp size={14} />
                  </button>
                </Tooltip>
                <Tooltip content="Import Collection">
                  <button
                    onClick={onImport}
                    className="p-1.5 rounded border border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border"
                  >
                    <Upload size={14} />
                  </button>
                </Tooltip>
              </>
            )}
            <div className="relative">
              <Tooltip content="Filter & Sort">
                <button
                  onClick={() => {
                    if (activeTab === 'collections') {
                      setShowFilterMenu(!showFilterMenu);
                    } else {
                      setShowApiFilterMenu(!showApiFilterMenu);
                    }
                  }}
                  className={`p-1.5 rounded border ${
                    (activeTab === 'collections' && hasActiveFilters) ||
                    (activeTab === 'api' && (apiSearchQuery || apiFilterFormat !== 'all' || apiSortOption !== 'created'))
                      ? 'bg-fetchy-accent/20 border-fetchy-accent text-fetchy-accent'
                      : 'border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
                  }`}
                >
                  <Filter size={14} />
                </button>
              </Tooltip>
              {activeTab === 'collections' && showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-2 min-w-[180px]">
                    <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase">Filter by Method</div>
                    {(['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => (
                      <button
                        key={method}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${filterMethod === method ? 'text-fetchy-accent' : ''}`}
                        onClick={() => {
                          setFilterMethod(method);
                        }}
                      >
                        {method === 'all' ? 'All Methods' : method}
                        {filterMethod === method && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    <hr className="my-2 border-fetchy-border" />
                    <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase flex items-center gap-1">
                      <ArrowUpDown size={12} /> Sort by
                    </div>
                    {([
                      { value: 'created', label: 'Created Order' },
                      { value: 'name-asc', label: 'Name (A-Z)' },
                      { value: 'name-desc', label: 'Name (Z-A)' },
                      { value: 'method', label: 'Method' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${sortOption === option.value ? 'text-fetchy-accent' : ''}`}
                        onClick={() => {
                          setSortOption(option.value);
                        }}
                      >
                        {option.label}
                        {sortOption === option.value && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    {hasActiveFilters && (
                      <>
                        <hr className="my-2 border-fetchy-border" />
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border text-red-400"
                          onClick={() => {
                            setSearchQuery('');
                            setFilterMethod('all');
                            setSortOption('created');
                            setShowFilterMenu(false);
                          }}
                        >
                          Clear All Filters
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
              {activeTab === 'api' && showApiFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowApiFilterMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-2 min-w-[180px]">
                    <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase">Filter by Format</div>
                    {(['all', 'yaml', 'json'] as const).map((format) => (
                      <button
                        key={format}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${apiFilterFormat === format ? 'text-fetchy-accent' : ''}`}
                        onClick={() => {
                          setApiFilterFormat(format);
                        }}
                      >
                        {format === 'all' ? 'All Formats' : format.toUpperCase()}
                        {apiFilterFormat === format && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    <hr className="my-2 border-fetchy-border" />
                    <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase flex items-center gap-1">
                      <ArrowUpDown size={12} /> Sort by
                    </div>
                    {([
                      { value: 'created', label: 'Created Order' },
                      { value: 'name-asc', label: 'Name (A-Z)' },
                      { value: 'name-desc', label: 'Name (Z-A)' },
                      { value: 'format', label: 'Format' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${apiSortOption === option.value ? 'text-fetchy-accent' : ''}`}
                        onClick={() => {
                          setApiSortOption(option.value);
                        }}
                      >
                        {option.label}
                        {apiSortOption === option.value && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    {(apiSearchQuery || apiFilterFormat !== 'all' || apiSortOption !== 'created') && (
                      <>
                        <hr className="my-2 border-fetchy-border" />
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border text-red-400"
                          onClick={() => {
                            setApiSearchQuery('');
                            setApiFilterFormat('all');
                            setApiSortOption('created');
                            setShowApiFilterMenu(false);
                          }}
                        >
                          Clear All Filters
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Content list */}
      <div className={`flex-1 overflow-y-auto p-2 transition-colors duration-150 ${isFocused ? 'sidebar-focused' : ''}`}>
        {activeTab === 'collections' && collections.length === 0 ? (
          <div className="text-center py-8 text-fetchy-text-muted">
            <p className="text-sm mb-4">No collections yet</p>
            <button
              onClick={handleAddCollection}
              className="btn btn-primary text-sm"
            >
              Create Collection
            </button>
            <p className="text-xs mt-3">or</p>
            <button
              onClick={onImport}
              className="text-fetchy-accent hover:underline text-sm mt-2"
            >
              Import from file
            </button>
          </div>
        ) : activeTab === 'collections' ? (
          <div>
            {/* Collections Section Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-fetchy-text-muted">
                {filteredCollections.length} collection{filteredCollections.length !== 1 ? 's' : ''}
                {filteredCollections.length !== collections.length && (
                  <span className="text-fetchy-text-muted"> ({collections.length} total)</span>
                )}
              </span>
              <button
                onClick={handleAddCollection}
                className="text-xs text-fetchy-accent hover:text-fetchy-accent/80 flex items-center gap-1"
              >
                <Plus size={12} /> New Collection
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
                {filteredCollections.map(renderCollection)}
              </SortableContext>
              <DragOverlay>
                {activeId && activeDragData && (
                  <div className="bg-fetchy-card border border-fetchy-accent rounded px-3 py-2 shadow-lg opacity-90">
                    <span className="text-sm text-fetchy-text">
                      {activeDragData.type === 'collection' && collections.find(c => c.id === activeDragData.id)?.name}
                      {activeDragData.type === 'request' && 'Moving request...'}
                      {activeDragData.type === 'folder' && 'Moving folder...'}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        ) : activeTab === 'api' ? (
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
                  openTab({
                    type: 'openapi',
                    title: doc.name,
                    openApiDocId: doc.id,
                  });
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
                    openTab({
                      type: 'openapi',
                      title: doc.name,
                      openApiDocId: doc.id,
                    });
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
                onDragOver={handleDragOver}
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
                            openTab({
                              type: 'openapi',
                              title: doc.name,
                              openApiDocId: doc.id,
                            });
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
                          if (confirm('Delete this OpenAPI spec?')) {
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
                          } catch (error) {
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
                          } catch (error) {
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

                            // Update all tabs with this openApiDocId to reflect the new name
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
                  {activeId && activeDragData && activeDragData.type === 'api-doc' && (
                    <div className="bg-fetchy-card border border-fetchy-accent rounded px-3 py-2 shadow-lg opacity-90">
                      <span className="text-sm text-fetchy-text">
                        {filteredApiDocuments.find(doc => doc.id === activeDragData.id)?.name || 'Moving spec...'}
                      </span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        ) : activeTab === 'history' && history.length === 0 ? (
          <div className="text-center py-8 text-fetchy-text-muted">
            <Clock size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">No request history yet</p>
            <p className="text-xs">Your past requests will appear here</p>
          </div>
        ) : activeTab === 'history' ? (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-fetchy-text-muted">{history.length} request{history.length !== 1 ? 's' : ''}</span>
              <button
                onClick={clearHistory}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            </div>
            {history.map(renderHistoryItem)}
          </div>
        ) : null}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="context-menu fixed z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
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
                  <Download size={14} /> Export to Postman
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
                <hr className="my-1 border-fetchy-border" />
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
                  onClick={() => {
                    deleteCollection(contextMenu.collectionId);
                    closeContextMenu();
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
                    // Find the folder to edit
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
                    deleteFolder(contextMenu.collectionId, contextMenu.folderId!);
                    closeContextMenu();
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
                      // Find the request to edit
                      const collection = collections.find(c => c.id === contextMenu.collectionId);
                      if (collection) {
                        const findRequest = (folders: typeof collection.folders, requests: typeof collection.requests): ApiRequest | null => {
                          // Check in root requests
                          const request = requests.find(r => r.id === contextMenu.requestId);
                          if (request) return request;

                          // Check in folders
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
                                  moveRequest(
                                    contextMenu.collectionId,
                                    contextMenu.folderId || null,
                                    targetCollection.id,
                                    null,
                                    contextMenu.requestId!
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
        </>
      )}

      {/* Auth Settings Modal */}
      {authModal && (
        <CollectionAuthModal
          isOpen={authModal.open}
          onClose={() => setAuthModal(null)}
          collectionId={authModal.collectionId}
          folderId={authModal.folderId}
        />
      )}

      {/* Run Collection Modal */}
      {runCollectionModal && (
        <RunCollectionModal
          isOpen={runCollectionModal.open}
          onClose={() => setRunCollectionModal(null)}
          collectionId={runCollectionModal.collectionId}
        />
      )}
    </div>
  );
}

