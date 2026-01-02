// MOSM Cloud Super Admin API
// Platform-wide administration endpoints
// Requires super_admin status

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://agkrwcdvfraivfhttjrp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Verify user is a super admin
async function verifySuperAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get user from token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Invalid token', status: 401 };
  }
  
  // Check super admin status
  const { data: superAdmin, error: saError } = await supabase
    .from('super_admins')
    .select('id, permissions')
    .eq('user_id', user.id)
    .single();
  
  if (saError || !superAdmin) {
    return { error: 'Forbidden - Super Admin access required', status: 403 };
  }
  
  return { user, superAdmin, supabase };
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  
  // Parse path: /api/super-admin/{resource}
  const pathParts = event.path.replace('/api/super-admin', '').split('/').filter(Boolean);
  const resource = pathParts[0];
  const resourceId = pathParts[1];
  
  // Verify super admin
  const auth = await verifySuperAdmin(event.headers.authorization);
  if (auth.error) {
    return {
      statusCode: auth.status,
      headers,
      body: JSON.stringify({ error: auth.error })
    };
  }
  
  const { supabase, user } = auth;
  
  try {
    // Route to handler
    switch (resource) {
      case 'metrics':
        return await handleMetrics(event, supabase, headers);
      case 'organizations':
        return await handleOrganizations(event, supabase, resourceId, headers);
      case 'services':
        return await handleServices(event, supabase, headers);
      case 'alerts':
        return await handleAlerts(event, supabase, resourceId, user, headers);
      case 'events':
        return await handleEvents(event, supabase, headers);
      case 'health':
        return await handleHealth(event, supabase, headers);
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Not found' })
        };
    }
  } catch (error) {
    console.error('Super admin API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

// GET /api/super-admin/metrics
async function handleMetrics(event, supabase, headers) {
  // Get real-time counts
  const [orgs, locations, users, menus, screens, devices, services, events] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('locations').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('menus').select('id', { count: 'exact', head: true }),
    supabase.from('screens').select('id', { count: 'exact', head: true }),
    supabase.from('devices').select('id', { count: 'exact', head: true }),
    supabase.from('service_registry').select('status'),
    supabase.from('event_log').select('id', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ]);
  
  // Calculate service health
  const serviceData = services.data || [];
  const online = serviceData.filter(s => s.status === 'online').length;
  const degraded = serviceData.filter(s => s.status === 'degraded').length;
  const offline = serviceData.filter(s => s.status === 'offline').length;
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      metrics: {
        organizations: orgs.count || 0,
        locations: locations.count || 0,
        users: users.count || 0,
        menus: menus.count || 0,
        screens: screens.count || 0,
        devices: devices.count || 0,
        services: {
          total: serviceData.length,
          online,
          degraded,
          offline
        },
        events24h: events.count || 0
      },
      timestamp: new Date().toISOString()
    })
  };
}

