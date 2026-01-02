/**
 * Device Row Component
 * 
 * Individual device row with expanded details view
 */

import React, { useState } from 'react';

interface DeviceRowProps {
  device: {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'idle' | 'playing';
    plan: string;
    last_seen: string;
    billing_status?: string;
    current_board?: string;
    uptime?: number;
    os_version?: string;
    type?: 'menu-board' | 'kiosk' | 'tv';
  };
  onAction?: (action: string, deviceId: string) => void;
}

export function DeviceRow({ device, onAction }: DeviceRowProps) {
  const [expanded, setExpanded] = useState(false);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          cursor: 'pointer',
          backgroundColor: expanded ? '#f9fafb' : 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor:
                device.status === 'online' || device.status === 'playing'
                  ? '#22c55e'
                  : device.status === 'idle'
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{device.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {device.type || 'Device'} • {device.plan}
            </div>
          </div>
        </div>
        <div style={{ color: '#6b7280' }}>{expanded ? '▼' : '▶'}</div>
      </div>

      {expanded && (
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Device ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {device.id}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Status</div>
              <div>{device.status}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Uptime</div>
              <div>{formatUptime(device.uptime)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Current Board
              </div>
              <div>{device.current_board || 'None'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>OS Version</div>
              <div>{device.os_version || 'Unknown'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Billing Status
              </div>
              <div>{device.billing_status || 'Unknown'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onAction?.('restart', device.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              Restart
            </button>
            <button
              onClick={() => onAction?.('switch_board', device.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              Switch Board
            </button>
            <button
              onClick={() => onAction?.('unpair', device.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid #ef4444',
                backgroundColor: 'white',
                color: '#ef4444',
                cursor: 'pointer',
              }}
            >
              Unpair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceRow;
