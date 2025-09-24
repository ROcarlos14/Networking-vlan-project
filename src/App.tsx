import { useState, useEffect } from 'react';
// Import from modular structure
import { 
  useAppStore,
  ViewType,
  Canvas,
  Toolbar,
  Sidebar,
  VlanPanel,
  PacketSimulationPanel,
  StatisticsPanel,
  STPPanel,
  CommandPalette,
  ErrorBoundary,
  useTheme,
  shortcutManager,
  createDefaultShortcuts
} from './modules';

/**
 * Main application component
 */
function App() {
  const { currentView, isLoading, error } = useAppStore();
  const { theme, setTheme, availableThemes } = useTheme();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  const store = useAppStore();

  // Initialize keyboard shortcuts
  useEffect(() => {
    const shortcuts = createDefaultShortcuts({
      // Navigation
      goToTopology: () => store.setCurrentView(ViewType.TOPOLOGY),
      goToVlanConfig: () => store.setCurrentView(ViewType.VLAN_CONFIG),
      goToSimulation: () => store.setCurrentView(ViewType.PACKET_SIM),
      goToStatistics: () => store.setCurrentView(ViewType.STATISTICS),
      
      // Editing - placeholder functions for now
      createSwitch: () => console.log('Create switch shortcut'),
      createRouter: () => console.log('Create router shortcut'),
      createPC: () => console.log('Create PC shortcut'),
      createServer: () => console.log('Create server shortcut'),
      deleteSelected: () => console.log('Delete selected shortcut'),
      duplicateSelected: () => console.log('Duplicate selected shortcut'),
      selectAll: () => console.log('Select all shortcut'),
      
      // View - placeholder functions
      zoomIn: () => console.log('Zoom in shortcut'),
      zoomOut: () => console.log('Zoom out shortcut'),
      zoomFit: () => console.log('Zoom fit shortcut'),
      zoomReset: () => console.log('Zoom reset shortcut'),
      toggleGrid: () => console.log('Toggle grid shortcut'),
      toggleLabels: () => console.log('Toggle labels shortcut'),
      
      // Simulation
      startStopSimulation: () => {
        if (store.simulationRunning) {
          store.stopSimulation();
        } else {
          store.startSimulation();
        }
      },
      pauseSimulation: () => store.pauseSimulation(),
      resetSimulation: () => store.stopSimulation(),
      sendTestPacket: () => {
        const devices = store.devices.filter(d => d.type !== 'switch');
        if (devices.length >= 2) {
          store.sendTestPacket(devices[0].id, devices[1].id);
        }
      },
      
      // File
      newTopology: () => store.clearTopology(),
      saveTopology: () => console.log('Save topology shortcut'),
      loadTopology: () => console.log('Load topology shortcut'),
      exportTopology: () => console.log('Export topology shortcut'),
      
      // Tools
      openCommandPalette: () => setShowCommandPalette(true),
      openShortcutsHelp: () => setShowShortcutsHelp(true),
      toggleTheme: () => {
        const themeNames = Object.keys(availableThemes) as Array<keyof typeof availableThemes>;
        const currentIndex = themeNames.indexOf(theme.name as keyof typeof availableThemes);
        const nextIndex = (currentIndex + 1) % themeNames.length;
        setTheme(themeNames[nextIndex]);
      },
      openSettings: () => console.log('Open settings shortcut'),
    });

    shortcuts.forEach(shortcut => shortcutManager.register(shortcut));

    return () => {
      shortcuts.forEach(shortcut => shortcutManager.unregister(shortcut.id));
    };
  }, [store, theme.name, setTheme, availableThemes]);

  return (
    <ErrorBoundary>
      <div 
        className="flex h-screen overflow-hidden"
        style={{
          backgroundColor: theme.colors.background.primary,
          color: theme.colors.text.primary,
        }}
      >
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <Toolbar />
          
          {/* Main canvas/content area */}
          <div className="flex-1 relative overflow-hidden">
            {error && (
              <div className="absolute top-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg">
                <div className="flex items-center">
                  <span className="mr-2">⚠️</span>
                  <span>{error}</span>
                  <button
                    className="ml-4 text-red-200 hover:text-white"
                    onClick={() => useAppStore.getState().clearError()}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                    <span>Loading...</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Main content based on current view */}
            {currentView === ViewType.TOPOLOGY && <Canvas />}
            {currentView === ViewType.VLAN_CONFIG && (
              <VlanPanel />
            )}
            {currentView === ViewType.PACKET_SIM && (
              <PacketSimulationPanel />
            )}
            {currentView === ViewType.STATISTICS && (
              <StatisticsPanel />
            )}
            {currentView === ViewType.STP && (
              <STPPanel />
            )}
          </div>
        </div>
      </div>
      
      {/* Professional Features */}
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)} 
      />
      
      {/* Keyboard Shortcuts Help Modal - TODO: Implement */}
      {showShortcutsHelp && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: theme.colors.background.overlay }}
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div 
            className="bg-white p-6 rounded-lg max-w-2xl w-full m-4"
            style={{
              backgroundColor: theme.colors.background.elevated,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border.primary}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Keyboard Shortcuts</h2>
            <p className="mb-4">Comprehensive shortcuts help will be implemented here.</p>
            <button 
              onClick={() => setShowShortcutsHelp(false)}
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: theme.colors.interactive.primary,
                color: theme.colors.text.inverse,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;