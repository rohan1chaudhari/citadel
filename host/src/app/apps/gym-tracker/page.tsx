'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface Entry {
  id: number;
  date: string | null;
  exercise: string;
  exercise_id: number | null;
  category: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
}

interface Exercise {
  id: number;
  name: string;
  category: string | null;
}

export default function GymTrackerPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  
  // Form state
  const [date, setDate] = useState('');
  const [exercise, setExercise] = useState('');
  const [category, setCategory] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [notes, setNotes] = useState('');
  
  // Autocomplete state
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categories = ['push', 'pull', 'legs', 'cardio', 'core', 'other'];

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/apps/gym-tracker/entries');
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries || []);
        setExercises(data.exercises || []);
        setRecentExercises(data.recentExercises || []);
      }
    } catch (e) {
      console.error('Failed to fetch entries:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Set default date to today
    setDate(new Date().toISOString().split('T')[0]);
  }, [fetchData]);

  // Handle exercise input change with autocomplete
  useEffect(() => {
    if (!exercise.trim()) {
      // Show recent/popular exercises when empty
      setFilteredExercises(
        exercises
          .sort((a, b) => {
            const aRecent = recentExercises.indexOf(a.name);
            const bRecent = recentExercises.indexOf(b.name);
            if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
            if (aRecent !== -1) return -1;
            if (bRecent !== -1) return 1;
            return a.name.localeCompare(b.name);
          })
          .slice(0, 8)
      );
      return;
    }

    const query = exercise.toLowerCase();
    const filtered = exercises
      .filter(ex => ex.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
    
    setFilteredExercises(filtered);
  }, [exercise, exercises, recentExercises]);

  // Handle clicks outside dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExerciseSelect = (selected: Exercise) => {
    setExercise(selected.name);
    if (selected.category) setCategory(selected.category);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => 
        i < filteredExercises.length - 1 ? i + 1 : i
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredExercises[highlightedIndex]) {
        handleExerciseSelect(filteredExercises[highlightedIndex]);
      } else {
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/apps/gym-tracker/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          exercise: exercise.trim(),
          category: category || null,
          sets: sets ? Number(sets) : null,
          reps: reps ? Number(reps) : null,
          weight: weight ? Number(weight) : null,
          rpe: rpe ? Number(rpe) : null,
          notes: notes || null
        })
      });

      const data = await res.json();
      if (data.ok) {
        // Show toast for new exercise
        if (data.isNewExercise) {
          setToast({ message: `New exercise added: ${data.exercise}`, type: 'success' });
        } else {
          setToast({ message: `Entry saved: ${data.exercise}`, type: 'info' });
        }
        
        // Reset form except date
        setExercise('');
        setCategory('');
        setSets('');
        setReps('');
        setWeight('');
        setRpe('');
        setNotes('');
        
        // Refresh entries
        fetchData();
        
        // Clear toast after 3s
        setTimeout(() => setToast(null), 3000);
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (err) {
      alert('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    try {
      const res = await fetch(`/api/apps/gym-tracker/entries/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      alert('Failed to delete');
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Gym Tracker</h1>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            padding: '12px 20px',
            borderRadius: 8,
            background: toast.type === 'success' ? '#22c55e' : '#3b82f6',
            color: 'white',
            fontWeight: 500,
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease'
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Entry Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <div style={{ 
          display: 'grid', 
          gap: 16, 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          marginBottom: 16
        }}>
          <div>
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label>Exercise *</label>
            <input
              ref={inputRef}
              type="text"
              value={exercise}
              onChange={e => {
                setExercise(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type to search..."
              style={{ width: '100%', padding: 8 }}
              required
            />
            
            {/* Autocomplete Dropdown */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  marginTop: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                {filteredExercises.length === 0 ? (
                  <div style={{ padding: 12, color: '#666', fontSize: 14 }}>
                    {exercise.trim() 
                      ? `Press Enter to add "${exercise}" as new exercise` 
                      : 'Start typing to search exercises'}
                  </div>
                ) : (
                  filteredExercises.map((ex, idx) => (
                    <div
                      key={ex.id}
                      onClick={() => handleExerciseSelect(ex)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: idx === highlightedIndex ? '#f3f4f6' : 'transparent',
                        borderBottom: '1px solid #f0f0f0'
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <div style={{ fontWeight: 500 }}>{ex.name}</div>
                      {ex.category && (
                        <div style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>
                          {ex.category}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">Select...</option>
              {categories.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Sets</label>
            <input
              type="number"
              value={sets}
              onChange={e => setSets(e.target.value)}
              min="1"
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div>
            <label>Reps</label>
            <input
              type="number"
              value={reps}
              onChange={e => setReps(e.target.value)}
              min="1"
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div>
            <label>Weight (kg)</label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              min="0"
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div>
            <label>RPE (1-10)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="10"
              value={rpe}
              onChange={e => setRpe(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 8 }}
            placeholder="Optional notes..."
          />
        </div>

        <button
          type="submit"
          disabled={saving || !exercise.trim()}
          style={{
            padding: '12px 24px',
            background: saving ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 500
          }}
        >
          {saving ? 'Saving...' : 'Add Entry'}
        </button>
      </form>

      {/* Entries List */}
      <h2>Recent Entries</h2>
      {entries.length === 0 ? (
        <p style={{ color: '#666' }}>No entries yet. Add your first workout above!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(entry => (
            <div
              key={entry.id}
              style={{
                padding: 16,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#fafafa'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {entry.exercise}
                    {entry.category && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '2px 8px',
                          background: '#e5e7eb',
                          borderRadius: 4,
                          fontSize: 12,
                          textTransform: 'capitalize'
                        }}
                      >
                        {entry.category}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, color: '#666', fontSize: 14 }}>
                    {entry.date || new Date(entry.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{
                    padding: '4px 12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Delete
                </button>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: 16, 
                marginTop: 12,
                fontSize: 14 
              }}>
                {entry.sets && (
                  <span><strong>{entry.sets}</strong> sets</span>
                )}
                {entry.reps && (
                  <span><strong>{entry.reps}</strong> reps</span>
                )}
                {entry.weight && (
                  <span><strong>{entry.weight}kg</strong></span>
                )}
                {entry.rpe && (
                  <span>RPE <strong>{entry.rpe}</strong></span>
                )}
              </div>
              
              {entry.notes && (
                <div style={{ marginTop: 8, color: '#666', fontSize: 14 }}>
                  {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}