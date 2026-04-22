// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/SortableFolderItem.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SortableFolderItem from '../../../src/components/sidebar/SortableFolderItem';
import type { RequestFolder } from '../../../src/types';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

function makeFolder(overrides?: Partial<RequestFolder>): RequestFolder {
  return {
    id: 'folder-1',
    name: 'My Folder',
    requests: [],
    folders: [],
    expanded: false,
    ...overrides,
  };
}

const defaultProps = {
  collectionId: 'col-1',
  depth: 1,
  onToggle: vi.fn(),
  onContextMenu: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SortableFolderItem', () => {
  it('renders the folder name', () => {
    render(
      <SortableFolderItem folder={makeFolder()} {...defaultProps}>
        <div />
      </SortableFolderItem>
    );
    expect(screen.getByText('My Folder')).toBeTruthy();
  });

  it('calls onToggle when folder row is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SortableFolderItem folder={makeFolder()} {...defaultProps} onToggle={onToggle}>
        <div />
      </SortableFolderItem>
    );
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.click(treeItem);
    expect(onToggle).toHaveBeenCalled();
  });

  it('calls onContextMenu on right-click', () => {
    const onContextMenu = vi.fn();
    render(
      <SortableFolderItem folder={makeFolder()} {...defaultProps} onContextMenu={onContextMenu}>
        <div />
      </SortableFolderItem>
    );
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.contextMenu(treeItem);
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('renders children when expanded', () => {
    render(
      <SortableFolderItem folder={makeFolder({ expanded: true })} {...defaultProps}>
        <div data-testid="folder-child">Child Item</div>
      </SortableFolderItem>
    );
    expect(screen.getByTestId('folder-child')).toBeTruthy();
  });

  it('renders an input when editingId matches folder id', () => {
    render(
      <SortableFolderItem
        folder={makeFolder()}
        {...defaultProps}
        editingId="folder-1"
        editingName="Editing Folder"
      >
        <div />
      </SortableFolderItem>
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Editing Folder');
  });

  it('calls setEditingName when input changes', () => {
    const setEditingName = vi.fn();
    render(
      <SortableFolderItem
        folder={makeFolder()}
        {...defaultProps}
        editingId="folder-1"
        editingName="Old Name"
        setEditingName={setEditingName}
      >
        <div />
      </SortableFolderItem>
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } });
    expect(setEditingName).toHaveBeenCalledWith('New Name');
  });

  it('calls onEditComplete when Enter is pressed in input', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableFolderItem
        folder={makeFolder()}
        {...defaultProps}
        editingId="folder-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      >
        <div />
      </SortableFolderItem>
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('applies depth-based indentation via marginLeft style', () => {
    const { container } = render(
      <SortableFolderItem folder={makeFolder()} {...defaultProps} depth={3}>
        <div />
      </SortableFolderItem>
    );
    const gripBtn = container.querySelector('button');
    if (gripBtn) {
      // depth=3 → marginLeft = (3-1)*16 = 32px
      expect(gripBtn.style.marginLeft).toBe('32px');
    }
  });
});
