import React from 'react';
import { useAppStore } from './store';
import { ViewType } from './types';
import Sidebar from './components/Sidebar/Sidebar';
import Toolbar from './components/Toolbar/Toolbar';
import Canvas from './components/Canvas/Canvas';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Main application component
 */
function App() {
  const { currentView, isLoading, error } = useAppStore();

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
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
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-lg">VLAN Configuration Panel - Coming Soon</div>
              </div>
            )}
            {currentView === ViewType.PACKET_SIM && (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-lg">Packet Simulation Panel - Coming Soon</div>
              </div>
            )}
            {currentView === ViewType.STATISTICS && (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-lg">Statistics Panel - Coming Soon</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;