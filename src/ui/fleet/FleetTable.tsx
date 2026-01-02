/**
 * Fleet Table Component
 * 
 * Displays device fleet with:
 * - Device name
 * - Status (from heartbeat)
 * - Plan
 * - Last seen timestamp
 */

import React from 'react';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'idle' | 'playing';
  plan: string;
  last_seen: string;
  billing_status?: string;
}

interface FleetTableProps {
  devices: Device[];
  onDeviceClick?: (device: Device) => void;
}

export function FleetTable({ devices, onDeviceClick }: FleetTableProps) {
  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'online':
      case 'playing':
        return '#22c55e'; // green
      case 'idle':
        return '#f59e0b'; // amber
      case 'offline':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (devices.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
        No devices registered. Pair a device to get started.
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          <th style={{ textAlign: 'left', padding: '0.75rem' }}>Device</th>
          <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
          <th style={{ textAlign: 'left', padding: '0.75rem' }}>Plan</th>
          <th style={{ textAlign: 'left', padding: '0.75rem' }}>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((device) => (
          <tr
            key={device.id}
            onClick={() => onDeviceClick?.(device)}
            style={{
              borderBottom: '1px solid #e5e7eb',
              cursor: onDeviceClick ? 'pointer' : 'default',
            }}
          >
            <td style={{ padding: '0.75rem' }}>
              <div style={{ fontWeight: 500 }}>{device.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {device.id.slice(0, 8)}...
              </div>
            </td>
            <td style={{ padding: '0.75rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(device.status),
                  }}
                />
                {device.status}
              </span>
            </td>
            <td style={{ padding: '0.75rem' }}>{device.plan}</td>
            <td style={{ padding: '0.75rem', color: '#6b7280' }}>
              {formatLastSeen(device.last_seen)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default FleetTable;
