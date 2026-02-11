import { useState } from 'react';

const PatientProfile = () => {
  const [doctorAccess, setDoctorAccess] = useState({
    drChen: true,
    drRodriguez: true,
    drWatson: false,
    drPark: true,
  });

  const toggleAccess = (doctor: keyof typeof doctorAccess) => {
    setDoctorAccess(prev => ({ ...prev, [doctor]: !prev[doctor] }));
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Title Section */}
        <div className="mb-8 flex items-start justify-between" data-reveal>
          <div>
            <h2 className="text-2xl font-display font-semibold text-white mb-1">Patient Digital Twin</h2>
            <p className="text-white/60">360-degree view of medical history</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-medium">Blockchain Secured</span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patient Info */}
          <div
            className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
            data-reveal
          >
            {/* Patient Avatar and Name */}
            <div className="flex flex-col items-center mb-6 pb-6 border-b border-white/10">
              <div className="w-16 h-16 bg-[color:var(--agent-accent)] rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-[color:var(--agent-on-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Sarah Johnson</h3>
              <p className="text-sm text-white/60">Patient ID: P-2847</p>
            </div>

            {/* Patient Details */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white/40 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-xs text-white/50">Date of Birth</p>
                  <p className="text-sm font-semibold text-white">March 15, 1985 (40y)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white/40 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-xs text-white/50">Location</p>
                  <p className="text-sm font-semibold text-white">San Francisco, CA</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white/40 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="text-xs text-white/50">Contact</p>
                  <p className="text-sm font-semibold text-white">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white/40 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-xs text-white/50">Email</p>
                  <p className="text-sm font-semibold text-white">sarah.j@email.com</p>
                </div>
              </div>
            </div>

            {/* Decision Tree Health Summary */}
            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[color:var(--agent-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <h4 className="font-semibold text-white">Decision Tree Health Summary</h4>
              </div>
              <ul className="space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--agent-accent)] mt-1">•</span>
                  <span>Overall health status: Good. No critical conditions detected.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--agent-accent)] mt-1">•</span>
                  <span>Previous surgical history reviewed. Recovery complete.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--agent-accent)] mt-1">•</span>
                  <span>Recommended annual cardiovascular screening due in 3 months.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Center Column - Interactive Body Map */}
          <div
            className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
            data-reveal
          >
            <h3 className="text-lg font-semibold text-white mb-2">Interactive Body Map</h3>
            <p className="text-sm text-white/60 mb-8">Click on body parts to view medical history</p>
            
            {/* Body Map Illustration */}
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
              <svg viewBox="0 0 200 300" className="w-full max-w-xs">
                {/* Head */}
                <circle cx="100" cy="40" r="25" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Body */}
                <rect x="75" y="65" width="50" height="80" rx="10" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Arms */}
                <circle cx="50" cy="90" r="15" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                <circle cx="150" cy="90" r="15" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Hands */}
                <circle cx="30" cy="120" r="12" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                <circle cx="170" cy="120" r="12" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Legs */}
                <circle cx="85" cy="180" r="15" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                <circle cx="115" cy="180" r="15" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Feet */}
                <circle cx="75" cy="230" r="14" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                <circle cx="125" cy="230" r="14" fill="#10b981" stroke="#059669" strokeWidth="3" className="cursor-pointer hover:opacity-80 transition" />
                
                {/* Lines connecting body parts */}
                <line x1="50" y1="90" x2="75" y2="80" stroke="#059669" strokeWidth="2" />
                <line x1="150" y1="90" x2="125" y2="80" stroke="#059669" strokeWidth="2" />
                <line x1="30" y1="120" x2="50" y2="100" stroke="#059669" strokeWidth="2" />
                <line x1="170" y1="120" x2="150" y2="100" stroke="#059669" strokeWidth="2" />
                <line x1="85" y1="180" x2="85" y2="145" stroke="#059669" strokeWidth="2" />
                <line x1="115" y1="180" x2="115" y2="145" stroke="#059669" strokeWidth="2" />
                <line x1="75" y1="230" x2="85" y2="195" stroke="#059669" strokeWidth="2" />
                <line x1="125" y1="230" x2="115" y2="195" stroke="#059669" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Right Column - Smart Contract Access */}
          <div
            className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
            data-reveal
          >
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-lg font-semibold text-white">Smart Contract Access</h3>
            </div>
            <p className="text-sm text-white/60 mb-6">Control who can access your medical records via blockchain smart contracts</p>

            {/* Doctor Access List */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <p className="font-semibold text-white">Dr. Sarah Chen</p>
                  <p className="text-sm text-white/60">Cardiology</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <button
                    onClick={() => toggleAccess('drChen')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      doctorAccess.drChen ? 'bg-[color:var(--agent-accent)]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        doctorAccess.drChen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <p className="font-semibold text-white">Dr. Michael Rodriguez</p>
                  <p className="text-sm text-white/60">Orthopedics</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <button
                    onClick={() => toggleAccess('drRodriguez')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      doctorAccess.drRodriguez ? 'bg-[color:var(--agent-accent)]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        doctorAccess.drRodriguez ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <p className="font-semibold text-white">Dr. Emily Watson</p>
                  <p className="text-sm text-white/60">Neurology</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <button
                    onClick={() => toggleAccess('drWatson')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      doctorAccess.drWatson ? 'bg-[color:var(--agent-accent)]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        doctorAccess.drWatson ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <p className="font-semibold text-white">Dr. James Park</p>
                  <p className="text-sm text-white/60">General Practice</p>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <button
                    onClick={() => toggleAccess('drPark')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      doctorAccess.drPark ? 'bg-[color:var(--agent-accent)]' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        doctorAccess.drPark ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Blockchain Notice */}
            <div className="rounded-2xl border border-white/10 border-l-4 border-[color:var(--agent-accent)] bg-white/5 p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[color:var(--agent-accent)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-white/70">
                  All access changes are recorded on the blockchain and cannot be altered retroactively.
                </p>
              </div>
            </div>

            {/* Recent Access Log */}
            <div>
              <h4 className="font-semibold text-white mb-4">Recent Access Log</h4>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-semibold text-white">Dr. Sarah Chen</p>
                  <p className="text-white/60">Viewed ECG Results • 2h ago</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white">Dr. James Park</p>
                  <p className="text-white/60">Updated Medication • 5h ago</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white">Dr. Michael Rodriguez</p>
                  <p className="text-white/60">Reviewed X-Rays • 1d ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
