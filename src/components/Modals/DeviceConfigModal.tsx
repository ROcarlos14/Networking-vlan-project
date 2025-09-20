import React, { useMemo, useState } from 'react';
import Modal from '../Modals/Modal';
import { DeviceStatus, NetworkDevice, DeviceType, InterfaceStatus, InterfaceType, SwitchDevice, RouterDevice, ServerDevice, PcDevice } from '../../types';

interface DeviceConfigModalProps {
  open: boolean;
  device: NetworkDevice;
  onClose: () => void;
  onSave: (updates: Partial<NetworkDevice>) => void;
}

const DeviceConfigModal: React.FC<DeviceConfigModalProps> = ({ open, device, onClose, onSave }) => {
  const [name, setName] = useState(device.name);
  const [status, setStatus] = useState<DeviceStatus>(device.status);
  const [password, setPassword] = useState<string>((device as any).password || '');
  const deviceType = useMemo(() => device.type, [device.type]);

  // Local editable copy of interfaces
  const [interfaces, setInterfaces] = useState<any>(() => {
    if ((device as any).interfaces) return JSON.parse(JSON.stringify((device as any).interfaces));
    if ((device as any).interface) return [JSON.parse(JSON.stringify((device as any).interface))];
    return [];
  });
  const [defaultGateway, setDefaultGateway] = useState<string | undefined>((device as any).defaultGateway);

  const save = () => {
    const updates: Partial<NetworkDevice> = { name, status } as any;
    (updates as any).password = password || undefined;
    if ((device as any).interfaces) {
      (updates as any).interfaces = interfaces;
    } else if ((device as any).interface && interfaces[0]) {
      (updates as any).interface = interfaces[0];
    }
    if (device.type === DeviceType.PC || device.type === DeviceType.SERVER) {
      (updates as any).defaultGateway = defaultGateway;
    }
    onSave(updates);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Configure ${device.name}`} widthClass="max-w-3xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DeviceStatus)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            <option value={DeviceStatus.ACTIVE}>Active</option>
            <option value={DeviceStatus.INACTIVE}>Inactive</option>
            <option value={DeviceStatus.ERROR}>Error</option>
          </select>
        </div>

        <div className="text-xs text-gray-400">Type: {deviceType}</div>

        {/* Interfaces editor: IP, VLAN, and port settings */}
        {interfaces.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-300">Interfaces</div>
            {interfaces.map((iface: any, idx: number) => (
              <div key={iface.id || idx} className="p-3 border border-gray-700 rounded-lg bg-gray-800 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                      value={iface.name}
                      onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, name: e.target.value } : it))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Status</label>
                    <select
                      value={iface.status}
                      onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, status: e.target.value as InterfaceStatus } : it))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                      <option value={InterfaceStatus.UP}>up</option>
                      <option value={InterfaceStatus.DOWN}>down</option>
                      <option value={InterfaceStatus.ADMIN_DOWN}>admin_down</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Speed (Mbps)</label>
                    <input
                      type="number"
                      value={iface.speed}
                      onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, speed: Number(e.target.value) } : it))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Duplex</label>
                    <select
                      value={iface.duplex}
                      onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, duplex: e.target.value } : it))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                      <option value="full">full</option>
                      <option value="half">half</option>
                    </select>
                  </div>
                </div>

                {/* IP Address (for router/pc/server interfaces) */}
                {(deviceType === DeviceType.ROUTER || deviceType === DeviceType.PC || deviceType === DeviceType.SERVER) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">IP Address</label>
                      <input
                        value={iface.ipAddress || ''}
                        onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, ipAddress: e.target.value } : it))}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                        placeholder="e.g., 192.168.1.10/24"
                      />
                    </div>
                    {deviceType !== DeviceType.ROUTER && idx === 0 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Default Gateway</label>
                        <input
                          value={defaultGateway || ''}
                          onChange={(e) => setDefaultGateway(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                          placeholder="e.g., 192.168.1.1"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* VLAN settings for switch/trunk/access */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Port Type</label>
                    <select
                      value={iface.type}
                      onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, type: e.target.value as InterfaceType } : it))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                      <option value={InterfaceType.ACCESS}>access</option>
                      <option value={InterfaceType.TRUNK}>trunk</option>
                      <option value={InterfaceType.ETHERNET}>ethernet</option>
                    </select>
                  </div>

                  {iface.type === InterfaceType.ACCESS && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Access VLAN</label>
                      <input
                        type="number"
                        value={iface.vlanConfig?.accessVlan ?? ''}
                        onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, vlanConfig: { ...(it.vlanConfig || {}), accessVlan: Number(e.target.value) } } : it))}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                        placeholder="e.g., 10"
                      />
                    </div>
                  )}

                  {iface.type === InterfaceType.TRUNK && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Allowed VLANs (comma-separated)</label>
                        <input
                          value={(iface.vlanConfig?.allowedVlans || []).join(',')}
                          onChange={(e) => {
                            const vals = e.target.value.split(',').map(v => Number(v.trim())).filter(v => !Number.isNaN(v));
                            setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, vlanConfig: { ...(it.vlanConfig || {}), allowedVlans: vals } } : it));
                          }}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                          placeholder="e.g., 10,20,30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Native VLAN</label>
                        <input
                          type="number"
                          value={iface.vlanConfig?.nativeVlan ?? ''}
                          onChange={(e) => setInterfaces((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, vlanConfig: { ...(it.vlanConfig || {}), nativeVlan: Number(e.target.value) } } : it))}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                          placeholder="e.g., 10"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
          <button onClick={save} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
};

export default DeviceConfigModal;
