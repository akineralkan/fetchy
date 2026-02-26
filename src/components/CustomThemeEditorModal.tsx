import { useState, useEffect } from 'react';
import { X, Palette, Copy } from 'lucide-react';
import { CustomTheme, CustomThemeColors } from '../types';

interface CustomThemeEditorModalProps {
  isOpen: boolean;
  editingTheme?: CustomTheme | null;
  onSave: (theme: CustomTheme) => void;
  onCancel: () => void;
}

const PRESET_STARTERS: Record<string, { label: string; colors: CustomThemeColors }> = {
  dark: {
    label: 'Indigo',
    colors: {
      bgColor: '#1a1a24',
      sidebarColor: '#181e2e',
      cardColor: '#172040',
      textColor: '#d8d8d8',
      textMuted: '#909090',
      borderColor: '#26263a',
      hoverBg: '#26263a',
      inputBg: '#121218',
      accent: '#906070',
      accentHover: '#7a5060',
      tabBarBg: '#181e2e',
      tabActiveBg: '#1a1a24',
      dropdownBg: '#181e2e',
      modalBg: '#172040',
      tooltipBg: '#1a1a24',
      separatorColor: '#303045',
      successColor: '#6a9878',
      warningColor: '#a08848',
      errorColor: '#a06060',
    },
  },
  light: {
    label: 'Light',
    colors: {
      bgColor: '#e6e6e9',
      sidebarColor: '#ededf0',
      cardColor: '#f2f2f5',
      textColor: '#2a2a2a',
      textMuted: '#5a5f66',
      borderColor: '#c8ccce',
      hoverBg: '#dadade',
      inputBg: '#f2f2f4',
      accent: '#8a5060',
      accentHover: '#7a4050',
      tabBarBg: '#ededf0',
      tabActiveBg: '#e6e6e9',
      dropdownBg: '#ededf0',
      modalBg: '#f2f2f5',
      tooltipBg: '#e6e6e9',
      separatorColor: '#c0c4c8',
      successColor: '#458856',
      warningColor: '#987028',
      errorColor: '#8a5050',
    },
  },
  ocean: {
    label: 'Ocean',
    colors: {
      bgColor: '#dce8f0',
      sidebarColor: '#c8dde8',
      cardColor: '#e8f0f8',
      textColor: '#1a3040',
      textMuted: '#4a6070',
      borderColor: '#90b8cc',
      hoverBg: '#a8c4d4',
      inputBg: '#f0f4f8',
      accent: '#4a7090',
      accentHover: '#3a5878',
      tabBarBg: '#c8dde8',
      tabActiveBg: '#dce8f0',
      dropdownBg: '#c8dde8',
      modalBg: '#e8f0f8',
      tooltipBg: '#dce8f0',
      separatorColor: '#78a8bc',
      successColor: '#487858',
      warningColor: '#906828',
      errorColor: '#8a4040',
    },
  },
  forest: {
    label: 'Forest',
    colors: {
      bgColor: '#e0eae4',
      sidebarColor: '#cae0d0',
      cardColor: '#e8f0ea',
      textColor: '#1a2e1e',
      textMuted: '#486050',
      borderColor: '#90c0a0',
      hoverBg: '#a8ccb4',
      inputBg: '#f0f4f2',
      accent: '#4a7858',
      accentHover: '#3a6048',
      tabBarBg: '#cae0d0',
      tabActiveBg: '#e0eae4',
      dropdownBg: '#cae0d0',
      modalBg: '#e8f0ea',
      tooltipBg: '#e0eae4',
      separatorColor: '#78a888',
      successColor: '#3a6048',
      warningColor: '#906828',
      errorColor: '#8a4040',
    },
  },
  earth: {
    label: 'Earth',
    colors: {
      bgColor: '#eee8de',
      sidebarColor: '#e4d5c4',
      cardColor: '#f2ece0',
      textColor: '#2a1e14',
      textMuted: '#705848',
      borderColor: '#c8b090',
      hoverBg: '#d8c0a0',
      inputBg: '#f5f0e8',
      accent: '#8a6040',
      accentHover: '#705030',
      tabBarBg: '#e4d5c4',
      tabActiveBg: '#eee8de',
      dropdownBg: '#e4d5c4',
      modalBg: '#f2ece0',
      tooltipBg: '#eee8de',
      separatorColor: '#b89870',
      successColor: '#487858',
      warningColor: '#906828',
      errorColor: '#8a4040',
    },
  },
  aurora: {
    label: 'Aurora',
    colors: {
      bgColor: '#111118',
      sidebarColor: '#151228',
      cardColor: '#181535',
      textColor: '#d8d4e8',
      textMuted: '#7870b0',
      borderColor: '#2a2858',
      hoverBg: '#2a2858',
      inputBg: '#0c0c14',
      accent: '#7a4880',
      accentHover: '#604068',
      tabBarBg: '#151228',
      tabActiveBg: '#111118',
      dropdownBg: '#151228',
      modalBg: '#181535',
      tooltipBg: '#111118',
      separatorColor: '#302860',
      successColor: '#6a9878',
      warningColor: '#a08848',
      errorColor: '#a06060',
    },
  },
  sunset: {
    label: 'Sunset',
    colors: {
      bgColor: '#2e1a14',
      sidebarColor: '#201410',
      cardColor: '#381e18',
      textColor: '#e8ddd8',
      textMuted: '#c09080',
      borderColor: '#5a3028',
      hoverBg: '#5a3028',
      inputBg: '#180e0c',
      accent: '#9a4840',
      accentHover: '#7a3830',
      tabBarBg: '#201410',
      tabActiveBg: '#2e1a14',
      dropdownBg: '#201410',
      modalBg: '#381e18',
      tooltipBg: '#2e1a14',
      separatorColor: '#5a3028',
      successColor: '#6a9878',
      warningColor: '#a08848',
      errorColor: '#a06060',
    },
  },
  candy: {
    label: 'Candy',
    colors: {
      bgColor: '#f0e0ec',
      sidebarColor: '#ead0e0',
      cardColor: '#f0e8f0',
      textColor: '#2a1830',
      textMuted: '#785068',
      borderColor: '#d0a0c0',
      hoverBg: '#e0b0d0',
      inputBg: '#f8f0f5',
      accent: '#885068',
      accentHover: '#704058',
      tabBarBg: '#ead0e0',
      tabActiveBg: '#f0e0ec',
      dropdownBg: '#ead0e0',
      modalBg: '#f0e8f0',
      tooltipBg: '#f0e0ec',
      separatorColor: '#c070a0',
      successColor: '#487858',
      warningColor: '#906828',
      errorColor: '#8a4040',
    },
  },
  dark: {
    label: 'Dark',
    colors: {
      bgColor: '#161616',
      sidebarColor: '#171717',
      cardColor: '#1c1c1c',
      textColor: '#c8c8c8',
      textMuted: '#686868',
      borderColor: '#2c2c2c',
      hoverBg: '#222222',
      inputBg: '#1e1e1e',
      accent: '#6066b0',
      accentHover: '#505098',
      tabBarBg: '#171717',
      tabActiveBg: '#161616',
      dropdownBg: '#1a1a1a',
      modalBg: '#1c1c1c',
      tooltipBg: '#1a1a1a',
      separatorColor: '#2a2a2a',
      successColor: '#6a9878',
      warningColor: '#908030',
      errorColor: '#a06060',
    },
  },
};

