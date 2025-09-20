import React, { useMemo, useState, useEffect } from 'react';
import Modal from './Modal';
import { InterfaceType, SwitchDevice, Vlan } from '../../types';

type PortConfigModalProps = {
  open: boolean;
  onClose: () => void;
  sw: SwitchDevice;
  interfaceId: string;
  vlanOptions: Vlan[];
  onApply: (mode: 'access' | 'trunk', accessVlan: number, allowedVlans: number[], nativeVlan: number) => void;
};

const PortConfigModal: React.FC<PortConfigModalProps> = ({ open, onClose, sw, interfaceId, vlanOptions, onApply }) => {
  const iface = useMemo(() => sw.interfaces.find(i => i.id === interfaceId)!, [sw, interfaceId]);

  const initialMode: 'access' | 'trunk' = iface.type === InterfaceType.TRUNK ? 'trunk' : 'access';
  const [mode, setMode] = useState<'access' | 'trunk'>(initialMode);
  const [accessVlan, setAccessVlan] = useState<number>(iface.vlanConfig?.accessVlan ?? 1);
  const [allowedVlans, setAllowedVlans] = useState<number[]>(iface.vlanConfig?.allowedVlans ?? []);
  const [nativeVlan, setNativeVlan] = useState<number>(iface.vlanConfig?.nativeVlan ?? (allowedVlans[0] || 1));

  useEffect(() => {
    setMode(initialMode);
    setAccessVlan(iface.vlanConfig?.accessVlan ?? 1);
    setAllowedVlans(iface.vlanConfig?.allowedVlans ?? []);
    setNativeVlan(iface.vlanConfig?.nativeVlan ?? (iface.vlanConfig?.allowedVlans?.[0] || 1));
  }, [iface, initialMode]);

  const apply = () => {
    if (mode === 'trunk' && allowedVlans.length > 0 && !allowedVlans.includes(nativeVlan)) {
      alert('Native VLAN must be in the allowed VLANs list.');
      return;
    }
    onApply(mode, accessVlan, allowedVlans, nativeVlan);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Configure ${iface.name}`} widthClass="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm">
            <input type="radio" className="mr-1" checked={mode === 'access'} onChange={() => setMode('access')} />
            Access
          </label>
          <label className="text-sm">
            <input type="radio" className="mr-1" checked={mode === 'trunk'} onChange={() => setMode('trunk')} />
            Trunk
          </label>
        </div>

        {mode === 'access' ? (
          <div className="flex items-center space-x-3">
            <label className="text-sm text-gray-300">Access VLAN:</label>
            <select
              value={accessVlan}
              onChange={(e) => setAccessVlan(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {vlanOptions.map((v) => (
                <option key={v.id} value={v.id}>VLAN {v.id} - {v.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Allowed VLANs:</label>
              <select
                multiple
                value={allowedVlans.map(String)}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                  setAllowedVlans(values);
                  if (!values.includes(nativeVlan) && values.length > 0) setNativeVlan(values[0]);
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm h-40"
              >
                {vlanOptions.map((v) => (
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
          </div>
        )}

        <div className="flex items-center justify-end space-x-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
          <button onClick={apply} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Apply</button>
        </div>
      </div>
    </Modal>
  );
};

export default PortConfigModal;