// GET /api/super-admin/organizations
// GET /api/super-admin/organizations/:id
async function handleOrganizations(event, supabase, orgId, headers) {
  if (orgId) {
    // Single organization with full details
    const { data: org, error } = await supabase
      .from('organizations')
      .select(`
        *,
        locations(id, name, address, city, state),
        users(id, email, first_name, last_name, role)
      `)
      .eq('id', orgId)
      .single();
    
    if (error) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Organization not found' })
      };
    }
    
    // Get service health for this org
    const { data: services } = await supabase
      .from('service_registry')
      .select('service_id, status, last_heartbeat, location_id')
      .in('location_id', org.locations?.map(l => l.id) || []);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ organization: { ...org, services: services || [] } })
    };
  }
  
  // List all organizations
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select(`
      id, name, slug, plan, created_at,
      locations:locations(count),
      users:users(count)
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch organizations' })
    };
  }
  
  // Get service counts per org
  const orgIds = orgs.map(o => o.id);
  const { data: locationMap } = await supabase
    .from('locations')
    .select('id, organization_id')
    .in('organization_id', orgIds);
  
  const locationsByOrg = {};
  (locationMap || []).forEach(l => {
    if (!locationsByOrg[l.organization_id]) locationsByOrg[l.organization_id] = [];
    locationsByOrg[l.organization_id].push(l.id);
  });
  
  const allLocationIds = (locationMap || []).map(l => l.id);
  const { data: services } = await supabase
    .from('service_registry')
    .select('location_id, status')
    .in('location_id', allLocationIds);
  
  // Enrich orgs with service health
  const enrichedOrgs = orgs.map(org => {
    const orgLocationIds = locationsByOrg[org.id] || [];
    const orgServices = (services || []).filter(s => orgLocationIds.includes(s.location_id));
    
    return {
      ...org,
      locationCount: org.locations?.[0]?.count || 0,
      userCount: org.users?.[0]?.count || 0,
      serviceHealth: {
        total: orgServices.length,
        online: orgServices.filter(s => s.status === 'online').length,
        degraded: orgServices.filter(s => s.status === 'degraded').length,
        offline: orgServices.filter(s => s.status === 'offline').length
      }
    };
  });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ organizations: enrichedOrgs })
  };
}

// GET /api/super-admin/services
async function handleServices(event, supabase, headers) {
  // Get all services across all orgs
  const { data: services, error } = await supabase
    .from('service_registry')
    .select(`
      *,
      locations!inner(name, organization_id, organizations(name))
    `)
    .order('last_heartbeat', { ascending: false, nullsFirst: false });
  
  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch services' })
    };
  }
  
  // Group by status
  const byStatus = {
    online: services.filter(s => s.status === 'online'),
    degraded: services.filter(s => s.status === 'degraded'),
    offline: services.filter(s => s.status === 'offline'),
    unknown: services.filter(s => s.status === 'unknown')
  };
  
  // Group by organization
  const byOrg = {};
  services.forEach(s => {
    const orgName = s.locations?.organizations?.name || 'Unknown';
    const orgId = s.locations?.organization_id;
    if (!byOrg[orgId]) {
      byOrg[orgId] = { name: orgName, services: [] };
    }
    byOrg[orgId].services.push(s);
  });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      total: services.length,
      byStatus: {
        online: byStatus.online.length,
        degraded: byStatus.degraded.length,
        offline: byStatus.offline.length,
        unknown: byStatus.unknown.length
      },
      byOrganization: byOrg,
      services: services.map(s => ({
        id: s.id,
        serviceId: s.service_id,
        instanceId: s.instance_id,
        status: s.status,
        version: s.version,
        lastHeartbeat: s.last_heartbeat,
        location: s.locations?.name,
        organization: s.locations?.organizations?.name
      }))
    })
  };
}

// GET /api/super-admin/alerts
// PUT /api/super-admin/alerts/:id (acknowledge)
async function handleAlerts(event, supabase, alertId, user, headers) {
  if (event.httpMethod === 'PUT' && alertId) {
    // Acknowledge alert
    const { data, error } = await supabase
      .from('platform_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();
    
    if (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to acknowledge alert' })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ alert: data })
    };
  }
  
  // List alerts
  const params = event.queryStringParameters || {};
  const showAcknowledged = params.acknowledged === 'true';
  
  let query = supabase
    .from('platform_alerts')
    .select(`
      *,
      organizations(name),
      locations(name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!showAcknowledged) {
    query = query.eq('acknowledged', false);
  }
  
  const { data: alerts, error } = await query;
  
  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch alerts' })
    };
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      alerts: alerts || [],
      unacknowledged: (alerts || []).filter(a => !a.acknowledged).length
    })
  };
}

// GET /api/super-admin/events
async function handleEvents(event, supabase, headers) {
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const orgId = params.organization_id;
  
  let query = supabase
    .from('event_log')
    .select(`
      id, event_type, source_service, resource_type, resource_id, timestamp,
      locations(name),
      organizations(name)
    `)
    .order('timestamp', { ascending: false })
    .limit(limit);
  
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }
  
  const { data: events, error } = await query;
  
  if (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch events' })
    };
  }
  
  // Get summary stats
  const { data: summary } = await supabase.rpc('get_event_summary_24h');
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      events: events || [],
      summary: summary || { total: 0 }
    })
  };
}

// GET /api/super-admin/health - Platform health overview
async function handleHealth(event, supabase, headers) {
  // Get all service statuses with org info
  const { data: services } = await supabase
    .from('service_registry')
    .select(`
      service_id, status, last_heartbeat, version,
      locations!inner(name, organization_id, organizations(name))
    `)
    .order('last_heartbeat', { ascending: false });
  
  const allServices = services || [];
  const now = Date.now();
  
  // Calculate health metrics
  const health = {
    total: allServices.length,
    online: allServices.filter(s => s.status === 'online').length,
    degraded: allServices.filter(s => s.status === 'degraded').length,
    offline: allServices.filter(s => s.status === 'offline').length,
    stale: allServices.filter(s => {
      if (!s.last_heartbeat) return true;
      return (now - new Date(s.last_heartbeat).getTime()) > 5 * 60 * 1000; // 5 min
    }).length
  };
  
  // Group by organization
  const byOrganization = {};
  allServices.forEach(s => {
    const orgId = s.locations?.organization_id;
    const orgName = s.locations?.organizations?.name || 'Unknown';
    
    if (!byOrganization[orgId]) {
      byOrganization[orgId] = {
        name: orgName,
        total: 0,
        online: 0,
        degraded: 0,
        offline: 0,
        services: []
      };
    }
    
    byOrganization[orgId].total++;
    byOrganization[orgId][s.status]++;
    byOrganization[orgId].services.push({
      service: s.service_id,
      location: s.locations?.name,
      status: s.status,
      lastHeartbeat: s.last_heartbeat,
      version: s.version
    });
  });
  
  // Get recent critical events
  const { data: criticalEvents } = await supabase
    .from('event_log')
    .select('event_type, source_service, timestamp, organizations(name)')
    .in('event_type', ['service.down', 'error.critical', 'availability.out_of_stock'])
    .gte('timestamp', new Date(now - 60 * 60 * 1000).toISOString()) // Last hour
    .order('timestamp', { ascending: false })
    .limit(10);
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      health,
      byOrganization,
      criticalEvents: criticalEvents || [],
      timestamp: new Date().toISOString()
    })
  };
}
