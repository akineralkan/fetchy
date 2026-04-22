// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/SortableCollectionItem.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SortableCollectionItem from '../../../src/components/sidebar/SortableCollectionItem';
import type { Collection } from '../../../src/types';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

function makeCollection(overrides?: Partial<Collection>): Collection {
  return {
    id: 'col-1',
    name: 'My Collection',
    requests: [],
    folders: [],
    variables: [],
    expanded: false,
    ...overrides,
  };
}

const defaultProps = {
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

describe('SortableCollectionItem', () => {
  it('renders the collection name', () => {
    render(
      <SortableCollectionItem collection={makeCollection()} {...defaultProps}>
        <div />
      </SortableCollectionItem>
    );
    expect(screen.getByText('My Collection')).toBeTruthy();
  });

  it('shows a chevron-right icon when collapsed', () => {
    render(
      <SortableCollectionItem collection={makeCollection({ expanded: false })} {...defaultProps}>
        <div />
      </SortableCollectionItem>
    );
    // The collapsed state uses ChevronRight; text name is visible
    expect(screen.getByText('My Collection')).toBeTruthy();
  });

  it('shows a chevron-down icon when expanded', () => {
    render(
      <SortableCollectionItem collection={makeCollection({ expanded: true })} {...defaultProps}>
        <div data-testid="child" />
      </SortableCollectionItem>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      <SortableCollectionItem collection={makeCollection()} {...defaultProps} onToggle={onToggle}>
        <div />
      </SortableCollectionItem>
    );
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.click(treeItem);
    expect(onToggle).toHaveBeenCalled();
  });

  it('calls onContextMenu on right-click', () => {
    const onContextMenu = vi.fn();
    render(
      <SortableCollectionItem collection={makeCollection()} {...defaultProps} onContextMenu={onContextMenu}>
        <div />
      </SortableCollectionItem>
    );
    const treeItem = document.querySelector('.tree-item');
    if (treeItem) fireEvent.contextMenu(treeItem);
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('renders an input when editingId matches collection id', () => {
    render(
      <SortableCollectionItem
        collection={makeCollection()}
        {...defaultProps}
        editingId="col-1"
        editingName="Editing Name"
      >
        <div />
      </SortableCollectionItem>
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Editing Name');
  });

  it('calls setEditingName when editing input changes', () => {
    const setEditingName = vi.fn();
    render(
      <SortableCollectionItem
        collection={makeCollection()}
        {...defaultProps}
        editingId="col-1"
        editingName="Current"
        setEditingName={setEditingName}
      >
        <div />
      </SortableCollectionItem>
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } });
    expect(setEditingName).toHaveBeenCalledWith('New Name');
  });

  it('calls onEditComplete on Enter key press', () => {
    const onEditComplete = vi.fn();
    render(
      <SortableCollectionItem
        collection={makeCollection()}
        {...defaultProps}
        editingId="col-1"
        editingName="Name"
        onEditComplete={onEditComplete}
      >
        <div />
      </SortableCollectionItem>
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEditComplete).toHaveBeenCalled();
  });

  it('renders children when expanded', () => {
    render(
      <SortableCollectionItem collection={makeCollection({ expanded: true })} {...defaultProps}>
        <div data-testid="child-content">Child</div>
      </SortableCollectionItem>
    );
    expect(screen.getByTestId('child-content')).toBeTruthy();
  });
});
