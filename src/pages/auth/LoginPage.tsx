import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { getDefaultDashboardPath } from '../../lib/permissions';
import {
  Shield,
  School,
  BookOpen,
  GraduationCap,
  Users,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsRole } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('teacher@lumeneios.demo');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');

  const demoAccounts: Array<{
    role: Role;
    name: string;
    email: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      role: 'admin',
      name: 'Dr. Rajesh Sharma',
      email: 'admin@lumeneios.demo',
      title: 'Platform Administrator',
      description: 'State-wide governance, 5 affiliated campuses, infrastructure tier telemetry.',
      icon: <Shield className="w-5 h-5 text-indigo-600" />,
      color: 'hover:border-indigo-500 hover:bg-indigo-50/30',
    },
    {
      role: 'principal',
      name: 'Dr. Sunita Deshmukh',
      email: 'principal@lumeneios.demo',
      title: 'School Principal (Sunrise Public)',
      description: 'Campus benchmark oversight, faculty assignments, and lost teaching-day audits.',
      icon: <School className="w-5 h-5 text-teal-600" />,
      color: 'hover:border-teal-500 hover:bg-teal-50/30',
    },
    {
      role: 'teacher',
      name: 'Vikram Sengupta',
      email: 'teacher@lumeneios.demo',
      title: 'Lead Educator (Grade 8 Math & Science)',
      description: '180-day micro-curriculum, Time-Aware compacting, VARK lessons & OCR scan grading.',
      icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
      color: 'hover:border-emerald-500 hover:bg-emerald-50/30 ring-2 ring-emerald-500/20 border-emerald-400',
    },
    {
      role: 'student',
      name: 'Aarav Patel',
      email: 'student@lumeneios.demo',
      title: 'Student (Class 8-A)',
      description: 'Personalized learning mission, interactive practice quizzes, and LU/CU/AU/CT mastery.',
      icon: <GraduationCap className="w-5 h-5 text-sky-600" />,
      color: 'hover:border-sky-500 hover:bg-sky-50/30',
    },
    {
      role: 'parent',
      name: 'Meera Patel',
      email: 'parent@lumeneios.demo',
      title: 'Parent (Linked to Aarav & Ananya)',
      description: 'Transparent competency growth, teacher feedback, and supportive home guidance.',
      icon: <Users className="w-5 h-5 text-amber-600" />,
      color: 'hover:border-amber-500 hover:bg-amber-50/30',
    },
  ];

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(email);
    if (success) {
      const matched = demoAccounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      const role = matched ? matched.role : 'teacher';
      navigate(getDefaultDashboardPath(role));
    } else {
      setError('Invalid credentials. Please click one of the pre-configured demo personas below.');
    }
  };

  const handleQuickLogin = (acc: typeof demoAccounts[0]) => {
    loginAsRole(acc.role);
    navigate(getDefaultDashboardPath(acc.role));
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500 text-navy-950 font-black text-2xl shadow-card mb-4">
          L
        </div>
        <h1 className="text-3xl font-extrabold text-navy-800 tracking-tight">
          Lumen<span className="text-teal-600">EIOS</span>
        </h1>
        <p className="mt-1 text-sm font-medium text-content-secondary">
          Adaptive EdTech Ecosystem • Aligned with NEP 2020 Competency Standards
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-card border border-surface-border">
          {/* Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-content-primary mb-1">
                Demo Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-content-muted absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface-bg/40 border border-surface-border rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  placeholder="e.g. teacher@lumeneios.demo"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-primary mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-content-muted absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface-bg/40 border border-surface-border rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  placeholder="demo123"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-navy-800 hover:bg-navy-900 active:bg-navy-950 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick 1-Click Persona Chooser */}
          <div className="mt-8 pt-6 border-t border-surface-border">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>1-Click Stakeholder Demonstrations</span>
              </span>
              <span className="text-[11px] text-content-muted font-mono">Password: demo123</span>
            </div>

            <div className="space-y-2.5">
              {demoAccounts.map((acc) => (
                <div
                  key={acc.role}
                  onClick={() => handleQuickLogin(acc)}
                  className={`p-3 rounded-xl border border-surface-border transition-all cursor-pointer flex items-center justify-between group ${acc.color}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-surface-border shadow-xs">
                      {acc.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-content-primary">
                          {acc.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-xs text-content-secondary line-clamp-1">{acc.description}</p>
                      <p className="text-[10px] text-content-muted font-mono mt-0.5">{acc.email}</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-xs font-semibold text-navy-800 bg-white border border-surface-border rounded-lg group-hover:bg-navy-800 group-hover:text-white transition-colors shrink-0 shadow-xs">
                    Login as {acc.role}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NEP 2020 pedagogical footnote */}
        <div className="mt-6 text-center text-xs text-content-secondary">
          <p>
            LumenEIOS incorporates Time-Aware Syllabus Compacting, protecting foundational concept mastery
            when teaching days are lost to public duties.
          </p>
        </div>
      </div>
    </div>
  );
};

