import { useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  MoonStar,
  Droplets,
  Leaf,
  Globe,
  Palette,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Flame,
  Star,
  Skull,
} from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { CustomTheme } from '../types';
import CustomThemeEditorModal from './CustomThemeEditorModal';

// ─────────────────────────────────────────────────────────────────
// Theme metadata for built-in themes
// ─────────────────────────────────────────────────────────────────

type BuiltinKey = 'indigo' | 'light' | 'ocean' | 'forest' | 'earth' | 'aurora' | 'sunset' | 'candy' | 'dark' | 'black';

const BUILTIN_THEMES: Array<{ id: BuiltinKey; label: string; dotColor: string; mode: 'light' | 'dark' }> = [
  { id: 'light', label: 'Light', dotColor: '#8a5060', mode: 'light' },
  { id: 'ocean', label: 'Ocean', dotColor: '#4a7090', mode: 'light' },
  { id: 'forest', label: 'Forest', dotColor: '#4a7858', mode: 'light' },
  { id: 'earth', label: 'Earth', dotColor: '#8a6040', mode: 'light' },
  { id: 'candy', label: 'Candy', dotColor: '#885068', mode: 'light' },
  { id: 'dark', label: 'Dark', dotColor: '#6066b0', mode: 'dark' },
  { id: 'indigo', label: 'Indigo', dotColor: '#906070', mode: 'dark' },
  { id: 'black', label: 'Black', dotColor: '#6466f1', mode: 'dark' },
  { id: 'aurora', label: 'Aurora', dotColor: '#7a4880', mode: 'dark' },
  { id: 'sunset', label: 'Sunset', dotColor: '#9a4840', mode: 'dark' },
];

const LIGHT_THEMES = BUILTIN_THEMES.filter((t) => t.mode === 'light');
const DARK_THEMES = BUILTIN_THEMES.filter((t) => t.mode === 'dark');

const BUILTIN_ICONS: Record<BuiltinKey, React.ReactNode> = {
  black: <Skull size={15} />,
  indigo: <MoonStar size={15} />,
  light: <Sun size={15} />,
  ocean: <Droplets size={15} />,
  forest: <Leaf size={15} />,
  earth: <Globe size={15} />,
  aurora: <Sparkles size={15} />,
  sunset: <Flame size={15} />,
  candy: <Star size={15} />,
  dark: <Moon size={15} />,
};

// ─────────────────────────────────────────────────────────────────
// CSS var mapping for custom themes
// ─────────────────────────────────────────────────────────────────

const COLOR_VAR_MAP: Record<string, string> = {
  bgColor: '--bg-color',
  sidebarColor: '--sidebar-color',
  cardColor: '--card-color',
  textColor: '--text-color',
  textMuted: '--text-muted',
  borderColor: '--border-color',
  hoverBg: '--hover-bg',
  inputBg: '--input-bg',
  accent: '--accent',
  accentHover: '--accent-hover',
  tabBarBg: '--tab-bar-bg',
  tabActiveBg: '--tab-active-bg',
  dropdownBg: '--dropdown-bg',
  modalBg: '--modal-bg',
  tooltipBg: '--tooltip-bg',
  separatorColor: '--separator-color',
  successColor: '--success',
  warningColor: '--warning',
  errorColor: '--error',
};

const ALL_CSS_VARS = Object.values(COLOR_VAR_MAP);
const THEME_CLASSES = ['light-theme', 'ocean-theme', 'forest-theme', 'earth-theme', 'aurora-theme', 'sunset-theme', 'candy-theme', 'black-theme', 'pure-black-theme'];

