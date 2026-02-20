import { Shell, Card, LinkA } from '@/components/Shell';
import { FriendTrackerClient } from './FriendTrackerClient';
import { dbExec, dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'friend-tracker';

interface Meeting {
  id: number;
  date: string;
  friend_names: string;
  location: string | null;
  image_path: string | null;
  notes: string | null;
  created_at: string;
}

interface Friend {
  id: number;
  name: string;
  meet_count: number;
  last_met_at: string | null;
}

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      friend_names TEXT NOT NULL,
      location TEXT,
      image_path TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
  
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      meet_count INTEGER DEFAULT 1,
      last_met_at TEXT,
      created_at TEXT NOT NULL
    )`
  );
  
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)`);
}

async function fetchData() {
  ensureSchema();
  
  const meetings = dbQuery<Meeting>(
    APP_ID,
    `SELECT id, date, friend_names, location, image_path, notes, created_at 
     FROM meetings 
     ORDER BY date DESC, created_at DESC 
     LIMIT 200`
  );
  
  const friends = dbQuery<Friend>(
    APP_ID,
    `SELECT id, name, meet_count, last_met_at 
     FROM friends 
     ORDER BY meet_count DESC, last_met_at DESC`
  );
  
  // Serialize to handle BigInt
  return {
    meetings: JSON.parse(JSON.stringify(meetings, (k, v) => typeof v === 'bigint' ? Number(v) : v)),
    friends: JSON.parse(JSON.stringify(friends, (k, v) => typeof v === 'bigint' ? Number(v) : v))
  };
}

export default async function FriendTrackerPage() {
  const data = await fetchData();
  
  return (
    <Shell title="Friend Tracker" subtitle="Log and remember every time you meet your friends.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.meetings.length} meetings · {data.friends.length} friends</div>
      </div>
      
      <FriendTrackerClient 
        initialMeetings={data.meetings} 
        initialFriends={data.friends}
      />
    </Shell>
  );
}
