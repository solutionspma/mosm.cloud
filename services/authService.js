/**
 * Auth Service
 * Handles authentication and user management
 */

import { supabase, supabaseAdmin } from './supabase.js';
import User from '../models/User.js';

/**
 * Sign up a new user
 */
export async function signUp(email, password, userData = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: userData.name || '',
        role: userData.role || 'viewer'
      }
    }
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Get user profile from database
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Invite user to organization
 */
export async function inviteUser(email, organizationId, role) {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available');
  }
  
  // Create invite in database
  const { data, error } = await supabaseAdmin
    .from('invites')
    .insert({
      email,
      organization_id: organizationId,
      role,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // TODO: Send invite email
  
  return data;
}

/**
 * Accept invite
 */
export async function acceptInvite(inviteId, userId) {
  const { data: invite, error: fetchError } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .single();
  
  if (fetchError) throw fetchError;
  
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite has expired');
  }
  
  // Update user's organization and role
  const { data, error } = await supabase
    .from('users')
    .update({
      organization_id: invite.organization_id,
      role: invite.role,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  
  // Delete the invite
  await supabase.from('invites').delete().eq('id', inviteId);
  
  return data;
}

/**
 * Verify user has permission
 */
export async function verifyPermission(userId, permission) {
  const profile = await getUserProfile(userId);
  return User.hasPermission(profile, permission);
}

/**
 * Reset password
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Update password
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
}

export default {
  signUp,
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  inviteUser,
  acceptInvite,
  verifyPermission,
  resetPassword,
  updatePassword
};