function applyTheme(theme: string, customThemes: CustomTheme[]) {
  const body = document.body;
  const html = document.documentElement;

  // Reset everything first
  THEME_CLASSES.forEach((cls) => body.classList.remove(cls));
  html.classList.remove('dark');
  ALL_CSS_VARS.forEach((v) => body.style.removeProperty(v));

  switch (theme) {
    case 'light':
      body.classList.add('light-theme');
      break;
    case 'ocean':
      body.classList.add('ocean-theme');
      break;
    case 'forest':
      body.classList.add('forest-theme');
      break;
    case 'earth':
      body.classList.add('earth-theme');
      break;
    case 'aurora':
      body.classList.add('aurora-theme');
      html.classList.add('dark');
      break;
    case 'sunset':
      body.classList.add('sunset-theme');
      html.classList.add('dark');
      break;
    case 'candy':
      body.classList.add('candy-theme');
      break;
    case 'dark':
      body.classList.add('black-theme');
      html.classList.add('dark');
      break;
    case 'black':
      body.classList.add('pure-black-theme');
      html.classList.add('dark');
      break;
    case 'indigo':
      html.classList.add('dark');
      break;
    default: {
      // Custom theme
      const customTheme = customThemes.find((t) => t.id === theme);
      if (customTheme) {
        html.classList.add('dark');
        Object.entries(customTheme.colors).forEach(([key, value]) => {
          const cssVar = COLOR_VAR_MAP[key];
          if (cssVar) body.style.setProperty(cssVar, value);
        });
      } else {
        // Fallback to dark
        html.classList.add('dark');
      }
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export default function ThemeToggle() {
  const { preferences, savePreferences } = usePreferencesStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = preferences.theme ?? 'dark';
  const customThemes: CustomTheme[] = preferences.customThemes ?? [];

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(currentTheme, customThemes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTheme, JSON.stringify(customThemes)]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // ── Current theme label & icon ───────────────────────────────
  const builtinMeta = BUILTIN_THEMES.find((t) => t.id === currentTheme);
  const customMeta = !builtinMeta ? customThemes.find((t) => t.id === currentTheme) : null;

  const currentLabel = builtinMeta?.label ?? customMeta?.name ?? 'Theme';
  const currentDotColor =
    builtinMeta?.dotColor ?? customMeta?.colors.accent ?? '#906070';
  const currentIcon = builtinMeta
    ? BUILTIN_ICONS[builtinMeta.id]
    : <Palette size={15} />;

  // ── Handlers ─────────────────────────────────────────────────

  const selectTheme = (id: string) => {
    savePreferences({ theme: id });
    setIsOpen(false);
  };

  const handleCreateTheme = () => {
    setEditingTheme(null);
    setIsOpen(false);
    setShowEditor(true);
  };

  const handleEditTheme = (theme: CustomTheme, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTheme(theme);
    setIsOpen(false);
    setShowEditor(true);
  };

  const handleDeleteTheme = (themeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customThemes.filter((t) => t.id !== themeId);
    const newActive = currentTheme === themeId ? 'dark' : currentTheme;
    savePreferences({ customThemes: updated, theme: newActive });
  };

  const handleSaveCustomTheme = (theme: CustomTheme) => {
    const exists = customThemes.some((t) => t.id === theme.id);
    const updated = exists
      ? customThemes.map((t) => (t.id === theme.id ? theme : t))
      : [...customThemes, theme];
    savePreferences({ customThemes: updated, theme: theme.id });
    setShowEditor(false);
    setEditingTheme(null);
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingTheme(null);
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border"
          title="Change Theme"
        >
          <span className="flex-shrink-0" style={{ color: currentDotColor }}>
            {currentIcon}
          </span>
          <span className="text-xs font-medium leading-none">{currentLabel}</span>
          <ChevronDown
            size={12}
            className="flex-shrink-0 transition-transform"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className="absolute right-0 bottom-full mb-1 rounded-lg shadow-2xl z-50 overflow-hidden min-w-[180px]"
            style={{
              backgroundColor: 'var(--sidebar-color)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Light themes */}
            <div className="py-1">
              <div
                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Light
              </div>
              {LIGHT_THEMES.map(({ id, label, dotColor }) => (
                <button
                  key={id}
                  onClick={() => selectTheme(id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                  style={{
                    color: currentTheme === id ? 'var(--accent)' : 'var(--text-color)',
                    backgroundColor:
                      currentTheme === id ? 'rgba(255,255,255,0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (currentTheme !== id)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (currentTheme !== id)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ color: dotColor }}>{BUILTIN_ICONS[id]}</span>
                  <span className="font-medium">{label}</span>
                  {currentTheme === id && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Dark themes */}
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="py-1">
                <div
                  className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dark
                </div>
                {DARK_THEMES.map(({ id, label, dotColor }) => (
                  <button
                    key={id}
                    onClick={() => selectTheme(id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
                    style={{
                      color: currentTheme === id ? 'var(--accent)' : 'var(--text-color)',
                      backgroundColor:
                        currentTheme === id ? 'rgba(255,255,255,0.05)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (currentTheme !== id)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (currentTheme !== id)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ color: dotColor }}>{BUILTIN_ICONS[id]}</span>
                    <span className="font-medium">{label}</span>
                    {currentTheme === id && (
                      <span
                        className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom themes */}
            {customThemes.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="py-1">
                  <div
                    className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Custom
                  </div>
                  {customThemes.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center gap-0 group"
                      style={{
                        backgroundColor:
                          currentTheme === ct.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (currentTheme !== ct.id)
                          (e.currentTarget as HTMLDivElement).style.backgroundColor =
                            'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (currentTheme !== ct.id)
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <button
                        onClick={() => selectTheme(ct.id)}
                        className="flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                        style={{
                          color:
                            currentTheme === ct.id ? 'var(--accent)' : 'var(--text-color)',
                        }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20"
                          style={{ backgroundColor: ct.colors.accent }}
                        />
                        <span className="font-medium truncate max-w-[100px]">{ct.name}</span>
                        {currentTheme === ct.id && (
                          <span
                            className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: 'var(--accent)' }}
                          />
                        )}
                      </button>
                      {/* Edit & Delete */}
                      <div className="flex items-center pr-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEditTheme(ct, e)}
                          className="p-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color =
                              'var(--text-color)')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color =
                              'var(--text-muted)')
                          }
                          title="Edit theme"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTheme(ct.id, e)}
                          className="p-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = '#a06060')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color =
                              'var(--text-muted)')
                          }
                          title="Delete theme"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Custom Theme */}
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="py-1">
                <button
                  onClick={handleCreateTheme}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}><Plus size={15} /></span>
                  <span className="font-medium">Create Custom Theme</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom theme editor modal */}
      <CustomThemeEditorModal
        isOpen={showEditor}
        editingTheme={editingTheme}
        onSave={handleSaveCustomTheme}
        onCancel={handleCancelEditor}
      />
    </>
  );
}

