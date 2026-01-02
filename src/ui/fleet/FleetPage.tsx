/**
 * Fleet Page Component
 * 
 * Main dashboard for device fleet management
 * 
 * This proves:
 * - Heartbeat data flows
 * - Billing info surfaces
 * - Platform observability exists
 */

import React, { useEffect, useState } from 'react';
import { FleetTable } from './FleetTable';
import { DeviceRow } from './DeviceRow';

interface Device {
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
}

interface FleetStats {
  total: number;
  online: number;
  offline: number;
  plan_breakdown: Record<string, number>;
}

type ViewMode = 'table' | 'cards';

export function FleetPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    fetchDevices();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const fetchedDevices: Device[] = data.devices || [];
      
      // Handle empty state gracefully
      if (fetchedDevices.length === 0) {
        setDevices([]);
        setStats({
          total: 0,
          online: 0,
          offline: 0,
          plan_breakdown: { starter: 0, pro: 0, enterprise: 0 },
        });
        setLoading(false);
        return;
      }

      // Map API response to Device interface
      const mappedDevices: Device[] = fetchedDevices.map((d: any) => ({
        id: d.id,
        name: d.name || 'Unnamed Device',
        status: d.status || 'offline',
        plan: d.plan || 'starter',
        last_seen: d.last_heartbeat || d.last_seen || new Date().toISOString(),
        billing_status: d.billing_status,
        current_board: d.current_board,
        uptime: d.uptime,
        os_version: d.os_version,
        type: d.type || 'menu-board',
      }));

      // Calculate stats from real data
      const planBreakdown = mappedDevices.reduce(
        (acc, d) => {
          acc[d.plan] = (acc[d.plan] || 0) + 1;
          return acc;
        },
        { starter: 0, pro: 0, enterprise: 0 } as Record<string, number>
      );

      setDevices(mappedDevices);
      setStats({
        total: mappedDevices.length,
        online: mappedDevices.filter((d) => d.status !== 'offline').length,
        offline: mappedDevices.filter((d) => d.status === 'offline').length,
        plan_breakdown: planBreakdown,
      });
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setError('Failed to fetch devices. Please check your connection.');
      setLoading(false);
    }
  };

  const handleDeviceAction = async (action: string, deviceId: string) => {
    console.log(`Action: ${action} on device: ${deviceId}`);
    // TODO: Implement device actions
    // await fetch(`/api/devices/${deviceId}/commands`, {
    //   method: 'POST',
    //   body: JSON.stringify({ type: action }),
    // });
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading fleet data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Device Fleet</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('table')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              backgroundColor: viewMode === 'table' ? '#3b82f6' : 'white',
              color: viewMode === 'table' ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('cards')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              backgroundColor: viewMode === 'cards' ? '#3b82f6' : 'white',
              color: viewMode === 'cards' ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>
              Total Devices
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats.total}
            </div>
          </div>
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#15803d' }}>Online</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats.online}
            </div>
          </div>
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Offline</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats.offline}
            </div>
          </div>
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fefce8',
              border: '1px solid #fef08a',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#a16207' }}>Pro Plan</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats.plan_breakdown.pro || 0}
            </div>
          </div>
        </div>
      )}

      {/* Device List */}
      {viewMode === 'table' ? (
        <FleetTable
          devices={devices}
          onDeviceClick={(device) => console.log('Selected:', device.id)}
        />
      ) : (
        <div>
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              onAction={handleDeviceAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FleetPage;
