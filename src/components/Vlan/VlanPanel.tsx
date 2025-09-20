import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { DeviceType, InterfaceType, SwitchDevice, Vlan, VlanStatus } from '../../types';
import { getInterfaceVlans, validateNetworkVlanConfig } from '../../utils/vlan-logic/vlanConfiguration';
import PortConfigModal from '../Modals/PortConfigModal';

// VLAN Manager subcomponent
const VlanManager: React.FC = () => {
  const { vlans, addVlan, updateVlan, removeVlan, selectVlan } = useAppStore();
  const [newVlanId, setNewVlanId] = useState<number>(1);
  const [newVlanName, setNewVlanName] = useState<string>('New VLAN');
  const [newVlanColor, setNewVlanColor] = useState<string>('#60A5FA');

  const onAdd = () => {
    if (!Number.isInteger(newVlanId) || newVlanId < 1 || newVlanId > 4094) {
      alert('VLAN ID must be an integer between 1 and 4094');
      return;
    }
    if (vlans.some(v => v.id === newVlanId)) {
      alert('VLAN ID already exists');
      return;
    }
    addVlan({
      id: newVlanId,
      name: newVlanName,
      color: newVlanColor,
      status: VlanStatus.ACTIVE,
      type: 'normal' as any,
      createdAt: new Date(),
      modifiedAt: new Date(),
    } as Vlan);
    selectVlan(newVlanId);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300 font-medium">VLAN Management</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">VLAN ID</label>
          <input type="number" value={newVlanId} onChange={(e) => setNewVlanId(parseInt(e.target.value || '0'))} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input value={newVlanName} onChange={(e) => setNewVlanName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Color</label>
          <input type="color" value={newVlanColor} onChange={(e) => setNewVlanColor(e.target.value)} className="w-12 h-8 bg-gray-800 border border-gray-700 rounded" />
        </div>
        <div className="flex items-end">
          <button onClick={onAdd} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm w-full">Add VLAN</button>
        </div>
      </div>

      {vlans.length > 0 && (
        <div className="mt-2 space-y-2">
          {vlans.map(v => (
            <div key={v.id} className="flex items-center bg-gray-800 border border-gray-700 rounded px-3 py-2">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: v.color }} />
              <div className="flex-1">
                <div className="text-sm text-white">VLAN {v.id}</div>
                <div className="text-xs text-gray-400">{v.name}</div>
              </div>
              <select
                value={v.status}
                onChange={(e) => updateVlan(v.id, { status: e.target.value as any, modifiedAt: new Date() } as any)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs mr-2"
              >
                <option value={VlanStatus.ACTIVE}>active</option>
                <option value={VlanStatus.SUSPENDED}>suspended</option>
                <option value={VlanStatus.SHUTDOWN}>shutdown</option>
              </select>
              <button onClick={() => selectVlan(v.id)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs mr-2">Select</button>
              <button onClick={() => removeVlan(v.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VlanPanel: React.FC = () => {
  const { devices, vlans, updateDevice, selectedVlan } = useAppStore();
  const switches = useMemo(
    () => devices.filter(d => d.type === DeviceType.SWITCH) as SwitchDevice[],
    [devices]
  );

  const [expandedSwitchId, setExpandedSwitchId] = useState<string | undefined>(switches[0]?.id);

  const vlanOptions = useMemo(() => vlans.filter(v => v.status === 'active'), [vlans]);

  // Validation result for warnings/errors
  const validation = useMemo(() => validateNetworkVlanConfig(devices, vlans, useAppStore.getState().connections), [devices, vlans]);

  const applyAccess = (sw: SwitchDevice, ifaceId: string, vlanId: number) => {
    const ifaceIdx = sw.interfaces.findIndex(i => i.id === ifaceId);
    if (ifaceIdx === -1) return;
    const newSw: SwitchDevice = {
      ...sw,
      interfaces: sw.interfaces.map((i, idx) => idx === ifaceIdx ? {
        ...i,
        type: InterfaceType.ACCESS,
        vlanConfig: { accessVlan: vlanId }
      } : i)
    };
    updateDevice(sw.id, newSw);
  };

  const applyTrunk = (sw: SwitchDevice, ifaceId: string, allowedVlans: number[], nativeVlan: number) => {
    const ifaceIdx = sw.interfaces.findIndex(i => i.id === ifaceId);
    if (ifaceIdx === -1) return;
    const newSw: SwitchDevice = {
      ...sw,
      interfaces: sw.interfaces.map((i, idx) => idx === ifaceIdx ? {
        ...i,
        type: InterfaceType.TRUNK,
        vlanConfig: { allowedVlans: [...allowedVlans], nativeVlan }
      } : i)
    };
    updateDevice(sw.id, newSw);
  };

  const getVlanColor = (vlanId?: number) => vlans.find(v => v.id === vlanId)?.color || '#9CA3AF';

  const [modalState, setModalState] = useState<{ open: boolean; sw?: SwitchDevice; ifaceId?: string }>({ open: false });

  const InterfaceRow: React.FC<{ sw: SwitchDevice; ifaceId: string }> = ({ sw, ifaceId }) => {
    const iface = sw.interfaces.find(i => i.id === ifaceId)!;
    const mode = iface.type === InterfaceType.TRUNK ? 'trunk' : (iface.type === InterfaceType.ACCESS ? 'access' : 'access');

    const [modeState, setModeState] = useState<'access' | 'trunk'>(mode);
    const [accessVlan, setAccessVlan] = useState<number>(iface.vlanConfig?.accessVlan ?? 1);
    const [allowedVlans, setAllowedVlans] = useState<number[]>(iface.vlanConfig?.allowedVlans ?? (selectedVlan ? [selectedVlan] : []));
    const [nativeVlan, setNativeVlan] = useState<number>(iface.vlanConfig?.nativeVlan ?? (allowedVlans[0] || 1));

    const onApply = () => {
      if (modeState === 'access') {
        applyAccess(sw, iface.id, accessVlan);
      } else {
        if (!allowedVlans.includes(nativeVlan)) {
          alert('Native VLAN must be in the allowed VLANs list.');
          return;
        }
        applyTrunk(sw, iface.id, allowedVlans, nativeVlan);
      }
    };

    return (
      <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium text-white">{iface.name}</div>
            <div className={`text-xs px-2 py-0.5 rounded bg-gray-700`}>{iface.status}</div>
            {getInterfaceVlans(iface).length > 0 && (
              <div className="flex items-center space-x-1 text-xs text-gray-300">
                {getInterfaceVlans(iface).map(id => (
                  <span key={id} className="inline-flex items-center">
                    <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: getVlanColor(id) }} /> VLAN {id}
                  </span>
                ))}
              </div>
            )}
          </div>
        <div className="flex items-center space-x-4">
          {/* Errors/warnings indicators for this interface */}
          {(() => {
            const devIssues = validation.byDevice[sw.id];
            const hasError = !!devIssues?.errors.find(e => e.interfaceId === iface.id);
            const hasWarn = !!devIssues?.warnings.find(w => w.interfaceId === iface.id || w.deviceId === sw.id);
            return (
              <>
                {hasError && <span className="text-xs text-red-400">• error</span>}
                {!hasError && hasWarn && <span className="text-xs text-amber-400">• warn</span>}
              </>
            );
          })()}
            <label className="text-sm">
              <input
                type="radio"
                className="mr-1"
                checked={modeState === 'access'}
                onChange={() => setModeState('access')}
              />
              Access
            </label>
            <label className="text-sm">
              <input
                type="radio"
                className="mr-1"
                checked={modeState === 'trunk'}
                onChange={() => setModeState('trunk')}
              />
              Trunk
            </label>
          </div>
        </div>

        {modeState === 'access' ? (
          <div className="mt-3 flex items-center space-x-3">
            <label className="text-sm text-gray-300">Access VLAN:</label>
            <select
              value={accessVlan}
              onChange={(e) => setAccessVlan(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {vlanOptions.map((v: Vlan) => (
                <option key={v.id} value={v.id}>VLAN {v.id} - {v.name}</option>
              ))}
            </select>
            <button
              onClick={onApply}
              className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Allowed VLANs:</label>
              <select
                multiple
                value={allowedVlans.map(String)}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                  setAllowedVlans(values);
                  if (!values.includes(nativeVlan) && values.length > 0) {
                    setNativeVlan(values[0]);
                  }
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm h-24"
              >
                {vlanOptions.map((v: Vlan) => (
                  <option key={v.id} value={v.id}>VLAN {v.id} - {v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Native VLAN:</label>
              <select
                value={nativeVlan}
                onChange={(e) => setNativeVlan(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              >
                {allowedVlans.map(id => (
                  <option key={id} value={id}>VLAN {id}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-center justify-end space-x-2">
              <button
                onClick={() => setModalState({ open: true, sw, ifaceId: iface.id })}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Configure…
              </button>
              <button
                onClick={onApply}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (switches.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-lg">Add at least one switch to configure VLANs.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Overall validation summary */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center justify-between">
        <div className="text-sm text-gray-300">Validation</div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-amber-400">Warnings: {validation.warnings.length}</div>
          <div className="text-red-400">Errors: {validation.errors.length}</div>
        </div>
      </div>

      {/* VLAN Management */}
      <VlanManager />

      {validation.errors.length + validation.warnings.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-300 mb-2">Issues</div>
          <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
            {validation.errors.map((e, idx) => (
              <div key={`e-${idx}`} className="text-red-400">❌ {e.message}</div>
            ))}
            {validation.warnings.map((w, idx) => (
              <div key={`w-${idx}`} className="text-amber-400">⚠️ {w.message}</div>
            ))}
          </div>
        </div>
      )}

      {switches.map(sw => (
        <div key={sw.id} className="bg-gray-900 border border-gray-700 rounded-lg">
          <button
            onClick={() => setExpandedSwitchId(expandedSwitchId === sw.id ? undefined : sw.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 rounded-t-lg"
          >
            <div className="text-white font-medium">{sw.name}</div>
            <div className="text-sm text-gray-400">Interfaces: {sw.interfaces.length}</div>
          </button>
          {expandedSwitchId === sw.id && (
            <div className="p-4 space-y-3">
              {sw.interfaces.map(iface => (
                <InterfaceRow key={iface.id} sw={sw} ifaceId={iface.id} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Port Config Modal */}
      {modalState.open && modalState.sw && modalState.ifaceId && (
        <PortConfigModal
          open={modalState.open}
          onClose={() => setModalState({ open: false })}
          sw={modalState.sw}
          interfaceId={modalState.ifaceId}
          vlanOptions={vlanOptions}
          onApply={(mode, aVlan, allowed, native) => {
            if (mode === 'access') {
              applyAccess(modalState.sw!, modalState.ifaceId!, aVlan);
            } else {
              applyTrunk(modalState.sw!, modalState.ifaceId!, allowed, native);
            }
          }}
        />
      )}
    </div>
  );
};

export default VlanPanel;
