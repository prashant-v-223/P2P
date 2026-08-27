import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, User } from 'lucide-react';
import { registerUser } from './authSlice';
import AuthShell from './AuthShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { FieldError } from '../../components/ui/field-error';
import { useToast } from '../../components/ui/toast';

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: 'Procurement' });
  const [departments, setDepartments] = useState(['Procurement', 'Finance & Accounts', 'EXIM & Logistics', 'Supply Chain', 'IT Operations', 'Executive Management']);
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    fetch('/api/departments')
      .then((res) => res.json())
      .then((data) => {
        const depts = data.departmentNames || (data.departments || []).map((d) => d.name);
        if (depts && depts.length > 0) {
          setDepartments(depts);
          if (!form.department || !depts.includes(form.department)) {
            setForm((prev) => ({ ...prev, department: depts[0] }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Enter at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (!form.department) nextErrors.department = 'Select a department.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ type: 'error', title: 'Check the highlighted fields', description: 'Some account details are missing or invalid.' });
      return;
    }
    dispatch(registerUser({ ...form, role: 'Procurement Head' })).unwrap().then(() => {
      showToast({ title: 'Account created', description: 'Welcome to Rayzon P2P.' });
      navigate('/dashboard');
    }).catch((message) => showToast({ type: 'error', title: 'Registration failed', description: String(message) }));
  };

  return (
    <AuthShell title="Create your account" description="Use your official Rayzon details.">
      {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">{error}</div>}
      <form noValidate onSubmit={submit} className="space-y-3.5">
        {[
          ['name', 'Full name', 'text', User, 'Ramesh Patel'],
          ['email', 'Work email', 'email', Mail, 'ramesh@rayzon.one'],
          ['password', 'Password', 'password', Lock, 'Minimum 8 characters']
        ].map(([key, label, type, Icon, placeholder]) => (
          <label key={key} className="block text-sm font-semibold text-slate-700">{label} <span className="text-rose-500" aria-hidden="true">*</span>
            <div className="relative mt-2"><Icon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><Input type={type} className={`pl-10 ${errors[key] ? 'border-rose-400' : ''}`} minLength={key === 'password' ? 8 : undefined} maxLength={key === 'name' ? 80 : key === 'email' ? 120 : 128} autoComplete={key === 'password' ? 'new-password' : key} placeholder={placeholder} value={form[key]} onChange={(event) => { set(key)(event); setErrors({ ...errors, [key]: '' }); }} /></div><FieldError>{errors[key]}</FieldError>
          </label>
        ))}
        <label className="block text-sm font-semibold text-slate-700">Department <span className="text-rose-500" aria-hidden="true">*</span>
          <div className="relative mt-2"><Building2 className="pointer-events-none absolute left-3.5 top-3.5 z-10 h-4 w-4 text-slate-400" /><div className="[&_button:first-child]:pl-10"><SearchableSelect value={form.department} onChange={(value) => { setForm({ ...form, department: value }); setErrors({ ...errors, department: '' }); }} error={errors.department} options={departments} searchPlaceholder="Search departments..." /></div></div>
        </label>
        <Button size="lg" className="mt-2 w-full" loading={loading}>Create account</Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-900">Sign in</Link></p>
    </AuthShell>
  );
}
