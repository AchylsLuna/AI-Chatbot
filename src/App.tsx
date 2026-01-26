import { useState } from 'react'
import { LogoMark } from './components/LogoMark'
import { NavBar } from './components/NavBar'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import ContactPage from './pages/ContactPage'
import PatientProfile from './pages/PatientProfile'

type PageType = 'landing' | 'dashboard' | 'contact' | 'patient'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing')

  const navLinks = [
    { label: 'Home', href: '#', onClick: () => setCurrentPage('landing') },
    { label: 'Features', href: '#', onClick: () => {} },
    { label: 'About', href: '#', onClick: () => {} },
    { label: 'Contact', href: '#', onClick: () => setCurrentPage('contact') },
  ]

  // Show different navigation based on current page
  const renderNavBar = () => {
    if (currentPage === 'dashboard' || currentPage === 'patient') {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">The Heath Care</h1>
              <p className="text-xs text-gray-500">Healthcare Intelligence Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'dashboard'
                  ? 'bg-blue-900 text-white hover:bg-blue-800'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentPage('patient')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'patient'
                  ? 'bg-blue-900 text-white hover:bg-blue-800'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Patient Profile
            </button>
          </div>
        </div>
      );
    }

    return (
      <NavBar
        brand={<LogoMark />}
        links={navLinks}
        cta={{ 
          label: 'Launch Platform', 
          href: '#',
          onClick: () => setCurrentPage('dashboard')
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto w-full max-w-7xl px-6 py-4">
          {renderNavBar()}
        </div>
      </header>

      <main>
        {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'contact' && <ContactPage />}
        {currentPage === 'patient' && <PatientProfile />}
      </main>
    </div>
  )
}

export default App
