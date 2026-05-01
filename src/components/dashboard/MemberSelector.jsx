import React, { useEffect, useState } from 'react';
import { User, Plus, Users, Loader2 } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { getMembers, addMember } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function MemberSelector() {
  const { user, token, members, setMembers, selectedMemberId, setSelectedMemberId } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newRelation, setNewRelation] = useState('Self');

  useEffect(() => {
    // Only fetch if we have a token, no members, and aren't already loading
    if (token && members.length === 0 && !loading) {
      fetchMembers();
    }
  }, [token]); // Keep token as primary trigger, but check members/loading inside

  const fetchMembers = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMembers();
      setMembers(data || []);
      if (data && data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setError('Could not load family members.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newName || !newAge) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await addMember({
        name: newName,
        age: parseInt(newAge) || 0,
        relation: newRelation
      });
      
      const updatedMembers = [...members, data];
      setMembers(updatedMembers);
      setSelectedMemberId(data.id);
      setShowAddForm(false);
      setNewName('');
      setNewAge('');
    } catch (error) {
      console.error('Failed to add member:', error);
      setError(error.response?.data?.detail || 'Failed to add family member.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mb-6 p-4 glass-card border-primary/20 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
          <Users className="w-4 h-4" />
          Select Family Member
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs h-8"
        >
          {showAddForm ? 'Cancel' : <><Plus className="w-3 h-3 mr-1" /> Add Member</>}
        </Button>
      </div>

      {showAddForm ? (
        <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input 
            placeholder="Name" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            required 
            className="h-9 text-sm"
          />
          <Input 
            placeholder="Age" 
            type="number" 
            value={newAge} 
            onChange={(e) => setNewAge(e.target.value)} 
            required 
            className="h-9 text-sm"
          />
          <select 
            value={newRelation} 
            onChange={(e) => setNewRelation(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option>Self</option>
            <option>Father</option>
            <option>Mother</option>
            <option>Spouse</option>
            <option>Child</option>
            <option>Sibling</option>
            <option>Other</option>
          </select>
          <Button type="submit" size="sm" disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
          {error && (
            <div className="col-span-1 md:col-span-4 text-xs text-destructive mt-1">
              {error}
            </div>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {loading && members.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading members...
            </div>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${
                  selectedMemberId === member.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground'
                }`}
              >
                <User className="w-3 h-3" />
                {member.name} ({member.relation})
              </button>
            ))
          )}
          {members.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground italic">No members added yet. Add yourself first!</p>
          )}
        </div>
      )}
    </div>
  );
}
