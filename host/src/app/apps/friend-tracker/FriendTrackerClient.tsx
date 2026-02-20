'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Card, Input, Label } from '@/components/Shell';

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

export function FriendTrackerClient({ 
  initialMeetings, 
  initialFriends 
}: { 
  initialMeetings: Meeting[];
  initialFriends: Friend[];
}) {
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [friendNames, setFriendNames] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    
    // Upload
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      
      const res = await fetch('/api/apps/friend-tracker/photo', {
        method: 'POST',
        body: fd
      });
      
      const data = await res.json();
      if (data.ok) {
        setImagePath(data.path);
      } else {
        alert(data.error || 'Upload failed');
        setImagePreview(null);
      }
    } catch (err) {
      alert('Failed to upload image');
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendNames.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/apps/friend-tracker/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          friendNames: friendNames.trim(),
          location: location.trim() || null,
          notes: notes.trim() || null,
          imagePath
        })
      });
      
      const data = await res.json();
      if (data.ok) {
        // Add to list
        setMeetings(prev => [data.meeting, ...prev]);
        
        // Reset form
        setDate(new Date().toISOString().split('T')[0]);
        setFriendNames('');
        setLocation('');
        setNotes('');
        setImagePath(null);
        setImagePreview(null);
        
        // Refresh friends list
        const friendsRes = await fetch('/api/apps/friend-tracker/meetings');
        const friendsData = await friendsRes.json();
        if (friendsData.ok) {
          setFriends(friendsData.friends);
        }
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (err) {
      alert('Failed to save meeting');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this meeting?')) return;
    try {
      const res = await fetch(`/api/apps/friend-tracker/meetings/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m.id !== id));
      }
    } catch (e) {
      alert('Failed to delete');
    }
  };
  
  const quickAddToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
    // Focus the friend names input
    document.getElementById('friend-names')?.focus();
  };
  
  // Group meetings by month for display
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const month = new Date(meeting.date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);
  
  return (
    <div className="grid gap-6">
      {/* Quick Add Button */}
      <div className="flex gap-2">
        <Button onClick={quickAddToday} variant="secondary">
          📅 Met Today
        </Button>
      </div>
      
      {/* Add Meeting Form */}
      <Card>
        <h2 className="text-sm font-semibold text-zinc-900">Log a Meeting</h2>
        
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Date *</Label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                required
              />
            </div>
            
            <div>
              <Label>Friend(s) * (comma-separated)</Label>
              <input
                id="friend-names"
                type="text"
                value={friendNames}
                onChange={e => setFriendNames(e.target.value)}
                placeholder="Alice, Bob, Charlie"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                list="friend-suggestions"
                required
              />
              <datalist id="friend-suggestions">
                {friends.map(f => (
                  <option key={f.id} value={f.name} />
                ))}
              </datalist>
            </div>
          </div>
          
          <div>
            <Label>Location (optional)</Label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Coffee shop, park, etc."
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <Label>Photo (optional)</Label>
            <div className="mt-1 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? 'Uploading...' : '📷 Add Photo'}
              </Button>
              
              {imagePreview && (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImagePath(null);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label>Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="What did you do? How was it?"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          
          <Button type="submit" disabled={saving || !friendNames.trim()}>
            {saving ? 'Saving...' : 'Log Meeting'}
          </Button>
        </form>
      </Card>
      
      {/* Friends Summary */}
      {friends.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900">Your Friends</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {friends.slice(0, 20).map(friend => (
              <button
                key={friend.id}
                onClick={() => setFriendNames(prev => 
                  prev ? `${prev}, ${friend.name}` : friend.name
                )}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm transition"
              >
                <span>{friend.name}</span>
                <span className="text-xs text-zinc-500">({friend.meet_count}x)</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      
      {/* Meetings List */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Meeting History</h2>
        
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No meetings yet. Log your first one above! 👆</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {Object.entries(groupedMeetings).map(([month, monthMeetings]) => (
              <div key={month}>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">{month}</h3>
                <div className="grid gap-2">
                  {monthMeetings.map(meeting => (
                    <div 
                      key={meeting.id} 
                      className="rounded-xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900">{meeting.friend_names}</span>
                            <span className="text-xs text-zinc-500">
                              {new Date(meeting.date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                          
                          {meeting.location && (
                            <div className="text-sm text-zinc-600 mt-1">📍 {meeting.location}</div>
                          )}
                          
                          {meeting.notes && (
                            <div className="text-sm text-zinc-600 mt-1">{meeting.notes}</div>
                          )}
                          
                          {meeting.image_path && (
                            <img 
                              src={meeting.image_path} 
                              alt="Meeting" 
                              className="mt-2 h-32 w-auto rounded-lg object-cover"
                            />
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleDelete(meeting.id)}
                          className="text-xs text-red-600 hover:text-red-700 px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
