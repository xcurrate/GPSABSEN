// js/supabase.js
// Konfigurasi Supabase Client
// Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan milik Anda

const SUPABASE_URL = 'https://sbxtfqidotarniglzban.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIyODE4NCwiZXhwIjoyMDgzODA0MTg0fQ.Hp-CEt0KrRay_G-NDUFq3x4prO3kEWImmPVZRssa2h0';


const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: get current user session
async function getCurrentUser() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.user || null;
}

// Helper: get user profile from profiles table
async function getUserProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Helper: redirect if not logged in
async function requireAuth(redirectTo = 'index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

// Helper: redirect if not admin
async function requireAdmin(redirectTo = 'dashboard.html') {
  const user = await requireAuth();
  if (!user) return null;
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = redirectTo;
    return null;
  }
  return { user, profile };
}

// Helper: format tanggal Indo
function formatDate(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Helper: format waktu HH:MM
function formatTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5);
}

// Helper: hitung jarak GPS (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: get today date string YYYY-MM-DD
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Helper: get current time HH:MM:SS
function getCurrentTime() {
  return new Date().toTimeString().split(' ')[0];
}

// Helper: show toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg transition-all duration-300 ${
    type === 'success' ? 'bg-emerald-500' :
    type === 'error' ? 'bg-red-500' :
    type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
  }`;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// Helper: loading state button
function setLoading(btn, loading, text = '') {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || text;
  }
}