const COLOR_FIELDS: Array<{ key: keyof CustomThemeColors; label: string; description: string }> = [
  { key: 'bgColor', label: 'Background', description: 'Main app background' },
  { key: 'sidebarColor', label: 'Sidebar', description: 'Sidebar / secondary background' },
  { key: 'cardColor', label: 'Card / Panel', description: 'Cards and panels background' },
  { key: 'inputBg', label: 'Input Background', description: 'Input and code editor fields' },
  { key: 'textColor', label: 'Text', description: 'Primary text color' },
  { key: 'textMuted', label: 'Muted Text', description: 'Secondary / placeholder text' },
  { key: 'borderColor', label: 'Border', description: 'Borders and dividers' },
  { key: 'hoverBg', label: 'Hover Background', description: 'Hover state background' },
  { key: 'accent', label: 'Accent', description: 'Buttons and active highlights' },
  { key: 'accentHover', label: 'Accent Hover', description: 'Accent color on hover' },
  { key: 'tabBarBg', label: 'Tab Bar', description: 'Tab strip background' },
  { key: 'tabActiveBg', label: 'Active Tab', description: 'Active tab background' },
  { key: 'dropdownBg', label: 'Dropdown', description: 'Dropdown and context menus' },
  { key: 'modalBg', label: 'Modal', description: 'Modal / dialog background' },
  { key: 'tooltipBg', label: 'Tooltip', description: 'Tooltip background' },
  { key: 'separatorColor', label: 'Separator', description: 'Panel separator / resize handle' },
  { key: 'successColor', label: 'Success', description: 'Success status indicators' },
  { key: 'warningColor', label: 'Warning', description: 'Warning status indicators' },
  { key: 'errorColor', label: 'Error', description: 'Error status indicators' },
];

