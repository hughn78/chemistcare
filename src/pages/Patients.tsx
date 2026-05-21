import { useState, useMemo, useEffect } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TagInput, parseTagString, tagsToString } from '@/components/ui/tag-input';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Search, Pencil, Trash2, Inbox } from 'lucide-react';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  medicare: string;
  lastVisit: string;
  conditions: string[];
}

const INITIAL_PATIENTS: Patient[] = [
  { id: '1', firstName: 'Sarah', lastName: 'Mitchell', dateOfBirth: '1985-03-14', sex: 'female', phone: '0412 345 678', medicare: '2345 67890 1', lastVisit: '2026-02-28', conditions: ['UTI'] },
  { id: '2', firstName: 'James', lastName: 'Chen', dateOfBirth: '1972-08-22', sex: 'male', phone: '0423 456 789', medicare: '3456 78901 2', lastVisit: '2026-02-25', conditions: ['Hypertension', 'T2DM'] },
  { id: '3', firstName: 'Emily', lastName: "O'Brien", dateOfBirth: '1990-11-05', sex: 'female', phone: '0434 567 890', medicare: '4567 89012 3', lastVisit: '2026-02-20', conditions: ['OCP Resupply'] },
];

function fuzzyMatch(query: string, ...fields: string[]): boolean {
  const q = query.toLowerCase().replace(/\s+/g, '');
  return fields.some(f => {
    const field = (f || '').toLowerCase().replace(/\s+/g, '');
    if (field.includes(q)) return true;
    let qi = 0;
    for (let i = 0; i < field.length && qi < q.length; i++) {
      if (field[i] === q[qi]) qi++;
    }
    return qi === q.length;
  });
}

const emptyForm = (): Omit<Patient, 'id' | 'lastVisit'> => ({
  firstName: '', lastName: '', dateOfBirth: '', sex: '', phone: '', medicare: '', conditions: [],
});

const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Edit/Add dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState(emptyForm());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    return patients.filter(p =>
      fuzzyMatch(search, p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.dateOfBirth, p.phone || '', p.medicare || '')
    );
  }, [search, patients]);

  const duplicateWarning = useMemo(() => {
    if (!search.trim() || filtered.length <= 1) return null;
    const names = filtered.map(p => `${p.firstName} ${p.lastName}`.toLowerCase());
    const dups = names.filter((n, i) => names.indexOf(n) !== i);
    return dups.length > 0 ? 'Possible duplicate patients detected' : null;
  }, [search, filtered]);

  const openAdd = () => {
    setEditingPatient(null);
    setForm(emptyForm());
    setEditDialogOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditingPatient(p);
    setForm({ firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, sex: p.sex, phone: p.phone, medicare: p.medicare, conditions: [...p.conditions] });
    setEditDialogOpen(true);
  };

  const openDelete = (p: Patient) => {
    setDeletingPatient(p);
    setDeleteDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: 'Validation Error', description: 'First and last name are required.', variant: 'destructive' });
      return;
    }

    if (editingPatient) {
      setPatients(prev => prev.map(p => p.id === editingPatient.id ? { ...p, ...form } : p));
      toast({ title: 'Patient Updated', description: `${form.firstName} ${form.lastName} has been updated.` });
    } else {
      const newPatient: Patient = {
        id: crypto.randomUUID(),
        ...form,
        lastVisit: new Date().toISOString().slice(0, 10),
      };
      setPatients(prev => [newPatient, ...prev]);
      toast({ title: 'Patient Added', description: `${form.firstName} ${form.lastName} has been added.` });
    }
    setEditDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingPatient) return;
    setPatients(prev => prev.filter(p => p.id !== deletingPatient.id));
    toast({ title: 'Patient Deleted', description: `${deletingPatient.firstName} ${deletingPatient.lastName} has been removed.` });
    setDeleteDialogOpen(false);
    setDeletingPatient(null);
  };

  const updateForm = (key: keyof typeof form, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <ClinicalLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1>Patients</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage patient profiles and consultation history</p>
          </div>
          <Button className="gap-2" onClick={openAdd}>
            <UserPlus className="h-4 w-4" /> Add Patient
          </Button>
        </div>

        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, DOB, Medicare, or phone..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {duplicateWarning && (
          <div className="text-xs px-3 py-2 rounded-md bg-clinical-warning-bg" style={{ color: 'hsl(var(--clinical-warning))' }}>
            ⚠ {duplicateWarning}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState message="No patients matching your search." />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">DOB: {p.dateOfBirth} · {p.sex} · Medicare: {p.medicare}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 hidden sm:flex">
                      {p.conditions.map(c => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">Last: {p.lastVisit}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPatient ? 'Edit Patient' : 'Add Patient'}</DialogTitle>
            <DialogDescription>
              {editingPatient ? 'Update patient details below.' : 'Enter the new patient\'s details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={form.dateOfBirth} onChange={e => updateForm('dateOfBirth', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sex">Sex</Label>
                <Select value={form.sex} onValueChange={v => updateForm('sex', v)}>
                  <SelectTrigger id="sex"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medicare">Medicare Number</Label>
                <Input id="medicare" value={form.medicare} onChange={e => updateForm('medicare', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Conditions</Label>
              <TagInput
                value={form.conditions}
                onChange={(tags) => updateForm('conditions', tags)}
                placeholder="Type a condition and press Enter..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPatient ? 'Save Changes' : 'Add Patient'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deletingPatient?.firstName} {deletingPatient?.lastName}</span>? This action cannot be undone and all associated consultation records may become orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClinicalLayout>
  );
};

export default Patients;
