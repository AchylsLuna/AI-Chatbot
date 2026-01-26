import { useState } from 'react';

type Message = {
  id: string;
  text: string;
  sender: 'ai' | 'user';
  timestamp: string;
};

const Dashboard = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI healthcare assistant. I can help you with patient diagnostics, blockchain verification, network insights, and predictive analytics. How can I assist you today?",
      sender: 'ai',
      timestamp: '09:51 PM'
    }
  ]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: chatInput,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I understand your inquiry. Let me analyze that for you. This is a simulated response for demonstration purposes.",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Title Section */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Smart Health Dashboard</h2>
            <p className="text-gray-500">Real-time healthcare intelligence powered by AI and blockchain</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">All Systems Operational</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Patients */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Patients</p>
                <p className="text-3xl font-bold text-gray-900">1,247</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-green-600 font-medium">+12%</span>
            </div>
          </div>

          {/* Active Beds */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Active Beds</p>
                <p className="text-3xl font-bold text-gray-900">89%</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-green-600 font-medium">+5%</span>
            </div>
          </div>

          {/* Critical Cases */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Critical Cases</p>
                <p className="text-3xl font-bold text-gray-900">12</p>
              </div>
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-red-600 font-medium">-3</span>
            </div>
          </div>

          {/* Efficiency */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Efficiency</p>
                <p className="text-3xl font-bold text-gray-900">94%</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-green-600 font-medium">+2%</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* AI Diagnostics - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">AI Diagnostics</h3>
                  <p className="text-sm text-gray-500">Real-time anomaly detection</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Normal Range</span>
              </div>
            </div>

            {/* Vitals */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Heart Rate</p>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">73</p>
                <p className="text-xs text-gray-500">bpm</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">O₂ Saturation</p>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">99.4</p>
                <p className="text-xs text-gray-500">%</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">BP Systolic</p>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">122</p>
                <p className="text-xs text-gray-500">mmHg</p>
              </div>
            </div>

            {/* Chart Area */}
            <div className="bg-gradient-to-b from-blue-50 to-transparent rounded-lg p-6 mb-4" style={{ height: '200px' }}>
              <svg className="w-full h-full" viewBox="0 0 800 150" preserveAspectRatio="none">
                <path
                  d="M 0,75 Q 100,85 200,80 T 400,65 T 600,70 T 800,75"
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="rgba(59, 130, 246, 0.8)"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* AI Analysis */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">AI Analysis:</span> All vitals within normal parameters. Heart rate variability indicates good cardiovascular health. Continue monitoring.
                </p>
              </div>
            </div>
          </div>

          {/* Blockchain Ledger */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Blockchain Ledger</h3>
                <p className="text-sm text-gray-500">Immutable medical records</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm text-gray-600">Network Status</span>
                <span className="text-sm font-semibold text-green-600">⚫ Synced</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm text-gray-600">Block Height</span>
                <span className="text-sm font-semibold text-gray-900">2,947,639</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Medication Administered</h4>
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mb-2">⏰ 21:52:15</p>
                <p className="text-xs text-gray-600 mb-2 font-mono bg-white p-2 rounded">0xovpewm8jquikv1nv15bv</p>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Verified on chain
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Lab Sample Collected</h4>
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mb-2">⏰ 21:52:07</p>
                <p className="text-xs text-gray-600 mb-2 font-mono bg-white p-2 rounded">0xuxker2stowlumha1e4esg</p>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Verified on chain
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Total Txns</p>
                <p className="text-xl font-bold text-gray-900">7</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Avg Time</p>
                <p className="text-xl font-bold text-gray-900">2.3s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Predictive Workload Analysis */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Predictive Workload Analysis</h3>
                <p className="text-sm text-gray-500">AI-powered ER occupancy forecast</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">High Load</span>
          </div>

          {/* Bar Chart */}
          <div className="mb-6" style={{ height: '200px' }}>
            <div className="flex items-end justify-between h-full gap-4">
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-blue-900 rounded-t-lg" style={{ height: '70%' }}></div>
                <span className="text-xs text-gray-500 mt-2">Now</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-blue-600 rounded-t-lg" style={{ height: '80%' }}></div>
                <span className="text-xs text-gray-500 mt-2">+1h</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-blue-900 rounded-t-lg" style={{ height: '78%' }}></div>
                <span className="text-xs text-gray-500 mt-2">+2h</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-blue-600 rounded-t-lg" style={{ height: '76%' }}></div>
                <span className="text-xs text-gray-500 mt-2">+3h</span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="w-full bg-blue-900 rounded-t-lg" style={{ height: '72%' }}></div>
                <span className="text-xs text-gray-500 mt-2">+4h</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Current ER Occupancy</p>
              <p className="text-3xl font-bold text-gray-900">72<span className="text-lg">%</span></p>
              <p className="text-xs text-gray-500 mt-1">50 beds</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Predicted Peak</p>
              <p className="text-3xl font-bold text-gray-900">82<span className="text-lg">%</span></p>
              <p className="text-xs text-gray-500 mt-1">Expected at +1h</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">AI Recommendation</p>
                  <p className="text-xs text-gray-600">Schedule additional staff for peak hours</p>
                </div>
              </div>
            </div>
          </div>

          {/* Department Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">Cardiology</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">23</p>
              <p className="text-xs text-green-600">↓ 2 from avg</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">Trauma</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">18</p>
              <p className="text-xs text-red-600">↑ 5 from avg</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">Pediatrics</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">12</p>
              <p className="text-xs text-green-600">↓ 1 from avg</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">General</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">32</p>
              <p className="text-xs text-gray-500">→ avg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-900 hover:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
      >
        {isChatOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Widget */}
      {isChatOpen && (
        <div className="fixed bottom-28 right-8 w-96 bg-white rounded-lg shadow-2xl border z-50 flex flex-col" style={{ height: '500px' }}>
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold">AI Health Assistant</h3>
                <p className="text-xs text-blue-100">Medical AI Support</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.sender === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-900 border'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                  <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t bg-white rounded-b-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about diagnostics, blockchain, or analytics..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">AI responses are simulated for demonstration</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