export default function CustomThemeEditorModal({
  isOpen,
  editingTheme,
  onSave,
  onCancel,
}: CustomThemeEditorModalProps) {
  const [name, setName] = useState(editingTheme?.name ?? '');
  const [colors, setColors] = useState<CustomThemeColors>(
    editingTheme?.colors ?? PRESET_STARTERS.dark.colors
  );
  const [nameError, setNameError] = useState('');

  // Reset form state whenever the modal opens (or editingTheme changes)
  useEffect(() => {
    if (isOpen) {
      setName(editingTheme?.name ?? '');
      setColors(editingTheme?.colors ? { ...editingTheme.colors } : { ...PRESET_STARTERS.dark.colors });
      setNameError('');
    }
  }, [isOpen, editingTheme]);

  if (!isOpen) return null;

  const handleColorChange = (key: keyof CustomThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetLoad = (preset: string) => {
    const starter = PRESET_STARTERS[preset];
    if (starter) {
      setColors({ ...starter.colors });
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Theme name is required');
      return;
    }
    setNameError('');
    const theme: CustomTheme = {
      id: editingTheme?.id ?? `custom-${Date.now()}`,
      name: trimmedName,
      colors: { ...colors },
    };
    onSave(theme);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm">
      <div
        className="rounded-lg shadow-2xl w-[640px] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #2d2d44' }}
        >
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-[#906070]" />
            <h2 className="text-base font-semibold text-white">
              {editingTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-gray-400 hover:text-white transition-colors"
            style={{ ':hover': { backgroundColor: '#2d2d44' } } as React.CSSProperties}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Theme Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Theme Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="My Custom Theme"
              className="w-full px-3 py-2 rounded text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#0f0f1a',
                border: nameError ? '1px solid #906070' : '1px solid #2d2d44',
                color: '#eaeaea',
              }}
            />
            {nameError && <p className="mt-1 text-xs text-[#906070]">{nameError}</p>}
          </div>

          {/* Start from preset */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Copy size={13} className="inline mr-1 opacity-70" />
              Start from preset
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_STARTERS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetLoad(key)}
                  className="px-3 py-1 text-xs rounded transition-colors"
                  style={{
                    backgroundColor: '#16213e',
                    border: '1px solid #2d2d44',
                    color: '#a0a0a0',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#906070';
                    (e.currentTarget as HTMLButtonElement).style.color = '#eaeaea';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d2d44';
                    (e.currentTarget as HTMLButtonElement).style.color = '#a0a0a0';
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color preview strip */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Preview</label>
            <div className="flex rounded overflow-hidden h-8 border" style={{ borderColor: '#2d2d44' }}>
              <div className="flex-1" style={{ backgroundColor: colors.bgColor }} title="Background" />
              <div className="flex-1" style={{ backgroundColor: colors.sidebarColor }} title="Sidebar" />
              <div className="flex-1" style={{ backgroundColor: colors.cardColor }} title="Card" />
              <div className="flex-1" style={{ backgroundColor: colors.inputBg }} title="Input" />
              <div className="flex-1" style={{ backgroundColor: colors.borderColor }} title="Border" />
              <div className="flex-1" style={{ backgroundColor: colors.hoverBg }} title="Hover" />
              <div className="flex-1" style={{ backgroundColor: colors.tabBarBg }} title="Tab Bar" />
              <div className="flex-1" style={{ backgroundColor: colors.modalBg }} title="Modal" />
              <div className="flex-1" style={{ backgroundColor: colors.dropdownBg }} title="Dropdown" />
              <div className="w-8" style={{ backgroundColor: colors.accent }} title="Accent" />
              <div className="w-8" style={{ backgroundColor: colors.accentHover }} title="Accent Hover" />
            </div>
            <div className="flex mt-1 gap-3">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: colors.textColor }}
                />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Text</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: colors.textMuted }}
                />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Muted</span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.successColor }} />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>OK</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.warningColor }} />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Warn</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.errorColor }} />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Err</span>
              </div>
            </div>
          </div>

          {/* Color Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Color Palette</label>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer border-0 p-0 bg-transparent"
                      style={{ outline: 'none' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-200 font-medium leading-tight">{label}</div>
                    <div className="text-xs leading-tight mt-0.5" style={{ color: '#666' }}>
                      {description}
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#906070' }}>
                      {colors[key]}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={colors[key]}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        handleColorChange(key, val);
                      }
                    }}
                    className="ml-auto w-24 px-2 py-1 text-xs font-mono rounded outline-none"
                    style={{
                      backgroundColor: '#0f0f1a',
                      border: '1px solid #2d2d44',
                      color: '#eaeaea',
                    }}
                    maxLength={7}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #2d2d44' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{ backgroundColor: '#16213e', border: '1px solid #2d2d44', color: '#a0a0a0' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#eaeaea';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#a0a0a0';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded font-semibold text-white transition-colors"
            style={{ backgroundColor: '#906070' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#7a5060';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#906070';
            }}
          >
            {editingTheme ? 'Save Changes' : 'Create Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}
