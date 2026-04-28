# Supabase Setup Guide

## Overview
Your "Millions Before 19" app now supports cloud backup with Supabase while maintaining offline functionality through localStorage.

**How it works:**
- ✅ **Local Storage**: Instant saves, works offline
- ☁️ **Supabase Cloud**: Automatic backup, multi-device sync
- 🔄 **Fallback**: If cloud is unavailable, app uses local storage seamlessly

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up (free tier available)
3. Create a new project:
   - Project name: `millions-before-19`
   - Password: (save it)
   - Region: Choose closest to you

---

## Step 2: Create Database Tables

Once your project is ready, go to **SQL Editor** and run this query:

```sql
-- Create user_data table
CREATE TABLE user_data (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  tasks JSONB DEFAULT '[]',
  habits JSONB DEFAULT '[]',
  wins JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{"soundEnabled": true}',
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_timestamp BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create health table (for connection testing)
CREATE TABLE health (
  id BIGSERIAL PRIMARY KEY,
  status TEXT DEFAULT 'ok',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test record
INSERT INTO health (status) VALUES ('ok');

-- Create indexes for performance
CREATE INDEX idx_user_data_user_id ON user_data(user_id);
CREATE INDEX idx_user_data_updated ON user_data(updated_at);

-- Enable RLS (Row Level Security)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE health ENABLE ROW LEVEL SECURITY;

-- Create policies (allow anonymous access for testing)
CREATE POLICY "Allow all operations for testing" ON user_data
  AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read health" ON health
  AS PERMISSIVE FOR SELECT USING (true);
```

---

## Step 3: Get API Keys

1. Go to **Project Settings** (gear icon)
2. Click **API** in sidebar
3. Copy:
   - **Project URL** (Supabase URL)
   - **anon public** key (API Key)

---

## Step 4: Configure Your App

1. Open `script.js`
2. Find these lines (around line 10-11):
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_KEY = 'your-anon-key';
   ```

3. Replace with your actual values:
   ```javascript
   const SUPABASE_URL = '';
   const SUPABASE_KEY = 'c';
   ```

---

## Step 5: Test the Connection

1. Open your app in browser
2. Open **Developer Console** (F12)
3. You should see:
   - ✓ Connected to Supabase
   - ✓ Data synced to Supabase

4. Or if not configured:
   - 📱 Running offline mode - local storage only

---

## Features

### Auto-Save
- Every action (task, habit, win) auto-saves
- Syncs to cloud every 5 minutes
- Instant local save (no waiting)

### Manual Sync
- Settings tab → "Sync Now" button
- See last sync time

### Data Integrity
- **Timestamps**: All data includes sync times
- **Fallback**: Works offline, syncs when online
- **No Data Loss**: Local storage is always primary

### Multi-Device Sync
Once configured, you can:
- Open app on different devices
- Use same user_id
- All devices stay in sync

---

## Offline Mode

If Supabase isn't configured:
- App uses localStorage only
- No cloud backup
- All data saved locally
- Perfect for testing

---

## Database Schema

### user_data table
```
user_id (TEXT) - Unique identifier
tasks (JSONB) - Array of task objects
habits (JSONB) - Array of habit objects
wins (JSONB) - Array of win objects
preferences (JSONB) - { soundEnabled: bool }
last_synced (TIMESTAMP) - When data was last synced
device_timestamp (BIGINT) - Client-side timestamp
created_at (TIMESTAMP) - Row creation time
updated_at (TIMESTAMP) - Last modification time
```

---

## Advanced: Production Setup

### Security (RLS Policies)
For production, update security policies:

```sql
-- Example: Only user can access their data
CREATE POLICY "Users can only access their own data" ON user_data
  AS PERMISSIVE FOR ALL
  USING (user_id = current_setting('app.user_id'))
  WITH CHECK (user_id = current_setting('app.user_id'));
```

### Backups
Supabase automatically backs up your data daily on Pro plan.

---

## Troubleshooting

### "Supabase not configured"
- Check API keys are correct
- No spaces or special characters
- Copy directly from Supabase dashboard

### "Sync failed"
- Check internet connection
- Verify credentials are correct
- Check browser console for errors

### Data not syncing
- App will work offline anyway
- Check Settings → "Sync Now"
- Reload page to retry

---

## Local Storage Backup

Even without Supabase, your data is saved locally:

```javascript
// View your data in browser console:
JSON.parse(localStorage.getItem('millions-data'))

// Export it:
const data = JSON.parse(localStorage.getItem('millions-data'));
console.log(JSON.stringify(data, null, 2));
```

---

## Questions?

- Check Supabase docs: https://supabase.com/docs
- Enable RLS after testing
- Start with free tier (plenty for your needs)

---

**Version**: 1.1  
**Last Updated**: April 28, 2026
